import Link from 'next/link';
import { Pulsante } from '@/components/ui/pulsante';

// Selettore "Mese / Settimana" delle ore di un dipendente (specs/18,
// vista dell'admin): due link, il corrente è marcato con aria-current
// (un testo, non solo il colore, specs/01). Stesso schema del selettore
// del tipo di report: voce corrente "primario", l'altra "secondario".
// Server Component: nessuno stato, la vista è nell'URL.
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
    <nav aria-label="Vista ore di lavoro" className="flex gap-2">
      <Pulsante asChild variante={vista === 'mese' ? 'primario' : 'secondario'} misura="normale">
        <Link href={hrefMese} aria-current={vista === 'mese' ? 'page' : undefined}>
          Mese
        </Link>
      </Pulsante>
      <Pulsante asChild variante={vista === 'settimana' ? 'primario' : 'secondario'} misura="normale">
        <Link href={hrefSettimana} aria-current={vista === 'settimana' ? 'page' : undefined}>
          Settimana
        </Link>
      </Pulsante>
    </nav>
  );
}
