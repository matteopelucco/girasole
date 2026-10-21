import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { SelettoreDestinatarioAvviso } from '@/components/SelettoreDestinatarioAvviso';
import { requireProfilo } from '@/lib/auth';
import { oggi, formattaIntervalloItaliano } from '@/lib/date';
import { sezioniEBambiniVisibili } from '@/lib/sezioni';
import { cardsDashboard } from '@/lib/dashboardSezioni';
import { percorsoGiornata } from '@/lib/giornata';
import { allarmePersonalePresenzePastiAttivo } from '@/lib/allarmi';
import { ID_ALLARME_RETTE } from '@/lib/elencoAllarmi';
import { ID_ALLARME_ROJAC } from '@/lib/allarmeRojac';
import { creaPromemoria } from './actions';
import { ProssimiEventi } from './ProssimiEventi';
import { caricaAllarmiCorrenti, caricaDatiAllarmiCorrenti } from './allarmi/dati';

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

  // Tutte le letture partono insieme (issue #367). Gli allarmi (specs/07 -
  // allarmi.md) non si ricalcolano qui: si prendono dai dati condivisi con
  // la campanella e la pagina Allarmi (una lettura per richiesta), con la
  // sessione normale dell'utente, nessuna service_role key.
  const [{ sezioni, bambini }, datiAllarmi, elencoAllarmi, { data: promemoria }] = await Promise.all([
    sezioniEBambiniVisibili(supabase, user.id, ruolo),
    caricaDatiAllarmiCorrenti(),
    caricaAllarmiCorrenti(),
    supabase
      .from('promemoria')
      .select('id, titolo, testo, destinatario_tipo, sezione_id, bambino_id, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const haSezioni = ruolo === 'admin' || sezioni.length > 0;
  const cards = cardsDashboard({ data: dataOggi, haSezioni, abilitatoOreLavoro: profilo?.abilitato_ore_lavoro });

  // Allarme 1: presenze/pasti non ancora segnati dopo le 10:00, personale —
  // solo le mie sezioni (tutte le sezioni attive se sono admin).
  const statoPersonale = datiAllarmi?.statoPersonale ?? { sezioniPresenzeIncomplete: [], pastiNonConfermati: false };
  const mostraAllarmePersonale =
    !!datiAllarmi &&
    allarmePersonalePresenzePastiAttivo(datiAllarmi.adesso, datiAllarmi.giornoAttivo, datiAllarmi.statoPersonale);

  // Allarme 2: la mia settimana di ore di lavoro di riferimento (quella
  // precedente fino a venerdì 18:00, poi quella corrente) non confermata.
  const settimanaOreNonConfermata = datiAllarmi?.settimanaOreNonConfermata ?? null;

  // Allarme 3: riepilogo read-only, solo per l'admin, degli allarmi
  // (presenze/pasti, settimana ore) di tutto il personale — nessuna azione
  // da qui, solo visibilità. Vuoto per gli altri ruoli.
  const allarmiStaff = datiAllarmi?.personale ?? [];

  // Allarmi 4 e 5: rette non comunicate e mail mensile a Rojac non inviata,
  // solo per l'admin (per gli altri ruoli non sono nell'elenco).
  const allarmiAdmin = (elencoAllarmi ?? []).filter((a) => a.id === ID_ALLARME_RETTE || a.id === ID_ALLARME_ROJAC);

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
                  <Link href={percorsoGiornata(dataOggi)} className="underline">
                    Presenze — {sezione.nome}
                  </Link>
                </li>
              ))}
              {statoPersonale.pastiNonConfermati && (
                <li>
                  <Link href={`${percorsoGiornata(dataOggi)}#comunicazione-rojac`} className="underline">
                    Comunicare i pasti a Rojac
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}

        {settimanaOreNonConfermata && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">⏰ Non hai confermato le ore della settimana</p>
            <p className="mt-1">
              Settimana {formattaIntervalloItaliano(settimanaOreNonConfermata.inizio, settimanaOreNonConfermata.fine)}.{' '}
              <Link href={`/dashboard/ore-lavoro?settimana=${settimanaOreNonConfermata.inizio}`} className="underline">
                Vai su Ore di lavoro per confermarla.
              </Link>
            </p>
          </div>
        )}

        {allarmiAdmin.map((allarme) => (
          <div
            key={allarme.id}
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
          >
            <p className="font-semibold">⚠️ {allarme.titolo}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {allarme.voci.map((voce, indice) => (
                <li key={`${indice}-${voce.testo}`}>
                  {voce.href ? (
                    <Link href={voce.href} className="underline">
                      {voce.testo}
                    </Link>
                  ) : (
                    voce.testo
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

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
                className={`rounded-2xl ${c.classi} px-4 py-8 text-center text-lg font-semibold text-white shadow-xs transition hover:-translate-y-0.5 hover:shadow-md ${
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

        <ProssimiEventi oggi={dataOggi} />

        <section>
          <h1 className="text-lg font-medium">Avvisi</h1>

          {searchParams.promemoria === 'eliminato' && (
            <p className="mt-2 text-sm text-green-700">Avviso eliminato.</p>
          )}

          <FormConEsito
            action={creaPromemoria}
            resetSuOk
            className="mt-3 space-y-2 rounded-xl border border-border bg-white p-4 shadow-xs"
          >
            <input
              name="titolo"
              required
              placeholder="Titolo"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-hidden focus:border-stone-500"
            />
            <textarea
              name="testo"
              required
              placeholder="Testo dell'avviso"
              rows={3}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-hidden focus:border-stone-500"
            />
            <SelettoreDestinatarioAvviso sezioni={sezioni} bambini={bambini} />
            <PulsanteInvio className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
              Pubblica avviso
            </PulsanteInvio>
          </FormConEsito>

          <ul className="mt-4 space-y-2">
            {promemoria?.map((p) => (
              <li key={p.id} className="rounded-lg border border-border bg-white p-3 text-sm shadow-xs">
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
