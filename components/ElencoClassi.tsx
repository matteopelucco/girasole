import Link from 'next/link';
import { SelettoreData } from '@/components/SelettoreData';
import type { SezioneAttiva } from '@/lib/sezioni';

// Schermata "elenco classi", condivisa da Presenze e Pasti (specs/12 -
// dashboard-maestre.md): stesso layout, cambiano solo titolo, percorso e
// messaggio quando non ci sono classi.
export function ElencoClassi({
  titolo,
  basePath,
  data,
  sezioni,
  messaggioVuoto,
}: {
  titolo: string;
  basePath: string;
  data: string;
  sezioni: SezioneAttiva[];
  messaggioVuoto: string;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium">{titolo}</h1>

      <SelettoreData basePath={basePath} data={data} />

      {!sezioni.length && <p className="text-sm text-stone-600">{messaggioVuoto}</p>}

      <ul className="space-y-2">
        {sezioni.map((sezione) => (
          <li key={sezione.id}>
            <Link
              href={`${basePath}/${sezione.id}?data=${data}`}
              className="block rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-medium text-emerald-900 hover:bg-emerald-100"
            >
              {sezione.nome}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
