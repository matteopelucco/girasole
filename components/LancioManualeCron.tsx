'use client';

import { useActionState, useState } from 'react';
import { PulsanteInvio } from './PulsanteInvio';
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
        <button
          type="button"
          onClick={() => setConfermaAperta(true)}
          className="inline-flex min-h-11 items-center rounded-full bg-amber-700 px-4 text-sm font-medium text-white hover:bg-amber-800"
        >
          Lancia ora
        </button>
      )}

      {confermaAperta && (
        <div
          role="group"
          aria-label={`Conferma lancio: ${titolo}`}
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          <p className="text-amber-900">{MESSAGGIO_CONFERMA_LANCIO}</p>
          <form action={lancia} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="nome" value={nome} />
            <PulsanteInvio
              testoAttesa="Lancio in corso…"
              className="inline-flex min-h-11 items-center rounded-full bg-amber-700 px-4 text-sm font-medium text-white hover:bg-amber-800"
            >
              Sì, lancia ora
            </PulsanteInvio>
            <button
              type="button"
              disabled={inCorso}
              onClick={() => setConfermaAperta(false)}
              className="inline-flex min-h-11 items-center rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Annulla
            </button>
          </form>
        </div>
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
        <div
          role="alert"
          data-testid="esito-lancio"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          <p className="font-medium">Lancio a mano completato: KO</p>
          <p className="mt-1 break-words">{esito.messaggio}</p>
        </div>
      )}

      {!inCorso && esito?.stato === 'rifiutato' && (
        <p
          role="alert"
          data-testid="esito-lancio"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {esito.messaggio}
        </p>
      )}
    </div>
  );
}
