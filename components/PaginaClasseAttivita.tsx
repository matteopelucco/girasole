import type { ReactNode } from 'react';
import { NavHeader } from '@/components/NavHeader';
import { SelettoreData } from '@/components/SelettoreData';

// Involucro comune alle pagine "elenco bambini di una classe" per
// Presenze e Pasti (app/dashboard/presenze/[sezioneId]/page.tsx,
// app/dashboard/pasti/[sezioneId]/page.tsx): header, navigazione data e
// banner di sola lettura sono identici, cambia solo il contenuto della
// lista (i pulsanti di stato sono diversi tra le due attività).
export function PaginaClasseAttivita({
  nome,
  ruolo,
  titolo,
  backHref,
  basePath,
  data,
  editable,
  messaggioChiusura,
  vuoto,
  riepilogo,
  children,
}: {
  nome: string;
  ruolo: string | null;
  titolo: string;
  backHref: string;
  basePath: string;
  data: string;
  editable: boolean;
  // Messaggio di chiusura scolastica (specs/53 - calendario-scolastico.md)
  // per la data corrente, o null se scrivibile. Ha priorità sul banner
  // "sola lettura" sotto: vale per QUALUNQUE ruolo, admin incluso, a
  // differenza di quel banner (che riguarda solo maestra/assistente).
  messaggioChiusura?: string | null;
  vuoto: boolean;
  riepilogo?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <NavHeader nome={nome} ruolo={ruolo} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <a href={backHref} className="text-sm text-stone-600 hover:text-stone-900">
            ← Torna alle classi
          </a>
          <h1 className="mt-2 text-lg font-medium">{titolo}</h1>
        </div>

        <SelettoreData basePath={basePath} data={data} />

        {riepilogo}

        {messaggioChiusura ? (
          <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
            🔒 {messaggioChiusura}
          </p>
        ) : (
          !editable && (
            <p className="rounded-xl border border-stone-300 bg-stone-50 p-3 text-sm text-stone-600">
              Sola lettura: puoi modificare solo la data di oggi.
            </p>
          )
        )}

        {vuoto && <p className="text-sm text-stone-600">Nessun bambino in questa classe.</p>}

        <ul className="space-y-3">{children}</ul>
      </main>
    </>
  );
}
