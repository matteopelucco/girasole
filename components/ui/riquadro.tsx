import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Riquadro ("Card" di specs/01 - ux.md, issue #340): contenitore a scheda con
// angoli `rounded-xl`, bordo `border`, sfondo bianco e `shadow-xs`. Sono i
// valori già in uso nell'app, scelti perché nessuna scheda cambi aspetto.
// Padding e layout li decide chi lo usa (`className`). Per un elemento che non
// è un `<div>` (es. un `<Link>`) si usa `riquadroVariants()` come classi.
//
// - `accento="neutro"`: filo di 4 px a sinistra nel colore `neutral-border`
//   (giorni di chiusura).
//
// Niente 'use client': è solo markup e classi.
const riquadroVariants = cva('rounded-xl border border-border bg-white shadow-xs', {
  variants: {
    accento: {
      nessuno: '',
      neutro: 'border-l-4 border-l-neutral-border',
    },
  },
  defaultVariants: { accento: 'nessuno' },
});

type RiquadroProps = ComponentProps<'div'> & VariantProps<typeof riquadroVariants>;

function Riquadro({ className, accento, ...props }: RiquadroProps) {
  return <div data-slot="riquadro" className={cn(riquadroVariants({ accento }), className)} {...props} />;
}

export { Riquadro, riquadroVariants };
export type { RiquadroProps };
