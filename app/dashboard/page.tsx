import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { SelettoreDestinatarioAvviso } from '@/components/SelettoreDestinatarioAvviso';
import { requireProfilo } from '@/lib/auth';
import { oggi } from '@/lib/date';
import { sezioniAttiveVisibili, bambiniAttiviVisibili } from '@/lib/sezioni';
import { cardsDashboard } from '@/lib/dashboardSezioni';
import { creaPromemoria } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage(
  props: {
    searchParams: Promise<{ promemoria?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { supabase, user, profilo } = await requireProfilo();

  const ruolo = profilo?.ruolo ?? null;
  const nomeVisualizzato = profilo?.nome || user.email || '';

  if (ruolo !== 'admin' && ruolo !== 'maestra' && ruolo !== 'assistente') {
    return (
      <NavHeader nome={nomeVisualizzato} ruolo={ruolo}>
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-xl font-medium">Ciao {nomeVisualizzato}</h1>
          <p className="mt-1 text-sm text-stone-600">Ruolo: {ruolo ?? 'non impostato'}</p>
          <div className="mt-8 rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-600">
            Il portale genitori è in arrivo in una fase successiva.
          </div>
        </main>
      </NavHeader>
    );
  }

  const dataOggi = oggi();
  const sezioni = await sezioniAttiveVisibili(supabase, user.id, ruolo);
  const haSezioni = ruolo === 'admin' || sezioni.length > 0;
  const cards = cardsDashboard({ data: dataOggi, haSezioni, abilitatoOreLavoro: profilo?.abilitato_ore_lavoro });

  const bambini = await bambiniAttiviVisibili(
    supabase,
    ruolo,
    sezioni.map((s) => s.id)
  );

  const { data: promemoria } = await supabase
    .from('promemoria')
    .select('id, titolo, testo, destinatario_tipo, sezione_id, bambino_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <NavHeader nome={nomeVisualizzato} ruolo={ruolo}>
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8">
        <section className="space-y-4">
          {!haSezioni && (
            <p className="text-sm text-stone-600">
              Non hai ancora nessuna sezione assegnata: chiedi all’admin di assegnartene una.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            {cards.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className={`rounded-2xl ${c.classi} px-4 py-8 text-center text-lg font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  c.spanIntero ? 'col-span-2' : ''
                }`}
              >
                <span className="block text-3xl" aria-hidden="true">
                  {c.icona}
                </span>
                {c.etichetta}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h1 className="text-lg font-medium">Avvisi</h1>

          {searchParams.promemoria === 'eliminato' && (
            <p className="mt-2 text-sm text-green-700">Avviso eliminato.</p>
          )}

          <FormConEsito
            action={creaPromemoria}
            resetSuOk
            className="mt-3 space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
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
              placeholder="Testo dell'avviso"
              rows={3}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
            <SelettoreDestinatarioAvviso sezioni={sezioni} bambini={bambini} />
            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Pubblica avviso
            </PulsanteInvio>
          </FormConEsito>

          <ul className="mt-4 space-y-2">
            {promemoria?.map((p) => (
              <li key={p.id} className="rounded-lg border border-stone-200 bg-white p-3 text-sm shadow-sm">
                <Link href={`/dashboard/promemoria/${p.id}`} className="font-medium hover:underline">
                  {p.titolo}
                </Link>
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
              <li className="text-sm text-stone-600">Nessun avviso pubblicato.</li>
            )}
          </ul>
        </section>
      </main>
    </NavHeader>
  );
}
