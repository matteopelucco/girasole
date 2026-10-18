// Helper e2e per la pagina "Azioni" (specs/63 - cron-job.md), che ha due schede:
// "Cron Job" (iniziale) e "Azioni" (per ora vuota).
//
// SCHEDE. `tablist` con due `tab` (link) e un solo `tabpanel`; la scheda attiva
// sta nell'indirizzo (`?scheda=azioni`).
//
// STRUTTURA della scheda "Cron Job". Un blocco (`<section>`, ruolo "region") per ogni job, con titolo
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
export const PERCORSO_SCHEDA_AZIONI = `${PERCORSO_CRON_JOB}?scheda=azioni`;
export const MESSAGGIO_AZIONI_VUOTE = 'Qui compariranno le azioni lanciabili a mano. Per ora non ce ne sono.';

export function schede(page: Page): Locator {
  return page.getByRole('tablist');
}

export function scheda(page: Page, nome: 'Cron Job' | 'Azioni'): Locator {
  return schede(page).getByRole('tab', { name: nome, exact: true });
}

export function pannelloScheda(page: Page): Locator {
  return page.getByRole('tabpanel');
}

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
