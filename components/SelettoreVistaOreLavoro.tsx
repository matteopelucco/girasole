import Link from 'next/link';

// Selettore "Mese / Settimana" delle ore di un dipendente (specs/18,
// vista dell'admin): due link, il corrente è marcato con aria-current
// (un testo, non solo il colore, specs/01). Server Component: nessuno
// stato, la vista è nell'URL.
export function SelettoreVistaOreLavoro({
  vista,
  hrefMese,
  hrefSettimana,
}: {
  vista: 'mese' | 'settimana';
  hrefMese: string;
  hrefSettimana: string;
}) {
  const classe = (attiva: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${
      attiva ? 'bg-stone-800 text-white' : 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-100'
    }`;
  return (
    <nav aria-label="Vista ore di lavoro" className="flex gap-2">
      <Link href={hrefMese} className={classe(vista === 'mese')} aria-current={vista === 'mese' ? 'page' : undefined}>
        Mese
      </Link>
      <Link
        href={hrefSettimana}
        className={classe(vista === 'settimana')}
        aria-current={vista === 'settimana' ? 'page' : undefined}
      >
        Settimana
      </Link>
    </nav>
  );
}
