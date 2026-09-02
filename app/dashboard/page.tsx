import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { SelettoreData } from '@/components/SelettoreData';
import { SelettoreDestinatarioAvviso } from '@/components/SelettoreDestinatarioAvviso';
import { requireProfilo } from '@/lib/auth';
import { oggi, formattaIntervalloItaliano } from '@/lib/date';
import { sezioniAttiveVisibili, bambiniAttiviVisibili } from '@/lib/sezioni';
import { cardsDashboard } from '@/lib/dashboardSezioni';
import { chiusuraPerData, isGiornoChiuso } from '@/lib/calendarioScolastico';
import {
  allarmePersonalePresenzePastiAttivo,
  calcolaStatoPersonaleGiorno,
  settimanaDiRiferimentoOre,
  settimanaConfermata,
  allarmiPerDipendenti,
} from '@/lib/allarmi';
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
  const dataOggi = oggi();
  const sezioni = await sezioniAttiveVisibili(supabase, user.id, ruolo);
  const haSezioni = ruolo === 'admin' || sezioni.length > 0;
  const cards = cardsDashboard({ data, haSezioni, ruolo, abilitatoOreLavoro: profilo?.abilitato_ore_lavoro });

  // Allarme 1 (specs/07 - allarmi.md): presenze/pasti non ancora
  // segnati dopo le 10:00, personale — solo le mie sezioni (tutte le
  // sezioni attive se sono admin). Usa la sessione normale dell'utente,
  // che ha già visibilità RLS sulle proprie sezioni: nessuna
  // service_role key necessaria.
  const oraAttuale = new Date();
  const chiusuraOggi = await chiusuraPerData(supabase, dataOggi);
  const giornoAttivoOggi = !isGiornoChiuso(dataOggi, chiusuraOggi ? [chiusuraOggi] : []);
  const statoPersonale = await calcolaStatoPersonaleGiorno(supabase, ruolo, sezioni, dataOggi);
  const mostraAllarmePersonale = allarmePersonalePresenzePastiAttivo(oraAttuale, giornoAttivoOggi, statoPersonale);

  // Allarme 2 (specs/07): la mia settimana di ore di lavoro di
  // riferimento (quella precedente fino a venerdì 18:00, poi quella
  // corrente) non confermata — solo per me.
  const settimanaOreRiferimento = settimanaDiRiferimentoOre(oraAttuale, dataOggi);
  let mostraAllarmeSettimanaOre = false;
  if (profilo?.abilitato_ore_lavoro) {
    const confermata = await settimanaConfermata(supabase, user.id, settimanaOreRiferimento.inizio);
    mostraAllarmeSettimanaOre = !confermata;
  }

  // Allarme 3 (specs/07): riepilogo read-only, solo per l'admin, degli
  // allarmi (presenze/pasti, settimana ore) di tutto il personale —
  // nessuna azione da qui, solo visibilità.
  const allarmiStaff =
    ruolo === 'admin' ? await allarmiPerDipendenti(supabase, dataOggi, giornoAttivoOggi, oraAttuale, user.id) : [];

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
        {mostraAllarmePersonale && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">⚠️ Presenze e/o pasti di oggi non risultano completati</p>
            <p className="mt-1">Sono le 10:00 passate. Ecco cosa manca:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {statoPersonale.sezioniPresenzeIncomplete.map((sezione) => (
                <li key={sezione.id}>
                  <Link href={`/dashboard/presenze/${sezione.id}?data=${dataOggi}`} className="underline">
                    Presenze — {sezione.nome}
                  </Link>
                </li>
              ))}
              {statoPersonale.pastiNonConfermati && (
                <li>
                  <Link href={`/dashboard/pasti?data=${dataOggi}`} className="underline">
                    Comunicare i pasti a Rojac
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}

        {mostraAllarmeSettimanaOre && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">⏰ Non hai confermato le ore della settimana</p>
            <p className="mt-1">
              Settimana {formattaIntervalloItaliano(settimanaOreRiferimento.inizio, settimanaOreRiferimento.fine)}.{' '}
              <Link href={`/dashboard/ore-lavoro?settimana=${settimanaOreRiferimento.inizio}`} className="underline">
                Vai su Ore di lavoro per confermarla.
              </Link>
            </p>
          </div>
        )}

        {ruolo === 'admin' && allarmiStaff.length > 0 && (
          <div className="rounded-xl border border-stone-300 bg-stone-50 p-4 text-sm text-stone-800">
            <p className="font-semibold">Situazione del personale</p>
            <ul className="mt-2 space-y-1">
              {allarmiStaff.map((allarme) => (
                <li key={allarme.utenteId}>
                  <span className="font-medium">
                    {allarme.nome} {allarme.cognome}
                  </span>
                  :{' '}
                  {[
                    ...allarme.sezioniPresenzeIncomplete.map((nome) => `presenze non segnate (${nome})`),
                    ...(allarme.pastiNonConfermati ? ['pasti non comunicati'] : []),
                    ...(allarme.settimanaOreNonConfermata
                      ? [
                          `settimana ore ${formattaIntervalloItaliano(
                            allarme.settimanaOreNonConfermata.inizio,
                            allarme.settimanaOreNonConfermata.fine
                          )} non confermata`,
                        ]
                      : []),
                  ].join(', ')}
                </li>
              ))}
            </ul>
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
