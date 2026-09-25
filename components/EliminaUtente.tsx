'use client';

import { useEffect, useId, useState } from 'react';
import { FormConEsito, type EsitoAzione } from './FormConEsito';
import { PulsanteInvio } from './PulsanteInvio';

function IconaCestino() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 12.5h10L18 7M10 11v5.5M14 11v5.5" />
    </svg>
  );
}

// Eliminazione di un account da /admin/maestre (specs/03 - utenti-e-ruoli.md):
// un'icona cestino in alto a destra della scheda apre una finestra di
// conferma; la cancellazione parte solo dopo la spunta esplicita di "Ne sono
// consapevole". Chiudere la finestra (Annulla, Esc, clic sullo sfondo) azzera
// la spunta, così ogni apertura riparte da zero.
export function EliminaUtente({
  azione,
  profiloId,
  email,
}: {
  azione: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  profiloId: string;
  email: string;
}) {
  const [aperta, setAperta] = useState(false);
  const [consapevole, setConsapevole] = useState(false);
  const idTitolo = useId();
  const idDescrizione = useId();

  function chiudi() {
    setAperta(false);
    setConsapevole(false);
  }

  useEffect(() => {
    if (!aperta) return;
    function gestisciTasto(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAperta(false);
        setConsapevole(false);
      }
    }
    document.addEventListener('keydown', gestisciTasto);
    return () => document.removeEventListener('keydown', gestisciTasto);
  }, [aperta]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAperta(true)}
        aria-label="Elimina utente"
        title="Elimina utente"
        className="absolute right-2 top-2 rounded-lg p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <IconaCestino />
      </button>

      {aperta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) chiudi();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitolo}
            aria-describedby={idDescrizione}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 id={idTitolo} className="text-base font-semibold text-stone-900">
              Eliminare definitivamente questo utente?
            </h2>
            <div id={idDescrizione} className="mt-2 space-y-2 text-sm text-stone-700">
              <p>
                Stai per eliminare l&apos;account <strong className="break-all">{email}</strong>.
              </p>
              <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-800">
                L&apos;eliminazione è definitiva e non si può annullare: l&apos;utente non potrà
                più accedere all&apos;app.
              </p>
            </div>

            <FormConEsito action={azione} className="mt-4">
              <input type="hidden" name="profilo_id" value={profiloId} />
              <label className="flex items-center gap-2 text-sm text-stone-800">
                <input
                  type="checkbox"
                  checked={consapevole}
                  onChange={(evento) => setConsapevole(evento.target.checked)}
                  autoFocus
                  className="h-4 w-4"
                />
                Ne sono consapevole
              </label>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={chiudi}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
                >
                  Annulla
                </button>
                <PulsanteInvio
                  disabled={!consapevole}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Procedi con la cancellazione utente
                </PulsanteInvio>
              </div>
            </FormConEsito>
          </div>
        </div>
      )}
    </>
  );
}
