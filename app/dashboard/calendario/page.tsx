import { Suspense } from 'react';
import { NavHeader } from '@/components/NavHeader';
import { requireStaff } from '@/lib/auth';
import { oggi } from '@/lib/date';
import { SezioneChiusure } from './SezioneChiusure';
import { SezioneEventi } from './SezioneEventi';
import { ScheletroChiusure, ScheletroEventi } from './Scheletri';

export const dynamic = 'force-dynamic';

// Pagina "Calendario" (specs/64 - calendario-eventi.md, issue #320), in sola
// lettura per admin, maestra e assistente (il genitore torna alla dashboard).
//
// REGOLA DI SEPARAZIONE. In alto i giorni di chiusura (tabella
// `giorni_chiusura`, specs/53), in basso gli eventi importati da Google
// (tabella `calendario_eventi`): due sezioni, due componenti, due query, mai
// fuse in un'unica lista. Gli eventi di Google non creano né bloccano nulla.
// Ogni sezione si carica a parte, con un'ancora (titolo + sagome della stessa
// altezza) già in pagina: niente salti quando arrivano i dati. La pagina legge
// solo il database, mai Google, e non tocca l'indirizzo del feed.
export default async function CalendarioPage() {
  const { profilo, user, ruolo } = await requireStaff({});
  const dataOggi = oggi();
  const eAdmin = ruolo === 'admin';

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={ruolo}>
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-6 sm:py-8">
        <header>
          <h1 className="font-heading text-2xl font-semibold text-stone-900">Calendario</h1>
          <p className="mt-1 text-sm text-stone-600">Chiusure dell&apos;asilo ed eventi in programma.</p>
        </header>

        <section aria-labelledby="titolo-chiusure" className="space-y-3">
          <h2 id="titolo-chiusure" className="font-heading text-lg font-semibold text-stone-900">
            Giorni di chiusura
          </h2>
          <Suspense fallback={<ScheletroChiusure />}>
            <SezioneChiusure oggi={dataOggi} eAdmin={eAdmin} />
          </Suspense>
        </section>

        <section aria-labelledby="titolo-eventi" className="space-y-4">
          <h2 id="titolo-eventi" className="font-heading text-lg font-semibold text-stone-900">
            A calendario
          </h2>
          <Suspense fallback={<ScheletroEventi />}>
            <SezioneEventi oggi={dataOggi} eAdmin={eAdmin} />
          </Suspense>
        </section>
      </main>
    </NavHeader>
  );
}
