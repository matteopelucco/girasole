import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { prossimiEventiDashboard, PROSSIMI_EVENTI_DASHBOARD, type EventoRiga } from '@/lib/calendarioEventiVista';
import { EtichetteEvento, TesseraGiorno } from './calendario/ElencoEventi';

// Riquadro "Prossimi eventi" della dashboard (specs/64 - calendario-eventi.md,
// issue #321): i 3 eventi di Google più vicini, compreso quello in corso.
//
// REGOLA DI SEPARAZIONE. Legge SOLO `calendario_eventi`, con una query a sé
// (mai `giorni_chiusura`, specs/53): le due cose non si fondono e gli eventi
// non creano né bloccano nulla. Usa la sessione di chi guarda (RLS), non
// chiama mai Google e non legge né mostra `impostazioni_calendario`: non sa se
// il calendario è collegato, quindi il messaggio vuoto è uguale per tutti.
//
// Titolo e orario arrivano da un feed non fidato: sono resi da React come
// testo, mai come HTML e mai come link. Se la lettura fallisce si mostra il
// messaggio neutro (l'errore resta nel log del server): il resto della
// dashboard non ne risente.

const TITOLO_ID = 'titolo-prossimi-eventi';

export function ScheletroProssimiEventi() {
  return (
    <div role="status" className="space-y-2">
      <span className="sr-only">Caricamento dei prossimi eventi…</span>
      {Array.from({ length: PROSSIMI_EVENTI_DASHBOARD }, (_, i) => (
        <div key={i} aria-hidden className="h-[78px] rounded-lg bg-stone-200 motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

async function leggiProssimiEventi(): Promise<EventoRiga[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('calendario_eventi')
      .select('id, titolo, descrizione, luogo, inizio, fine, tutto_il_giorno')
      // Già finiti: fuori. Quelli cominciati e non ancora finiti restano.
      .gte('fine', new Date().toISOString())
      .order('inizio', { ascending: true })
      .limit(PROSSIMI_EVENTI_DASHBOARD);
    if (error) {
      console.error('Dashboard: impossibile leggere i prossimi eventi', error.message);
      return [];
    }
    return (data ?? []) as EventoRiga[];
  } catch (errore) {
    console.error('Dashboard: impossibile leggere i prossimi eventi', errore instanceof Error ? errore.message : 'errore');
    return [];
  }
}

async function ElencoProssimiEventi({ oggi }: { oggi: string }) {
  const eventi = prossimiEventiDashboard(await leggiProssimiEventi(), oggi);

  if (eventi.length === 0) {
    return (
      <p
        data-testid="nessun-prossimo-evento"
        className="rounded-lg border border-dashed border-stone-300 bg-white px-4 py-5 text-center text-sm text-stone-700"
      >
        Non ci sono eventi in programma.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {eventi.map((evento) => (
        <li
          key={evento.id}
          data-testid="prossimo-evento"
          className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
        >
          <TesseraGiorno
            data={evento.data}
            nomeGiorno={evento.nomeGiorno}
            numero={evento.numero}
            mese={evento.mese}
            eOggi={evento.eOggi}
          />
          <div className="min-w-0 flex-1">
            <p data-testid="titolo-evento" className="text-sm font-medium text-stone-900 [overflow-wrap:anywhere]">
              {evento.titolo}
            </p>
            <EtichetteEvento evento={evento} className="mt-1.5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProssimiEventi({ oggi }: { oggi: string }) {
  return (
    <section aria-labelledby={TITOLO_ID} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={TITOLO_ID} className="text-lg font-medium">
          Prossimi eventi
        </h2>
        <Link
          href="/dashboard/calendario"
          className="text-sm font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
        >
          Vedi tutto
        </Link>
      </div>
      <Suspense fallback={<ScheletroProssimiEventi />}>
        <ElencoProssimiEventi oggi={oggi} />
      </Suspense>
    </section>
  );
}
