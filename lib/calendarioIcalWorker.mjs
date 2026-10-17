// Punto d'ingresso del worker thread che analizza il feed iCal (specs/64):
// riceve il testo e la finestra, risponde con il risultato o con un errore dal
// motivo fisso. Chi lo avvia lo termina allo scadere del tempo massimo
// (lib/calendarioIcalIsolato.ts). Nessun dettaglio dell'errore esce da qui:
// potrebbe contenere pezzi del feed.
import { parentPort, workerData } from 'node:worker_threads';
import { analizzaFeedIcal } from './calendarioIcalMotore.mjs';

try {
  const { testo, da, a } = workerData;
  parentPort.postMessage({ ok: true, risultato: analizzaFeedIcal(testo, new Date(da), new Date(a)) });
} catch {
  parentPort.postMessage({ ok: false, motivo: 'feed_non_valido' });
}
