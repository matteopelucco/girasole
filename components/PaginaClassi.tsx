import type { ReactNode } from 'react';
import { NavHeader } from '@/components/NavHeader';
import { ElencoClassi } from '@/components/ElencoClassi';
import { RiepilogoConteggio } from '@/components/RiepilogoConteggio';
import { requireStaff, assicuraAccessoPasti } from '@/lib/auth';
import { sezioniEBambiniVisibili } from '@/lib/sezioni';

// Schermata "elenco classi" completa (header + navigazione + elenco),
// condivisa dalle route app/dashboard/presenze/page.tsx e
// app/dashboard/pasti/page.tsx: stessa logica di accesso/caricamento
// classi, cambiano solo titolo, percorso e il riepilogo aggregato
// (specs/12 - dashboard-maestre.md). `tipo` sceglie quale riepilogo
// calcolare (query diverse: presenze per "presenze", pasti per "pasti").
// `escludiAssistente` va passato solo dalla route Pasti: l'assistente
// non ha accesso al registro pasti, nemmeno all'elenco classi che vi fa
// da anticamera (specs/14 - segna-pasto.md).
export async function PaginaClassi({
  titolo,
  basePath,
  searchParams,
  tipo,
  escludiAssistente,
}: {
  titolo: string;
  basePath: string;
  searchParams: { data?: string };
  tipo: 'presenze' | 'pasti';
  escludiAssistente?: boolean;
}) {
  const { supabase, user, profilo, ruolo, data } = await requireStaff(searchParams);
  if (escludiAssistente) assicuraAccessoPasti(ruolo);
  const { sezioni, bambini } = await sezioniEBambiniVisibili(supabase, user.id, ruolo);
  const idBambini = bambini.map((b) => b.id);

  let riepilogo: ReactNode = null;
  if (idBambini.length) {
    if (tipo === 'presenze') {
      const { data: presenze } = await supabase
        .from('presenze')
        .select('stato, pre_asilo, post_asilo')
        .eq('data', data)
        .in('bambino_id', idBambini);
      const righe = presenze ?? [];
      const presenti = righe.filter((r) => r.stato === 'presente').length;
      const preAsilo = righe.filter((r) => r.pre_asilo).length;
      const postAsilo = righe.filter((r) => r.post_asilo).length;
      riepilogo = (
        <div className="flex flex-wrap gap-2">
          <RiepilogoConteggio etichetta="Presenti" numeratore={presenti} denominatore={bambini.length} />
          <RiepilogoConteggio etichetta="Pre-asilo" numeratore={preAsilo} />
          <RiepilogoConteggio etichetta="Post-asilo" numeratore={postAsilo} />
        </div>
      );
    } else {
      const { data: pasti } = await supabase
        .from('pasti')
        .select('mangiato')
        .eq('data', data)
        .in('bambino_id', idBambini);
      const numeroMangiato = (pasti ?? []).filter((p) => p.mangiato === 'si').length;
      riepilogo = (
        <RiepilogoConteggio etichetta="Pasti" numeratore={numeroMangiato} denominatore={bambini.length} />
      );
    }
  }

  return (
    <>
      <NavHeader nome={profilo?.nome || user.email || ''} ruolo={ruolo} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <a href={`/dashboard?data=${data}`} className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna alla dashboard
        </a>
        <ElencoClassi
          titolo={titolo}
          basePath={basePath}
          data={data}
          sezioni={sezioni}
          riepilogo={riepilogo}
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
