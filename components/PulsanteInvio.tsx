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
  confermaMessaggio,
  className,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  testoAttesa?: string;
  // Per i pulsanti compatti (es. Presente/Assente/Malattia) mantenere
  // l'etichetta originale è più leggibile che sostituirla col testo di
  // attesa: qui basta lo stato disabilitato/attenuato a segnalare
  // "avviato/in corso" (specs/05 - feedback.md).
  mantieniTesto?: boolean;
  // Popup nativo del browser (window.confirm) prima di inviare il form
  // (specs/56 - comunicazione-retta-mensile.md, "conferma prima
  // dell'invio massivo"): se l'admin annulla il popup, il submit non
  // parte. Un window.confirm, non il componente ConfermaAzione, perché
  // questo pulsante sta già dentro un <form> che raccoglie i campi di
  // ogni riga di una tabella (es. "Invia comunicazioni" in
  // app/admin/rette/page.tsx) — un secondo <form> annidato (quello che
  // ConfermaAzione crea quando conferma) sarebbe HTML non valido e
  // perderebbe comunque quei campi, che sono fuori dal suo <form>.
  confermaMessaggio?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(evento) => {
        if (confermaMessaggio && !window.confirm(confermaMessaggio)) {
          evento.preventDefault();
          return;
        }
        onClick?.(evento);
      }}
      className={`${className ?? ''} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending && !mantieniTesto ? testoAttesa : children}
    </button>
  );
}
