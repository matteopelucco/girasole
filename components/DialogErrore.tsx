'use client';

import { useState } from 'react';
import type { EsitoAzione } from './FormConEsito';
import { Finestra } from './ui/finestra';
import { Pulsante } from './ui/pulsante';

// Popup bloccante per un'azione fallita (specs/05 - feedback.md, specs/18
// - report-ore-lavoro.md, issue #189): un banner discreto sotto il pulsante
// passava inosservato e chi salvava la settimana la credeva salvata. Qui
// l'esito "ko" è una finestra modale che dice chiaramente che l'azione NON
// è andata a buon fine e, se l'azione lo fornisce, elenca tutte le
// incongruenze da sanare.
//
// Costruito su Finestra (components/ui/finestra.tsx): <dialog> nativo con
// showModal(), quindi il browser porta il focus dentro la finestra e lo
// mantiene lì, rende inerte il resto della pagina e chiude con Esc. Non si
// chiude toccando fuori: serve un riconoscimento esplicito ("Chiudi e
// correggi"). Il ruolo alertdialog lo fa annunciare subito dai lettori di
// schermo.
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
  // L'esito già chiuso dall'utente: un nuovo esito è un oggetto diverso, e la
  // finestra si riapre.
  const [esitoChiuso, setEsitoChiuso] = useState<typeof esito | null>(null);

  return (
    <Finestra
      variante="avviso"
      aperta={esitoChiuso !== esito}
      onChiudi={() => {
        setEsitoChiuso(esito);
        onChiuso?.();
      }}
      titolo={
        <>
          <span aria-hidden="true">⚠ </span>
          {titolo}
        </>
      }
      descrizione={esito.messaggio}
    >
      {esito.elenco && esito.elenco.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 py-2 pl-7 pr-3 text-sm text-red-900">
          {esito.elenco.map((voce, indice) => (
            <li key={indice}>{voce}</li>
          ))}
        </ul>
      )}
      {esito.dettaglio && <p className="mt-3 text-xs text-stone-600">{esito.dettaglio}</p>}
      <Pulsante
        variante="pericolo"
        misura="normale"
        onClick={(evento) => evento.currentTarget.closest('dialog')?.close()}
        className="mt-4 min-h-11 w-full py-0 sm:min-h-11"
      >
        Chiudi e correggi
      </Pulsante>
    </Finestra>
  );
}
