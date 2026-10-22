import { ElencoChiusure } from '@/components/ElencoChiusure';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { Campo } from '@/components/ui/campo';
import { riquadroVariants } from '@/components/ui/riquadro';
import { requireAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';
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
          className={cn(riquadroVariants(), 'space-y-2 p-4')}
        >
          <div className="flex flex-wrap gap-2">
            <Campo name="data_inizio" type="date" required aria-label="Data di inizio" className="flex-1" />
            <Campo name="data_fine" type="date" required aria-label="Data di fine" className="flex-1" />
          </div>
          <Campo name="nota" placeholder="Nota (opzionale, es. Vacanze di Natale)" className="w-full" />
          <PulsanteInvio variante="primario" misura="normale">
            Aggiungi giorno di chiusura
          </PulsanteInvio>
        </FormConEsito>

        {/* Stessa lista della scheda "Giorni di chiusura" di "Calendario attività" (specs/64), in modo gestione. */}
        <ElencoChiusure chiusure={chiusure} oggi={oggi()} modo="gestione" />
      </main>
    </NavHeader>
  );
}
