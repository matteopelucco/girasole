// Helper e2e per la pagina "Cron Job" (specs/63 - cron-job.md).
//
// STRUTTURA. Un blocco (`<section>`, ruolo "region") per ogni job, con titolo
// "Report notturno" o "Riepilogo allarmi"; dentro, un elenco di lanci (uno
// per `<li>`, con `<time dateTime>` dell'inizio e lo stato OK/KO/In corso) e,
// se ci sono lanci più vecchi, il link "Carica altri".
import type { Locator, Page } from '@playwright/test';

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
