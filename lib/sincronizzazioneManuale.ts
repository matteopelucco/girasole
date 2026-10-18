import { motivoErroreValido, problemaCalendario, type RisultatoSincronizzazione } from './calendarioIcal';

// Sincronizzazione del Google Calendar lanciata a mano dall'admin, dalla scheda
// "Azioni" (specs/64 - calendario-eventi.md, "Sincronizzazione a mano"; issue
// #326): logica pura (nessun I/O). La Server Action è in
// app/admin/cron-job/actions.ts.
//
// L'esito che arriva al browser è RICOSTRUITO qui dal risultato di
// `sincronizzaCalendario`: solo uno stato, una frase scelta da un elenco fisso e
// tre numeri. Mai testi di eccezioni, titoli di eventi, indirizzo del feed o
// chiavi. Etichette "OK"/"ERRORE" (il registro dei cron usa "KO", specs/63).

export const MESSAGGIO_DISATTIVATA = 'Sincronizzazione disattivata: nessun indirizzo impostato.';
export const MESSAGGIO_GIA_IN_CORSO = 'Una sincronizzazione è già in corso: attendi che finisca.';
export const MESSAGGIO_IN_CORSO = 'Esecuzione in corso…';

// Durata massima della funzione che esegue l'azione (`maxDuration` della
// pagina): passato questo tempo la guardia contro il lancio concorrente decade,
// anche se la funzione precedente fosse stata interrotta senza liberarla.
export const DURATA_MASSIMA_GUARDIA_MS = 60_000;

export type EsitoSincronizzazioneManuale =
  | { stato: 'OK'; messaggio: string }
  | { stato: 'ERRORE'; messaggio: string };

function conteggio(valore: unknown): number {
  return typeof valore === 'number' && Number.isInteger(valore) && valore >= 0 ? valore : 0;
}

export function esitoSincronizzazioneManuale(risultato: RisultatoSincronizzazione): EsitoSincronizzazioneManuale {
  if (risultato.stato === 'disattivata') return { stato: 'OK', messaggio: MESSAGGIO_DISATTIVATA };
  if (risultato.stato === 'ok') {
    const aggiunti = conteggio(risultato.inseriti);
    const aggiornati = conteggio(risultato.aggiornati);
    const tolti = conteggio(risultato.rimossi);
    return { stato: 'OK', messaggio: `Eventi aggiunti: ${aggiunti}, aggiornati: ${aggiornati}, tolti: ${tolti}.` };
  }
  const motivo = risultato.stato === 'errore' && motivoErroreValido(risultato.motivo) ? risultato.motivo : 'imprevisto';
  return { stato: 'ERRORE', messaggio: problemaCalendario(motivo) };
}

// Vero se una sincronizzazione a mano partita all'istante `inizio` (ms, null =
// nessuna) è ancora considerata in corso: un solo lancio alla volta.
export function sincronizzazioneInCorso(inizio: number | null, adesso: number): boolean {
  if (inizio === null) return false;
  const trascorso = adesso - inizio;
  return trascorso >= 0 && trascorso < DURATA_MASSIMA_GUARDIA_MS;
}
