import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { requireAdmin } from '@/lib/auth';
import {
  creaSezione,
  toggleAttivaSezione,
  creaAnnoScolastico,
  creaBambino,
  assegnaSezioneBambino,
} from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { supabase, user, profilo } = await requireAdmin();

  const [{ data: anniScolastici }, { data: sezioni }, { data: bambini }] = await Promise.all([
    supabase.from('anni_scolastici').select('id, nome').order('nome'),
    supabase.from('sezioni').select('id, nome, attiva, anno_scolastico_id').order('nome'),
    supabase
      .from('bambini')
      .select('id, nome, cognome, sezione_id, note_allergie, attiva')
      .order('cognome'),
  ]);

  const tuttiBambini = bambini ?? [];
  const bambiniPerSezione = new Map<string, typeof tuttiBambini>();
  for (const bambino of tuttiBambini) {
    if (!bambino.sezione_id || !bambino.attiva) continue;
    const lista = bambiniPerSezione.get(bambino.sezione_id) ?? [];
    lista.push(bambino);
    bambiniPerSezione.set(bambino.sezione_id, lista);
  }
  const bambiniSenzaClasseODisattivati = tuttiBambini.filter(
    (bambino) => !bambino.sezione_id || !bambino.attiva
  );

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        <section>
          <h1 className="text-lg font-medium">Anni scolastici</h1>
          <FormConEsito action={creaAnnoScolastico} className="mt-3 flex gap-2">
            <input
              name="nome"
              required
              placeholder="Nome anno scolastico (es. 2026/2027)"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Crea
            </PulsanteInvio>
          </FormConEsito>

          <ul className="mt-4 space-y-1">
            {anniScolastici?.map((anno) => (
              <li key={anno.id} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
                {anno.nome}
              </li>
            ))}
            {!anniScolastici?.length && (
              <li className="text-sm text-stone-600">Nessun anno scolastico ancora creato.</li>
            )}
          </ul>
        </section>

        <section>
          <h1 className="text-lg font-medium">Sezioni</h1>
          <FormConEsito action={creaSezione} className="mt-3 flex flex-wrap gap-2">
            <input
              name="nome"
              required
              placeholder="Nome sezione (es. Girasoli)"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <select
              name="anno_scolastico_id"
              defaultValue=""
              aria-label="Anno scolastico"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            >
              <option value="">Anno scolastico (opzionale)</option>
              {anniScolastici?.map((anno) => (
                <option key={anno.id} value={anno.id}>
                  {anno.nome}
                </option>
              ))}
            </select>
            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Crea
            </PulsanteInvio>
          </FormConEsito>

          <ul className="mt-4 space-y-1">
            {sezioni?.map((sezione) => (
              <li
                key={sezione.id}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <span>
                  {sezione.nome}
                  {!sezione.attiva && (
                    <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
                      non attiva
                    </span>
                  )}
                </span>
                <FormConEsito action={toggleAttivaSezione}>
                  <input type="hidden" name="sezione_id" value={sezione.id} />
                  <input type="hidden" name="attiva_attuale" value={String(sezione.attiva)} />
                  <PulsanteInvio className="text-xs text-stone-600 underline hover:text-stone-900">
                    {sezione.attiva ? 'Disattiva' : 'Riattiva'}
                  </PulsanteInvio>
                </FormConEsito>
              </li>
            ))}
            {!sezioni?.length && (
              <li className="text-sm text-stone-600">Nessuna sezione ancora creata.</li>
            )}
          </ul>
        </section>

        <section>
          <h1 className="text-lg font-medium">Bambini</h1>
          <FormConEsito
            action={creaBambino}
            className="mt-3 space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
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
              defaultValue=""
              aria-label="Sezione"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            >
              <option value="">Nessuna sezione (assegna dopo)</option>
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
            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Aggiungi bambino
            </PulsanteInvio>
          </FormConEsito>

          <div id="classi-e-bambini-assegnati" className="mt-6 space-y-4">
            <h2 className="text-sm font-medium text-stone-700">Classi e bambini assegnati</h2>
            {sezioni?.map((sezione) => {
              const lista = bambiniPerSezione.get(sezione.id) ?? [];
              return (
                <div key={sezione.id} className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <h3 className="text-sm font-semibold">{sezione.nome}</h3>
                  <ul className="mt-2 space-y-1">
                    {lista.map((bambino) => (
                      <li
                        key={bambino.id}
                        className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2 text-sm"
                      >
                        <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
                          {bambino.nome} {bambino.cognome}
                        </Link>
                        {bambino.note_allergie && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            {bambino.note_allergie}
                          </span>
                        )}
                      </li>
                    ))}
                    {!lista.length && (
                      <li className="text-xs text-stone-600">Nessun bambino assegnato.</li>
                    )}
                  </ul>
                </div>
              );
            })}
            {!sezioni?.length && (
              <p className="text-sm text-stone-600">Nessuna sezione ancora creata.</p>
            )}
          </div>

          <div id="bambini-senza-classe" className="mt-6 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-medium text-stone-700">Bambini senza classe o disattivati</h2>
            <ul className="mt-2 space-y-2">
              {bambiniSenzaClasseODisattivati.map((bambino) => (
                <li key={bambino.id} className="rounded-lg border border-stone-100 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
                      {bambino.nome} {bambino.cognome}
                    </Link>
                    {!bambino.attiva && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
                        Disattivato
                      </span>
                    )}
                  </div>
                  <FormConEsito action={assegnaSezioneBambino} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="bambino_id" value={bambino.id} />
                    <select
                      name="sezione_id"
                      required
                      defaultValue=""
                      aria-label={`Sezione per ${bambino.nome} ${bambino.cognome}`}
                      className="rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-500"
                    >
                      <option value="" disabled>
                        Assegna a...
                      </option>
                      {sezioni?.map((sezione) => (
                        <option key={sezione.id} value={sezione.id}>
                          {sezione.nome}
                        </option>
                      ))}
                    </select>
                    <PulsanteInvio className="rounded-lg border border-sky-300 bg-white px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50">
                      Assegna
                    </PulsanteInvio>
                  </FormConEsito>
                </li>
              ))}
              {!bambiniSenzaClasseODisattivati.length && (
                <li className="text-xs text-stone-600">Nessuno.</li>
              )}
            </ul>
          </div>
        </section>
      </main>
    </NavHeader>
  );
}
