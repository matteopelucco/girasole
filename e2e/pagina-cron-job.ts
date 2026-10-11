// Helper e2e per la pagina "Cron Job" (specs/63 - cron-job.md).
//
// STRUTTURA. Un blocco (`<section>`, ruolo "region") per ogni job, con titolo
// "Report notturno" o "Riepilogo allarmi"; dentro, un elenco di lanci (uno
// per `<li>`, con `<time dateTime>` dell'inizio e lo stato OK/KO/In corso) e,
// se ci sono lanci più vecchi, il link "Carica altri". I lanci a mano hanno il
// tag "estemporaneo" (`data-testid="tag-estemporaneo"`).
//
// LANCIO A MANO (issue #302). In ogni blocco il pulsante "Lancia ora" apre una
// richiesta di conferma (gruppo "Conferma lancio: <titolo>") con "Sì, lancia
// ora" e "Annulla"; durante il lancio compare l'avviso (ruolo "status")
// "Esecuzione in corso…", alla fine l'esito (`data-testid="esito-lancio"`).
import type { Locator, Page, Request } from '@playwright/test';

export const PERCORSO_CRON_JOB = '/admin/cron-job';

export function bloccoCron(page: Page, titolo: 'Report notturno' | 'Riepilogo allarmi'): Locator {
  return page.getByRole('region', { name: titolo });
}

export function lanciCron(blocco: Locator): Locator {
  return blocco.getByRole('listitem');
}

export function caricaAltri(blocco: Locator): Locator {
  return blocco.getByRole('link', { name: 'Carica altri' });
}

// Istanti di inizio (ISO) dei lanci di un blocco, nell'ordine mostrato.
export async function iniziLanci(blocco: Locator): Promise<string[]> {
  return lanciCron(blocco)
    .locator('time')
    .evaluateAll((elementi) => elementi.map((e) => e.getAttribute('datetime') ?? ''));
}

export function pulsanteLanciaOra(blocco: Locator): Locator {
  return blocco.getByRole('button', { name: 'Lancia ora', exact: true });
}

export function confermaLancio(blocco: Locator): Locator {
  return blocco.getByRole('group', { name: /^Conferma lancio:/ });
}

export function avvisoInCorso(blocco: Locator): Locator {
  return blocco.getByRole('status').filter({ hasText: 'Esecuzione in corso…' });
}

export function esitoLancio(blocco: Locator): Locator {
  return blocco.getByTestId('esito-lancio');
}

export function tagEstemporaneo(lancio: Locator): Locator {
  return lancio.getByTestId('tag-estemporaneo');
}

// Vero per le richieste POST di una Server Action (header `next-action`).
export function eRichiestaAzione(richiesta: Request): boolean {
  return richiesta.method() === 'POST' && richiesta.headers()['next-action'] !== undefined;
}
