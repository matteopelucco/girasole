import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { requireAdmin } from '@/lib/auth';
import { formattaIntervalloItaliano } from '@/lib/date';
import { creaGiornoChiusura } from './actions';

export const dynamic = 'force-dynamic';

export default async function CalendarioScolasticoPage() {
  const { supabase, user, profilo } = await requireAdmin();

  const { data: giorniChiusura } = await supabase
    .from('giorni_chiusura')
    .select('id, data_inizio, data_fine, nota')
    .order('data_inizio', { ascending: false });

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Calendario scolastico</h1>
          <p className="mt-1 text-sm text-stone-600">
            Giorni di chiusura dell&apos;asilo (vacanze, ponti, chiusure straordinarie). Sabato e
            domenica sono chiusi sempre, non serve inserirli qui.
          </p>
        </div>

        <FormConEsito
          action={creaGiornoChiusura}
          resetSuOk
          className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap gap-2">
            <input
              name="data_inizio"
              type="date"
              required
              aria-label="Data di inizio"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <input
              name="data_fine"
              type="date"
              required
              aria-label="Data di fine"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>
          <input
            name="nota"
            placeholder="Nota (opzionale, es. Vacanze di Natale)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Aggiungi giorno di chiusura
          </PulsanteInvio>
        </FormConEsito>

        <ul className="space-y-2">
          {giorniChiusura?.map((giorno) => (
            <li key={giorno.id}>
              <Link
                href={`/admin/calendario/${giorno.id}`}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-stone-50"
              >
                <span>
                  {formattaIntervalloItaliano(giorno.data_inizio, giorno.data_fine)}
                  {giorno.nota && <span className="ml-2 text-stone-600">— {giorno.nota}</span>}
                </span>
                <span className="text-xs text-stone-500">Modifica</span>
              </Link>
            </li>
          ))}
          {!giorniChiusura?.length && (
            <li className="text-sm text-stone-600">Nessun giorno di chiusura ancora inserito.</li>
          )}
        </ul>
      </main>
    </NavHeader>
  );
}
