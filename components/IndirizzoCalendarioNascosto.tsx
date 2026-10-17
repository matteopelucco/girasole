'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { FormVerificaPassword } from './FormVerificaPassword';
import { SEGNAPOSTO_VALORE } from '@/lib/parametriAmbiente';

type EsitoIndirizzo = { ok: true; indirizzo: string } | { ok: false; messaggio: string };

// Indirizzo iCal salvato, nascosto finché l'admin non reinserisce la password
// (specs/64 - calendario-eventi.md, stesso meccanismo di "Variabili
// d'ambiente", specs/62). Dal server arriva solo il fatto che l'indirizzo
// esiste: il valore arriva dalla Server Action `rivela` dopo la verifica e vive
// solo nello stato di questo componente (niente cookie, localStorage o URL),
// quindi ricaricando la pagina torna nascosto. "Nascondi indirizzo" lo
// cancella dallo stato. Niente console.*.
export function IndirizzoCalendarioNascosto({ rivela }: { rivela: (formData: FormData) => Promise<EsitoIndirizzo> }) {
  const [indirizzo, setIndirizzo] = useState<string | null>(null);
  const [verificaAperta, setVerificaAperta] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inVerifica, avviaVerifica] = useTransition();

  function cambiaVisibilita() {
    setErrore(null);
    if (indirizzo) {
      setIndirizzo(null);
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
          setIndirizzo(esito.indirizzo);
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
      <div>
        <p className="text-xs text-stone-600">Indirizzo salvato</p>
        <p data-testid="indirizzo-calendario" className="break-all text-sm">
          {indirizzo ? (
            <code>{indirizzo}</code>
          ) : (
            <>
              <span aria-hidden="true" className="text-stone-500">
                {SEGNAPOSTO_VALORE}
              </span>
              <span className="sr-only">Indirizzo nascosto</span>
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={cambiaVisibilita}
        aria-expanded={indirizzo ? undefined : verificaAperta}
        aria-controls={verificaAperta && !indirizzo ? 'verifica-password-calendario' : undefined}
        className="min-h-11 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-100"
      >
        {indirizzo ? 'Nascondi indirizzo' : 'Mostra indirizzo'}
      </button>
      {verificaAperta && !indirizzo && (
        <FormVerificaPassword
          id="verifica-password-calendario"
          idCampo="password-calendario"
          descrizione="Per vedere l'indirizzo reinserisci la password con cui accedi."
          inCorso={inVerifica}
          errore={errore}
          onSubmit={verifica}
        />
      )}
    </div>
  );
}
