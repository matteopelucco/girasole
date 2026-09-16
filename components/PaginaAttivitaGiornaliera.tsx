import type { ReactNode } from 'react';
import { NavHeader } from '@/components/NavHeader';
import { SelettoreData } from '@/components/SelettoreData';

// Involucro comune a Presenze e Pasti (app/dashboard/presenze/page.tsx,
// app/dashboard/pasti/page.tsx — specs/12 - dashboard-maestre.md): header,
// selettore data, riepilogo aggregato e banner di sola lettura sono
// identici, cambia solo il contenuto raggruppato per sezione (`children`
// — costruito dalla pagina chiamante, perché le righe bambino di
// Presenze e Pasti hanno pulsanti diversi tra loro). Non c'è più una
// pagina "elenco classi" intermedia (vedi PaginaClassi/ElencoClassi/
// PaginaClasseAttivita, rimossi): la scelta di una classe è ora solo
// visiva (un titolo sopra ciascun gruppo), non un click in più.
export function PaginaAttivitaGiornaliera({
  nome,
  ruolo,
  titolo,
  basePath,
  data,
  riepilogoAggregato,
  extra,
  messaggioChiusura,
  editable,
  children,
}: {
  nome: string;
  ruolo: string | null;
  titolo: string;
  basePath: string;
  data: string;
  riepilogoAggregato?: ReactNode;
  extra?: ReactNode;
  // Messaggio di chiusura scolastica (specs/53 - calendario-scolastico.md)
  // per la data corrente, o null/undefined se scrivibile. Ha priorità sul
  // banner "sola lettura" sotto: vale per QUALUNQUE ruolo, admin incluso,
  // a differenza di quel banner (che riguarda solo maestra/assistente).
  messaggioChiusura?: string | null;
  editable: boolean;
  children: ReactNode;
}) {
  return (
    <NavHeader nome={nome} ruolo={ruolo}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <a href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">
            ← Torna alla dashboard
          </a>
          <h1 className="mt-2 text-lg font-medium">{titolo}</h1>
        </div>

        <SelettoreData basePath={basePath} data={data} />

        {riepilogoAggregato}
        {extra}

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

        {children}
      </main>
    </NavHeader>
  );
}
