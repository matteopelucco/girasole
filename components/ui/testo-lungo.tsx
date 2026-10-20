import type { ComponentProps } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { campoVariants } from './campo';

// Area di testo dell'app (issue #339): `<textarea>` nativo con le stesse
// misure, lo stesso anello di focus e lo stesso stato di errore di `Campo`.
type TestoLungoProps = ComponentProps<'textarea'> & VariantProps<typeof campoVariants>;

function TestoLungo({ className, misura, ...props }: TestoLungoProps) {
  return <textarea data-slot="testo-lungo" className={cn(campoVariants({ misura }), className)} {...props} />;
}

export { TestoLungo };
export type { TestoLungoProps };
