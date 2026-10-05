'use client';

import { useState } from 'react';
import { FormConEsito, type EsitoAzione } from './FormConEsito';
import { PulsanteInvio } from './PulsanteInvio';

// Pulsante "Invia a Rojac" con anteprima e conferma (specs/61 -
// email-pasti-rojac.md): mostra destinatario, copia, oggetto e corpo così
// come verranno inviati, già calcolati dal server, e invia solo dopo
// "Conferma invio". Il client manda all'azione solo il mese: i numeri
// vengono ricalcolati lato server.
export function InvioEmailRojac({
  mese,
  a,
  cc,
  oggetto,
  corpo,
  azione,
}: {
  mese: string;
  a: string;
  cc: string;
  oggetto: string;
  corpo: string;
  azione: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
}) {
  const [aperta, setAperta] = useState(false);
  const [inviato, setInviato] = useState(false);

  async function azioneEInforma(stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
    const esito = await azione(stato, formData);
    if (esito.ok) {
      setInviato(true);
      setAperta(false);
    }
    return esito;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setInviato(false);
          setAperta(true);
        }}
        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Invia a Rojac
      </button>

      {inviato && (
        <p role="status" className="text-sm font-medium text-emerald-800">
          <span aria-hidden="true">✓ </span>Riepilogo inviato a Rojac
        </p>
      )}

      {aperta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Anteprima mail a Rojac"
          className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/40 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-lg">
            <h2 className="text-base font-medium">Anteprima mail a Rojac</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-stone-500">A</dt>
                <dd>{a}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-stone-500">CC</dt>
                <dd>{cc}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-stone-500">Oggetto</dt>
                <dd>{oggetto}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-stone-500">Corpo</dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 p-2 text-stone-700">
                  {corpo}
                </dd>
              </div>
            </dl>
            <FormConEsito action={azioneEInforma} className="mt-4 flex flex-wrap justify-end gap-2" titoloPopupErrore="Mail non inviata">
              <input type="hidden" name="mese" value={mese} />
              <button
                type="button"
                onClick={() => setAperta(false)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
              >
                Annulla
              </button>
              <PulsanteInvio className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
                Conferma invio
              </PulsanteInvio>
            </FormConEsito>
          </div>
        </div>
      )}
    </div>
  );
}
