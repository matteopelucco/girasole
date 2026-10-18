import { analizzaFeedIcal as analizzaMotore } from './calendarioIcalMotore.mjs';

// Sincronizzazione degli eventi del Google Calendar (specs/64 - calendario-eventi.md):
// logica PURA (nessun I/O, nessun accesso al database o alla rete): tipi, errori,
// validazione dell'indirizzo e finestra di tempo. L'analisi del feed è nel motore
// (lib/calendarioIcalMotore.mjs, in JavaScript perché gira anche in un worker che
// si può terminare: lib/calendarioIcalIsolato.ts); rete e database sono in
// lib/calendarioIcalDati.ts.
//
// L'indirizzo del feed è un SEGRETO: nulla qui lo riporta in messaggi o errori.

export { MAX_ITERAZIONI_TOTALI, MAX_EVENTI, MAX_INTERVALLO } from './calendarioIcalMotore.mjs';

export const GIORNI_PASSATO = 30;
export const MESI_FUTURO = 12;
const MS_GIORNO = 86_400_000;

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
  | 'analisi_lenta'
  | 'analisi_incompleta'
  | 'impostazione_non_leggibile'
  | 'salvataggio'
  | 'imprevisto';

const DESCRIZIONE_MOTIVO: Record<MotivoErroreCalendario, string> = {
  indirizzo_non_valido: 'indirizzo non valido',
  non_raggiungibile: 'servizio non raggiungibile',
  risposta_non_valida: 'risposta non valida',
  feed_non_valido: 'feed non valido',
  analisi_lenta: 'analisi del feed troppo lenta',
  analisi_incompleta: 'feed troppo complesso, analisi interrotta dai limiti',
  impostazione_non_leggibile: 'impostazione non leggibile',
  salvataggio: 'salvataggio degli eventi non riuscito',
  imprevisto: 'errore imprevisto',
};

// Vero solo per un motivo dell'elenco fisso (chi costruisce messaggi per l'admin
// non si fida di un valore che potrebbe contenere altro).
export function motivoErroreValido(valore: unknown): valore is MotivoErroreCalendario {
  return typeof valore === 'string' && Object.hasOwn(DESCRIZIONE_MOTIVO, valore);
}

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

// --- Analisi del feed -------------------------------------------------------

export type RisultatoAnalisi = { eventi: EventoCalendario[]; incompleta: boolean };

// Analizza il feed iCal `testo` (nello stesso processo, senza isolamento: per
// l'uso in produzione c'è lib/calendarioIcalIsolato.ts) e ritorna gli eventi
// compresi tra `da` e `a`. `incompleta` è vero se un limite (iterazioni, eventi,
// tempo) ha fermato l'analisi. Lancia ErroreCalendario('feed_non_valido') se il
// testo non è un calendario.
export function analizzaFeedIcal(testo: string, da: Date, a: Date, opzioni?: { budgetMs?: number }): RisultatoAnalisi {
  try {
    return analizzaMotore(testo, da, a, opzioni) as RisultatoAnalisi;
  } catch (errore) {
    // Del motore esce solo il motivo fisso: nulla del contenuto del feed.
    void errore;
    throw new ErroreCalendario('feed_non_valido');
  }
}

// Come analizzaFeedIcal, ma un'analisi incompleta è un errore
// ('analisi_incompleta'): gli eventi salvati non vanno sostituiti con un elenco
// parziale. Risultato ordinato per inizio.
export function espandiEventiIcal(testo: string, da: Date, a: Date, opzioni?: { budgetMs?: number }): EventoCalendario[] {
  const { eventi, incompleta } = analizzaFeedIcal(testo, da, a, opzioni);
  if (incompleta) throw new ErroreCalendario('analisi_incompleta');
  return eventi;
}
