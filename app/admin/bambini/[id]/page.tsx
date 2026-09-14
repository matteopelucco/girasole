import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { requireAdmin } from '@/lib/auth';
import { aggiornaBambino, aggiornaCostiBambino, toggleAttivaBambino } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function BambinoDettaglioPage({ params }: { params: { id: string } }) {
  const { supabase, user, profilo } = await requireAdmin();

  const [{ data: bambino }, { data: sezioni }, { data: costi }] = await Promise.all([
    supabase
      .from('bambini')
      .select('id, nome, cognome, data_nascita, sesso, sezione_id, note_allergie, altre_note, attiva')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('sezioni').select('id, nome').order('nome'),
    supabase
      .from('costi_bambini')
      .select(
        'prezzo_mensile, prezzo_buono_pasto, prezzo_marca_da_bollo, pre_asilo_richiesto, prezzo_pre_asilo, post_asilo_richiesto, prezzo_post_asilo, email_promemoria'
      )
      .eq('bambino_id', params.id)
      .maybeSingle(),
  ]);

  if (!bambino) redirect('/admin');

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <a href="/admin" className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna a Sezioni e bambini
        </a>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-medium">
            {bambino.nome} {bambino.cognome}
          </h1>
          {!bambino.attiva && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
              Disattivato
            </span>
          )}
        </div>

        <FormConEsito
          action={aggiornaBambino}
          className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <input type="hidden" name="bambino_id" value={bambino.id} />
          <div className="flex gap-2">
            <input
              name="nome"
              required
              defaultValue={bambino.nome}
              placeholder="Nome"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <input
              name="cognome"
              required
              defaultValue={bambino.cognome}
              placeholder="Cognome"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>
          <div className="flex gap-2">
            <input
              name="data_nascita"
              type="date"
              required
              defaultValue={bambino.data_nascita ?? ''}
              aria-label="Data di nascita"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <select
              name="sesso"
              required
              defaultValue={bambino.sesso ?? ''}
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
            defaultValue={bambino.sezione_id ?? ''}
            aria-label="Sezione"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          >
            <option value="">Nessuna sezione</option>
            {sezioni?.map((sezione) => (
              <option key={sezione.id} value={sezione.id}>
                {sezione.nome}
              </option>
            ))}
          </select>
          <input
            name="note_allergie"
            defaultValue={bambino.note_allergie ?? ''}
            placeholder="Allergie o intolleranze (opzionale)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <input
            name="altre_note"
            defaultValue={bambino.altre_note ?? ''}
            placeholder="Altre note (opzionale)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Salva modifiche
          </PulsanteInvio>
        </FormConEsito>

        <FormConEsito action={toggleAttivaBambino}>
          <input type="hidden" name="bambino_id" value={bambino.id} />
          <input type="hidden" name="attiva_attuale" value={String(bambino.attiva)} />
          <PulsanteInvio className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
            {bambino.attiva ? 'Disattiva bambino' : 'Riattiva bambino'}
          </PulsanteInvio>
        </FormConEsito>

        <div className="space-y-2">
          <h2 className="text-base font-medium">Costi</h2>
          <FormConEsito
            action={aggiornaCostiBambino}
            className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <input type="hidden" name="bambino_id" value={bambino.id} />
            <div className="flex flex-wrap gap-2">
              <label className="flex-1 text-xs text-stone-600">
                Prezzo retta mensile (€)
                <input
                  name="prezzo_mensile"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={costi?.prezzo_mensile ?? 0}
                  aria-label="Prezzo retta mensile (€)"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                />
              </label>
              <label className="flex-1 text-xs text-stone-600">
                Prezzo buono pasto (€)
                <input
                  name="prezzo_buono_pasto"
                  type="number"
                  min={0}
                  step={0.01}
                  // Come marca da bollo sotto: precompilato all'importo
                  // corrente tipico (6€), non a 0, solo per un bambino
                  // senza ancora nessun costo salvato (specs/55).
                  defaultValue={costi?.prezzo_buono_pasto ?? 6}
                  aria-label="Prezzo buono pasto (€)"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                />
              </label>
              <label className="flex-1 text-xs text-stone-600">
                Prezzo marca da bollo (€)
                <input
                  name="prezzo_marca_da_bollo"
                  type="number"
                  min={0}
                  step={0.01}
                  // Precompilato all'importo corrente reale (2€), non a 0
                  // ("nessun importo previsto") — solo per un bambino
                  // senza ancora nessun costo salvato (specs/55).
                  defaultValue={costi?.prezzo_marca_da_bollo ?? 2}
                  aria-label="Prezzo marca da bollo (€)"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    name="pre_asilo_richiesto"
                    defaultChecked={costi?.pre_asilo_richiesto ?? false}
                    className="h-4 w-4"
                  />
                  Pre-asilo richiesto
                </label>
                <label className="text-xs text-stone-600">
                  Prezzo (€)
                  <input
                    name="prezzo_pre_asilo"
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={costi?.prezzo_pre_asilo ?? 70}
                    aria-label="Prezzo pre-asilo (€)"
                    className="mt-1 block w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                  />
                </label>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    name="post_asilo_richiesto"
                    defaultChecked={costi?.post_asilo_richiesto ?? false}
                    className="h-4 w-4"
                  />
                  Post-asilo richiesto
                </label>
                <label className="text-xs text-stone-600">
                  Prezzo (€)
                  <input
                    name="prezzo_post_asilo"
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={costi?.prezzo_post_asilo ?? 70}
                    aria-label="Prezzo post-asilo (€)"
                    className="mt-1 block w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                  />
                </label>
              </div>
            </div>

            <label className="block text-xs text-stone-600">
              Email promemoria retta
              <input
                name="email_promemoria"
                type="email"
                defaultValue={costi?.email_promemoria ?? ''}
                placeholder="genitore@esempio.it (opzionale)"
                aria-label="Email promemoria retta"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </label>

            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Salva costi
            </PulsanteInvio>
          </FormConEsito>
        </div>
      </main>
    </NavHeader>
  );
}
