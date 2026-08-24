'use client';

import { useState } from 'react';
import { FormConEsito, type EsitoAzione } from './FormConEsito';
import { PulsanteInvio } from './PulsanteInvio';

// Pulsante "Elimina" con conferma esplicita sì/annulla (specs/15 -
// memo.md, scenario "cancellazione di un avviso"): evita cancellazioni
// accidentali con un tap solo.
export function ConfermaEliminazione({
  azione,
  campiNascosti,
  etichetta = 'Elimina',
}: {
  azione: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  campiNascosti: Record<string, string>;
  etichetta?: string;
}) {
  const [confermaRichiesta, setConfermaRichiesta] = useState(false);

  if (!confermaRichiesta) {
    return (
      <button
        type="button"
        onClick={() => setConfermaRichiesta(true)}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        {etichetta}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <span className="text-sm text-red-800">Confermi l&apos;eliminazione?</span>
      <FormConEsito action={azione}>
        {Object.entries(campiNascosti).map(([nome, valore]) => (
          <input key={nome} type="hidden" name={nome} value={valore} />
        ))}
        <PulsanteInvio className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">
          Sì
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
