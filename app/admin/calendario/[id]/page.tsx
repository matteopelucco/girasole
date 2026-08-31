import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { requireAdmin } from '@/lib/auth';
import { aggiornaGiornoChiusura, eliminaGiornoChiusura } from '../actions';

export const dynamic = 'force-dynamic';

export default async function GiornoChiusuraDettaglioPage({ params }: { params: { id: string } }) {
  const { supabase, user, profilo } = await requireAdmin();

  const { data: giorno } = await supabase
    .from('giorni_chiusura')
    .select('id, data_inizio, data_fine, nota')
    .eq('id', params.id)
    .maybeSingle();

  if (!giorno) redirect('/admin/calendario');

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <a href="/admin/calendario" className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna al calendario scolastico
        </a>

        <h1 className="text-lg font-medium">Modifica giorno di chiusura</h1>

        <FormConEsito
          action={aggiornaGiornoChiusura}
          className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <input type="hidden" name="giorno_id" value={giorno.id} />
          <div className="flex flex-wrap gap-2">
            <input
              name="data_inizio"
              type="date"
              required
              defaultValue={giorno.data_inizio}
              aria-label="Data di inizio"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <input
              name="data_fine"
              type="date"
              required
              defaultValue={giorno.data_fine}
              aria-label="Data di fine"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>
          <input
            name="nota"
            defaultValue={giorno.nota ?? ''}
            placeholder="Nota (opzionale, es. Vacanze di Natale)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Salva modifiche
          </PulsanteInvio>
        </FormConEsito>

        <ConfermaAzione
          azione={eliminaGiornoChiusura}
          campiNascosti={{ giorno_id: giorno.id }}
          etichetta="Elimina giorno di chiusura"
          messaggioConferma="Confermi l'eliminazione?"
        />
      </main>
    </NavHeader>
  );
}
