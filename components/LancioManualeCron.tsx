'use client';

import { useActionState, useState } from 'react';
import { PulsanteInvio } from './PulsanteInvio';
import { Avviso } from '@/components/ui/avviso';
import { Pulsante } from '@/components/ui/pulsante';
import { MESSAGGIO_CONFERMA_LANCIO, type EsitoLancioManuale, type NomeCron } from '@/lib/cronEsecuzioni';

// Pulsante "Lancia ora" di un job nella pagina Cron Job (specs/63, "Lancio a
// mano"; issue #302): chiede conferma (il lancio invia davvero le email),
// avvisa mentre il job lavora e poi mostra l'esito. Il browser manda solo il
// nome del job: controlli e lavoro sono sul server (app/admin/cron-job/actions.ts).
// L'avviso dell'esito è richiesto dall'issue: eccezione voluta ad ADR-0003.
export function LancioManualeCron({
  nome,
  titolo,
  azione,
}: {
  nome: NomeCron;
  titolo: string;
  azione: (stato: EsitoLancioManuale | null, formData: FormData) => Promise<EsitoLancioManuale>;
}) {
  const [confermaAperta, setConfermaAperta] = useState(false);
  const [esito, lancia, inCorso] = useActionState(async (stato: EsitoLancioManuale | null, formData: FormData) => {
    const nuovo = await azione(stato, formData);
    setConfermaAperta(false);
    return nuovo;
  }, null);

  return (
    <div className="space-y-2">
      {!confermaAperta && (
        <Pulsante variante="primario" misura="normale" onClick={() => setConfermaAperta(true)} className="bg-warning hover:bg-amber-800">
          Lancia ora
        </Pulsante>
      )}

      {confermaAperta && (
        <Avviso tono="attenzione" role="group" aria-label={`Conferma lancio: ${titolo}`} className="p-3">
          <p>{MESSAGGIO_CONFERMA_LANCIO}</p>
          <form action={lancia} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="nome" value={nome} />
            <PulsanteInvio testoAttesa="Lancio in corso…" variante="primario" misura="normale" className="bg-warning hover:bg-amber-800">
              Sì, lancia ora
            </PulsanteInvio>
            <Pulsante variante="secondario" misura="normale" disabled={inCorso} onClick={() => setConfermaAperta(false)}>
              Annulla
            </Pulsante>
          </form>
        </Avviso>
      )}

      {/* Sempre presente, così i lettori di schermo annunciano il cambio di testo. */}
      <div role="status" className="text-sm">
        {inCorso && (
          <p className="text-amber-900">Esecuzione in corso… Attendi l&apos;esito senza chiudere la pagina.</p>
        )}
        {!inCorso && esito?.stato === 'OK' && (
          <p data-testid="esito-lancio" className="font-medium text-emerald-800">
            Lancio a mano completato: OK
          </p>
        )}
      </div>

      {!inCorso && esito?.stato === 'KO' && (
        <Avviso tono="errore" data-testid="esito-lancio" className="p-3">
          <p className="font-medium">Lancio a mano completato: KO</p>
          <p className="mt-1 wrap-break-word">{esito.messaggio}</p>
        </Avviso>
      )}

      {!inCorso && esito?.stato === 'rifiutato' && (
        <Avviso tono="errore" data-testid="esito-lancio" className="p-3">
          {esito.messaggio}
        </Avviso>
      )}
    </div>
  );
}
