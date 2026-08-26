import { redirect } from 'next/navigation';
import { PaginaClasseAttivita } from '@/components/PaginaClasseAttivita';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { EtichettaAssente } from '@/components/EtichettaAssente';
import { AvvisoInconsistenza } from '@/components/AvvisoInconsistenza';
import { RiepilogoConteggio } from '@/components/RiepilogoConteggio';
import { CardRiepilogo } from '@/components/CardRiepilogo';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { BottoneSalvaNota } from '@/components/BottoneSalvaNota';
import { requireStaff, puoScrivereData, assicuraAccessoPasti } from '@/lib/auth';
import { sezionePerId } from '@/lib/sezioni';
import { classePulsanteStato } from '@/lib/classiStato';
import { inconsistenzeGiorno, type StatoPasto, type StatoPresenza } from '@/lib/consistenza';
import { formattaDataOraItaliana } from '@/lib/date';
import { segnaPasto, salvaNotaPasto } from '../actions';

export const dynamic = 'force-dynamic';

const ETICHETTE: Record<string, string> = { si: 'Sì', no: 'No' };

export default async function PastiClassePage({
  params,
  searchParams,
}: {
  params: { sezioneId: string };
  searchParams: { data?: string };
}) {
  const { supabase, user, profilo, ruolo, data } = await requireStaff(searchParams);
  assicuraAccessoPasti(ruolo);
  const { sezioneId } = params;

  const sezione = await sezionePerId(supabase, sezioneId);
  if (!sezione) redirect(`/dashboard/pasti?data=${data}`);

  const { data: bambiniSezione } = await supabase
    .from('bambini')
    .select('id, nome, cognome, note_allergie')
    .eq('sezione_id', sezioneId)
    .eq('attiva', true)
    .order('cognome');
  const bambini = bambiniSezione ?? [];
  const idBambini = bambini.map((b) => b.id);

  const [{ data: pastiData }, { data: presenzeData }, { data: comunicazione }] = await Promise.all([
    idBambini.length
      ? supabase.from('pasti').select('bambino_id, mangiato, note').eq('data', data).in('bambino_id', idBambini)
      : Promise.resolve({ data: [] as { bambino_id: string; mangiato: string; note: string | null }[] }),
    idBambini.length
      ? supabase.from('presenze').select('bambino_id, stato').eq('data', data).in('bambino_id', idBambini)
      : Promise.resolve({ data: [] as { bambino_id: string; stato: string }[] }),
    supabase
      .from('pasti_comunicati')
      .select('numero_pasti, comunicato_at, comunicato_da_nome')
      .eq('data', data)
      .maybeSingle(),
  ]);

  const pastoPerBambino = new Map((pastiData ?? []).map((p) => [p.bambino_id, p]));
  const presenzaPerBambino = new Map((presenzeData ?? []).map((p) => [p.bambino_id, p.stato]));
  const editable = puoScrivereData(ruolo, data);
  // La comunicazione a Rojac è per l'intero asilo (specs/16 -
  // comunicazione-pasti-rojac.md), non per questa sola classe: blocca
  // comunque la maestra qui, come in ogni altra classe. L'admin può
  // sempre modificare.
  const editabileRiga = editable && (ruolo === 'admin' || !comunicazione);

  const bambiniConPastoApplicabile = bambini.filter((b) => {
    const stato = presenzaPerBambino.get(b.id);
    return stato !== 'assente' && stato !== 'malattia';
  });
  const numeroMangiato = bambiniConPastoApplicabile.filter((b) => pastoPerBambino.get(b.id)?.mangiato === 'si').length;

  return (
    <PaginaClasseAttivita
      nome={profilo?.nome || user.email || ''}
      ruolo={ruolo}
      titolo={`Pasti — ${sezione.nome}`}
      backHref={`/dashboard/pasti?data=${data}`}
      basePath={`/dashboard/pasti/${sezioneId}`}
      data={data}
      editable={editable}
      vuoto={!bambini.length}
      riepilogo={
        bambini.length > 0 && (
          <CardRiepilogo titolo={`Pasti giornalieri - Sezione ${sezione.nome}`}>
            <div className="space-y-3">
              <RiepilogoConteggio
                etichetta="Pasti"
                numeratore={numeroMangiato}
                denominatore={bambiniConPastoApplicabile.length}
              />
              {comunicazione && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  I pasti di oggi (tutte le classi) sono stati comunicati a Rojac il{' '}
                  {formattaDataOraItaliana(comunicazione.comunicato_at)}: {comunicazione.numero_pasti} pasti totali
                  (da {comunicazione.comunicato_da_nome}).
                  {ruolo === 'admin' && ' Come admin puoi comunque modificare i pasti di qualunque classe.'}
                </p>
              )}
            </div>
          </CardRiepilogo>
        )
      }
    >
      {bambini.map((bambino) => {
        const pasto = pastoPerBambino.get(bambino.id);
        const statoPresenza = presenzaPerBambino.get(bambino.id);
        const assente = statoPresenza === 'assente';
        const malato = statoPresenza === 'malattia';
        const pastoNonApplicabile = assente || malato;
        const problemiConsistenza = inconsistenzeGiorno({
          stato: statoPresenza as StatoPresenza | undefined,
          mangiato: pasto?.mangiato as StatoPasto | undefined,
        });

        return (
          <li key={bambino.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {bambino.nome} {bambino.cognome}
              </span>
              <div className="flex flex-wrap gap-1">
                {assente && <EtichettaAssente />}
                {malato && <EtichettaMalattia />}
                {bambino.note_allergie && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    ⚠ {bambino.note_allergie}
                  </span>
                )}
                <AvvisoInconsistenza messaggi={problemiConsistenza} />
              </div>
            </div>

            {pastoNonApplicabile ? (
              <p className="mt-3 text-sm text-stone-600">
                {assente ? 'Bambino assente: il pasto non è applicabile.' : 'Bambino malato: il pasto non è applicabile.'}
              </p>
            ) : editabileRiga ? (
              <form className="mt-3 flex flex-wrap items-center gap-2">
                {(['si', 'no'] as const).map((mangiato) => (
                  <PulsanteInvio
                    key={mangiato}
                    mantieniTesto
                    formAction={segnaPasto.bind(null, bambino.id, mangiato, sezioneId, data)}
                    className={classePulsanteStato(mangiato, pasto?.mangiato === mangiato)}
                  >
                    {ETICHETTE[mangiato]}
                  </PulsanteInvio>
                ))}
                <input
                  name="nota_pasto"
                  defaultValue={pasto?.note ?? ''}
                  placeholder="Nota (opzionale)"
                  className="min-w-[10rem] flex-1 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                />
                <BottoneSalvaNota
                  formAction={
                    pasto
                      ? salvaNotaPasto.bind(null, bambino.id, sezioneId, data, pasto.mangiato as 'si' | 'no')
                      : null
                  }
                />
              </form>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-600">
                <span>{pasto ? ETICHETTE[pasto.mangiato] : 'Non ancora segnato'}</span>
                {pasto?.note && <span className="text-stone-600">— {pasto.note}</span>}
              </div>
            )}
          </li>
        );
      })}
    </PaginaClasseAttivita>
  );
}
