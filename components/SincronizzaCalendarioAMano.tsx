'use client';

import { useActionState } from 'react';
import { PulsanteInvio } from './PulsanteInvio';
import { MESSAGGIO_IN_CORSO, type EsitoSincronizzazioneManuale } from '@/lib/sincronizzazioneManuale';

// Azione "Sincronizza calendario" della scheda "Azioni" (specs/64, "Sincronizzazione
// a mano"; issue #326): un pulsante che lancia la sincronizzazione del Google
// Calendar, avvisa mentre lavora ("Esecuzione in corso…", pulsante disabilitato)
// e poi mostra l'esito "OK" o "ERRORE" con la frase scelta dal server. Il
// browser non manda nulla: controlli e lavoro sono sul server
// (app/admin/cron-job/actions.ts). L'avviso dell'esito è richiesto dalla issue:
// eccezione voluta ad ADR-0003.
export function SincronizzaCalendarioAMano({
  azione,
}: {
  azione: (stato: EsitoSincronizzazioneManuale | null) => Promise<EsitoSincronizzazioneManuale>;
}) {
  const [esito, lancia, inCorso] = useActionState(azione, null);

  return (
    <section aria-labelledby="azione-sincronizza-calendario" className="space-y-3">
      <div>
        <h2 id="azione-sincronizza-calendario" className="text-base font-medium text-stone-900">
          Sincronizza calendario
        </h2>
        <p className="mt-0.5 text-sm text-stone-600">
          Aggiorna subito gli eventi dal Google Calendar dell&apos;asilo, senza aspettare la notte. Non invia email e non
          tocca il report notturno.
        </p>
      </div>

      <form action={lancia}>
        <PulsanteInvio
          mantieniTesto
          className="inline-flex min-h-11 items-center rounded-full bg-amber-700 px-4 text-sm font-medium text-white hover:bg-amber-800"
        >
          Sincronizza calendario ora
        </PulsanteInvio>
      </form>

      {/* Sempre presente, così i lettori di schermo annunciano il cambio di testo. */}
      <div role="status" className="text-sm">
        {inCorso && <p className="text-amber-900">{MESSAGGIO_IN_CORSO}</p>}
        {!inCorso && esito?.stato === 'OK' && (
          <div data-testid="esito-sincronizzazione" className="text-emerald-800">
            <p className="font-medium">OK</p>
            <p className="wrap-break-word">{esito.messaggio}</p>
          </div>
        )}
      </div>

      {!inCorso && esito?.stato === 'ERRORE' && (
        <div
          role="alert"
          data-testid="esito-sincronizzazione"
          className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-text"
        >
          <p className="font-medium">ERRORE</p>
          <p className="mt-1 wrap-break-word">{esito.messaggio}</p>
        </div>
      )}
    </section>
  );
}
