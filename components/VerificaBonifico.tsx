'use client';

import { useState } from 'react';
import { FormConEsito, type EsitoAzione } from './FormConEsito';
import { PulsanteInvio } from './PulsanteInvio';
import { formattaImporto } from '@/lib/comunicazioneRetta';
import { formattaDataOraItaliana } from '@/lib/date';

// Verifica del bonifico di una comunicazione già inviata (specs/59 -
// verifica-bonifico-retta.md): due azioni ("Bonifico corretto"/
// "Importo diverso") finché è "da verificare", uno stato di sola
// lettura una volta marcato. Ogni riga ha il proprio `<form>`
// indipendente (tramite FormConEsito/useFormState, non un formAction
// annidato nel form "Invia comunicazioni"): a differenza di "Invia
// comunicazioni"/"Annulla invio", la verifica del bonifico deve
// funzionare anche nella vista di sola lettura di un mese passato, che
// non ha nessun `<form>` che la contenga (specs/59, "verificare il
// bonifico anche su un mese passato").
export function VerificaBonifico({
  bambinoNome,
  totale,
  stato,
  importoRicevuto,
  nota,
  verificatoDaNome,
  verificatoIl,
  meseSuggerito,
  meseMinimo,
  marcaCorretto,
  marcaImportoErrato,
}: {
  // comunicazioneId/bambinoId non sono tra le prop: `marcaCorretto`/
  // `marcaImportoErrato` arrivano già "bindate" a quegli id dal
  // chiamante (app/admin/rette/page.tsx) — coerente con lo stesso
  // pattern già usato per "Annulla invio"/"Invia comunicazione".
  bambinoNome: string;
  totale: number;
  stato: 'in_attesa' | 'corretto' | 'importo_errato';
  importoRicevuto: number | null;
  nota: string | null;
  verificatoDaNome: string | null;
  verificatoIl: string | null;
  meseSuggerito: string;
  meseMinimo: string;
  marcaCorretto: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  marcaImportoErrato: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
}) {
  const [apertoModale, setApertoModale] = useState(false);

  if (stato === 'corretto') {
    return (
      <p className="mt-1 text-xs text-emerald-700">
        Bonifico ricevuto (importo corretto) — verificato da {verificatoDaNome} il{' '}
        {verificatoIl ? formattaDataOraItaliana(verificatoIl) : ''}
      </p>
    );
  }

  if (stato === 'importo_errato') {
    return (
      <p className="mt-1 text-xs text-amber-700">
        Bonifico ricevuto (importo diverso): {formattaImporto(importoRicevuto ?? 0)} invece di{' '}
        {formattaImporto(totale)} — {nota} — verificato da {verificatoDaNome} il{' '}
        {verificatoIl ? formattaDataOraItaliana(verificatoIl) : ''}
      </p>
    );
  }

  return (
    <>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-stone-500">Bonifico da verificare</span>
        <FormConEsito action={marcaCorretto}>
          <PulsanteInvio
            mantieniTesto
            confermaMessaggio={`Confermi che il bonifico di ${bambinoNome} è stato ricevuto per l'importo corretto (${formattaImporto(
              totale
            )})?`}
            className="rounded-lg border border-emerald-300 px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Bonifico corretto
          </PulsanteInvio>
        </FormConEsito>
        <button
          type="button"
          onClick={() => setApertoModale(true)}
          className="rounded-lg border border-amber-300 px-2 py-0.5 font-medium text-amber-700 hover:bg-amber-50"
        >
          Importo diverso
        </button>
      </div>

      {apertoModale && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Importo bonifico diverso per ${bambinoNome}`}
          className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/40 p-4"
        >
          <FormConEsito
            action={marcaImportoErrato}
            className="w-full max-w-sm space-y-3 rounded-xl bg-white p-5 text-left shadow-lg"
          >
            <h2 className="text-base font-medium">Importo bonifico diverso — {bambinoNome}</h2>
            <p className="text-xs text-stone-600">Importo atteso: {formattaImporto(totale)}</p>
            <label className="block text-xs text-stone-600">
              Importo ricevuto (€)
              <input
                name="importo_ricevuto"
                type="number"
                min={0}
                step={0.01}
                required
                aria-label="Importo ricevuto (€)"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </label>
            <label className="block text-xs text-stone-600">
              Nota (obbligatoria)
              <input
                name="nota"
                required
                placeholder="Motivo della differenza"
                aria-label="Nota bonifico"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </label>
            <label className="block text-xs text-stone-600">
              Mese su cui conteggiare la differenza
              <input
                name="mese_competenza"
                type="month"
                min={meseMinimo}
                defaultValue={meseSuggerito}
                aria-label="Mese su cui conteggiare la differenza"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApertoModale(false)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
              >
                Annulla
              </button>
              <PulsanteInvio className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">
                Conferma
              </PulsanteInvio>
            </div>
          </FormConEsito>
        </div>
      )}
    </>
  );
}
