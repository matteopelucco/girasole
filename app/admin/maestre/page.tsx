import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { REGOLA_PASSWORD } from '@/lib/password';
import {
  creaUtente,
  aggiornaUtente,
  eliminaUtente,
  assegnaSezione,
  rimuoviSezione,
} from './actions';

const ETICHETTE_RUOLO: Record<string, string> = {
  admin: 'Admin',
  maestra: 'Maestra',
  genitore: 'Genitore',
};

const MESSAGGI_ERRORE: Record<string, string> = {
  'campi-mancanti': 'Compila tutti i campi (nome, cognome, email, telefono, ruolo).',
  'password-debole': REGOLA_PASSWORD,
  'email-duplicata': 'Esiste già un utente con questa email.',
  'creazione-fallita': "Non è stato possibile creare l'utente. Riprova.",
};

const MESSAGGI_OK: Record<string, string> = {
  'utente-creato': 'Utente creato con successo.',
};

export const dynamic = 'force-dynamic';

export default async function MaestrePage({
  searchParams,
}: {
  searchParams: { errore?: string; ok?: string; dettaglio?: string };
}) {
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
    supabase
      .from('profili')
      .select('id, nome, cognome, email, telefono, ruolo, indirizzo_residenza, note')
      .order('cognome'),
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

  const messaggioErrore = searchParams?.errore ? MESSAGGI_ERRORE[searchParams.errore] : null;
  const messaggioOk = searchParams?.ok ? MESSAGGI_OK[searchParams.ok] : null;

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
            Crea, modifica ed elimina gli account direttamente da qui — email, password,
            nome, cognome, telefono, indirizzo, note e ruolo (admin / maestra / genitore).
          </p>

          {messaggioOk && <p className="mt-3 text-sm text-green-700">{messaggioOk}</p>}
          {messaggioErrore && (
            <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm">
              <p className="font-medium text-red-800">{messaggioErrore}</p>
              {searchParams?.dettaglio && (
                <p className="mt-1 text-xs text-red-600">
                  {decodeURIComponent(searchParams.dettaglio)}
                </p>
              )}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-stone-200 p-4">
            <h2 className="text-sm font-medium">Crea nuovo utente</h2>
            <p className="mt-1 text-xs text-stone-500">{REGOLA_PASSWORD}</p>
            <form action={creaUtente} className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                name="nome"
                required
                placeholder="Nome"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
              <input
                name="cognome"
                required
                placeholder="Cognome"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
              <input
                name="email"
                type="email"
                required
                placeholder="Email"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
              <input
                name="telefono"
                type="tel"
                required
                placeholder="Telefono"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Password"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
              <select
                name="ruolo"
                required
                defaultValue="genitore"
                aria-label="Ruolo"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              >
                {Object.entries(ETICHETTE_RUOLO).map(([valore, etichetta]) => (
                  <option key={valore} value={valore}>
                    {etichetta}
                  </option>
                ))}
              </select>
              <input
                name="indirizzo_residenza"
                placeholder="Indirizzo di residenza (opzionale)"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 sm:col-span-2"
              />
              <input
                name="note"
                placeholder="Note (opzionale)"
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 sm:col-span-2"
              />
              <PulsanteInvio className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 sm:col-span-2">
                Crea utente
              </PulsanteInvio>
            </form>
          </div>

          <ul className="mt-4 space-y-2">
            {profili?.map((p) => (
              <li key={p.id} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
                <div className="mb-2 text-xs text-stone-600">{p.email}</div>
                <FormConEsito action={aggiornaUtente} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="profilo_id" value={p.id} />
                  <input
                    name="nome"
                    defaultValue={p.nome}
                    placeholder="Nome"
                    className="w-24 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                  />
                  <input
                    name="cognome"
                    defaultValue={p.cognome}
                    placeholder="Cognome"
                    className="w-24 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                  />
                  <input
                    name="telefono"
                    defaultValue={p.telefono ?? ''}
                    placeholder="Telefono"
                    className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                  />
                  <input
                    name="indirizzo_residenza"
                    defaultValue={p.indirizzo_residenza ?? ''}
                    placeholder="Indirizzo"
                    className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                  />
                  <input
                    name="note"
                    defaultValue={p.note ?? ''}
                    placeholder="Note"
                    className="w-24 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                  />
                  <select
                    name="ruolo"
                    defaultValue={p.ruolo}
                    aria-label="Ruolo"
                    className="rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                  >
                    {Object.entries(ETICHETTE_RUOLO).map(([valore, etichetta]) => (
                      <option key={valore} value={valore}>
                        {etichetta}
                      </option>
                    ))}
                  </select>
                  <PulsanteInvio className="rounded-lg bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700">
                    Aggiorna
                  </PulsanteInvio>
                </FormConEsito>
                <FormConEsito action={eliminaUtente} className="mt-1">
                  <input type="hidden" name="profilo_id" value={p.id} />
                  <PulsanteInvio className="text-xs text-red-600 hover:text-red-800">
                    Elimina utente
                  </PulsanteInvio>
                </FormConEsito>
              </li>
            ))}
            {!profili?.length && (
              <li className="text-sm text-stone-600">Nessun utente registrato.</li>
            )}
          </ul>
        </section>

        <section>
          <h1 className="text-lg font-medium">Assegna maestre alle sezioni</h1>

          <FormConEsito action={assegnaSezione} className="mt-3 flex flex-wrap gap-2">
            <select
              name="maestra_id"
              required
              defaultValue=""
              aria-label="Maestra"
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
              aria-label="Sezione"
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
            <PulsanteInvio className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
              Assegna
            </PulsanteInvio>
          </FormConEsito>
          {!maestre.length && (
            <p className="mt-2 text-sm text-stone-600">
              Nessun utente ha ancora il ruolo maestra: creane uno o promuovilo nella sezione qui
              sopra.
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
                    <span className="text-stone-600">Nessuna sezione assegnata.</span>
                  )}
                  {assegnazioni
                    ?.filter((a) => a.maestra_id === m.id)
                    .map((a) => {
                      const nomeSezione = sezioni?.find((s) => s.id === a.sezione_id)?.nome;
                      return (
                        <FormConEsito key={a.sezione_id} action={rimuoviSezione}>
                          <input type="hidden" name="maestra_id" value={a.maestra_id} />
                          <input type="hidden" name="sezione_id" value={a.sezione_id} />
                          <PulsanteInvio
                            className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-200"
                            title="Rimuovi assegnazione"
                          >
                            {nomeSezione} ✕
                          </PulsanteInvio>
                        </FormConEsito>
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
