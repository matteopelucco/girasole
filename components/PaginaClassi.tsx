import type { ReactNode } from 'react';
import { NavHeader } from '@/components/NavHeader';
import { ElencoClassi } from '@/components/ElencoClassi';
import { RiepilogoConteggio } from '@/components/RiepilogoConteggio';
import { CardRiepilogo } from '@/components/CardRiepilogo';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { requireStaff, assicuraAccessoPasti, puoScrivereData } from '@/lib/auth';
import { sezioniEBambiniVisibili } from '@/lib/sezioni';
import { formattaDataOraItaliana } from '@/lib/date';
import { contaPastiSiOggiTuttoAsilo, TELEFONO_ROJAC } from '@/lib/pastiRojac';
// Import "a ritroso" (components/ → app/), deliberato: comunicaPastiRojac
// (specs/16 - comunicazione-pasti-rojac.md) va mostrato solo qui, ma
// richiede lo stesso ruolo/data/supabase già risolti da requireStaff()
// poco sotto — duplicarli nella route chiamante (app/dashboard/pasti/page.tsx)
// avrebbe replicato la logica di bootstrap che questo componente esiste
// apposta per condividere (vedi commento sotto).
import { comunicaPastiRojac } from '@/app/dashboard/pasti/actions';

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
        <CardRiepilogo titolo="Presenze giornaliere">
          <div className="flex flex-wrap gap-2">
            <RiepilogoConteggio etichetta="Presenti" numeratore={presenti} denominatore={bambini.length} />
            <RiepilogoConteggio etichetta="Pre-asilo" numeratore={preAsilo} />
            <RiepilogoConteggio etichetta="Post-asilo" numeratore={postAsilo} />
          </div>
        </CardRiepilogo>
      );
    } else {
      const { data: pasti } = await supabase
        .from('pasti')
        .select('mangiato')
        .eq('data', data)
        .in('bambino_id', idBambini);
      const numeroMangiato = (pasti ?? []).filter((p) => p.mangiato === 'si').length;
      riepilogo = (
        <CardRiepilogo titolo="Pasti giornalieri">
          <RiepilogoConteggio etichetta="Pasti" numeratore={numeroMangiato} denominatore={bambini.length} />
        </CardRiepilogo>
      );
    }
  }

  // Comunicazione pasti a Rojac (specs/16): un'unica azione al giorno
  // sull'intero asilo, non sulle sole classi visibili a chi guarda —
  // per questo il riquadro compare in cima all'elenco classi di Pasti,
  // non dentro una singola classe.
  let riepilogoRojac: ReactNode = null;
  if (tipo === 'pasti') {
    const { data: comunicazione } = await supabase
      .from('pasti_comunicati')
      .select('numero_pasti, comunicato_at, comunicato_da_nome')
      .eq('data', data)
      .maybeSingle();

    if (comunicazione) {
      riepilogoRojac = (
        <CardRiepilogo titolo="Comunicazione pasti a Rojac">
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <span aria-hidden="true" className="text-green-600">
              ✓
            </span>{' '}
            Pasti comunicati a Rojac il {formattaDataOraItaliana(comunicazione.comunicato_at)}:{' '}
            {comunicazione.numero_pasti} pasti (da {comunicazione.comunicato_da_nome}).
          </p>
        </CardRiepilogo>
      );
    } else if (puoScrivereData(ruolo, data)) {
      const numeroPastiOggi = await contaPastiSiOggiTuttoAsilo(data);
      riepilogoRojac = (
        <CardRiepilogo titolo="Comunicazione pasti a Rojac">
          <ConfermaAzione
            azione={comunicaPastiRojac}
            campiNascosti={{ data }}
            etichetta="Conferma pasti"
            messaggioConferma={
              <>
                Conferma <strong className="text-2xl font-extrabold">{numeroPastiOggi}</strong> pasti a Rojac (
                {TELEFONO_ROJAC})
              </>
            }
            etichettaConferma="Conferma"
            tono="neutro"
          />
        </CardRiepilogo>
      );
    }
  }

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={ruolo}>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <a href={`/dashboard?data=${data}`} className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna alla dashboard
        </a>
        <ElencoClassi
          titolo={titolo}
          basePath={basePath}
          data={data}
          sezioni={sezioni}
          riepilogo={
            (riepilogo || riepilogoRojac) && (
              <div className="space-y-4">
                {riepilogo}
                {riepilogoRojac}
              </div>
            )
          }
          messaggioVuoto={
            ruolo === 'maestra' || ruolo === 'assistente'
              ? 'Non hai ancora nessuna sezione assegnata: chiedi all’admin di assegnartene una.'
              : 'Nessuna classe attiva ancora creata.'
          }
        />
      </main>
    </NavHeader>
  );
}
