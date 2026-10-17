import ICAL from 'ical.js';
import { VTIMEZONE_ROMA } from './calendarioFusoRoma';

// Sincronizzazione degli eventi del Google Calendar (specs/64 - calendario-eventi.md):
// logica PURA (nessun I/O, nessun accesso al database o alla rete). Dal testo di
// un feed iCal ricava gli eventi, già espansi, compresi in una finestra di
// tempo. Rete e database sono in lib/calendarioIcalDati.ts.
//
// L'indirizzo del feed è un SEGRETO: nulla qui lo riporta in messaggi o errori.

const FUSO = 'Europe/Rome';

export const GIORNI_PASSATO = 30;
export const MESI_FUTURO = 12;

// Limiti di sicurezza: un feed enorme o una ripetizione senza fine non devono
// bloccare il job. Titolo/descrizione/luogo corrispondono ai vincoli della
// tabella `calendario_eventi` (migration 0065).
const MAX_EVENTI = 5000;
const MAX_ITERAZIONI_SERIE = 20000;
// Tetto sulle iterazioni di tutte le serie del feed insieme.
export const MAX_ITERAZIONI_TOTALI = 50_000;
// Frequenze espanse: le ripetizioni più fitte (ogni secondo, minuto, ora) non
// servono a un calendario scolastico e sono costose da calcolare.
const FREQUENZE_ESPANSE = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
// Per DAILY e WEEKLY queste parti rendono possibili regole impossibili (es.
// "ogni giorno del 30 febbraio") in cui ical.js non termina mai: la serie si salta.
const PARTI_NON_AMMESSE_GIORNALIERE = ['BYMONTHDAY', 'BYYEARDAY', 'BYWEEKNO', 'BYSETPOS'];
const MAX_TITOLO = 300;
const MAX_DESCRIZIONE = 5000;
const MAX_LUOGO = 500;
const TITOLO_VUOTO = '(senza titolo)';
// Un'occorrenza spostata in avanti rispetto all'originale compare comunque se
// l'originale è poco oltre la finestra: si guarda questi giorni in più.
const MARGINE_GIORNI = 14;
const MS_GIORNO = 86_400_000;
const BLOCCO_EVENTO = /BEGIN:VEVENT\r?\n[\s\S]*?\r?\nEND:VEVENT[ \t]*(?:\r?\n|$)/g;

export type EventoCalendario = {
  // UID dell'evento nel feed; per le occorrenze di un evento ripetuto anche
  // l'occorrenza originale ("uid#2026-10-27T09:00:00Z"): uno spostamento
  // aggiorna la stessa riga.
  id_esterno: string;
  titolo: string;
  descrizione: string | null;
  luogo: string | null;
  // Istanti ISO (UTC). Tutto il giorno: mezzanotte Europe/Rome del primo giorno
  // e del giorno dopo l'ultimo (fine esclusa).
  inizio: string;
  fine: string;
  tutto_il_giorno: boolean;
};

// --- Errori e messaggi (mai l'indirizzo del feed) ---------------------------

export type MotivoErroreCalendario =
  | 'indirizzo_non_valido'
  | 'non_raggiungibile'
  | 'risposta_non_valida'
  | 'feed_non_valido'
  | 'impostazione_non_leggibile'
  | 'salvataggio'
  | 'imprevisto';

const DESCRIZIONE_MOTIVO: Record<MotivoErroreCalendario, string> = {
  indirizzo_non_valido: 'indirizzo non valido',
  non_raggiungibile: 'servizio non raggiungibile',
  risposta_non_valida: 'risposta non valida',
  feed_non_valido: 'feed non valido',
  impostazione_non_leggibile: 'impostazione non leggibile',
  salvataggio: 'salvataggio degli eventi non riuscito',
  imprevisto: 'errore imprevisto',
};

