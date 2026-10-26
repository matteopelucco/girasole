import type { ReactNode } from 'react';
import Link from 'next/link';
import { Pulsante } from '@/components/ui/pulsante';
import { cn } from '@/lib/utils';

// Selettore a pillole (issue #352, specs/01 - ux.md, "Schede e selettore a
// pillole"): un gruppo di link con cui si FILTRA un elenco (tipo di report,
// mese o settimana); per cambiare la parte di pagina si usano invece le schede
// (`components/Schede.tsx`).
//
// Ogni pillola è un `<Link>` dentro a `Pulsante asChild`: la voce scelta è
// "primario" (token `primary`, lo stesso colore della sottolineatura della
// scheda attiva), le altre "secondario"; altezza di tocco e anello di focus
// (token `ring`) sono quelli del Pulsante. La voce scelta ha anche
// `aria-current="page"` (un testo, non solo il colore, specs/01).
//
// - `etichetta`: se c'è, il gruppo è un `<nav aria-label>`; altrimenti un
//   `<div>` (la pagina ha già il suo contesto).
// - `children`: altri elementi accanto alle pillole (es. un link che non è un
//   filtro), dentro allo stesso contenitore.
//
// Niente 'use client': è solo markup, la voce scelta è nell'indirizzo.
export type VocePillola = { id: string; etichetta: string; href: string };

export function SelettorePillole({
  voci,
  attiva,
  etichetta,
  className,
  children,
}: {
  voci: readonly VocePillola[];
  attiva: string;
  etichetta?: string;
  className?: string;
  children?: ReactNode;
}) {
  const Contenitore = etichetta ? 'nav' : 'div';
  return (
    <Contenitore
      data-slot="selettore-pillole"
      {...(etichetta ? { 'aria-label': etichetta } : {})}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {voci.map((voce) => {
        const scelta = voce.id === attiva;
        return (
          <Pulsante key={voce.id} asChild variante={scelta ? 'primario' : 'secondario'} misura="normale">
            <Link href={voce.href} aria-current={scelta ? 'page' : undefined}>
              {voce.etichetta}
            </Link>
          </Pulsante>
        );
      })}
      {children}
    </Contenitore>
  );
}
