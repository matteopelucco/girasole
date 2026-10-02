'use client';

import { useState } from 'react';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { classePulsanteStato } from '@/lib/classiStato';
import { ETICHETTE_PRESENZA } from './comune';

type StatoAssenza = 'assente' | 'malattia';

// Pulsanti Assente/Malattia della sezione "Presenza" per un bambino con
// qualcosa da azzerare (specs/13 - segna-presenza.md, issue #186): un
// pasto "sì" o un pre/post-asilo già segnati. Premendoli non si salva
// ancora nulla: si apre un avviso (`avviso`, da lib/presenza.ts) con
// "Conferma e azzera" e "Annulla". Fanno da celle della griglia a tre
// colonne di ColonnaPresenza (l'avviso occupa l'intera riga) e il
// pulsante di conferma sta nel <form> della card, quindi invia anche la
// nota scritta, come Presente/Assente/Malattia. L'azzeramento vero lo fa
// la server action (app/dashboard/presenze/actions.ts), non questo
// componente: qui c'è solo la conferma. `aria-expanded` segnala che il
// pulsante apre un pannello invece di salvare subito.
export function PulsantiAssenzaConAvviso({
  bambinoId,
  azioni,
  avviso,
}: {
  bambinoId: string;
  azioni: Record<StatoAssenza, (formData: FormData) => void | Promise<void>>;
  avviso: string;
}) {
  const [scelta, setScelta] = useState<StatoAssenza | null>(null);
  const idAvviso = `avviso-assenza-${bambinoId}`;

  return (
    <>
      {(['assente', 'malattia'] as const).map((stato) => (
        <button
          key={stato}
          type="button"
          aria-expanded={scelta === stato}
          aria-controls={scelta === stato ? idAvviso : undefined}
          onClick={() => setScelta(stato)}
          className={classePulsanteStato(stato, false)}
        >
          {ETICHETTE_PRESENZA[stato]}
        </button>
      ))}
      {scelta && (
        <div
          id={idAvviso}
          role="group"
          aria-label="Conferma azzeramento"
          className="col-span-3 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          <p>
            <span aria-hidden="true">⚠️</span> {avviso}
          </p>
          <div className="flex flex-wrap gap-2">
            <PulsanteInvio
              mantieniTesto
              formAction={azioni[scelta]}
              className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              Conferma e azzera
            </PulsanteInvio>
            <button
              type="button"
              onClick={() => setScelta(null)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </>
  );
}
