import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Etichetta di un campo e testi che lo accompagnano (issue #339).
//
// - `Etichetta`: `<label>` nativo, da collegare con `htmlFor`/`id`.
// - `TestoAiuto`: spiegazione sotto il campo. Per collegarlo al campo gli
//   si dà un `id` e lo si passa al campo come `aria-describedby`.
// - `TestoErrore`: messaggio di errore, stesso collegamento; il campo in
//   errore porta anche `aria-invalid`.
//
// Esempio:
//   <Etichetta htmlFor="nome">Nome</Etichetta>
//   <Campo id="nome" aria-invalid={!!errore} aria-describedby="nome-errore" />
//   <TestoErrore id="nome-errore">{errore}</TestoErrore>
//
// Nessun `role="alert"`: l'annuncio dell'errore lo decide chi lo mostra
// (es. `DialogErrore`), per non duplicarlo ai lettori di schermo.
function Etichetta({ className, ...props }: ComponentProps<'label'>) {
  return <label data-slot="etichetta" className={cn('block text-sm font-medium text-stone-700', className)} {...props} />;
}

function TestoAiuto({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="testo-aiuto" className={cn('mt-1 text-xs text-muted-foreground', className)} {...props} />;
}

function TestoErrore({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="testo-errore" className={cn('mt-1 text-xs text-danger', className)} {...props} />;
}

export { Etichetta, TestoAiuto, TestoErrore };
