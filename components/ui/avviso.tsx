import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Avviso (issue #340, specs/01 - ux.md): riquadro colorato per un messaggio
// all'utente. Colori dai token di significato.
//
// - `tono`: "errore" (Pericolo), "attenzione" (Avviso), "informazione",
//   "successo".
// - Ruolo: l'errore è `role="alert"` (annunciato subito dai lettori di
//   schermo), gli altri `role="status"`. Se serve altro si passa `role`.
//
// Niente 'use client': è solo markup e classi.
const avvisoVariants = cva('rounded-xl border p-4 text-sm', {
  variants: {
    tono: {
      errore: 'border-danger-border bg-danger-soft text-danger-text',
      attenzione: 'border-warning-border bg-warning-soft text-warning-text',
      informazione: 'border-info-border bg-info-soft text-info-text',
      successo: 'border-success-border bg-success-soft text-success-text',
    },
  },
  defaultVariants: { tono: 'informazione' },
});

type AvvisoProps = ComponentProps<'div'> & VariantProps<typeof avvisoVariants>;

function Avviso({ className, tono, role, ...props }: AvvisoProps) {
  return (
    <div
      data-slot="avviso"
      role={role ?? (tono === 'errore' ? 'alert' : 'status')}
      className={cn(avvisoVariants({ tono }), className)}
      {...props}
    />
  );
}

export { Avviso, avvisoVariants };
export type { AvvisoProps };
