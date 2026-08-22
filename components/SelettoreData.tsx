import Link from 'next/link';
import { oggi, sommaGiorni, formattaDataItaliana } from '@/lib/date';

// Il "calendario" richiesto da specs/01 - ux.md e specs/12 -
// dashboard-maestre.md: frecce giorno prima/dopo (un tap) più un input
// nativo per saltare a una data qualsiasi. Server Component puro — un
// <form method="get"> funziona anche senza JavaScript, coerente con la
// preferenza per i Server Component di CLAUDE.md.
export function SelettoreData({ basePath, data }: { basePath: string; data: string }) {
  const ieri = sommaGiorni(data, -1);
  const domani = sommaGiorni(data, 1);
  const dataOdierna = oggi();
  const isOggi = data === dataOdierna;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <Link
        href={`${basePath}?data=${ieri}`}
        aria-label="Giorno precedente"
        className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
      >
        ←
      </Link>
      <form method="get" action={basePath} className="flex items-center gap-2">
        <input
          type="date"
          name="data"
          defaultValue={data}
          aria-label="Data"
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          Vai
        </button>
      </form>
      <Link
        href={`${basePath}?data=${domani}`}
        aria-label="Giorno successivo"
        className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
      >
        →
      </Link>
      <span className="text-sm font-medium capitalize text-amber-900">{formattaDataItaliana(data)}</span>
      {!isOggi && (
        <Link href={`${basePath}?data=${dataOdierna}`} className="text-sm text-amber-800 underline">
          Torna a oggi
        </Link>
      )}
    </div>
  );
}
