import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { SelettoreDestinatarioAvviso } from '@/components/SelettoreDestinatarioAvviso';
import { requireProfilo } from '@/lib/auth';
import { sezioniAttiveVisibili, bambiniAttiviVisibili } from '@/lib/sezioni';
import { aggiornaPromemoria, eliminaPromemoria } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function PromemoriaDettaglioPage({ params }: { params: { id: string } }) {
  const { supabase, user, profilo } = await requireProfilo();
  const ruolo = profilo?.ruolo ?? null;
  if (ruolo !== 'admin' && ruolo !== 'maestra') redirect('/dashboard');

  const [{ data: promemoria }, sezioni] = await Promise.all([
    supabase
      .from('promemoria')
      .select('id, titolo, testo, destinatario_tipo, sezione_id, bambino_id')
      .eq('id', params.id)
      .maybeSingle(),
    sezioniAttiveVisibili(supabase, user.id, ruolo),
  ]);

  if (!promemoria) redirect('/dashboard');

  const bambini = await bambiniAttiviVisibili(
    supabase,
    ruolo,
    sezioni.map((s) => s.id)
  );

  return (
    <>
      <NavHeader nome={profilo?.nome || user.email || ''} ruolo={ruolo} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <a href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna alla dashboard
        </a>

        <h1 className="text-lg font-medium">Modifica avviso</h1>

        <FormConEsito action={aggiornaPromemoria} className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <input type="hidden" name="promemoria_id" value={promemoria.id} />
          <input
            name="titolo"
            required
            defaultValue={promemoria.titolo}
            placeholder="Titolo"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <textarea
            name="testo"
            required
            defaultValue={promemoria.testo}
            placeholder="Testo dell'avviso"
            rows={3}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <SelettoreDestinatarioAvviso
            sezioni={sezioni}
            bambini={bambini}
            defaultTipo={promemoria.destinatario_tipo as 'tutti' | 'sezione' | 'bambino'}
            defaultSezioneId={promemoria.sezione_id ?? ''}
            defaultBambinoId={promemoria.bambino_id ?? ''}
          />
          <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Salva modifiche
          </PulsanteInvio>
        </FormConEsito>

        <ConfermaAzione
          azione={eliminaPromemoria}
          campiNascosti={{ promemoria_id: promemoria.id }}
          etichetta="Elimina avviso"
          messaggioConferma="Confermi l'eliminazione?"
        />
      </main>
    </>
  );
}
