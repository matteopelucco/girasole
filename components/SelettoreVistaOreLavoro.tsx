import { SelettorePillole } from '@/components/ui/selettore-pillole';

// Selettore "Mese / Settimana" delle ore di un dipendente (specs/18,
// vista dell'admin): due link, il corrente è marcato con aria-current
// (un testo, non solo il colore, specs/01). Usa il Selettore a pillole
// (`components/ui/selettore-pillole.tsx`, issue #352), lo stesso del tipo di
// report. Server Component: nessuno stato, la vista è nell'URL.
export function SelettoreVistaOreLavoro({
  vista,
  hrefMese,
  hrefSettimana,
}: {
  vista: 'mese' | 'settimana';
  hrefMese: string;
  hrefSettimana: string;
}) {
  return (
    <SelettorePillole
      etichetta="Vista ore di lavoro"
      voci={[
        { id: 'mese', etichetta: 'Mese', href: hrefMese },
        { id: 'settimana', etichetta: 'Settimana', href: hrefSettimana },
      ]}
      attiva={vista}
    />
  );
}
