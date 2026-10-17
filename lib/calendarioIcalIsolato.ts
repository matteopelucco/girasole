import path from 'node:path';
import type { Worker } from 'node:worker_threads';
import { ErroreCalendario, type RisultatoAnalisi } from './calendarioIcal';

// Analisi del feed iCal in un worker thread con tempo massimo (specs/64,
// Regole): una regola di ripetizione ostile (valida o malformata) può far
// restare ical.js bloccato in una sola chiamata, che nessun tetto sul numero di
// passi interrompe, e l'analisi sincrona bloccherebbe il report notturno che
// gira nello stesso processo. Qui il lavoro gira in un thread a parte, che allo
// scadere del tempo viene terminato (`terminate()`): il feed è considerato non
// analizzabile ('analisi_lenta'), gli eventi già salvati restano e il report
// esce comunque.
//
// Il worker è un file JavaScript vero (lib/calendarioIcalWorker.mjs), caricato
// da disco a runtime: non passa dal bundle di Next. Su Vercel deve essere nel
// pacchetto della funzione insieme al motore e a ical.js
// (`outputFileTracingIncludes` in next.config.mjs). Se il worker non parte è un
// errore ('imprevisto'), mai un ripiego nello stesso processo: l'isolamento è
// il punto.
//
// Del worker non esce mai un messaggio d'errore (potrebbe contenere pezzi del
// feed): solo un motivo scelto da un elenco fisso.

export const TEMPO_MASSIMO_ANALISI_MS = 8000;
const MEMORIA_MASSIMA_MB = 256;

export function percorsoWorkerAnalisi(): string {
  return path.join(process.cwd(), 'lib', 'calendarioIcalWorker.mjs');
}

export function analizzaFeedIsolato(
  testo: string,
  da: Date,
  a: Date,
  tempoMassimoMs: number = TEMPO_MASSIMO_ANALISI_MS,
  percorsoWorker: string = percorsoWorkerAnalisi()
): Promise<RisultatoAnalisi> {
  return new Promise<RisultatoAnalisi>((risolvi, rifiuta) => {
    let concluso = false;
    let worker: Worker;
    const concludi = (azione: () => void) => {
      if (concluso) return;
      concluso = true;
      clearTimeout(timer);
      void worker?.terminate();
      azione();
    };
    const timer = setTimeout(() => concludi(() => rifiuta(new ErroreCalendario('analisi_lenta'))), tempoMassimoMs);

    try {
      // La classe si prende da `process.getBuiltinModule` e non da un import: il
      // bundler di Next riconosce `new Worker(...)` su un import e prova a
      // includere il file nel bundle (fallendo); qui il file va caricato da
      // disco a runtime.
      const { Worker: ClasseWorker } = process.getBuiltinModule('node:worker_threads');
      worker = new ClasseWorker(percorsoWorker, {
        workerData: { testo, da: da.toISOString(), a: a.toISOString() },
        resourceLimits: { maxOldGenerationSizeMb: MEMORIA_MASSIMA_MB },
      });
    } catch {
      concludi(() => rifiuta(new ErroreCalendario('imprevisto')));
      return;
    }
    worker.once('message', (messaggio: { ok: boolean; risultato?: RisultatoAnalisi }) =>
      concludi(() =>
        messaggio.ok && messaggio.risultato
          ? risolvi(messaggio.risultato)
          : rifiuta(new ErroreCalendario('feed_non_valido'))
      )
    );
    worker.once('error', () => concludi(() => rifiuta(new ErroreCalendario('imprevisto'))));
    worker.once('exit', () => concludi(() => rifiuta(new ErroreCalendario('imprevisto'))));
  });
}
