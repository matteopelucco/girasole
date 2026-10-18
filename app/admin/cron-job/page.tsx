import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { LancioManualeCron } from '@/components/LancioManualeCron';
import { SchedeAzioni } from '@/components/SchedeAzioni';
import { requireAdmin } from '@/lib/auth';
import {
  LIMITE_MASSIMO,
  etichettaLancio,
  formattaInizioLancio,
  gruppiCron,
  hrefCaricaAltri,
  limitiDaParametri,
  statoLancio,
  type StatoLancio,
} from '@/lib/cronEsecuzioni';
import { leggiLanciCron } from '@/lib/cronEsecuzioniDati';
import { ID_PANNELLO_SCHEDE, idTabScheda, schedaDaParametri } from '@/lib/schedeAzioni';
import { lanciaCronAMano } from './actions';

export const dynamic = 'force-dynamic';

// Durata massima della funzione, che vale anche per il lancio a mano (Server
// Action di questa pagina, specs/63): 60 secondi, limite accettato anche dal
// piano gratuito di Vercel. Un lancio che lo supera viene interrotto e, senza
// esito, risulta "KO" (interrotto) dopo 15 minuti.
export const maxDuration = 60;

// Stringhe letterali: Tailwind non vede le classi composte a runtime.
const CLASSI_STATO: Record<StatoLancio['stato'], string> = {
  OK: 'bg-emerald-100 text-emerald-800',
  KO: 'bg-rose-100 text-rose-800',
  'In corso': 'bg-amber-100 text-amber-900',
};

// specs/63 - cron-job.md: pagina "Azioni" (indirizzo `/admin/cron-job`) con due
// schede, scelte da `?scheda=`: "Cron Job" (iniziale) e "Azioni" (per ora vuota).
// Scheda "Cron Job": lanci dei job pianificati, letti dal registro
// `cron_esecuzioni` con la sessione dell'admin (la RLS lascia leggere solo a
// lui). Un blocco per job; "Carica altri" allarga di 20 il solo blocco scelto
// (parametro nella query string), senza JavaScript lato client. Ogni blocco ha
// il pulsante "Lancia ora" (lancio a mano, issue #302): i lanci a mano hanno il
// tag "estemporaneo".
export default async function CronJobPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user, profilo } = await requireAdmin();
  const parametri = await props.searchParams;
  const scheda = schedaDaParametri(parametri);

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h1 className="text-lg font-medium">Azioni</h1>

        <SchedeAzioni attiva={scheda} />

        <div
          role="tabpanel"
          id={ID_PANNELLO_SCHEDE}
          aria-labelledby={idTabScheda(scheda)}
          tabIndex={0}
          className="space-y-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900"
        >
          {scheda === 'cron-job' ? (
            <SchedaCronJob supabase={supabase} parametri={parametri} />
          ) : (
            <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
              Qui compariranno le azioni lanciabili a mano. Per ora non ce ne sono.
            </p>
          )}
        </div>
      </main>
    </NavHeader>
  );
}

// Contenuto della scheda "Cron Job": invariato rispetto a prima di #325.
async function SchedaCronJob({
  supabase,
  parametri,
}: {
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'];
  parametri: Record<string, string | string[] | undefined>;
}) {
  const limiti = limitiDaParametri(parametri);
  const { righe, errore } = await leggiLanciCron(supabase, limiti);
  const gruppi = gruppiCron(righe, limiti);
  const adesso = new Date();

  return (
    <>
      <p className="text-sm text-stone-600">
        I lanci dei job pianificati, dal più recente: quando sono partiti e se sono andati a buon fine.
      </p>

      {errore && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Non è stato possibile leggere il registro dei lanci. Riprova più tardi.
        </p>
      )}

      {gruppi.map((gruppo) => (
        <section key={gruppo.nome} aria-labelledby={`cron-${gruppo.nome}`} className="space-y-3">
          <div>
            <h2 id={`cron-${gruppo.nome}`} className="text-base font-medium text-stone-900">
              {gruppo.titolo}
            </h2>
            <p className="mt-0.5 text-sm text-stone-600">{gruppo.descrizione}</p>
          </div>

          <LancioManualeCron nome={gruppo.nome} titolo={gruppo.titolo} azione={lanciaCronAMano} />

          {gruppo.lanci.length === 0 ? (
            <p className="text-sm text-stone-600">Nessun lancio registrato.</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm">
              {gruppo.lanci.map((lancio) => {
                const { stato, messaggio } = statoLancio(lancio, adesso);
                const etichetta = etichettaLancio(lancio);
                return (
                  <li key={lancio.id} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-stone-900">
                        <span className="font-medium">{gruppo.titolo}</span>
                        {' · '}
                        <time dateTime={new Date(lancio.iniziato_il).toISOString()}>
                          {formattaInizioLancio(lancio.iniziato_il)}
                        </time>
                        {etichetta && (
                          <span
                            data-testid="tag-estemporaneo"
                            className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900"
                          >
                            {etichetta}
                          </span>
                        )}
                      </span>
                      <span
                        data-testid="stato-lancio"
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASSI_STATO[stato]}`}
                      >
                        {stato}
                      </span>
                    </div>
                    {messaggio && <p className="mt-1 break-words text-stone-700">{messaggio}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          {gruppo.altri && limiti[gruppo.nome] < LIMITE_MASSIMO && (
            <Link
              href={hrefCaricaAltri(gruppo.nome, limiti)}
              scroll={false}
              className="inline-flex min-h-11 items-center rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:border-stone-500"
            >
              Carica altri
            </Link>
          )}
        </section>
      ))}
    </>
  );
}
