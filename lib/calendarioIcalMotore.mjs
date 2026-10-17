// Motore di analisi del feed iCal (specs/64 - calendario-eventi.md).
//
// File in JavaScript puro (non TypeScript) di proposito: gira anche dentro un
// worker thread (lib/calendarioIcalIsolato.ts, lib/calendarioIcalWorker.mjs) che
// Node carica da disco e che si può terminare allo scadere del tempo. Una regola
// di ripetizione ostile può far restare ical.js bloccato in una sola chiamata,
// che nessun tetto sul numero di passi interrompe: l'unica difesa completa è
// poter uccidere il lavoro. Per questo il file non importa nulla di TypeScript.
//
// Logica PURA (nessun I/O, nessuna rete, nessun database). L'indirizzo del feed
// non arriva mai qui e nulla riporta il contenuto del feed in un errore.
import ICAL from 'ical.js';
import { VTIMEZONE_ROMA } from './calendarioFusoRoma.mjs';

const FUSO = 'Europe/Rome';

// Limiti di sicurezza (titolo/descrizione/luogo = vincoli di `calendario_eventi`,
// migration 0065).
export const MAX_EVENTI = 5000;
export const MAX_ITERAZIONI_SERIE = 20000;
// Tetto sulle iterazioni di tutte le serie del feed insieme.
export const MAX_ITERAZIONI_TOTALI = 50_000;
export const MAX_BLOCCHI_EVENTO = 20_000;
export const MAX_INTERVALLO = 1000;
// Tempo massimo dell'analisi, controllato prima di ogni serie e ogni 256 passi
// (il worker lo rafforza uccidendo il lavoro: lib/calendarioIcalIsolato.ts).
export const BUDGET_ANALISI_MS = 4000;
const MAX_TITOLO = 300;
const MAX_DESCRIZIONE = 5000;
const MAX_LUOGO = 500;
const TITOLO_VUOTO = '(senza titolo)';
// Un'occorrenza spostata in avanti rispetto all'originale compare comunque se
// l'originale è poco oltre la finestra: si guarda questi giorni in più.
const MARGINE_GIORNI = 14;
const MS_GIORNO = 86_400_000;

// Frequenze espanse: le ripetizioni più fitte (ogni secondo, minuto, ora) non
// servono a un calendario scolastico e sono costose da calcolare.
const FREQUENZE_ESPANSE = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
// Per DAILY e WEEKLY queste parti rendono possibili regole impossibili (es.
// "ogni giorno del 30 febbraio") in cui ical.js non termina mai.
const PARTI_NON_AMMESSE_GIORNALIERE = ['BYMONTHDAY', 'BYYEARDAY', 'BYWEEKNO', 'BYSETPOS'];
const GIORNO_SEMPLICE = /^(MO|TU|WE|TH|FR|SA|SU)$/;

/** Errore del motore: `motivo` è sempre 'feed_non_valido'. */
export class ErroreMotore extends Error {
  /** @param {string} motivo */
  constructor(motivo) {
    super(motivo);
    this.name = 'ErroreMotore';
    this.motivo = motivo;
  }
}

/**
 * @typedef {{
 *   id_esterno: string, titolo: string, descrizione: string | null, luogo: string | null,
 *   inizio: string, fine: string, tutto_il_giorno: boolean
 * }} EventoCalendario
 * @typedef {{ eventi: EventoCalendario[], incompleta: boolean }} RisultatoAnalisi
 */