// Errore con un motivo scelto da un elenco fisso: il messaggio non contiene
// nulla del feed né dell'indirizzo.
export class ErroreCalendario extends Error {
  readonly motivo: MotivoErroreCalendario;
  constructor(motivo: MotivoErroreCalendario) {
    super(DESCRIZIONE_MOTIVO[motivo]);
    this.name = 'ErroreCalendario';
    this.motivo = motivo;
  }
}

// Frase mostrata nel registro "Cron Job" (specs/63).
export function problemaCalendario(motivo: MotivoErroreCalendario): string {
  return `Calendario non sincronizzato: ${DESCRIZIONE_MOTIVO[motivo]}.`;
}

// Esito del passo di sincronizzazione del cron (la risposta del cron lo riporta
// così com'è: niente titoli, niente indirizzo).
export type RisultatoSincronizzazione =
  | { stato: 'disattivata' }
  | { stato: 'ok'; inseriti: number; aggiornati: number; rimossi: number; totale: number }
  | { stato: 'errore'; motivo: MotivoErroreCalendario };

// Frase per il registro "Cron Job" (specs/63): null se non c'è un problema
// (sincronizzazione riuscita o disattivata).
export function problemaSincronizzazione(risultato: RisultatoSincronizzazione): string | null {
  return risultato.stato === 'errore' ? problemaCalendario(risultato.motivo) : null;
}

// Unisce i problemi di più parti dello stesso lancio (nessuno = null).
export function unisciProblemi(...problemi: (string | null | undefined)[]): string | null {
  const presenti = problemi.filter((p): p is string => Boolean(p));
  return presenti.length ? presenti.join(' ') : null;
}

// --- Indirizzo del feed -----------------------------------------------------

export const MESSAGGIO_INDIRIZZO_NON_VALIDO =
  "Questo non è un indirizzo iCal di Google Calendar valido: deve iniziare con https://, essere di Google Calendar e finire con .ics.";

const HOST_GOOGLE = ['calendar.google.com', 'www.google.com'];
const LUNGHEZZA_MASSIMA_INDIRIZZO = 2000;
const ORIGINE_PROVA = /^http:\/\/127\.0\.0\.1:\d{2,5}$/;

export type AmbienteIndirizzo = { CALENDARIO_ICAL_PROVA_ORIGINE?: string; VERCEL_ENV?: string; VERCEL?: string };

export type EsitoIndirizzo = { ok: true; indirizzo: string | null } | { ok: false; messaggio: string };

// Valida l'indirizzo del feed (specs/64, Regole): solo https, nessuna
// credenziale né porta, host di Google, percorso che finisce con .ics. Il campo
// vuoto è valido e vale "sincronizzazione disattivata" (indirizzo = null).
// Per i test e2e è ammessa anche l'origine locale in `ambiente`
// (CALENDARIO_ICAL_PROVA_ORIGINE), ignorata in produzione. Il messaggio
// d'errore è fisso: non riporta mai ciò che è stato digitato.
export function validaIndirizzoIcal(valore: string, ambiente: AmbienteIndirizzo = {}): EsitoIndirizzo {
  const indirizzo = valore.trim();
  if (indirizzo === '') return { ok: true, indirizzo: null };
  const nonValido: EsitoIndirizzo = { ok: false, messaggio: MESSAGGIO_INDIRIZZO_NON_VALIDO };
  if (indirizzo.length > LUNGHEZZA_MASSIMA_INDIRIZZO || /\s/.test(indirizzo)) return nonValido;

  let url: URL;
  try {
    url = new URL(indirizzo);
  } catch {
    return nonValido;
  }
  if (url.username || url.password || url.hash || !url.pathname.toLowerCase().endsWith('.ics')) return nonValido;

  const provaAmmessa =
    ambiente.VERCEL_ENV !== 'production' &&
    !ambiente.VERCEL &&
    typeof ambiente.CALENDARIO_ICAL_PROVA_ORIGINE === 'string' &&
    ORIGINE_PROVA.test(ambiente.CALENDARIO_ICAL_PROVA_ORIGINE) &&
    url.origin === ambiente.CALENDARIO_ICAL_PROVA_ORIGINE;
  if (provaAmmessa) return { ok: true, indirizzo };

  if (url.protocol !== 'https:' || url.port !== '' || !HOST_GOOGLE.includes(url.hostname)) return nonValido;
  return { ok: true, indirizzo };
}

