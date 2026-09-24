'use client';

import { useState } from 'react';

// Icone occhio/occhio-barrato lineari e monocromatiche (colore ereditato
// da `currentColor`, coerente con il resto dell'interfaccia): niente
// emoji colorate, in linea con il layout minimale dell'app (issue #47).
function IconaOcchio() {
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
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

function IconaOcchioBarrato() {
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
      <path d="M2.5 12S6 5.5 12 5.5c1.6 0 3 .35 4.2.9M21.5 12s-1.4 2.5-4 4.2M9.6 9.6a2.75 2.75 0 003.9 3.9" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

// Campo password con pulsante "occhio" per mostrare/nascondere il
// testo in chiaro (specs/11 - login.md, specs/03 - utenti-e-ruoli.md):
// utile per controllare quanto digitato, soprattutto da smartphone.
export function CampoPassword({
  id,
  name,
  required,
  minLength,
  placeholder,
  ariaLabel,
  autoComplete,
  onChange,
}: {
  id?: string;
  name: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  ariaLabel?: string;
  autoComplete?: string;
  onChange?: (valore: string) => void;
}) {
  const [visibile, setVisibile] = useState(false);

  return (
    <div className="relative self-start">
      <input
        id={id}
        name={name}
        type={visibile ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete={autoComplete}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 pr-10 text-sm outline-none focus:border-stone-500"
      />
      <button
        type="button"
        onClick={() => setVisibile((v) => !v)}
        aria-label={visibile ? 'Nascondi password' : 'Mostra password'}
        aria-pressed={visibile}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-stone-500 hover:text-stone-800"
      >
        {visibile ? <IconaOcchioBarrato /> : <IconaOcchio />}
      </button>
    </div>
  );
}
