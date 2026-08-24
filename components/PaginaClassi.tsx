import { NavHeader } from '@/components/NavHeader';
import { ElencoClassi } from '@/components/ElencoClassi';
import { requireStaff, assicuraAccessoPasti } from '@/lib/auth';
import { sezioniAttiveVisibili } from '@/lib/sezioni';

// Schermata "elenco classi" completa (header + navigazione + elenco),
// condivisa dalle route app/dashboard/presenze/page.tsx e
// app/dashboard/pasti/page.tsx: stessa logica di accesso/caricamento
// classi, cambiano solo titolo e percorso (specs/12 - dashboard-maestre.md).
// `escludiAssistente` va passato solo dalla route Pasti: l'assistente
// non ha accesso al registro pasti, nemmeno all'elenco classi che vi fa
// da anticamera (specs/14 - segna-pasto.md).
export async function PaginaClassi({
  titolo,
  basePath,
  searchParams,
  escludiAssistente,
}: {
  titolo: string;
  basePath: string;
  searchParams: { data?: string };
  escludiAssistente?: boolean;
}) {
  const { supabase, user, profilo, ruolo, data } = await requireStaff(searchParams);
  if (escludiAssistente) assicuraAccessoPasti(ruolo);
  const sezioni = await sezioniAttiveVisibili(supabase, user.id, ruolo);

  return (
    <>
      <NavHeader nome={profilo?.nome || user.email || ''} ruolo={ruolo} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <a href={`/dashboard?data=${data}`} className="text-sm text-stone-500 hover:text-stone-900">
          ← Torna alla dashboard
        </a>
        <ElencoClassi
          titolo={titolo}
          basePath={basePath}
          data={data}
          sezioni={sezioni}
          messaggioVuoto={
            ruolo === 'maestra' || ruolo === 'assistente'
              ? 'Non hai ancora nessuna sezione assegnata: chiedi all’admin di assegnartene una.'
              : 'Nessuna classe attiva ancora creata.'
          }
        />
      </main>
    </>
  );
}
