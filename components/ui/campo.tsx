import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Campo di testo unico dell'app (issue #339, specs/01 - ux.md, "Sistema
// grafico"), nello stile dei componenti shadcn/ui. Vale anche per i campi
// `date`, `time`, `number`, `email`, `password`: il tipo è quello nativo.
// I colori arrivano dai token di `app/globals.css`, mai dalla tinta.
//
// - `misura`: "normale" (`px-3 py-2`, come i campi di oggi) o "piccolo"
//   (`px-2 py-1`, per i campi dentro a righe compatte). Il testo resta
//   a 14 px in entrambe: sotto non si legge bene da telefono.
// - Focus: un solo anello da 2 px nel colore `ring` (= primario), uguale in
//   `Campo`, `Selezione` e `TestoLungo`. Il bordo non cambia più, perché
//   l'anello è già il segnale. `focus-visible` e non `focus`: un campo di
//   testo lo mostra sempre quando riceve il focus.
// - Errore: chi segnala un campo non valido passa `aria-invalid`; il bordo
//   diventa `danger`. Il testo di aiuto/errore si collega con
//   `aria-describedby` (vedi `TestoAiuto`/`TestoErrore` in `etichetta.tsx`).
//
// Non aggiunge contenitori né attributi: il DOM resta quello di un
// `<input>`, quindi nome accessibile, ruolo e selettori delle e2e non
// cambiano. Niente 'use client': è solo markup e classi.
export const campoVariants = cva(
  'rounded-base border border-input text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      misura: {
        normale: 'px-3 py-2',
        piccolo: 'px-2 py-1',
      },
    },
    defaultVariants: {
      misura: 'normale',
    },
  },
);

type CampoProps = ComponentProps<'input'> & VariantProps<typeof campoVariants>;

function Campo({ className, misura, ...props }: CampoProps) {
  return <input data-slot="campo" className={cn(campoVariants({ misura }), className)} {...props} />;
}

export { Campo };
export type { CampoProps };
