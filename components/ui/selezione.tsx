import type { ComponentProps } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { campoVariants } from './campo';

// Menu a tendina dell'app (issue #339): resta l'elemento `<select>`
// nativo, che su telefono apre il selettore del sistema (ottimo da usare con
// un dito). Nessuna icona aggiunta: la freccia è quella del browser.
// Stesse misure, stesso anello di focus e stesso stato di errore di `Campo`.
type SelezioneProps = ComponentProps<'select'> & VariantProps<typeof campoVariants>;

function Selezione({ className, misura, ...props }: SelezioneProps) {
  return <select data-slot="selezione" className={cn(campoVariants({ misura }), className)} {...props} />;
}

export { Selezione };
export type { SelezioneProps };
