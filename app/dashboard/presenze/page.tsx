import { PaginaAttivitaGiornaliera } from '@/components/PaginaAttivitaGiornaliera';
import { EtichettaMalattia } from '@/components/EtichettaMalattia';
import { AvvisoInconsistenza } from '@/components/AvvisoInconsistenza';
import { RiepilogoConteggio } from '@/components/RiepilogoConteggio';
import { CardRiepilogo } from '@/components/CardRiepilogo';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { BottoneSalvaNota } from '@/components/BottoneSalvaNota';
import { requireStaff } from '@/lib/auth';
import { sezioniEBambiniVisibili, raggruppaPerSezione, messaggioSezioniVuote } from '@/lib/sezioni';
import { classePulsanteStato, classePulsanteToggle } from '@/lib/classiStato';
import type { RigaPresenza } from '@/lib/presenza';
import { inconsistenzeGiorno, type StatoPasto, type StatoPresenza } from '@/lib/consistenza';
import { editabilitaGiorno } from '@/lib/calendarioScolastico';
import { segnaPresenza, segnaPreAsilo, segnaPostAsilo, salvaNotaPresenza } from './actions';

export const dynamic = 'force-dynamic';

const ETICHETTE: Record<string, string> = {
  presente: 'Presente',
  assente: 'Assente',
  malattia: 'Malattia',
};

// "Presenze giornaliere - Sezione {nome}" per una sezione vera, senza il
// prefisso "Sezione" per il gruppo "Senza sezione" (specs/12).
function titoloRiepilogoSezione(titoloGruppo: string): string {
  return titoloGruppo === 'Senza sezione' ? 'Presenze giornaliere - Senza sezione' : `Presenze giornaliere - Sezione ${titoloGruppo}`;
}

export default async function PresenzePage({ searchParams }: { searchParams: { data?: string } }) {
  const { supabase, user, profilo, ruolo, data } = await requireStaff(searchParams);
  const { sezioni, bambini } = await sezioniEBambiniVisibili(supabase, user.id, ruolo);
  const idBambini = bambini.map((b) => b.id);

  const [{ data: presenzeData }, { data: pastiData }, { editable, messaggioChiuso }] = await Promise.all([
    idBambini.length
      ? supabase
          .from('presenze')
          .select('bambino_id, stato, note, pre_asilo, post_asilo')
          .eq('data', data)
          .in('bambino_id', idBambini)
      : Promise.resolve({
          data: [] as { bambino_id: string; stato: string; note: string | null; pre_asilo: boolean; post_asilo: boolean }[],
        }),
    idBambini.length
      ? supabase.from('pasti').select('bambino_id, mangiato').eq('data', data).in('bambino_id', idBambini)
      : Promise.resolve({ data: [] as { bambino_id: string; mangiato: string }[] }),
    editabilitaGiorno(supabase, data, ruolo),
  ]);

  const presenzaPerBambino = new Map((presenzeData ?? []).map((p) => [p.bambino_id, p]));
  const pastoPerBambino = new Map((pastiData ?? []).map((p) => [p.bambino_id, p.mangiato]));

  // Riepilogo aggregato su tutte le sezioni visibili (specs/12, scenario
  // "riepilogo aggregato di tutte le classi"), prima ancora dei gruppi
  // per sezione.
  const riepilogoAggregato = bambini.length ? (
    <CardRiepilogo titolo="Presenze giornaliere">
      <div className="flex flex-wrap gap-2">
        <RiepilogoConteggio
          etichetta="Presenti"
          numeratore={bambini.filter((b) => presenzaPerBambino.get(b.id)?.stato === 'presente').length}
          denominatore={bambini.length}
        />
        <RiepilogoConteggio
          etichetta="Pre-asilo"
          numeratore={bambini.filter((b) => presenzaPerBambino.get(b.id)?.pre_asilo).length}
        />
        <RiepilogoConteggio
          etichetta="Post-asilo"
          numeratore={bambini.filter((b) => presenzaPerBambino.get(b.id)?.post_asilo).length}
        />
      </div>
    </CardRiepilogo>
  ) : null;

  function rigaBambino(bambino: { id: string; nome: string; cognome: string }) {
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
    const nomeCompleto = `${bambino.nome} ${bambino.cognome}`;

    return (
      <li key={bambino.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{nomeCompleto}</span>
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
                formAction={segnaPresenza.bind(null, bambino.id, 'presente', data)}
                className={classePulsanteStato('presente', presenza?.stato === 'presente')}
              >
                {ETICHETTE.presente}
              </PulsanteInvio>
              <PulsanteInvio
                mantieniTesto
                formAction={segnaPreAsilo.bind(null, bambino.id, rigaAttuale, data)}
                className={classePulsanteToggle(!!presenza?.pre_asilo)}
              >
                Pre-asilo
              </PulsanteInvio>
              <PulsanteInvio
                mantieniTesto
                formAction={segnaPostAsilo.bind(null, bambino.id, rigaAttuale, data)}
                className={classePulsanteToggle(!!presenza?.post_asilo)}
              >
                Post-asilo
              </PulsanteInvio>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PulsanteInvio
                mantieniTesto
                formAction={segnaPresenza.bind(null, bambino.id, 'assente', data)}
                className={classePulsanteStato('assente', presenza?.stato === 'assente')}
              >
                {ETICHETTE.assente}
              </PulsanteInvio>
              <PulsanteInvio
                mantieniTesto
                formAction={segnaPresenza.bind(null, bambino.id, 'malattia', data)}
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
                formAction={rigaAttuale ? salvaNotaPresenza.bind(null, bambino.id, data, rigaAttuale) : null}
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
  }

  const gruppi = raggruppaPerSezione(bambini, (b) => b.sezione_id, sezioni);

  let contenuto;
  if (!sezioni.length) {
    contenuto = <p className="text-sm text-stone-600">{messaggioSezioniVuote(ruolo)}</p>;
  } else if (!gruppi.length) {
    contenuto = <p className="text-sm text-stone-600">Nessun bambino attivo in nessuna classe.</p>;
  } else {
    contenuto = (
      <div className="space-y-6">
        {gruppi.map((gruppo) => (
          <div key={gruppo.titolo} className="space-y-3">
            <CardRiepilogo titolo={titoloRiepilogoSezione(gruppo.titolo)}>
              <div className="flex flex-wrap gap-2">
                <RiepilogoConteggio
                  etichetta="Presenti"
                  numeratore={gruppo.elementi.filter((b) => presenzaPerBambino.get(b.id)?.stato === 'presente').length}
                  denominatore={gruppo.elementi.length}
                />
                <RiepilogoConteggio
                  etichetta="Pre-asilo"
                  numeratore={gruppo.elementi.filter((b) => presenzaPerBambino.get(b.id)?.pre_asilo).length}
                />
                <RiepilogoConteggio
                  etichetta="Post-asilo"
                  numeratore={gruppo.elementi.filter((b) => presenzaPerBambino.get(b.id)?.post_asilo).length}
                />
              </div>
            </CardRiepilogo>
            <ul className="space-y-3">{gruppo.elementi.map(rigaBambino)}</ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <PaginaAttivitaGiornaliera
      nome={profilo?.nome || user.email || ''}
      ruolo={ruolo}
      titolo="Presenze"
      basePath="/dashboard/presenze"
      data={data}
      riepilogoAggregato={riepilogoAggregato}
      messaggioChiusura={messaggioChiuso}
      editable={editable}
    >
      {contenuto}
    </PaginaAttivitaGiornaliera>
  );
}
