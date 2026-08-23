import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { ConfermaEliminazione } from '@/components/ConfermaEliminazione';
import { requireProfilo } from '@/lib/auth';
import { sezioniAttiveVisibili } from '@/lib/sezioni';
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

  let bambini: { id: string; nome: string; cognome: string }[] = [];
  if (ruolo === 'admin') {
    const { data } = await supabase.from('bambini').select('id, nome, cognome').eq('attiva', true).order('cognome');
    bambini = data ?? [];
  } else if (sezioni.length) {
    const { data } = await supabase
      .from('bambini')
      .select('id, nome, cognome')
      .in('sezione_id', sezioni.map((s) => s.id))
      .eq('attiva', true)
      .order('cognome');
    bambini = data ?? [];
  }

  return (
    <>
      <NavHeader nome={profilo?.nome || user.email || ''} ruolo={ruolo} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <a href="/dashboard" className="text-sm text-stone-500 hover:text-stone-900">
          ← Torna alla dashboard
        </a>

        <h1 className="text-lg font-medium">Modifica promemoria</h1>

        <FormConEsito action={aggiornaPromemoria} className="space-y-2 rounded-xl border border-stone-200 p-4">
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
            placeholder="Testo del promemoria"
            rows={3}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <div className="flex flex-wrap gap-2">
            <select
              name="destinatario_tipo"
              defaultValue={promemoria.destinatario_tipo}
              aria-label="Destinatario"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 sm:w-auto"
            >
              <option value="tutti">Tutti</option>
              <option value="sezione">Una sezione</option>
              <option value="bambino">Un bambino</option>
            </select>
            <select
              name="sezione_id"
              defaultValue={promemoria.sezione_id ?? ''}
              aria-label="Sezione destinataria"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 sm:w-56"
            >
              <option value="">— sezione (se destinatario è &quot;Una sezione&quot;) —</option>
              {sezioni.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
            <select
              name="bambino_id"
              defaultValue={promemoria.bambino_id ?? ''}
              aria-label="Bambino destinatario"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 sm:w-56"
            >
              <option value="">— bambino (se destinatario è &quot;Un bambino&quot;) —</option>
              {bambini.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome} {b.cognome}
                </option>
              ))}
            </select>
          </div>
          <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Salva modifiche
          </PulsanteInvio>
        </FormConEsito>

        <ConfermaEliminazione
          azione={eliminaPromemoria}
          campiNascosti={{ promemoria_id: promemoria.id }}
          etichetta="Elimina promemoria"
        />
      </main>
    </>
  );
}
