import type { ReactNode } from 'react';
import Link from 'next/link';
import { SelettoreData } from '@/components/SelettoreData';
import type { SezioneAttiva } from '@/lib/sezioni';

// Schermata "elenco classi", condivisa da Presenze e Pasti (specs/12 -
// dashboard-maestre.md): stesso layout, cambiano solo titolo, percorso e
// messaggio quando non ci sono classi. `riepilogo` (opzionale) mostra la
// sommatoria di tutte le classi visibili, ancora prima di sceglierne una
// (specs/12, scenario "riepilogo aggregato di tutte le classi").
export function ElencoClassi({
  titolo,
  basePath,
  data,
  sezioni,
  riepilogo,
  messaggioVuoto,
}: {
  titolo: string;
  basePath: string;
  data: string;
  sezioni: SezioneAttiva[];
  riepilogo?: ReactNode;
  messaggioVuoto: string;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium">{titolo}</h1>

      <SelettoreData basePath={basePath} data={data} />

      {riepilogo}

      {!sezioni.length && <p className="text-sm text-stone-600">{messaggioVuoto}</p>}

      <ul className="space-y-2">
        {sezioni.map((sezione) => (
          <li key={sezione.id}>
            <Link
              href={`${basePath}/${sezione.id}?data=${data}`}
              className="block rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-medium text-emerald-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-md"
            >
              {sezione.nome}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
