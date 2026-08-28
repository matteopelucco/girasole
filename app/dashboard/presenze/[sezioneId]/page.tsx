import { redirect } from 'next/navigation';
import { PaginaClasseAttivita } from '@/components/PaginaClasseAttivita';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { AvvisoInconsistenza } from '@/components/AvvisoInconsistenza';
import { RiepilogoConteggio } from '@/components/RiepilogoConteggio';
import { CardRiepilogo } from '@/components/CardRiepilogo';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { BottoneSalvaNota } from '@/components/BottoneSalvaNota';
import { requireStaff, puoScrivereData } from '@/lib/auth';
import { sezionePerId } from '@/lib/sezioni';
import { classePulsanteStato, classePulsanteToggle } from '@/lib/classiStato';
import type { RigaPresenza } from '@/lib/presenza';
import { inconsistenzeGiorno, type StatoPasto, type StatoPresenza } from '@/lib/consistenza';
import { chiusuraPerData, isGiornoChiuso, messaggioChiusura as calcolaMessaggioChiusura } from '@/lib/calendarioScolastico';
import { segnaPresenza, segnaPreAsilo, segnaPostAsilo, salvaNotaPresenza } from '../actions';

export const dynamic = 'force-dynamic';

const ETICHETTE: Record<string, string> = {
  presente: 'Presente',
  assente: 'Assente',
  malattia: 'Malattia',
};

