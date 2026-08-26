'use client';

import { useState } from 'react';
import { FormConEsito, type EsitoAzione } from './FormConEsito';
import { PulsanteInvio } from './PulsanteInvio';

const PALETTE = {
  distruttivo: {
    bottone: 'rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50',
    box: 'border-red-200 bg-red-50',
    testo: 'text-red-800',
    conferma: 'bg-red-600 hover:bg-red-700',
  },
  neutro: {
    bottone: 'rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800',
    box: 'border-amber-300 bg-amber-50',
    testo: 'text-amber-900',
    conferma: 'bg-amber-700 hover:bg-amber-800',
  },
} as const;

// Pulsante con conferma esplicita sì/annulla prima di un'azione
// irreversibile (specs/15 - memo.md, "cancellazione di un avviso";
// specs/16 - comunicazione-pasti-rojac.md, "il pulsante chiede conferma
// prima di comunicare"): evita azioni accidentali con un tap solo.
// `tono` sceglie solo la palette: "distruttivo" (rosso) per le
// eliminazioni, "neutro" (ambra) per altre azioni irreversibili ma non
// distruttive.
export function ConfermaAzione({
  azione,
  campiNascosti,
  etichetta,
  messaggioConferma,
  etichettaConferma = 'Sì',
  tono = 'distruttivo',
}: {
  azione: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  campiNascosti: Record<string, string>;
  etichetta: string;
  messaggioConferma: string;
  etichettaConferma?: string;
  tono?: keyof typeof PALETTE;
}) {
  const [confermaRichiesta, setConfermaRichiesta] = useState(false);
  const palette = PALETTE[tono];

  if (!confermaRichiesta) {
    return (
      <button type="button" onClick={() => setConfermaRichiesta(true)} className={palette.bottone}>
        {etichetta}
      </button>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 ${palette.box}`}>
      <span className={`text-sm ${palette.testo}`}>{messaggioConferma}</span>
      <FormConEsito action={azione}>
        {Object.entries(campiNascosti).map(([nome, valore]) => (
          <input key={nome} type="hidden" name={nome} value={valore} />
        ))}
        <PulsanteInvio className={`rounded-lg px-3 py-1 text-xs font-medium text-white ${palette.conferma}`}>
          {etichettaConferma}
        </PulsanteInvio>
      </FormConEsito>
      <button
        type="button"
        onClick={() => setConfermaRichiesta(false)}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700 hover:bg-stone-100"
      >
        Annulla
      </button>
    </div>
  );
}
