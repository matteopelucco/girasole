import { formattaDataOraItaliana } from './date';

// Registro dei lanci dei job pianificati (specs/63 - cron-job.md): logica
// pura (nessun I/O). Lettura e scrittura su Supabase sono in
// lib/cronEsecuzioniDati.ts.

// Job registrati, nell'ordine dei blocchi della pagina. `nome` è il nome della
// route in app/api/cron/ ed è il valore di `cron_esecuzioni.nome`.
export const CRON_JOB = [
  {
    nome: 'report-presenze',
    titolo: 'Report notturno',
    descrizione: 'Ogni notte, poco dopo mezzanotte: email con i report di presenze e pasti (specs/52).',
  },
  {
    nome: 'allarmi',
    titolo: 'Riepilogo allarmi',
    descrizione: 'Ogni giorno, dopo le 10:00: email di riepilogo dei controlli, se qualcosa è da sistemare (specs/07).',
  },
] as const;

export type NomeCron = (typeof CRON_JOB)[number]['nome'];
export type LimitiCron = Record<NomeCron, number>;

export const LANCI_PER_PAGINA = 20;
export const LIMITE_MASSIMO = 500;
export const MINUTI_PRIMA_DI_INTERROTTO = 15;
export const LUNGHEZZA_MASSIMA_MESSAGGIO = 300;
export const PERCORSO_CRON_JOB = '/admin/cron-job';

export type RigaCronEsecuzione = {
  id: string;
  nome: string;
  iniziato_il: string;
  finito_il: string | null;
  esito: 'ok' | 'ko' | null;
  messaggio_errore: string | null;
  // Vero per i lanci avviati a mano dall'admin (migration 0064, issue #302).
  estemporaneo: boolean;
};

export type GruppoCron = {
  nome: NomeCron;
  titolo: string;
  descrizione: string;
  lanci: RigaCronEsecuzione[];
  // Vero se nel registro ci sono lanci più vecchi di quelli mostrati.
  altri: boolean;
};

// Quanti lanci mostrare per ogni job, dalla query string (`?allarmi=40`):
// multipli di 20, tra 20 e LIMITE_MASSIMO; un valore non valido vale 20.
export function limitiDaParametri(parametri: Record<string, string | string[] | undefined>): LimitiCron {
  const limiti = {} as LimitiCron;
  for (const { nome } of CRON_JOB) {
    const grezzo = parametri[nome];
    const valore = Array.isArray(grezzo) ? grezzo[0] : grezzo;
    const numero = valore && /^\d+$/.test(valore) ? Number(valore) : 0;
    const multiplo = Math.floor(numero / LANCI_PER_PAGINA) * LANCI_PER_PAGINA;
    limiti[nome] = Math.min(LIMITE_MASSIMO, Math.max(LANCI_PER_PAGINA, multiplo));
  }
  return limiti;
}

// Link di "Carica altri" per un job: 20 lanci in più per quel job, gli altri
// conservano il limite che avevano (solo quelli diversi da 20 finiscono nella
// query string).
export function hrefCaricaAltri(nome: NomeCron, limiti: LimitiCron): string {
  const query = new URLSearchParams();
  for (const job of CRON_JOB) {
    const limite = job.nome === nome ? Math.min(LIMITE_MASSIMO, limiti[job.nome] + LANCI_PER_PAGINA) : limiti[job.nome];
    if (limite !== LANCI_PER_PAGINA) query.set(job.nome, String(limite));
  }
  const stringa = query.toString();
  return stringa ? `${PERCORSO_CRON_JOB}?${stringa}` : PERCORSO_CRON_JOB;
}

// Raggruppa le righe lette dal registro per job, nell'ordine di CRON_JOB, dal
// lancio più recente; ogni job mostra al più il suo limite. Chi legge chiede
// limite + 1 righe per job: se arrivano, ci sono altri lanci da caricare.
export function gruppiCron(righe: RigaCronEsecuzione[], limiti: LimitiCron): GruppoCron[] {
  return CRON_JOB.map(({ nome, titolo, descrizione }) => {
    const delJob = righe
      .filter((r) => r.nome === nome)
      .sort((a, b) => new Date(b.iniziato_il).getTime() - new Date(a.iniziato_il).getTime());
    return { nome, titolo, descrizione, lanci: delJob.slice(0, limiti[nome]), altri: delJob.length > limiti[nome] };
  });
}

export type StatoLancio = { stato: 'OK' | 'KO' | 'In corso'; messaggio: string | null };

// Stato mostrato per un lancio. Senza esito il lancio è "In corso" per 15
// minuti (i cron durano pochi secondi), poi è considerato interrotto (es.
// timeout della funzione): KO.
export function statoLancio(riga: RigaCronEsecuzione, adesso: Date): StatoLancio {
  if (riga.esito === 'ok') return { stato: 'OK', messaggio: null };
  if (riga.esito === 'ko') return { stato: 'KO', messaggio: riga.messaggio_errore || 'Nessun dettaglio disponibile.' };
  const minuti = (adesso.getTime() - new Date(riga.iniziato_il).getTime()) / 60_000;
  if (minuti < MINUTI_PRIMA_DI_INTERROTTO) return { stato: 'In corso', messaggio: null };
  return { stato: 'KO', messaggio: 'Esecuzione interrotta: nessun esito registrato.' };
}

