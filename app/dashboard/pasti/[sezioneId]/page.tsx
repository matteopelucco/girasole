import { redirect } from 'next/navigation';
import { PaginaClasseAttivita } from '@/components/PaginaClasseAttivita';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { EtichettaAssente } from '@/components/EtichettaAssente';
import { RiepilogoConteggio } from '@/components/RiepilogoConteggio';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { BottoneSalvaNota } from '@/components/BottoneSalvaNota';
import { requireStaff, puoScrivereData } from '@/lib/auth';
import { sezionePerId } from '@/lib/sezioni';
import { classePulsanteStato } from '@/lib/classiStato';
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

  const [{ data: pastiData }, { data: presenzeData }] = await Promise.all([
    idBambini.length
      ? supabase.from('pasti').select('bambino_id, mangiato, note').eq('data', data).in('bambino_id', idBambini)
      : Promise.resolve({ data: [] as { bambino_id: string; mangiato: string; note: string | null }[] }),
    idBambini.length
      ? supabase.from('presenze').select('bambino_id, stato').eq('data', data).in('bambino_id', idBambini)
      : Promise.resolve({ data: [] as { bambino_id: string; stato: string }[] }),
  ]);

  const pastoPerBambino = new Map((pastiData ?? []).map((p) => [p.bambino_id, p]));
  const presenzaPerBambino = new Map((presenzeData ?? []).map((p) => [p.bambino_id, p.stato]));
  const editable = puoScrivereData(ruolo, data);

  const bambiniNonAssenti = bambini.filter((b) => presenzaPerBambino.get(b.id) !== 'assente');
  const numeroMangiato = bambiniNonAssenti.filter((b) => pastoPerBambino.get(b.id)?.mangiato === 'si').length;

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
          <RiepilogoConteggio
            etichetta="Pasti"
            numeratore={numeroMangiato}
            denominatore={bambiniNonAssenti.length}
          />
        )
      }
    >
      {bambini.map((bambino) => {
        const pasto = pastoPerBambino.get(bambino.id);
        const statoPresenza = presenzaPerBambino.get(bambino.id);
        const assente = statoPresenza === 'assente';

        return (
          <li key={bambino.id} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {bambino.nome} {bambino.cognome}
              </span>
              <div className="flex flex-wrap gap-1">
                {assente && <EtichettaAssente />}
                {!assente && statoPresenza === 'malattia' && <EtichettaMalattia />}
                {bambino.note_allergie && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    ⚠ {bambino.note_allergie}
                  </span>
                )}
              </div>
            </div>

            {assente ? (
              <p className="mt-3 text-sm text-stone-500">
                Bambino assente: il pasto non è applicabile.
              </p>
            ) : editable ? (
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
                {pasto?.note && <span className="text-stone-500">— {pasto.note}</span>}
              </div>
            )}
          </li>
        );
      })}
    </PaginaClasseAttivita>
  );
}
