import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { requireAdmin } from '@/lib/auth';
import { aggiornaBambino, aggiornaRettaBambino, toggleAttivaBambino } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function BambinoDettaglioPage({ params }: { params: { id: string } }) {
  const { supabase, user, profilo } = await requireAdmin();

  const [{ data: bambino }, { data: sezioni }, { data: retta }] = await Promise.all([
    supabase
      .from('bambini')
      .select('id, nome, cognome, data_nascita, sesso, sezione_id, note_allergie, altre_note, attiva')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('sezioni').select('id, nome').order('nome'),
    supabase
      .from('rette_bambini')
      .select('prezzo_mensile, prezzo_buono_pasto, email_promemoria')
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
          <h2 className="text-base font-medium">Retta</h2>
          <FormConEsito
            action={aggiornaRettaBambino}
            className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <input type="hidden" name="bambino_id" value={bambino.id} />
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-stone-600">
                Prezzo retta mensile (€)
                <input
                  name="prezzo_mensile"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={retta?.prezzo_mensile ?? 0}
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
                  defaultValue={retta?.prezzo_buono_pasto ?? 0}
                  aria-label="Prezzo buono pasto (€)"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
                />
              </label>
            </div>
            <label className="block text-xs text-stone-600">
              Email promemoria retta
              <input
                name="email_promemoria"
                type="email"
                defaultValue={retta?.email_promemoria ?? ''}
                placeholder="genitore@esempio.it (opzionale)"
                aria-label="Email promemoria retta"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </label>
            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Salva retta
            </PulsanteInvio>
          </FormConEsito>
        </div>
      </main>
    </NavHeader>
  );
}
