import { Suspense } from 'react';
import { NavHeader } from '@/components/NavHeader';
import { Schede } from '@/components/Schede';
import { requireStaff } from '@/lib/auth';
import { oggi } from '@/lib/date';
import { ID_PANNELLO_SCHEDE, idTabScheda, schedaDaParametri } from '@/lib/schede';
import { SCHEDE_CALENDARIO } from '@/lib/schedeCalendario';
import { SezioneChiusure } from './SezioneChiusure';
import { SezioneEventi } from './SezioneEventi';
import { ScheletroChiusure, ScheletroEventi } from './Scheletri';

export const dynamic = 'force-dynamic';

// Pagina "Calendario attività" (specs/64 - calendario-eventi.md, issue #320 e
// #328), in sola lettura per admin, maestra e assistente (il genitore torna
// alla dashboard). Due schede, scelte da `?scheda=`: "Calendario attività" (gli
// eventi di Google, iniziale) e "Giorni di chiusura" (`?scheda=chiusure`).
//
// REGOLA DI SEPARAZIONE. I giorni di chiusura (tabella `giorni_chiusura`,
// specs/53) e gli eventi importati da Google (tabella `calendario_eventi`)
// sono due schede, due componenti, due query, mai fusi in un'unica lista; si
// legge solo quella della scheda scelta. Gli eventi di Google non creano né
// bloccano nulla. Ogni sezione si carica a parte, con un'ancora (titolo +
// sagome della stessa altezza) già in pagina: niente salti quando arrivano i
// dati. La pagina legge solo il database, mai Google, e non tocca l'indirizzo
// del feed.
export default async function CalendarioPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profilo, user, ruolo } = await requireStaff({});
  const scheda = schedaDaParametri(await props.searchParams, SCHEDE_CALENDARIO);
  const dataOggi = oggi();
  const eAdmin = ruolo === 'admin';

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={ruolo}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:py-8">
        <header>
          <h1 className="font-heading text-2xl font-semibold text-stone-900">Calendario attività</h1>
          <p className="mt-1 text-sm text-stone-600">Eventi in programma e chiusure dell&apos;asilo.</p>
        </header>

        <Schede schede={SCHEDE_CALENDARIO} attiva={scheda} />

        <div
          role="tabpanel"
          id={ID_PANNELLO_SCHEDE}
          aria-labelledby={idTabScheda(scheda)}
          tabIndex={0}
          className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {scheda === 'chiusure' ? (
            <section aria-labelledby="titolo-chiusure" className="space-y-3">
              <h2 id="titolo-chiusure" className="font-heading text-lg font-semibold text-stone-900">
                Giorni di chiusura
              </h2>
              <Suspense fallback={<ScheletroChiusure />}>
                <SezioneChiusure oggi={dataOggi} eAdmin={eAdmin} />
              </Suspense>
            </section>
          ) : (
            <section aria-labelledby="titolo-eventi" className="space-y-4">
              <h2 id="titolo-eventi" className="font-heading text-lg font-semibold text-stone-900">
                A calendario
              </h2>
              <Suspense fallback={<ScheletroEventi />}>
                <SezioneEventi oggi={dataOggi} eAdmin={eAdmin} />
              </Suspense>
            </section>
          )}
        </div>
      </main>
    </NavHeader>
  );
}
