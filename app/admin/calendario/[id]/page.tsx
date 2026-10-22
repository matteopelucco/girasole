import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { Campo } from '@/components/ui/campo';
import { riquadroVariants } from '@/components/ui/riquadro';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { requireAdmin } from '@/lib/auth';
import { formattaDataOraItaliana } from '@/lib/date';
import { cn } from '@/lib/utils';
import { aggiornaGiornoChiusura, eliminaGiornoChiusura } from '../actions';

export const dynamic = 'force-dynamic';

export default async function GiornoChiusuraDettaglioPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { supabase, user, profilo } = await requireAdmin();

  const { data: giorno } = await supabase
    .from('giorni_chiusura')
    .select('id, data_inizio, data_fine, nota, updated_at')
    .eq('id', params.id)
    .maybeSingle();

  if (!giorno) redirect('/admin/calendario');

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Link href="/admin/calendario" className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna al calendario scolastico
        </Link>

        <h1 className="text-lg font-medium">Modifica giorno di chiusura</h1>

        <FormConEsito
          action={aggiornaGiornoChiusura}
          className={cn(riquadroVariants(), 'space-y-2 p-4')}
        >
          <input type="hidden" name="giorno_id" value={giorno.id} />
          <div className="flex flex-wrap gap-2">
            <Campo
              name="data_inizio"
              type="date"
              required
              defaultValue={giorno.data_inizio}
              aria-label="Data di inizio"
              className="flex-1"
            />
            <Campo
              name="data_fine"
              type="date"
              required
              defaultValue={giorno.data_fine}
              aria-label="Data di fine"
              className="flex-1"
            />
          </div>
          <Campo
            name="nota"
            defaultValue={giorno.nota ?? ''}
            placeholder="Nota (opzionale, es. Vacanze di Natale)"
            className="w-full"
          />
          <PulsanteInvio variante="primario" misura="normale">
            Salva modifiche
          </PulsanteInvio>
          {giorno.updated_at && (
            <p className="text-xs text-stone-500">
              Ultimo salvataggio: {formattaDataOraItaliana(giorno.updated_at).replace('_', ' alle ')}
            </p>
          )}
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
