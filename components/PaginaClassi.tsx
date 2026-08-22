import { NavHeader } from '@/components/NavHeader';
import { ElencoClassi } from '@/components/ElencoClassi';
import { requireStaff } from '@/lib/auth';
import { sezioniAttiveVisibili } from '@/lib/sezioni';

// Schermata "elenco classi" completa (header + navigazione + elenco),
// condivisa dalle route app/dashboard/presenze/page.tsx e
// app/dashboard/pasti/page.tsx: stessa logica di accesso/caricamento
// classi, cambiano solo titolo e percorso (specs/12 - dashboard-maestre.md).
export async function PaginaClassi({
  titolo,
  basePath,
  searchParams,
}: {
  titolo: string;
  basePath: string;
  searchParams: { data?: string };
}) {
  const { supabase, user, profilo, ruolo, data } = await requireStaff(searchParams);
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
            ruolo === 'maestra'
              ? 'Non hai ancora nessuna sezione assegnata: chiedi all’admin di assegnartene una.'
              : 'Nessuna classe attiva ancora creata.'
          }
        />
      </main>
    </>
  );
}
