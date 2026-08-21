import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { creaSezione, toggleAttivaSezione, creaAnnoScolastico, creaBambino } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
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

  if (profilo?.ruolo !== 'admin') redirect('/dashboard');

  const [{ data: anniScolastici }, { data: sezioni }, { data: bambini }] = await Promise.all([
    supabase.from('anni_scolastici').select('id, nome').order('nome'),
    supabase.from('sezioni').select('id, nome, attiva, anno_scolastico_id').order('nome'),
    supabase
      .from('bambini')
      .select('id, nome, cognome, data_nascita, sesso, note_allergie, altre_note, sezioni(nome)')
      .order('cognome'),
  ]);

  return (
    <>
      <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null} />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        <section>
          <h1 className="text-lg font-medium">Anni scolastici</h1>
          <form action={creaAnnoScolastico} className="mt-3 flex gap-2">
            <input
              name="nome"
              required
              placeholder="Nome anno scolastico (es. 2026/2027)"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            >
              Crea
            </button>
          </form>

          <ul className="mt-4 space-y-1">
            {anniScolastici?.map((anno) => (
              <li key={anno.id} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
                {anno.nome}
              </li>
            ))}
            {!anniScolastici?.length && (
              <li className="text-sm text-stone-400">Nessun anno scolastico ancora creato.</li>
            )}
          </ul>
        </section>

        <section>
          <h1 className="text-lg font-medium">Sezioni</h1>
          <form action={creaSezione} className="mt-3 flex flex-wrap gap-2">
            <input
              name="nome"
              required
              placeholder="Nome sezione (es. Girasoli)"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <select
              name="anno_scolastico_id"
              defaultValue=""
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            >
              <option value="">Anno scolastico (opzionale)</option>
              {anniScolastici?.map((anno) => (
                <option key={anno.id} value={anno.id}>
                  {anno.nome}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            >
              Crea
            </button>
          </form>

          <ul className="mt-4 space-y-1">
            {sezioni?.map((sezione) => (
              <li
                key={sezione.id}
                className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <span>
                  {sezione.nome}
                  {!sezione.attiva && (
                    <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                      non attiva
                    </span>
                  )}
                </span>
                <form action={toggleAttivaSezione}>
                  <input type="hidden" name="sezione_id" value={sezione.id} />
                  <input type="hidden" name="attiva_attuale" value={String(sezione.attiva)} />
                  <button type="submit" className="text-xs text-stone-500 underline hover:text-stone-900">
                    {sezione.attiva ? 'Disattiva' : 'Riattiva'}
                  </button>
                </form>
              </li>
            ))}
            {!sezioni?.length && (
              <li className="text-sm text-stone-400">Nessuna sezione ancora creata.</li>
            )}
          </ul>
        </section>

        <section>
          <h1 className="text-lg font-medium">Bambini</h1>
          <form action={creaBambino} className="mt-3 space-y-2 rounded-xl border border-stone-200 p-4">
            <div className="flex gap-2">
              <input
                name="nome"
                required
                placeholder="Nome"
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
              <input
                name="cognome"
                required
                placeholder="Cognome"
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </div>
            <div className="flex gap-2">
              <input
                name="data_nascita"
                type="date"
                required
                aria-label="Data di nascita"
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
              <select
                name="sesso"
                required
                defaultValue=""
                aria-label="Sesso"
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              >
                <option value="" disabled>
                  Sesso
                </option>
                <option value="F">Femmina</option>
                <option value="M">Maschio</option>
              </select>
            </div>
            <select
              name="sezione_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            >
              <option value="" disabled>
                Scegli la sezione
              </option>
              {sezioni?.map((sezione) => (
                <option key={sezione.id} value={sezione.id}>
                  {sezione.nome}
                </option>
              ))}
            </select>
            <input
              name="note_allergie"
              placeholder="Allergie o intolleranze (opzionale)"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <input
              name="altre_note"
              placeholder="Altre note (opzionale)"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            >
              Aggiungi bambino
            </button>
          </form>

          <ul className="mt-4 space-y-1">
            {bambini?.map((bambino) => (
              <li
                key={bambino.id}
                className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <span>
                  {bambino.nome} {bambino.cognome}{' '}
                  <span className="text-stone-400">
                    — {(bambino.sezioni as unknown as { nome: string } | null)?.nome ?? 'nessuna sezione'}
                  </span>
                </span>
                {bambino.note_allergie && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {bambino.note_allergie}
                  </span>
                )}
              </li>
            ))}
            {!bambini?.length && (
              <li className="text-sm text-stone-400">Nessun bambino ancora inserito.</li>
            )}
          </ul>
        </section>
      </main>
    </>
  );
}