// Estrae i blocchi VEVENT in tempo lineare (indexOf, niente espressioni
// regolari): un feed enorme o malformato non può rallentare l'analisi. Se dopo
// un BEGIN:VEVENT non c'è l'END, si smette di cercare.
/** @param {string} testo */
export function estraiBlocchiEvento(testo) {
  const INIZIO = 'BEGIN:VEVENT';
  const FINE = 'END:VEVENT';
  const blocchi = [];
  const resto = [];
  let posizione = 0;
  let cerca = 0;
  while (cerca < testo.length) {
    const inizio = testo.indexOf(INIZIO, cerca);
    if (inizio < 0) break;
    if (inizio > 0 && testo[inizio - 1] !== '\n') {
      cerca = inizio + INIZIO.length;
      continue;
    }
    const fine = testo.indexOf(FINE, inizio + INIZIO.length);
    if (fine < 0) break;
    const finale = fine + FINE.length;
    blocchi.push(testo.slice(inizio, finale));
    resto.push(testo.slice(posizione, inizio));
    posizione = finale;
    cerca = finale;
    if (blocchi.length > MAX_BLOCCHI_EVENTO) break;
  }
  resto.push(testo.slice(posizione));
  return { blocchi, intestazione: resto.join('') };
}

function registraFusi(calendario) {
  ICAL.TimezoneService.reset();
  for (const vtimezone of calendario.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(new ICAL.Timezone(vtimezone));
    } catch {
      // un fuso illeggibile non ferma il feed: gli eventi che lo usano
      // ricadono sul ripiego (Europe/Rome) sotto.
    }
  }
  if (!ICAL.TimezoneService.has(FUSO)) {
    ICAL.TimezoneService.register(new ICAL.Timezone(new ICAL.Component(ICAL.parse(VTIMEZONE_ROMA))));
  }
}

// Orario "a muro" di Europe/Rome -> istante.
function daOrarioRoma({ year, month, day, hour, minute, second }) {
  const roma = new ICAL.Time({ year, month, day, hour, minute, second, isDate: false }, ICAL.TimezoneService.get(FUSO));
  return roma.toJSDate();
}

// ICAL.Time -> istante. Tutto il giorno: mezzanotte di Roma; orario senza fuso
// ("fluttuante"): ora di Roma; altrimenti l'istante indicato dal feed.
function aIstante(t) {
  if (t.isDate) return daOrarioRoma({ year: t.year, month: t.month, day: t.day, hour: 0, minute: 0, second: 0 });
  if (!t.zone || t.zone.tzid === 'floating') {
    return daOrarioRoma({ year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second });
  }
  return t.toJSDate();
}

function troncato(testo, massimo) {
  const caratteri = Array.from(testo);
  return caratteri.length > massimo ? caratteri.slice(0, massimo).join('') : testo;
}

function testoOpzionale(valore, massimo) {
  if (typeof valore !== 'string') return null;
  const pulito = valore.trim();
  return pulito === '' ? null : troncato(pulito, massimo);
}

function annullato(evento) {
  const stato = evento.component.getFirstPropertyValue('status');
  return typeof stato === 'string' && stato.toUpperCase() === 'CANCELLED';
}

function identificativoOccorrenza(t) {
  if (t.isDate) return t.toString();
  return aIstante(t).toISOString();
}

function costruisci(c, da, a) {
  if (annullato(c.evento)) return null;
  const tuttoIlGiorno = c.inizio.isDate;
  const inizio = aIstante(c.inizio);
  let fine = c.fine ? aIstante(c.fine) : inizio;
  if (fine.getTime() < inizio.getTime()) fine = inizio;
  if (tuttoIlGiorno && fine.getTime() <= inizio.getTime()) {
    // Senza fine, un evento di tutto il giorno dura quel giorno.
    const dopo = c.inizio.clone();
    dopo.adjust(1, 0, 0, 0);
    fine = aIstante(dopo);
  }
  if (fine.getTime() < da.getTime() || inizio.getTime() >= a.getTime()) return null;

  return {
    id_esterno: c.id,
    titolo: testoOpzionale(c.evento.summary, MAX_TITOLO) ?? TITOLO_VUOTO,
    descrizione: testoOpzionale(c.evento.description, MAX_DESCRIZIONE),
    luogo: testoOpzionale(c.evento.location, MAX_LUOGO),
    inizio: inizio.toISOString(),
    fine: fine.toISOString(),
    tutto_il_giorno: tuttoIlGiorno,
  };
}

