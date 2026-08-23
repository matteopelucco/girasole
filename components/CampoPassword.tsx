'use client';

import { useState } from 'react';

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
    <div className="relative">
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
        {visibile ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
