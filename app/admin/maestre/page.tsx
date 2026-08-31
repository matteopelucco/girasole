import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { CampiPasswordConferma } from '@/components/CampiPasswordConferma';
import { REGOLA_PASSWORD } from '@/lib/password';
import { requireAdmin } from '@/lib/auth';
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
  assistente: 'Assistente',
  genitore: 'Genitore',
};

export const dynamic = 'force-dynamic';

export default async function MaestrePage() {
  const { supabase, user, profilo: profiloCorrente } = await requireAdmin();

  const [{ data: profili }, { data: sezioni }, { data: assegnazioni }, { data: profiliOrari }] = await Promise.all([
    supabase
      .from('profili')
      .select(
        'id, nome, cognome, email, telefono, ruolo, indirizzo_residenza, note, abilitato_ore_lavoro, profilo_orario_id'
      )
      .order('cognome'),
    supabase.from('sezioni').select('id, nome').order('nome'),
    supabase.from('maestre_sezioni').select('maestra_id, sezione_id'),
    supabase.from('profili_orari').select('id, nome').order('nome'),
  ]);

  const staffAssegnabile = profili?.filter((p) => p.ruolo === 'maestra' || p.ruolo === 'assistente') ?? [];
  const sezioniPerMaestra = new Map<string, string[]>();
  for (const a of assegnazioni ?? []) {
    const nomeSezione = sezioni?.find((s) => s.id === a.sezione_id)?.nome ?? a.sezione_id;
    const lista = sezioniPerMaestra.get(a.maestra_id) ?? [];
    lista.push(nomeSezione);
    sezioniPerMaestra.set(a.maestra_id, lista);
  }

  return (
    <NavHeader
      nome={profiloCorrente?.nome || user.email || ''}
      ruolo={profiloCorrente?.ruolo ?? null}
    >
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        <section>
          <h1 className="text-lg font-medium">Utenti e ruoli</h1>
          <p className="mt-1 text-sm text-stone-600">
            Crea, modifica ed elimina gli account direttamente da qui — email, password,
            nome, cognome, telefono, indirizzo, note e ruolo (admin / maestra / assistente /
            genitore).
          </p>

          <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium">Crea nuovo utente</h2>
            <p className="mt-1 text-xs text-stone-600">{REGOLA_PASSWORD}</p>
            <FormConEsito action={creaUtente} resetSuOk className="mt-3 grid gap-2 sm:grid-cols-2">
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
              <CampiPasswordConferma />
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
              <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
                <input type="checkbox" name="abilitato_ore_lavoro" className="h-4 w-4" />
                Abilita al report ore di lavoro
              </label>
              <label className="flex flex-col text-sm text-stone-700 sm:col-span-2">
                Profilo orario (opzionale)
                <select
                  name="profilo_orario_id"
                  defaultValue=""
                  aria-label="Profilo orario"
                  className="mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                >
                  <option value="">Nessun profilo orario</option>
                  {profiliOrari?.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.nome}
                    </option>
                  ))}
                </select>
              </label>
              <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 sm:col-span-2">
                Crea utente
              </PulsanteInvio>
            </FormConEsito>
          </div>

          <ul className="mt-4 space-y-2">
            {profili?.map((p) => (
              <li key={p.id} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
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
                  <label className="flex items-center gap-1 text-xs text-stone-700">
                    <input
                      type="checkbox"
                      name="abilitato_ore_lavoro"
                      defaultChecked={p.abilitato_ore_lavoro}
                      className="h-3.5 w-3.5"
                    />
                    Ore di lavoro
                  </label>
                  <select
                    name="profilo_orario_id"
                    defaultValue={p.profilo_orario_id ?? ''}
                    aria-label="Profilo orario"
                    className="rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                  >
                    <option value="">Nessun profilo orario</option>
                    {profiliOrari?.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.nome}
                      </option>
                    ))}
                  </select>
                  <PulsanteInvio className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800">
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
          <h1 className="text-lg font-medium">Assegna maestre e assistenti alle sezioni</h1>

          <FormConEsito action={assegnaSezione} className="mt-3 flex flex-wrap gap-2">
            <select
              name="maestra_id"
              required
              defaultValue=""
              aria-label="Maestra o assistente"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            >
              <option value="" disabled>
                Maestra o assistente
              </option>
              {staffAssegnabile.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} {m.cognome} ({ETICHETTE_RUOLO[m.ruolo]})
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
            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Assegna
            </PulsanteInvio>
          </FormConEsito>
          {!staffAssegnabile.length && (
            <p className="mt-2 text-sm text-stone-600">
              Nessun utente ha ancora il ruolo maestra o assistente: creane uno o promuovilo nella
              sezione qui sopra.
            </p>
          )}

          <ul className="mt-4 space-y-1">
            {staffAssegnabile.map((m) => (
              <li key={m.id} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
                <div className="font-medium">
                  {m.nome} {m.cognome}{' '}
                  <span className="font-normal text-stone-600">({ETICHETTE_RUOLO[m.ruolo]})</span>
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
    </NavHeader>
  );
}
