import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { requireAdmin } from '@/lib/auth';
import {
  LIMITE_MASSIMO,
  formattaInizioLancio,
  gruppiCron,
  hrefCaricaAltri,
  limitiDaParametri,
  statoLancio,
  type StatoLancio,
} from '@/lib/cronEsecuzioni';
import { leggiLanciCron } from '@/lib/cronEsecuzioniDati';

export const dynamic = 'force-dynamic';

// Stringhe letterali: Tailwind non vede le classi composte a runtime.
const CLASSI_STATO: Record<StatoLancio['stato'], string> = {
  OK: 'bg-emerald-100 text-emerald-800',
  KO: 'bg-rose-100 text-rose-800',
  'In corso': 'bg-amber-100 text-amber-900',
};

// specs/63 - cron-job.md: lanci dei job pianificati, letti dal registro
// `cron_esecuzioni` con la sessione dell'admin (la RLS lascia leggere solo a
// lui). Un blocco per job; "Carica altri" allarga di 20 il solo blocco scelto
// (parametro nella query string), senza JavaScript lato client.
export default async function CronJobPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user, profilo } = await requireAdmin();
  const limiti = limitiDaParametri(await props.searchParams);
  const { righe, errore } = await leggiLanciCron(supabase, limiti);
  const gruppi = gruppiCron(righe, limiti);
  const adesso = new Date();

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Cron Job</h1>
          <p className="mt-1 text-sm text-stone-600">
            I lanci dei job pianificati, dal più recente: quando sono partiti e se sono andati a buon fine.
          </p>
        </div>

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

            {gruppo.lanci.length === 0 ? (
              <p className="text-sm text-stone-600">Nessun lancio registrato.</p>
            ) : (
              <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm">
                {gruppo.lanci.map((lancio) => {
                  const { stato, messaggio } = statoLancio(lancio, adesso);
                  return (
                    <li key={lancio.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-stone-900">
                          <span className="font-medium">{gruppo.titolo}</span>
                          {' · '}
                          <time dateTime={new Date(lancio.iniziato_il).toISOString()}>
                            {formattaInizioLancio(lancio.iniziato_il)}
                          </time>
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
      </main>
    </NavHeader>
  );
}
