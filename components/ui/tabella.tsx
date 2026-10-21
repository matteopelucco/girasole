import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Riquadro } from '@/components/ui/riquadro';

// Tabella (issue #341, specs/01 - ux.md): pezzi di una tabella dati, un solo
// schema al posto delle quattro varianti copiate nelle pagine. Restano gli
// elementi nativi (`<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<th>`,
// `<td>`): ruoli, `scope`, `aria-labelledby` e `<caption>` li decide chi usa i
// pezzi, come prima (nessun `scope` aggiunto di nascosto).
//
// - `TabellaScorrevole`: riquadro (`Riquadro`) con `overflow-x-auto`; su
//   telefono la tabella scorre in orizzontale lì dentro, la pagina no. Si usa
//   quando la tabella è larga; le tabelle strette stanno nella pagina.
// - `Tabella`: `w-full text-sm`; `separatori` aggiunge le righe tra le righe
//   (intestazione compresa).
// - `TabellaCorpo`: `separatori` aggiunge le righe sottili tra le righe.
// - `TabellaCella` e `TabellaTitolo`: `allinea` mette il testo a sinistra o a
//   destra (colonne di numeri); spaziatura e peso del carattere li decide
//   `className`, che ha la precedenza.
//
// Niente 'use client': è solo markup e classi.
const tabellaVariants = cva('w-full text-sm', {
  variants: {
    separatori: {
      true: 'divide-y divide-stone-200',
      false: '',
    },
  },
  defaultVariants: { separatori: false },
});

const corpoVariants = cva('', {
  variants: {
    separatori: {
      true: 'divide-y divide-stone-100',
      false: '',
    },
  },
  defaultVariants: { separatori: false },
});

const allineaVariants = cva('', {
  variants: {
    allinea: {
      sinistra: 'text-left',
      destra: 'text-right',
    },
  },
});

type TabellaProps = ComponentProps<'table'> & VariantProps<typeof tabellaVariants>;
type TabellaCorpoProps = ComponentProps<'tbody'> & VariantProps<typeof corpoVariants>;
type TabellaCellaProps = ComponentProps<'td'> & VariantProps<typeof allineaVariants>;
type TabellaTitoloProps = ComponentProps<'th'> & VariantProps<typeof allineaVariants>;

function TabellaScorrevole({ className, ...props }: ComponentProps<'div'>) {
  return <Riquadro data-slot="tabella-scorrevole" className={cn('overflow-x-auto', className)} {...props} />;
}

function Tabella({ className, separatori, ...props }: TabellaProps) {
  return <table data-slot="tabella" className={cn(tabellaVariants({ separatori }), className)} {...props} />;
}

function TabellaIntestazione(props: ComponentProps<'thead'>) {
  return <thead data-slot="tabella-intestazione" {...props} />;
}

function TabellaCorpo({ className, separatori, ...props }: TabellaCorpoProps) {
  return <tbody data-slot="tabella-corpo" className={cn(corpoVariants({ separatori }), className)} {...props} />;
}

function TabellaPiede(props: ComponentProps<'tfoot'>) {
  return <tfoot data-slot="tabella-piede" {...props} />;
}

function TabellaRiga(props: ComponentProps<'tr'>) {
  return <tr data-slot="tabella-riga" {...props} />;
}

function TabellaTitolo({ className, allinea, ...props }: TabellaTitoloProps) {
  return <th data-slot="tabella-titolo" className={cn(allineaVariants({ allinea }), className)} {...props} />;
}

function TabellaCella({ className, allinea, ...props }: TabellaCellaProps) {
  return <td data-slot="tabella-cella" className={cn(allineaVariants({ allinea }), className)} {...props} />;
}

export {
  Tabella,
  TabellaCella,
  TabellaCorpo,
  TabellaIntestazione,
  TabellaPiede,
  TabellaRiga,
  TabellaScorrevole,
  TabellaTitolo,
};
export type { TabellaCellaProps, TabellaCorpoProps, TabellaProps, TabellaTitoloProps };
