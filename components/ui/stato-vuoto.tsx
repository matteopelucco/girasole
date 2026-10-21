import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Stato vuoto (issue #340, specs/01 - ux.md): messaggio "non c'è nulla da
// mostrare" (o "non si è potuto leggere"), in un riquadro dal bordo
// tratteggiato.
//
// - `allineamento="sinistra"` (`px-4 py-3`): sotto a un titolo, dentro a una
//   scheda. `"centro"` (`px-4 py-5`, testo centrato): al posto di un elenco.
//
// Niente 'use client': è solo markup e classi.
const statoVuotoVariants = cva('rounded-xl border border-dashed border-input bg-white px-4 text-sm text-stone-700', {
  variants: {
    allineamento: {
      sinistra: 'py-3',
      centro: 'py-5 text-center',
    },
  },
  defaultVariants: { allineamento: 'sinistra' },
});

type StatoVuotoProps = ComponentProps<'p'> & VariantProps<typeof statoVuotoVariants>;

function StatoVuoto({ className, allineamento, ...props }: StatoVuotoProps) {
  return <p data-slot="stato-vuoto" className={cn(statoVuotoVariants({ allineamento }), className)} {...props} />;
}

export { StatoVuoto, statoVuotoVariants };
export type { StatoVuotoProps };
