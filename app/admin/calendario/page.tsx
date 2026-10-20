import { ElencoChiusure } from '@/components/ElencoChiusure';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { requireAdmin } from '@/lib/auth';
import type { GiornoChiusura } from '@/lib/calendarioScolastico';
import { oggi } from '@/lib/date';
import { creaGiornoChiusura } from './actions';

export const dynamic = 'force-dynamic';

export default async function CalendarioScolasticoPage() {
  const { supabase, user, profilo } = await requireAdmin();

  const { data: giorniChiusura } = await supabase
    .from('giorni_chiusura')
    .select('id, data_inizio, data_fine, nota')
    .order('data_inizio', { ascending: false });

  const chiusure: GiornoChiusura[] = (giorniChiusura ?? []).map((g) => ({
    id: g.id,
    dataInizio: g.data_inizio,
    dataFine: g.data_fine,
    nota: g.nota,
  }));

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Giorni di chiusura</h1>
          <p className="mt-1 text-sm text-stone-600">
            Giorni di chiusura dell&apos;asilo (vacanze, ponti, chiusure straordinarie). Sabato e
            domenica sono chiusi sempre, non serve inserirli qui.
          </p>
        </div>

        <FormConEsito
          action={creaGiornoChiusura}
          resetSuOk
          className="space-y-2 rounded-xl border border-border bg-white p-4 shadow-xs"
        >
          <div className="flex flex-wrap gap-2">
            <input
              name="data_inizio"
              type="date"
              required
              aria-label="Data di inizio"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-hidden focus:border-stone-500"
            />
            <input
              name="data_fine"
              type="date"
              required
              aria-label="Data di fine"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-hidden focus:border-stone-500"
            />
          </div>
          <input
            name="nota"
            placeholder="Nota (opzionale, es. Vacanze di Natale)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-hidden focus:border-stone-500"
          />
          <PulsanteInvio className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
            Aggiungi giorno di chiusura
          </PulsanteInvio>
        </FormConEsito>

        {/* Stessa lista della scheda "Giorni di chiusura" di "Calendario attività" (specs/64), in modo gestione. */}
        <ElencoChiusure chiusure={chiusure} oggi={oggi()} modo="gestione" />
      </main>
    </NavHeader>
  );
}
