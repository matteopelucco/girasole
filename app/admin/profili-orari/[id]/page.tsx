import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { CampiOreSettimana } from '@/components/CampiOreSettimana';
import { requireAdmin } from '@/lib/auth';
import { totaleOreSettimanali } from '@/lib/profiliOrari';
import { aggiornaProfiloOrario, eliminaProfiloOrario } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ProfiloOrarioDettaglioPage({ params }: { params: { id: string } }) {
  const { supabase, user, profilo } = await requireAdmin();

  const { data: profiloOrario } = await supabase
    .from('profili_orari')
    .select('id, nome, ore_lunedi, ore_martedi, ore_mercoledi, ore_giovedi, ore_venerdi')
    .eq('id', params.id)
    .maybeSingle();

  if (!profiloOrario) redirect('/admin/profili-orari');

  return (
    <>
      <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <a href="/admin/profili-orari" className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna ai profili orari
        </a>

        <h1 className="text-lg font-medium">Modifica profilo orario</h1>

        <FormConEsito
          action={aggiornaProfiloOrario}
          className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <input type="hidden" name="profilo_id" value={profiloOrario.id} />
          <input
            name="nome"
            required
            defaultValue={profiloOrario.nome}
            placeholder="Nome (es. 35 ore settimanali)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <CampiOreSettimana valori={profiloOrario} />
          <p className="text-sm text-stone-600">Totale: {totaleOreSettimanali(profiloOrario)}h/settimana</p>
          <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Salva modifiche
          </PulsanteInvio>
        </FormConEsito>

        <ConfermaAzione
          azione={eliminaProfiloOrario}
          campiNascosti={{ profilo_id: profiloOrario.id }}
          etichetta="Elimina profilo orario"
          messaggioConferma="Confermi l'eliminazione? Gli utenti a cui è assegnato resteranno senza profilo orario."
        />
      </main>
    </>
  );
}
