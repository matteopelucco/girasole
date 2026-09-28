import type { ReactNode } from 'react';

// Elementi condivisi dalle due colonne della card bambino della
// schermata "Presenze e pasti" (specs/10).

// Area di tocco minima dei pulsanti compatti (36px, specs/10: "almeno
// 32px"): le maestre usano soprattutto il telefono (specs/01).
export const ALTEZZA_TAP = 'min-h-9';

export const ETICHETTE_PRESENZA: Record<string, string> = {
  presente: 'Presente',
  assente: 'Assente',
  malattia: 'Malattia',
};

export const ETICHETTE_PASTO: Record<string, string> = { si: 'Sì', no: 'No' };

// Titolo visibile della colonna, che dà anche il nome accessibile al
// role="group" che la contiene (aria-labelledby).
export function IntestazioneColonna({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-600">
      {children}
    </p>
  );
}
