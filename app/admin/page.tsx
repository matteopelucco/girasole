import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { creaSezione, creaBambino } from './actions';

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

  const [{ data: sezioni }, { data: bambini }] = await Promise.all([
    supabase.from('sezioni').select('id, nome').order('nome'),
    supabase
      .from('bambini')
      .select('id, nome, cognome, note_allergie, sezioni(nome)')
      .order('cognome'),
  ]);

  return (
    <>
      <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null} />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        <section>
          <h1 className="text-lg font-medium">Sezioni</h1>
          <form action={creaSezione} className="mt-3 flex gap-2">
            <input
              name="nome"
              required
              placeholder="Nome sezione (es. Girasoli)"
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
            {sezioni?.map((sezione) => (
              <li key={sezione.id} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
                {sezione.nome}
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
