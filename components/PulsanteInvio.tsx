'use client';

import { useFormStatus } from 'react-dom';
import type { ButtonHTMLAttributes } from 'react';

// Pulsante di invio che riflette lo stato "avviato/in corso" di
// un'azione (specs/05 - feedback.md): si disabilita e mostra un testo
// di attesa non appena il form viene inviato, finché il server non ha
// risposto — impedisce anche i doppi invii accidentali. Va usato dentro
// al <form> la cui azione vogliamo riflettere (useFormStatus legge lo
// stato del form antenato più vicino).
export function PulsanteInvio({
  children,
  testoAttesa = 'Attendere…',
  mantieniTesto = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  testoAttesa?: string;
  // Per i pulsanti compatti (es. Presente/Assente/Malattia) mantenere
  // l'etichetta originale è più leggibile che sostituirla col testo di
  // attesa: qui basta lo stato disabilitato/attenuato a segnalare
  // "avviato/in corso" (specs/05 - feedback.md).
  mantieniTesto?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ''} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending && !mantieniTesto ? testoAttesa : children}
    </button>
  );
}
