import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Etichetta a pillola (issue #340, specs/01 - ux.md): piccolo tag di stato,
// es. "Assente", "Malattia", "Inconsistenza", "In corso". Un solo aspetto
// (`rounded-full px-2 py-0.5 text-xs font-semibold`), cambia solo il tono.
//
// - `tono="neutro"`: indicatore non legato a un esito (token `neutral`).
// - `assente`, `malattia`, `inconsistenza`: tinte di oggi (`stone`, `rose`,
//   `orange`), fuori dai token di proposito: la issue #350 ha portato i
//   pulsanti di stato su `pulsante-stato.tsx` senza cambiarne i colori e ha
//   lasciato queste etichette com'erano.
//
// Niente 'use client': è solo markup e classi.
const etichettaPillolaVariants = cva('rounded-full px-2 py-0.5 text-xs font-semibold', {
  variants: {
    tono: {
      neutro: 'bg-neutral-soft text-neutral-text',
      assente: 'bg-stone-200 text-stone-800',
      malattia: 'bg-rose-100 text-rose-800',
      inconsistenza: 'bg-orange-100 text-orange-800',
    },
  },
  defaultVariants: { tono: 'neutro' },
});

type EtichettaPillolaProps = ComponentProps<'span'> & VariantProps<typeof etichettaPillolaVariants>;

function EtichettaPillola({ className, tono, ...props }: EtichettaPillolaProps) {
  return <span data-slot="etichetta-pillola" className={cn(etichettaPillolaVariants({ tono }), className)} {...props} />;
}

export { EtichettaPillola, etichettaPillolaVariants };
export type { EtichettaPillolaProps };
