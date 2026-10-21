'use client';

import { useActionState } from 'react';
import { PulsanteInvio } from './PulsanteInvio';
import { Avviso } from '@/components/ui/avviso';
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
        <PulsanteInvio mantieniTesto variante="primario" misura="normale" className="bg-warning hover:bg-amber-800">
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
        <Avviso tono="errore" data-testid="esito-sincronizzazione" className="p-3">
          <p className="font-medium">ERRORE</p>
          <p className="mt-1 wrap-break-word">{esito.messaggio}</p>
        </Avviso>
      )}
    </section>
  );
}
