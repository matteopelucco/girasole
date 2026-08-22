import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { SelettoreData } from '@/components/SelettoreData';
import { requireProfilo } from '@/lib/auth';
import { oggi } from '@/lib/date';
import { sezioniAttiveVisibili } from '@/lib/sezioni';
import { creaPromemoria } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { data?: string };
}) {
  const { supabase, user, profilo } = await requireProfilo();

  const ruolo = profilo?.ruolo ?? null;
  const nomeVisualizzato = profilo?.nome || user.email || '';

  if (ruolo !== 'admin' && ruolo !== 'maestra') {
    return (
      <>
        <NavHeader nome={nomeVisualizzato} ruolo={ruolo} />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-medium">Ciao {nomeVisualizzato}</h1>
          <p className="mt-1 text-sm text-stone-500">Ruolo: {ruolo ?? 'non impostato'}</p>
          <div className="mt-8 rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-500">
            Il portale genitori è in arrivo in una fase successiva.
          </div>
        </main>
      </>
    );
  }

  const data = searchParams.data || oggi();
  const sezioni = await sezioniAttiveVisibili(supabase, user.id, ruolo);
  const haSezioni = ruolo === 'admin' || sezioni.length > 0;

  let bambini: { id: string; nome: string; cognome: string }[] = [];
  if (ruolo === 'admin') {
    const { data: tuttiBambini } = await supabase.from('bambini').select('id, nome, cognome').order('cognome');
    bambini = tuttiBambini ?? [];
  } else if (sezioni.length) {
    const { data: mieiBambini } = await supabase
      .from('bambini')
      .select('id, nome, cognome')
      .in(
        'sezione_id',
        sezioni.map((s) => s.id)
      )
      .order('cognome');
    bambini = mieiBambini ?? [];
  }

  const { data: promemoria } = await supabase
    .from('promemoria')
    .select('id, titolo, testo, destinatario_tipo, sezione_id, bambino_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <>
      <NavHeader nome={nomeVisualizzato} ruolo={ruolo} />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        {ruolo === 'admin' && (
          <div className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500">
            Per creare sezioni e bambini o gestire gli utenti vai su{' '}
            <a href="/admin" className="underline">
              Sezioni e bambini
            </a>{' '}
            /{' '}
            <a href="/admin/maestre" className="underline">
              Utenti
            </a>
            .
          </div>
        )}

        <section className="space-y-4">
          <SelettoreData basePath="/dashboard" data={data} />

          {!haSezioni && (
            <p className="text-sm text-stone-600">
              Non hai ancora nessuna sezione assegnata: chiedi all’admin di assegnartene una.
            </p>
          )}

          {haSezioni && (
            <div className="grid grid-cols-2 gap-4">
              <Link
                href={`/dashboard/presenze?data=${data}`}
                className="rounded-2xl bg-emerald-700 px-4 py-8 text-center text-lg font-semibold text-white shadow-sm hover:bg-emerald-800"
              >
                Presenze
              </Link>
              <Link
                href={`/dashboard/pasti?data=${data}`}
                className="rounded-2xl bg-amber-700 px-4 py-8 text-center text-lg font-semibold text-white shadow-sm hover:bg-amber-800"
              >
                Pasti
              </Link>
            </div>
          )}
        </section>

        <section>
          <h1 className="text-lg font-medium">Promemoria</h1>

          <FormConEsito
            action={creaPromemoria}
            className="mt-3 space-y-2 rounded-xl border border-stone-200 p-4"
          >
            <input
              name="titolo"
              required
              placeholder="Titolo"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <textarea
              name="testo"
              required
              placeholder="Testo del promemoria"
              rows={3}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <div className="flex flex-wrap gap-2">
              <select
                name="destinatario_tipo"
                defaultValue="tutti"
                aria-label="Destinatario"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 sm:w-auto"
              >
                <option value="tutti">Tutti</option>
                <option value="sezione">Una sezione</option>
                <option value="bambino">Un bambino</option>
              </select>
              <select
                name="sezione_id"
                defaultValue=""
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
                defaultValue=""
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
              Pubblica promemoria
            </PulsanteInvio>
          </FormConEsito>

          <ul className="mt-4 space-y-2">
            {promemoria?.map((p) => (
              <li key={p.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                <div className="font-medium">{p.titolo}</div>
                <p className="mt-1 text-stone-600">{p.testo}</p>
                <p className="mt-1 text-xs text-stone-600">
                  {p.destinatario_tipo === 'tutti' && 'Per tutti'}
                  {p.destinatario_tipo === 'sezione' && 'Per una sezione'}
                  {p.destinatario_tipo === 'bambino' && 'Per un bambino'}
                  {' · '}
                  {new Date(p.created_at).toLocaleDateString('it-IT')}
                </p>
              </li>
            ))}
            {!promemoria?.length && (
              <li className="text-sm text-stone-600">Nessun promemoria pubblicato.</li>
            )}
          </ul>
        </section>
      </main>
    </>
  );
}