// --- Finestra di tempo ------------------------------------------------------

// Da 30 giorni prima a 12 mesi dopo `adesso`.
export function finestraSincronizzazione(adesso: Date): { da: Date; a: Date } {
  const da = new Date(adesso.getTime() - GIORNI_PASSATO * MS_GIORNO);
  const a = new Date(adesso.getTime());
  a.setUTCMonth(a.getUTCMonth() + MESI_FUTURO);
  return { da, a };
}

// --- Espansione del feed ----------------------------------------------------

type Tempo = InstanceType<typeof ICAL.Time>;
type Evento = InstanceType<typeof ICAL.Event>;

function registraFusi(calendario: InstanceType<typeof ICAL.Component>): void {
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
type OrarioAMuro = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function daOrarioRoma({ year, month, day, hour, minute, second }: OrarioAMuro): Date {
  const roma = new ICAL.Time({ year, month, day, hour, minute, second, isDate: false }, ICAL.TimezoneService.get(FUSO));
  return roma.toJSDate();
}

// ICAL.Time -> istante. Tutto il giorno: mezzanotte di Roma; orario senza fuso
// ("fluttuante"): ora di Roma; altrimenti l'istante indicato dal feed.
function aIstante(t: Tempo): Date {
  if (t.isDate) return daOrarioRoma({ year: t.year, month: t.month, day: t.day, hour: 0, minute: 0, second: 0 });
  if (!t.zone || t.zone.tzid === 'floating') {
    return daOrarioRoma({ year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second });
  }
  return t.toJSDate();
}

function troncato(testo: string, massimo: number): string {
  const caratteri = Array.from(testo);
  return caratteri.length > massimo ? caratteri.slice(0, massimo).join('') : testo;
}

function testoOpzionale(valore: unknown, massimo: number): string | null {
  if (typeof valore !== 'string') return null;
  const pulito = valore.trim();
  return pulito === '' ? null : troncato(pulito, massimo);
}

function annullato(evento: Evento): boolean {
  const stato = evento.component.getFirstPropertyValue('status');
  return typeof stato === 'string' && stato.toUpperCase() === 'CANCELLED';
}

function identificativoOccorrenza(t: Tempo): string {
  if (t.isDate) return t.toString();
  return aIstante(t).toISOString();
}

type Candidato = { evento: Evento; id: string; inizio: Tempo; fine: Tempo | null };

function costruisci(c: Candidato, da: Date, a: Date): EventoCalendario | null {
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

// Vero se la regola di ripetizione si può espandere senza rischi (vedi
// FREQUENZE_ESPANSE e PARTI_NON_AMMESSE_GIORNALIERE). Nessuna RRULE (solo RDATE)
// è sempre espandibile: l'elenco è finito.
function serieEspandibile(evento: Evento): boolean {
  try {
    for (const proprieta of evento.component.getAllProperties('rrule')) {
      const regola = proprieta.getFirstValue();
      if (!regola || typeof regola !== 'object' || !('freq' in regola)) return false;
      const freq = String((regola as { freq: unknown }).freq).toUpperCase();
      if (!FREQUENZE_ESPANSE.includes(freq)) return false;
      if (freq === 'DAILY' || freq === 'WEEKLY') {
        const parti = (regola as { parts?: Record<string, unknown> }).parts ?? {};
        if (PARTI_NON_AMMESSE_GIORNALIERE.some((nome) => parti[nome] !== undefined)) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function fineEvento(evento: Evento): Tempo | null {
  try {
    return evento.endDate ?? null;
  } catch {
    return null;
  }
}

// Espande il feed iCal `testo` negli eventi compresi tra `da` e `a`. Lancia
// ErroreCalendario('feed_non_valido') se il testo non è un calendario. Gli
// eventi ripetuti (RRULE, EXDATE) sono espansi una riga per occorrenza; le
// occorrenze spostate o modificate (RECURRENCE-ID) sostituiscono l'originale;
// gli annullati (STATUS:CANCELLED) non compaiono. Risultato ordinato per inizio.
export function espandiEventiIcal(testo: string, da: Date, a: Date): EventoCalendario[] {
  // Ogni VEVENT è letto da solo: una regola malformata (che ical.js rifiuta già
  // in lettura) fa saltare solo quell'evento, non tutto il feed. Il resto del
  // calendario (intestazione e fusi orari) deve invece essere valido.
  const blocchi = testo.match(BLOCCO_EVENTO) ?? [];
  let calendario: InstanceType<typeof ICAL.Component>;
  try {
    calendario = new ICAL.Component(ICAL.parse(testo.replace(BLOCCO_EVENTO, '')));
    if (calendario.name !== 'vcalendar') throw new Error('non è un calendario');
    registraFusi(calendario);
  } catch {
    throw new ErroreCalendario('feed_non_valido');
  }

  const componenti: InstanceType<typeof ICAL.Component>[] = [];
  for (const blocco of blocchi) {
    try {
      componenti.push(new ICAL.Component(ICAL.parse(blocco)));
    } catch {
      // evento illeggibile: saltato
    }
  }

  try {
    return espandi(componenti, da, a);
  } catch (errore) {
    if (errore instanceof ErroreCalendario) throw errore;
    throw new ErroreCalendario('feed_non_valido');
  }
}

function espandi(componenti: InstanceType<typeof ICAL.Component>[], da: Date, a: Date): EventoCalendario[] {
  const principali = new Map<string, Evento>();
  const eccezioni: Evento[] = [];
  for (const componente of componenti) {
    let evento: Evento;
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
  const orfane: Evento[] = [];
  for (const eccezione of eccezioni) {
    const principale = principali.get(eccezione.uid);
    if (principale) principale.relateException(eccezione);
    else orfane.push(eccezione);
  }

  const risultato = new Map<string, EventoCalendario>();
  // Un evento malformato si salta, gli altri restano.
  const aggiungi = (candidato: Candidato) => {
    try {
      const evento = costruisci(candidato, da, a);
      if (evento) risultato.set(evento.id_esterno, evento);
    } catch {
      // saltato
    }
  };
  let iterazioniTotali = 0;

  for (const [uid, evento] of principali) {
    if (risultato.size >= MAX_EVENTI || iterazioniTotali >= MAX_ITERAZIONI_TOTALI) break;
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
        if (++passi > MAX_ITERAZIONI_SERIE || ++iterazioniTotali > MAX_ITERAZIONI_TOTALI) break;
        if (aIstante(t).getTime() > limiteIterazione.getTime()) break;
        const dettagli = evento.getOccurrenceDetails(t);
        aggiungi({
          evento: dettagli.item,
          id: `${uid}#${identificativoOccorrenza(dettagli.recurrenceId)}`,
          inizio: dettagli.startDate,
          fine: dettagli.endDate,
        });
        if (risultato.size >= MAX_EVENTI) break;
      }
    } catch {
      continue;
    }
  }

  // Occorrenze modificate senza la serie nel feed: eventi a sé.
  for (const evento of orfane) {
    if (risultato.size >= MAX_EVENTI) break;
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

  return Array.from(risultato.values())
    .sort((x, y) => x.inizio.localeCompare(y.inizio) || x.id_esterno.localeCompare(y.id_esterno))
    .slice(0, MAX_EVENTI);
}
