import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

// Pulsante unico dell'app (issue #338, specs/01 - ux.md, "Sistema grafico"),
// nello stile dei componenti shadcn/ui. I colori arrivano dai token di
// `app/globals.css`, mai dalla tinta della palette.
//
// - `variante`: "primario" (azione principale), "secondario" (azione
//   accessoria, bordo e sfondo bianco), "pericolo" (azione distruttiva).
// - `misura`: "normale" o "piccolo" (pulsanti compatti dentro a righe e
//   riquadri di conferma).
// - `asChild`: rende il figlio (es. `<Link>`) con le stesse classi, senza
//   cambiare ruolo né nome accessibile.
//
// Senza `variante` e `misura` il componente applica solo la parte comune
// (stato disabilitato e anello di focus): serve a `PulsanteInvio` per non
// cambiare i pulsanti che hanno ancora le loro classi nella pagina.
//
// Niente 'use client': è solo markup e classi, quindi resta un Server
// Component quando lo usa un Server Component.
const pulsanteVariants = cva(
  // Parte comune. Stato disabilitato uguale per tutte le varianti; anello di
  // focus da tastiera unico, dal token `ring`, identico in ogni variante.
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variante: {
        primario: 'rounded-base bg-primary text-primary-foreground hover:bg-primary-hover',
        secondario:
          'rounded-base border border-input bg-background text-stone-700 hover:bg-secondary',
        pericolo: 'rounded-base bg-danger text-primary-foreground hover:bg-danger-text',
      },
      misura: {
        // Altezza minima per il tocco su telefono (issue #343): 44 px sotto
        // 640 px (`sm`), poi torna l'altezza naturale. `inline-flex` perché
        // `min-height` non vale su un elemento in linea (link con `asChild`).
        normale:
          'inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm font-medium sm:min-h-0',
        // Mai sotto 32 px su telefono (issue #343).
        piccolo:
          'inline-flex min-h-8 items-center justify-center px-3 py-1 text-xs font-medium sm:min-h-0',
      },
    },
  },
);

type PulsanteProps = ComponentProps<'button'> &
  VariantProps<typeof pulsanteVariants> & {
    asChild?: boolean;
  };

function Pulsante({ className, variante, misura, asChild = false, type, ...props }: PulsanteProps) {
  const Componente = asChild ? Slot.Root : 'button';

  return (
    <Componente
      data-slot="pulsante"
      // Un <button> senza type dentro a un <form> invia il form: meglio
      // "button" di default; chi invia lo dichiara (`type="submit"`). Con
      // asChild il figlio (es. un link) non ha un type.
      {...(asChild ? {} : { type: type ?? 'button' })}
      className={cn(pulsanteVariants({ variante, misura }), className)}
      {...props}
    />
  );
}

export { Pulsante, pulsanteVariants };
export type { PulsanteProps };
