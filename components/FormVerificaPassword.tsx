'use client';

import type { FormEvent } from 'react';
import { CampoPassword } from './CampoPassword';

// Richiesta della password dell'admin prima di mostrare un valore nascosto
// (specs/62 - parametri-di-funzionamento.md, specs/64 - calendario-eventi.md).
// Condivisa da "Variabili d'ambiente" e "Calendario Google": chi la usa
// gestisce l'invio (onSubmit) e il messaggio d'errore; la password non resta
// nel campo (chi la usa fa `form.reset()` dopo aver letto i dati).
export function FormVerificaPassword({
  id,
  idCampo,
  descrizione,
  inCorso,
  errore,
  onSubmit,
}: {
  id: string;
  idCampo: string;
  descrizione: string;
  inCorso: boolean;
  errore: string | null;
  onSubmit: (evento: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form id={id} onSubmit={onSubmit} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <label htmlFor={idCampo} className="text-sm font-medium text-stone-700">
        La tua password
      </label>
      <p className="text-xs text-stone-600">{descrizione}</p>
      <CampoPassword id={idCampo} name="password" required autoComplete="current-password" />
      <button
        type="submit"
        disabled={inCorso}
        className="min-h-11 self-start rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {inCorso ? 'Verifica in corso…' : 'Verifica e mostra'}
      </button>
      {errore && (
        <p role="alert" className="text-sm text-red-700">
          {errore}
        </p>
      )}
    </form>
  );
}
