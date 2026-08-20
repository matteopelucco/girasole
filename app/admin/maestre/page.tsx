import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { cambiaRuolo, assegnaSezione, rimuoviSezione } from './actions';

const ETICHETTE_RUOLO: Record<string, string> = {
  admin: 'Admin',
  maestra: 'Maestra',
  genitore: 'Genitore',
};

export default async function MaestrePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profiloCorrente } = await supabase
    .from('profili')
    .select('nome, cognome, ruolo')
    .eq('id', user.id)
    .single();

  if (profiloCorrente?.ruolo !== 'admin') redirect('/dashboard');

  const [{ data: profili }, { data: sezioni }, { data: assegnazioni }] = await Promise.all([
    supabase.from('profili').select('id, nome, cognome, email, ruolo').order('cognome'),
    supabase.from('sezioni').select('id, nome').order('nome'),
    supabase.from('maestre_sezioni').select('maestra_id, sezione_id'),
  ]);

  const maestre = profili?.filter((p) => p.ruolo === 'maestra') ?? [];
  const sezioniPerMaestra = new Map<string, string[]>();
  for (const a of assegnazioni ?? []) {
    const nomeSezione = sezioni?.find((s) => s.id === a.sezione_id)?.nome ?? a.sezione_id;
    const lista = sezioniPerMaestra.get(a.maestra_id) ?? [];
    lista.push(nomeSezione);
    sezioniPerMaestra.set(a.maestra_id, lista);
  }

  return (
    <>
      <NavHeader
        nome={profiloCorrente?.nome || user.email || ''}
        ruolo={profiloCorrente?.ruolo ?? null}
      />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        <section>
          <h1 className="text-lg font-medium">Utenti e ruoli</h1>
          <p className="mt-1 text-sm text-stone-500">
            Nuovi utenti compaiono qui dopo essersi registrati (ruolo iniziale: genitore).
            Promuovili a maestra o admin.
          </p>

          <ul className="mt-4 space-y-2">
            {profili?.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <span>
                  {p.nome} {p.cognome}{' '}
                  <span className="text-stone-400">— {p.email}</span>
                </span>
                <form action={cambiaRuolo} className="flex items-center gap-2">
                  <input type="hidden" name="profilo_id" value={p.id} />
                  <select
                    name="ruolo"
                    defaultValue={p.ruolo}
                    className="rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                  >
                    {Object.entries(ETICHETTE_RUOLO).map(([valore, etichetta]) => (
                      <option key={valore} value={valore}>
                        {etichetta}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700"
                  >
                    Aggiorna
                  </button>
                </form>
              </li>
            ))}
            {!profili?.length && (
              <li className="text-sm text-stone-400">Nessun utente registrato.</li>
            )}
          </ul>
        </section>

        <section>
          <h1 className="text-lg font-medium">Assegna maestre alle sezioni</h1>

          <form action={assegnaSezione} className="mt-3 flex flex-wrap gap-2">
            <select
              name="maestra_id"
              required
              defaultValue=""
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            >
              <option value="" disabled>
                Maestra
              </option>
              {maestre.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} {m.cognome}
                </option>
              ))}
            </select>
            <select
              name="sezione_id"
              required
              defaultValue=""
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            >
              <option value="" disabled>
                Sezione
              </option>
              {sezioni?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            >
              Assegna
            </button>
          </form>
          {!maestre.length && (
            <p className="mt-2 text-sm text-stone-400">
              Nessun utente ha ancora il ruolo maestra: promuovilo prima nella sezione qui sopra.
            </p>
          )}

          <ul className="mt-4 space-y-1">
            {maestre.map((m) => (
              <li key={m.id} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
                <div className="font-medium">
                  {m.nome} {m.cognome}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(sezioniPerMaestra.get(m.id) ?? []).length === 0 && (
                    <span className="text-stone-400">Nessuna sezione assegnata.</span>
                  )}
                  {assegnazioni
                    ?.filter((a) => a.maestra_id === m.id)
                    .map((a) => {
                      const nomeSezione = sezioni?.find((s) => s.id === a.sezione_id)?.nome;
                      return (
                        <form key={a.sezione_id} action={rimuoviSezione}>
                          <input type="hidden" name="maestra_id" value={a.maestra_id} />
                          <input type="hidden" name="sezione_id" value={a.sezione_id} />
                          <button
                            type="submit"
                            className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-200"
                            title="Rimuovi assegnazione"
                          >
                            {nomeSezione} ✕
                          </button>
                        </form>
                      );
                    })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
