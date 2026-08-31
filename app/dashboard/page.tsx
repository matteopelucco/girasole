import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { SelettoreData } from '@/components/SelettoreData';
import { SelettoreDestinatarioAvviso } from '@/components/SelettoreDestinatarioAvviso';
import { requireProfilo } from '@/lib/auth';
import { oggi, settimanaPrecedente, formattaIntervalloItaliano } from '@/lib/date';
import { sezioniAttiveVisibili, bambiniAttiviVisibili } from '@/lib/sezioni';
import { cardsDashboard } from '@/lib/dashboardSezioni';
import { chiusuraPerData, isGiornoChiuso } from '@/lib/calendarioScolastico';
import {
  dopoMezzogiorno,
  allarmeMezzogiornoAttivo,
  calcolaStatoOperativoGiorno,
  descrizioneStatoOperativo,
  settimanaPrecedenteConfermata,
} from '@/lib/allarmi';
import { createAdminClient } from '@/lib/supabase/admin';
import { creaPromemoria } from './actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { data?: string; promemoria?: string };
}) {
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

  const data = searchParams.data || oggi();
  const sezioni = await sezioniAttiveVisibili(supabase, user.id, ruolo);
  const haSezioni = ruolo === 'admin' || sezioni.length > 0;
  const cards = cardsDashboard({ data, haSezioni, ruolo, abilitatoOreLavoro: profilo?.abilitato_ore_lavoro });

  // Allarme 1 (specs/07 - allarmi.md): presenze/pasti non completati
  // entro mezzogiorno, per TUTTO l'asilo — richiede la service_role key
  // per vedere le sezioni al di là di quelle dell'utente corrente
  // (stesso motivo del report notturno, specs/52).
  const oraAttuale = new Date();
  const chiusuraOggi = await chiusuraPerData(supabase, oggi());
  const giornoAttivoOggi = !isGiornoChiuso(oggi(), chiusuraOggi ? [chiusuraOggi] : []);
  let descrizioneAllarmeMezzogiorno: string | null = null;
  if (giornoAttivoOggi && dopoMezzogiorno(oraAttuale)) {
    const statoOperativo = await calcolaStatoOperativoGiorno(createAdminClient(), oggi());
    if (allarmeMezzogiornoAttivo(oraAttuale, giornoAttivoOggi, statoOperativo)) {
      descrizioneAllarmeMezzogiorno = descrizioneStatoOperativo(statoOperativo);
    }
  }

  // Allarme 2 (specs/07): la mia settimana di ore di lavoro scorsa non
  // confermata — solo per me (RLS sulla mia sessione, nessun bisogno
  // della service_role key qui).
  const settimanaOreScorsa = settimanaPrecedente(oggi());
  let mostraAllarmeSettimanaOre = false;
  if (profilo?.abilitato_ore_lavoro) {
    const confermata = await settimanaPrecedenteConfermata(supabase, user.id, settimanaOreScorsa.inizio);
    mostraAllarmeSettimanaOre = !confermata;
  }

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
        {descrizioneAllarmeMezzogiorno && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">⚠️ Presenze e/o pasti di oggi non risultano completati</p>
            <p className="mt-1">Sono le 12:00 passate e {descrizioneAllarmeMezzogiorno}. Verifica appena possibile.</p>
          </div>
        )}

        {mostraAllarmeSettimanaOre && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">⏰ Non hai confermato le ore della settimana scorsa</p>
            <p className="mt-1">
              Settimana {formattaIntervalloItaliano(settimanaOreScorsa.inizio, settimanaOreScorsa.fine)}. Contatta
              l&apos;amministratore per regolarizzarla.
            </p>
          </div>
        )}

        {ruolo === 'admin' && (
          <div className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-600">
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
