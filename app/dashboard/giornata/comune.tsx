import type { ReactNode } from 'react';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { IconaNota } from '@/components/icone';

// Elementi condivisi dalle sezioni "Presenza" e "Pasto" della card
// bambino della schermata "Presenze e pasti" (specs/10, issue #106).

export const ETICHETTE_PRESENZA: Record<string, string> = {
  presente: 'Presente',
  assente: 'Assente',
  malattia: 'Malattia',
};

export const ETICHETTE_PASTO: Record<string, string> = { si: 'Sì', no: 'No' };

// Titolo visibile della sezione, con icona decorativa: il suo testo dà
// anche il nome accessibile al role="group" che la contiene
// (aria-labelledby), quindi l'icona è aria-hidden e il nome resta
// esattamente "Presenza" / "Pasto".
export function IntestazioneSezione({ id, icona, children }: { id: string; icona: ReactNode; children: ReactNode }) {
  return (
    <p id={id} className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-800">
      <span className="text-stone-600">{icona}</span>
      {children}
    </p>
  );
}

// Pulsante di stato grande (classi da lib/classiStato.ts): quando è
// selezionato mostra il segno ✓ (decorativo, fuori dal nome accessibile)
// ed espone aria-pressed, così lo stato corrente arriva anche alle
// tecnologie assistive e non solo tramite il colore (specs/10).
export function PulsanteStato({
  formAction,
  selezionato,
  className,
  children,
}: {
  formAction: (formData: FormData) => void | Promise<void>;
  selezionato: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <PulsanteInvio mantieniTesto formAction={formAction} aria-pressed={selezionato} className={className}>
      {selezionato && <span aria-hidden="true">✓</span>}
      {children}
    </PulsanteInvio>
  );
}

// Campo "Nota (opzionale)" con etichetta visibile (non solo segnaposto),
// condiviso da presenza e pasto: due campi distinti, con `name` diversi
// (nota_presenza / nota_pasto) letti dalle rispettive server action.
export function CampoNota({ id, name, valore }: { id: string; name: string; valore: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
        <IconaNota className="h-3.5 w-3.5" />
        Nota <span className="font-normal text-stone-600">(opzionale)</span>
      </label>
      <textarea
        id={id}
        name={name}
        rows={2}
        defaultValue={valore ?? ''}
        placeholder="Scrivi qui…"
        className="block w-full min-w-0 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none placeholder:text-stone-500 focus:border-stone-500"
      />
    </div>
  );
}