export default async function PresenzeClassePage({
  params,
  searchParams,
}: {
  params: { sezioneId: string };
  searchParams: { data?: string };
}) {
  const { supabase, user, profilo, ruolo, data } = await requireStaff(searchParams);
  const { sezioneId } = params;

  const sezione = await sezionePerId(supabase, sezioneId);
  if (!sezione) redirect(`/dashboard/presenze?data=${data}`);

  const { data: bambiniSezione } = await supabase
    .from('bambini')
    .select('id, nome, cognome')
    .eq('sezione_id', sezioneId)
    .eq('attiva', true)
    .order('cognome');
  const bambini = bambiniSezione ?? [];
  const idBambini = bambini.map((b) => b.id);

  const [{ data: presenzeData }, { data: pastiData }] = idBambini.length
    ? await Promise.all([
        supabase
          .from('presenze')
          .select('bambino_id, stato, note, pre_asilo, post_asilo')
          .eq('data', data)
          .in('bambino_id', idBambini),
        supabase.from('pasti').select('bambino_id, mangiato').eq('data', data).in('bambino_id', idBambini),
      ])
    : [
        {
          data: [] as {
            bambino_id: string;
            stato: string;
            note: string | null;
            pre_asilo: boolean;
            post_asilo: boolean;
          }[],
        },
        { data: [] as { bambino_id: string; mangiato: string }[] },
      ];

  const presenzaPerBambino = new Map((presenzeData ?? []).map((p) => [p.bambino_id, p]));
  const pastoPerBambino = new Map((pastiData ?? []).map((p) => [p.bambino_id, p.mangiato]));

  const chiusura = await chiusuraPerData(supabase, data);
  const chiusure = chiusura ? [chiusura] : [];
  const chiuso = isGiornoChiuso(data, chiusure);
  const messaggioChiuso = calcolaMessaggioChiusura(data, chiusure);
  // Un giorno di chiusura scolastica non è scrivibile da nessuno, admin
  // incluso (specs/53 - calendario-scolastico.md, a differenza della
  // regola "sola data odierna" sotto, che esenta l'admin).
  const editable = puoScrivereData(ruolo, data) && !chiuso;
  const numeroPresenti = bambini.filter((b) => presenzaPerBambino.get(b.id)?.stato === 'presente').length;
  const numeroPreAsilo = bambini.filter((b) => presenzaPerBambino.get(b.id)?.pre_asilo).length;
  const numeroPostAsilo = bambini.filter((b) => presenzaPerBambino.get(b.id)?.post_asilo).length;

  return (
    <PaginaClasseAttivita
      nome={profilo?.nome || user.email || ''}
      ruolo={ruolo}
      titolo={`Presenze — ${sezione.nome}`}
      backHref={`/dashboard/presenze?data=${data}`}
      basePath={`/dashboard/presenze/${sezioneId}`}
      data={data}
      editable={editable}
      messaggioChiusura={messaggioChiuso}
      vuoto={!bambini.length}
      riepilogo={
        bambini.length > 0 && (
          <CardRiepilogo titolo={`Presenze giornaliere - Sezione ${sezione.nome}`}>
            <div className="flex flex-wrap gap-2">
              <RiepilogoConteggio etichetta="Presenti" numeratore={numeroPresenti} denominatore={bambini.length} />
              <RiepilogoConteggio etichetta="Pre-asilo" numeratore={numeroPreAsilo} />
              <RiepilogoConteggio etichetta="Post-asilo" numeratore={numeroPostAsilo} />
            </div>
          </CardRiepilogo>
        )
      }
    >
      {bambini.map((bambino) => {
        const presenza = presenzaPerBambino.get(bambino.id);
        const rigaAttuale: RigaPresenza | null = presenza
          ? {
              stato: presenza.stato as 'presente' | 'assente' | 'malattia',
              preAsilo: presenza.pre_asilo,
              postAsilo: presenza.post_asilo,
            }
          : null;
        const problemiConsistenza = inconsistenzeGiorno({
          stato: presenza?.stato as StatoPresenza | undefined,
          preAsilo: presenza?.pre_asilo,
          postAsilo: presenza?.post_asilo,
          mangiato: pastoPerBambino.get(bambino.id) as StatoPasto | undefined,
        });

        return (
          <li key={bambino.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {bambino.nome} {bambino.cognome}
              </span>
              <div className="flex flex-wrap gap-1">
                {presenza?.stato === 'malattia' && <EtichettaMalattia />}
                <AvvisoInconsistenza messaggi={problemiConsistenza} />
              </div>
            </div>

            {editable ? (
              <form className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <PulsanteInvio
                    mantieniTesto
                    formAction={segnaPresenza.bind(null, bambino.id, 'presente', sezioneId, data)}
                    className={classePulsanteStato('presente', presenza?.stato === 'presente')}
                  >
                    {ETICHETTE.presente}
                  </PulsanteInvio>
                  <PulsanteInvio
                    mantieniTesto
                    formAction={segnaPreAsilo.bind(null, bambino.id, rigaAttuale, sezioneId, data)}
                    className={classePulsanteToggle(!!presenza?.pre_asilo)}
                  >
                    Pre-asilo
                  </PulsanteInvio>
                  <PulsanteInvio
                    mantieniTesto
                    formAction={segnaPostAsilo.bind(null, bambino.id, rigaAttuale, sezioneId, data)}
                    className={classePulsanteToggle(!!presenza?.post_asilo)}
                  >
                    Post-asilo
                  </PulsanteInvio>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PulsanteInvio
                    mantieniTesto
                    formAction={segnaPresenza.bind(null, bambino.id, 'assente', sezioneId, data)}
                    className={classePulsanteStato('assente', presenza?.stato === 'assente')}
                  >
                    {ETICHETTE.assente}
                  </PulsanteInvio>
                  <PulsanteInvio
                    mantieniTesto
                    formAction={segnaPresenza.bind(null, bambino.id, 'malattia', sezioneId, data)}
                    className={classePulsanteStato('malattia', presenza?.stato === 'malattia')}
                  >
                    {ETICHETTE.malattia}
                  </PulsanteInvio>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <textarea
                    name="nota_presenza"
                    rows={2}
                    defaultValue={presenza?.note ?? ''}
                    placeholder="Nota (opzionale)"
                    className="min-w-[10rem] flex-1 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                  />
                  <BottoneSalvaNota
                    formAction={
                      rigaAttuale
                        ? salvaNotaPresenza.bind(null, bambino.id, sezioneId, data, rigaAttuale)
                        : null
                    }
                  />
                </div>
              </form>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-600">
                <span>{presenza ? ETICHETTE[presenza.stato] : 'Non ancora segnato'}</span>
                {presenza?.pre_asilo && <span className="text-sky-700">Pre-asilo</span>}
                {presenza?.post_asilo && <span className="text-sky-700">Post-asilo</span>}
                {presenza?.note && <span className="text-stone-600">— {presenza.note}</span>}
              </div>
            )}
          </li>
        );
      })}
    </PaginaClasseAttivita>
  );
}
