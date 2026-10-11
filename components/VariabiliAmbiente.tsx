'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { CampoPassword } from './CampoPassword';
import { SEGNAPOSTO_VALORE, type Parametro } from '@/lib/parametriAmbiente';

type EsitoValori = { ok: true; parametri: Parametro[] } | { ok: false; messaggio: string };

// Tabella delle variabili d'ambiente con il pulsante "Mostra valori"/"Nascondi
// valori" (specs/62 - parametri-di-funzionamento.md, issue #287). Riceve dal
// server SOLO i nomi; i valori arrivano dalla Server Action `rivela` dopo la
// verifica della password e vivono solo nello stato di questo componente:
// niente cookie, localStorage o URL, quindi ricaricando la pagina tornano
// nascosti. "Nascondi valori" li cancella dallo stato. Niente console.*.
export function VariabiliAmbiente({
  nomi,
  rivela,
}: {
  nomi: string[];
  rivela: (formData: FormData) => Promise<EsitoValori>;
}) {
  const [valori, setValori] = useState<Map<string, string> | null>(null);
  const [verificaAperta, setVerificaAperta] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inVerifica, avviaVerifica] = useTransition();

  function cambiaVisibilita() {
    setErrore(null);
    if (valori) {
      setValori(null);
      setVerificaAperta(false);
    } else {
      setVerificaAperta((aperta) => !aperta);
    }
  }

  function verifica(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const dati = new FormData(form);
    // La password non resta nel campo, né in caso di errore né di successo.
    form.reset();
    avviaVerifica(async () => {
      try {
        const esito = await rivela(dati);
        if (esito.ok) {
          setValori(new Map(esito.parametri.map((p) => [p.nome, p.valore])));
          setVerificaAperta(false);
          setErrore(null);
        } else {
          setErrore(esito.messaggio);
        }
      } catch {
        setErrore('Verifica non riuscita. Riprova.');
      }
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={cambiaVisibilita}
        aria-expanded={valori ? undefined : verificaAperta}
        aria-controls={verificaAperta && !valori ? 'verifica-password-parametri' : undefined}
        className="min-h-11 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-100"
      >
        {valori ? 'Nascondi valori' : 'Mostra valori'}
      </button>

      {verificaAperta && !valori && (
        <form
          id="verifica-password-parametri"
          onSubmit={verifica}
          className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50 p-4"
        >
          <label htmlFor="password-parametri" className="text-sm font-medium text-stone-700">
            La tua password
          </label>
          <p className="text-xs text-stone-600">
            Per vedere i valori reinserisci la password con cui accedi.
          </p>
          <CampoPassword id="password-parametri" name="password" required autoComplete="current-password" />
          <button
            type="submit"
            disabled={inVerifica}
            className="min-h-11 self-start rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {inVerifica ? 'Verifica in corso…' : 'Verifica e mostra'}
          </button>
          {errore && (
            <p role="alert" className="text-sm text-red-700">
              {errore}
            </p>
          )}
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full table-fixed divide-y divide-stone-200 text-sm">
          <caption className="sr-only">Variabili d&apos;ambiente e relativi valori</caption>
          <thead>
            <tr>
              <th scope="col" className="w-2/5 px-3 py-2 text-left font-medium text-stone-700">
                Nome
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-stone-700">
                Valore
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {nomi.map((nome) => (
              <tr key={nome} data-testid="riga-variabile">
                <th scope="row" className="break-all px-3 py-2 text-left align-top font-normal">
                  <code data-testid="nome-variabile">{nome}</code>
                </th>
                <td data-testid="valore-variabile" className="break-all px-3 py-2 align-top">
                  {valori ? (
                    <code>{valori.get(nome) ?? ''}</code>
                  ) : (
                    <>
                      <span aria-hidden="true" className="text-stone-500">
                        {SEGNAPOSTO_VALORE}
                      </span>
                      <span className="sr-only">Valore nascosto</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
