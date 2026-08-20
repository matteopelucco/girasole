import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { oggi } from '@/lib/date';
import { segnaPresenza, segnaPasto, creaPromemoria } from './actions';

const ETICHETTE_PRESENZA: Record<string, string> = {
  presente: 'Presente',
  assente: 'Assente',
  malattia: 'Malattia',
};
const ETICHETTE_PASTO: Record<string, string> = {
  si: 'Sì',
  no: 'No',
  parziale: 'Parziale',
};

function classePulsante(selezionato: boolean) {
  return selezionato
    ? 'rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white'
    : 'rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 hover:border-stone-500';
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profilo } = await supabase
    .from('profili')
    .select('nome, cognome, ruolo')
    .eq('id', user.id)
    .single();

  const ruolo = profilo?.ruolo ?? null;
  const nomeVisualizzato = profilo?.nome || user.email || '';

  if (ruolo !== 'admin' && ruolo !== 'maestra') {
    return (
      <>
        <NavHeader nome={nomeVisualizzato} ruolo={ruolo} />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-medium">Ciao {nomeVisualizzato}</h1>
          <p className="mt-1 text-sm text-stone-500">Ruolo: {ruolo ?? 'non impostato'}</p>
          <div className="mt-8 rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-500">
            Il portale genitori è in arrivo in una fase successiva.
          </div>
        </main>
      </>
    );
  }

  let sezioni: { id: string; nome: string }[] = [];
  let bambini: { id: string; nome: string; cognome: string; note_allergie: string | null }[] = [];

  if (ruolo === 'admin') {
    const [{ data: tutteSezioni }, { data: tuttiBambini }] = await Promise.all([
      supabase.from('sezioni').select('id, nome').order('nome'),
      supabase.from('bambini').select('id, nome, cognome, note_allergie').order('cognome'),
    ]);
    sezioni = tutteSezioni ?? [];
    bambini = tuttiBambini ?? [];
  } else {
    const { data: mieSezioni } = await supabase
      .from('maestre_sezioni')
      .select('sezione_id, sezioni(id, nome)')
      .eq('maestra_id', user.id);

    sezioni = (mieSezioni ?? [])
      .map((r) => r.sezioni as unknown as { id: string; nome: string } | null)
      .filter((s): s is { id: string; nome: string } => !!s);

    if (sezioni.length) {
      const { data: mieiBambini } = await supabase
        .from('bambini')
        .select('id, nome, cognome, note_allergie')
        .in(
          'sezione_id',
          sezioni.map((s) => s.id)
        )
        .order('cognome');
      bambini = mieiBambini ?? [];
    }
  }

  const oggiData = oggi();
  const idBambini = bambini.map((b) => b.id);

  const [{ data: presenzeOggi }, { data: pastiOggi }, { data: promemoria }] = await Promise.all([
    idBambini.length
      ? supabase.from('presenze').select('bambino_id, stato, note').eq('data', oggiData).in('bambino_id', idBambini)
      : Promise.resolve({ data: [] as { bambino_id: string; stato: string; note: string | null }[] }),
    idBambini.length
      ? supabase.from('pasti').select('bambino_id, mangiato, note').eq('data', oggiData).in('bambino_id', idBambini)
      : Promise.resolve({ data: [] as { bambino_id: string; mangiato: string; note: string | null }[] }),
    supabase
      .from('promemoria')
      .select('id, titolo, testo, destinatario_tipo, sezione_id, bambino_id, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const presenzaPerBambino = new Map((presenzeOggi ?? []).map((p) => [p.bambino_id, p]));
  const pastoPerBambino = new Map((pastiOggi ?? []).map((p) => [p.bambino_id, p]));

  return (
    <>
      <NavHeader nome={nomeVisualizzato} ruolo={ruolo} />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        {ruolo === 'admin' && (
          <div className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500">
            Per creare sezioni e bambini o gestire le maestre vai su{' '}
            <a href="/admin" className="underline">
              Sezioni e bambini
            </a>{' '}
            /{' '}
            <a href="/admin/maestre" className="underline">
              Maestre
            </a>
            .
          </div>
        )}

        <section>
          <h1 className="text-lg font-medium">Presenze e pasti di oggi</h1>
          {!bambini.length && (
            <p className="mt-3 text-sm text-stone-400">
              {ruolo === 'maestra'
                ? 'Non hai ancora nessuna sezione assegnata: chiedi all’admin di assegnartene una.'
                : 'Nessun bambino ancora inserito.'}
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {bambini.map((bambino) => {
              const presenza = presenzaPerBambino.get(bambino.id);
              const pasto = pastoPerBambino.get(bambino.id);
              return (
                <li key={bambino.id} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {bambino.nome} {bambino.cognome}
                    </span>
                    {bambino.note_allergie && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        ⚠ {bambino.note_allergie}
                      </span>
                    )}
                  </div>

                  <form className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="w-16 text-xs text-stone-500">Presenza</span>
                    {(['presente', 'assente', 'malattia'] as const).map((stato) => (
                      <button
                        key={stato}
                        formAction={segnaPresenza.bind(null, bambino.id, stato)}
                        className={classePulsante(presenza?.stato === stato)}
                      >
                        {ETICHETTE_PRESENZA[stato]}
                      </button>
                    ))}
                    <input
                      name="nota_presenza"
                      defaultValue={presenza?.note ?? ''}
                      placeholder="Nota (opzionale)"
                      className="min-w-[10rem] flex-1 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                    />
                  </form>

                  <form className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="w-16 text-xs text-stone-500">Pasto</span>
                    {(['si', 'no', 'parziale'] as const).map((mangiato) => (
                      <button
                        key={mangiato}
                        formAction={segnaPasto.bind(null, bambino.id, mangiato)}
                        className={classePulsante(pasto?.mangiato === mangiato)}
                      >
                        {ETICHETTE_PASTO[mangiato]}
                      </button>
                    ))}
                    <input
                      name="nota_pasto"
                      defaultValue={pasto?.note ?? ''}
                      placeholder="Nota (opzionale)"
                      className="min-w-[10rem] flex-1 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                    />
                  </form>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h1 className="text-lg font-medium">Promemoria</h1>

          <form action={creaPromemoria} className="mt-3 space-y-2 rounded-xl border border-stone-200 p-4">
            <input
              name="titolo"
              required
              placeholder="Titolo"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <textarea
              name="testo"
              required
              placeholder="Testo del promemoria"
              rows={3}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <div className="flex flex-wrap gap-2">
              <select
                name="destinatario_tipo"
                defaultValue="tutti"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              >
                <option value="tutti">Tutti</option>
                <option value="sezione">Una sezione</option>
                <option value="bambino">Un bambino</option>
              </select>
              <select
                name="sezione_id"
                defaultValue=""
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              >
                <option value="">— sezione (se destinatario è "Una sezione") —</option>
                {sezioni.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
              <select
                name="bambino_id"
                defaultValue=""
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              >
                <option value="">— bambino (se destinatario è "Un bambino") —</option>
                {bambini.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome} {b.cognome}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            >
              Pubblica promemoria
            </button>
          </form>

          <ul className="mt-4 space-y-2">
            {promemoria?.map((p) => (
              <li key={p.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                <div className="font-medium">{p.titolo}</div>
                <p className="mt-1 text-stone-600">{p.testo}</p>
                <p className="mt-1 text-xs text-stone-400">
                  {p.destinatario_tipo === 'tutti' && 'Per tutti'}
                  {p.destinatario_tipo === 'sezione' && 'Per una sezione'}
                  {p.destinatario_tipo === 'bambino' && 'Per un bambino'}
                  {' · '}
                  {new Date(p.created_at).toLocaleDateString('it-IT')}
                </p>
              </li>
            ))}
            {!promemoria?.length && (
              <li className="text-sm text-stone-400">Nessun promemoria pubblicato.</li>
            )}
          </ul>
        </section>
      </main>
    </>
  );
}
