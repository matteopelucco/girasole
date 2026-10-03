'use client';

import { useEffect, useId, useRef } from 'react';
import type { EsitoAzione } from './FormConEsito';

// Popup bloccante per un'azione fallita (specs/05 - feedback.md, specs/18
// - report-ore-lavoro.md, issue #189): un banner discreto sotto il pulsante
// passava inosservato e chi salvava la settimana la credeva salvata. Qui
// l'esito "ko" è una finestra modale che dice chiaramente che l'azione NON
// è andata a buon fine e, se l'azione lo fornisce, elenca tutte le
// incongruenze da sanare.
//
// <dialog> nativo con showModal(): il browser porta il focus dentro la
// finestra e lo mantiene lì (focus trap), rende inerte il resto della
// pagina e chiude con Esc. Non si chiude toccando fuori: serve un
// riconoscimento esplicito ("Chiudi e correggi"). Il ruolo alertdialog lo
// fa annunciare subito dai lettori di schermo.
//
// Si riapre a ogni nuovo esito negativo (anche identico al precedente: ogni
// risposta del server è un oggetto nuovo), non solo la prima volta.
export function DialogErrore({
  esito,
  titolo,
  onChiuso,
}: {
  esito: Extract<EsitoAzione, { ok: false }>;
  titolo: string;
  // Chiamata dopo ogni chiusura (pulsante o Esc): chi usa il popup riporta
  // il focus dove ha senso (il pulsante che ha avviato l'azione).
  onChiuso?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const idTitolo = useId();
  const idDescrizione = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [esito]);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={idTitolo}
      aria-describedby={idDescrizione}
      onClose={onChiuso}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border-2 border-red-300 bg-white p-0 text-stone-900 shadow-xl backdrop:bg-stone-900/60"
    >
      <div className="p-5">
        <h2 id={idTitolo} className="text-base font-semibold text-red-800">
          <span aria-hidden="true">⚠ </span>
          {titolo}
        </h2>
        <p id={idDescrizione} className="mt-2 text-sm text-stone-800">
          {esito.messaggio}
        </p>
        {esito.elenco && esito.elenco.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 py-2 pl-7 pr-3 text-sm text-red-900">
            {esito.elenco.map((voce, indice) => (
              <li key={indice}>{voce}</li>
            ))}
          </ul>
        )}
        {esito.dettaglio && <p className="mt-3 text-xs text-stone-600">{esito.dettaglio}</p>}
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="mt-4 min-h-11 w-full rounded-lg bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
        >
          Chiudi e correggi
        </button>
      </div>
    </dialog>
  );
}