// Tag mostrato accanto a un lancio: solo i lanci a mano lo hanno.
export function etichettaLancio(riga: Pick<RigaCronEsecuzione, 'estemporaneo'>): 'estemporaneo' | null {
  return riga.estemporaneo ? 'estemporaneo' : null;
}

// --- Lancio a mano (specs/63, "Lancio a mano"; issue #302) -----------------

export const MESSAGGIO_CONFERMA_LANCIO = 'Questo lancio invia davvero le email. Procedere?';
export const MESSAGGIO_GIA_IN_CORSO = 'È già in corso un lancio di questo job: attendi che finisca.';
export const MESSAGGIO_REGISTRO_NON_LEGGIBILE =
  'Non è stato possibile controllare se il job è già in corso: lancio non avviato. Riprova più tardi.';
export const MESSAGGIO_JOB_SCONOSCIUTO = 'Job non riconosciuto: lancio non avviato.';

// Esito di un lancio a mano, mostrato all'admin: 'rifiutato' = il job non è
// partito (già in corso, registro non leggibile, nome non valido).
export type EsitoLancioManuale =
  | { stato: 'OK' }
  | { stato: 'KO'; messaggio: string }
  | { stato: 'rifiutato'; messaggio: string };

// Il nome arriva dal browser: si accettano solo i job dell'elenco.
export function nomeCronValido(valore: unknown): valore is NomeCron {
  return typeof valore === 'string' && CRON_JOB.some((job) => job.nome === valore);
}

// Inizio della finestra in cui un lancio senza esito è ancora "In corso".
export function inizioFinestraInCorso(adesso: Date): string {
  return new Date(adesso.getTime() - MINUTI_PRIMA_DI_INTERROTTO * 60_000).toISOString();
}

// Vero se c'è un lancio del job (pianificato o a mano) ancora "In corso",
// con la stessa regola mostrata nella pagina (statoLancio): un solo lancio
// alla volta per job.
export function lancioInCorso(righe: RigaCronEsecuzione[], nome: NomeCron, adesso: Date): boolean {
  return righe.some((r) => r.nome === nome && statoLancio(r, adesso).stato === 'In corso');
}

// Esito di un lancio a mano finito: OK, oppure KO con la frase fissa che
// descrive la parte non riuscita (stessa regola del registro).
export function esitoLancioManuale(problema: string | null | undefined): EsitoLancioManuale {
  return problema ? { stato: 'KO', messaggio: problema } : { stato: 'OK' };
}

// Esito di un lancio a mano il cui lavoro ha sollevato un errore: KO con il
// messaggio ripulito (mai lo stack, chiavi, token o email).
export function esitoLancioFallito(errore: unknown): EsitoLancioManuale {
  return { stato: 'KO', messaggio: messaggioErroreSicuro(errore) };
}

// "gg/mm/aaaa alle hh:mm" nel fuso Europe/Rome.
export function formattaInizioLancio(istante: string): string {
  const [data, ora] = formattaDataOraItaliana(istante).split('_');
  return `${data} alle ${ora}`;
}

const NASCOSTO = '[nascosto]';

// Messaggio di errore da registrare: solo il testo (mai lo stack), solo la
// prima riga, senza email, token Bearer, JWT o stringhe lunghe simili a
// chiavi, al massimo 300 caratteri (specs/63, Regole).
export function messaggioErroreSicuro(errore: unknown): string {
  let testo = '';
  if (typeof errore === 'string') testo = errore;
  else if (errore && typeof errore === 'object' && typeof (errore as { message?: unknown }).message === 'string') {
    testo = (errore as { message: string }).message;
  }
  const primaRiga = testo.split(/\r?\n/)[0].trim();
  if (!primaRiga) return 'Errore senza messaggio.';

  const pulito = primaRiga
    .replace(/Bearer\s+\S+/gi, `Bearer ${NASCOSTO}`)
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, NASCOSTO)
    .replace(/[^\s@"'<>(),;:[\]]+@[^\s@"'<>(),;:[\]]+\.[A-Za-z]{2,}/g, NASCOSTO)
    .replace(/[A-Za-z0-9_-]{24,}/g, NASCOSTO);

  return pulito.length > LUNGHEZZA_MASSIMA_MESSAGGIO
    ? `${pulito.slice(0, LUNGHEZZA_MASSIMA_MESSAGGIO - 1)}…`
    : pulito;
}

// Report notturno (specs/52): KO se almeno un report non è stato prodotto.
export function problemaReportNotturno(risultati: Record<string, string>): string | null {
  const falliti = Object.entries(risultati)
    .filter(([, esito]) => esito === 'errore')
    .map(([tipo]) => tipo);
  return falliti.length ? `Report non prodotti: ${falliti.join(', ')}.` : null;
}

// Riepilogo allarmi (specs/07): KO se il registro degli invii ha rifiutato la
// riga (l'email non parte); "già inviato" e "tutto ok" sono lanci riusciti.
export function problemaRiepilogoAllarmi(riepilogo: string): string | null {
  return riepilogo === 'errore_registro'
    ? 'Registro degli allarmi inviati non disponibile: email di riepilogo non inviata.'
    : null;
}