const ha = (parti, nome) =>
  parti[nome] !== undefined && parti[nome] !== null && !(Array.isArray(parti[nome]) && parti[nome].length === 0);

// Vero se la regola di ripetizione si può espandere senza rischi. Una serie con
// più RRULE si salta se anche una sola è esclusa. Nessuna RRULE (solo RDATE) è
// sempre espandibile: l'elenco è finito. Regole escluse (ical.js può restare
// bloccato in una sola chiamata, vedi la nota in testa al file):
//   * frequenze diverse da DAILY/WEEKLY/MONTHLY/YEARLY;
//   * INTERVAL oltre MAX_INTERVALLO;
//   * DAILY/WEEKLY: BYMONTHDAY, BYYEARDAY, BYWEEKNO, BYSETPOS; BYDAY solo con
//     giorni semplici (niente "1MO", "-1FR"); con INTERVAL > 1 anche BYMONTH
//     (e, per DAILY, BYDAY: un passo che non incontra mai il giorno);
//   * YEARLY con BYSETPOS.
function serieEspandibile(evento) {
  try {
    for (const proprieta of evento.component.getAllProperties('rrule')) {
      const regola = proprieta.getFirstValue();
      if (!regola || typeof regola !== 'object' || !('freq' in regola)) return false;
      const freq = String(regola.freq).toUpperCase();
      if (!FREQUENZE_ESPANSE.includes(freq)) return false;
      const parti = regola.parts ?? {};
      const intervallo = Number(regola.interval ?? 1);
      if (!Number.isFinite(intervallo) || intervallo < 1 || intervallo > MAX_INTERVALLO) return false;
      if (freq === 'DAILY' || freq === 'WEEKLY') {
        if (PARTI_NON_AMMESSE_GIORNALIERE.some((nome) => ha(parti, nome))) return false;
        const giorni = parti.BYDAY ?? [];
        if (!Array.isArray(giorni) || giorni.some((g) => !GIORNO_SEMPLICE.test(String(g)))) return false;
        if (intervallo > 1 && ha(parti, 'BYMONTH')) return false;
        if (freq === 'DAILY' && intervallo > 1 && giorni.length > 0) return false;
      }
      if (freq === 'YEARLY' && ha(parti, 'BYSETPOS')) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function fineEvento(evento) {
  try {
    return evento.endDate ?? null;
  } catch {
    return null;
  }
}

/**
 * Espande il feed iCal `testo` negli eventi compresi tra `da` e `a`
 * (specs/64, Regole). Lancia ErroreMotore('feed_non_valido') se il testo non è
 * un calendario. `incompleta` è vero se un limite (iterazioni, eventi, tempo) ha
 * fermato l'analisi prima della fine: chi chiama non deve sostituire gli eventi
 * salvati con un elenco parziale.
 * @param {string} testo
 * @param {Date} da
 * @param {Date} a
 * @param {{ budgetMs?: number }} [opzioni]
 * @returns {RisultatoAnalisi}
 */
export function analizzaFeedIcal(testo, da, a, { budgetMs = BUDGET_ANALISI_MS } = {}) {
  const scadenza = Date.now() + budgetMs;
  const scaduto = () => Date.now() > scadenza;
  let incompleta = false;

  // Ogni VEVENT è letto da solo: una regola malformata (che ical.js rifiuta già
  // in lettura) fa saltare solo quell'evento, non tutto il feed. Il resto del
  // calendario (intestazione e fusi orari) deve invece essere valido.
  const { blocchi, intestazione } = estraiBlocchiEvento(testo);
  if (blocchi.length > MAX_BLOCCHI_EVENTO) {
    blocchi.length = MAX_BLOCCHI_EVENTO;
    incompleta = true;
  }
  let calendario;
  try {
    calendario = new ICAL.Component(ICAL.parse(intestazione));
    if (calendario.name !== 'vcalendar') throw new Error('non è un calendario');
    registraFusi(calendario);
  } catch {
    throw new ErroreMotore('feed_non_valido');
  }

  const componenti = [];
  for (const blocco of blocchi) {
    if (scaduto()) {
      incompleta = true;
      break;
    }
    try {
      componenti.push(new ICAL.Component(ICAL.parse(blocco)));
    } catch {
      // evento illeggibile: saltato
    }
  }

  try {
    const risultato = espandi(componenti, da, a, scaduto);
    return { eventi: risultato.eventi, incompleta: incompleta || risultato.incompleta };
  } catch (errore) {
    if (errore instanceof ErroreMotore) throw errore;
    throw new ErroreMotore('feed_non_valido');
  }
}

function espandi(componenti, da, a, scaduto) {
  let incompleta = false;
  const principali = new Map();
  const eccezioni = [];
  for (const componente of componenti) {
    let evento;
    try {
      evento = new ICAL.Event(componente);
      if (!evento.uid || !evento.startDate) continue;
    } catch {
      continue; // evento malformato: si salta, gli altri restano
    }
    if (evento.isRecurrenceException()) eccezioni.push(evento);
    else principali.set(evento.uid, evento);
  }

  const limiteIterazione = new Date(a.getTime() + MARGINE_GIORNI * MS_GIORNO);

  // Eccezioni con la serie nel feed: relazionate alla serie.
  const orfane = [];
  for (const eccezione of eccezioni) {
    const principale = principali.get(eccezione.uid);
    if (principale) principale.relateException(eccezione);
    else orfane.push(eccezione);
  }

  const risultato = new Map();
  // Un evento malformato si salta, gli altri restano.
  const aggiungi = (candidato) => {
    try {
      const evento = costruisci(candidato, da, a);
      if (evento) risultato.set(evento.id_esterno, evento);
    } catch {
      // saltato
    }
  };
  let iterazioniTotali = 0;

  for (const [uid, evento] of principali) {
    if (risultato.size >= MAX_EVENTI || iterazioniTotali >= MAX_ITERAZIONI_TOTALI || scaduto()) {
      incompleta = true;
      break;
    }
    if (!evento.isRecurring()) {
      aggiungi({ evento, id: uid, inizio: evento.startDate, fine: fineEvento(evento) });
      continue;
    }
    if (annullato(evento) || !serieEspandibile(evento)) continue;
    // Una serie malformata salta solo se stessa, non tutto il feed.
    try {
      const iteratore = evento.iterator();
      let passi = 0;
      for (let t = iteratore.next(); t; t = iteratore.next()) {
        if (++passi > MAX_ITERAZIONI_SERIE || ++iterazioniTotali > MAX_ITERAZIONI_TOTALI) {
          incompleta = true;
          break;
        }
        if (passi % 256 === 0 && scaduto()) {
          incompleta = true;
          break;
        }
        if (aIstante(t).getTime() > limiteIterazione.getTime()) break;
        const dettagli = evento.getOccurrenceDetails(t);
        aggiungi({
          evento: dettagli.item,
          id: `${uid}#${identificativoOccorrenza(dettagli.recurrenceId)}`,
          inizio: dettagli.startDate,
          fine: dettagli.endDate,
        });
        if (risultato.size >= MAX_EVENTI) {
          incompleta = true;
          break;
        }
      }
    } catch {
      continue;
    }
  }

  // Occorrenze modificate senza la serie nel feed: eventi a sé.
  for (const evento of orfane) {
    if (risultato.size >= MAX_EVENTI) {
      incompleta = true;
      break;
    }
    try {
      aggiungi({
        evento,
        id: `${evento.uid}#${identificativoOccorrenza(evento.recurrenceId)}`,
        inizio: evento.startDate,
        fine: fineEvento(evento),
      });
    } catch {
      continue; // identificativo non calcolabile: evento saltato
    }
  }

  const eventi = Array.from(risultato.values())
    .sort((x, y) => x.inizio.localeCompare(y.inizio) || x.id_esterno.localeCompare(y.id_esterno))
    .slice(0, MAX_EVENTI);
  return { eventi, incompleta };
}
