import { redirect } from 'next/navigation';
import { PaginaClasseAttivita } from '@/components/PaginaClasseAttivita';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { BottoneSalvaNota } from '@/components/BottoneSalvaNota';
import { requireStaff, puoScrivereData } from '@/lib/auth';
import { sezionePerId } from '@/lib/sezioni';
import { classePulsanteStato } from '@/lib/classiStato';
import { segnaPresenza, salvaNotaPresenza } from '../actions';

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

  const { data: presenzeData } = idBambini.length
    ? await supabase
        .from('presenze')
        .select('bambino_id, stato, note')
        .eq('data', data)
        .in('bambino_id', idBambini)
    : { data: [] as { bambino_id: string; stato: string; note: string | null }[] };

  const presenzaPerBambino = new Map((presenzeData ?? []).map((p) => [p.bambino_id, p]));
  const editable = puoScrivereData(ruolo, data);

  return (
    <PaginaClasseAttivita
      nome={profilo?.nome || user.email || ''}
      ruolo={ruolo}
      titolo={`Presenze — ${sezione.nome}`}
      backHref={`/dashboard/presenze?data=${data}`}
      basePath={`/dashboard/presenze/${sezioneId}`}
      data={data}
      editable={editable}
      vuoto={!bambini.length}
    >
      {bambini.map((bambino) => {
        const presenza = presenzaPerBambino.get(bambino.id);
        return (
          <li key={bambino.id} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {bambino.nome} {bambino.cognome}
              </span>
              {presenza?.stato === 'malattia' && <EtichettaMalattia />}
            </div>

            {editable ? (
              <form className="mt-3 flex flex-wrap items-center gap-2">
                {(['presente', 'assente', 'malattia'] as const).map((stato) => (
                  <PulsanteInvio
                    key={stato}
                    mantieniTesto
                    formAction={segnaPresenza.bind(null, bambino.id, stato, sezioneId, data)}
                    className={classePulsanteStato(stato, presenza?.stato === stato)}
                  >
                    {ETICHETTE[stato]}
                  </PulsanteInvio>
                ))}
                <input
                  name="nota_presenza"
                  defaultValue={presenza?.note ?? ''}
                  placeholder="Nota (opzionale)"
                  className="min-w-[10rem] flex-1 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                />
                <BottoneSalvaNota
                  formAction={
                    presenza
                      ? salvaNotaPresenza.bind(
                          null,
                          bambino.id,
                          sezioneId,
                          data,
                          presenza.stato as 'presente' | 'assente' | 'malattia'
                        )
                      : null
                  }
                />
              </form>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-600">
                <span>{presenza ? ETICHETTE[presenza.stato] : 'Non ancora segnato'}</span>
                {presenza?.note && <span className="text-stone-500">— {presenza.note}</span>}
              </div>
            )}
          </li>
        );
      })}
    </PaginaClasseAttivita>
  );
}
