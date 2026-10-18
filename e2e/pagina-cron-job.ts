// Helper e2e per la pagina "Azioni" (specs/63 - cron-job.md), che ha due schede:
// "Cron Job" (iniziale) e "Azioni" (l'azione "Sincronizza calendario").
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
//
// SINCRONIZZAZIONE A MANO (issue #326, specs/64). Nella scheda "Azioni" una
// regione "Sincronizza calendario" con il pulsante "Sincronizza calendario ora";
// durante il lavoro l'avviso (ruolo "status") "Esecuzione in corso…" e il
// pulsante disabilitato; alla fine l'esito (`data-testid="esito-sincronizzazione"`)
// con "OK" oppure "ERRORE" e la frase del server.
import { expect, type Locator, type Page, type Request } from '@playwright/test';

export const PERCORSO_CRON_JOB = '/admin/cron-job';
export const PERCORSO_SCHEDA_AZIONI = `${PERCORSO_CRON_JOB}?scheda=azioni`;
export const MESSAGGIO_AZIONI_VUOTE = 'Qui compariranno le azioni lanciabili a mano. Per ora non ce ne sono.';
export const NOME_PULSANTE_SINCRONIZZA = 'Sincronizza calendario ora';

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

export function azioneSincronizza(page: Page): Locator {
  return page.getByRole('region', { name: 'Sincronizza calendario', exact: true });
}

export function pulsanteSincronizza(page: Page): Locator {
  return page.getByRole('button', { name: NOME_PULSANTE_SINCRONIZZA, exact: true });
}

export function avvisoSincronizzazioneInCorso(page: Page): Locator {
  return azioneSincronizza(page).getByRole('status').filter({ hasText: 'Esecuzione in corso…' });
}

export function esitoSincronizzazione(page: Page): Locator {
  return azioneSincronizza(page).getByTestId('esito-sincronizzazione');
}

// Trattiene le Server Action della pagina finché non si chiama `rilascia`, così
// il test vede lo stato "in corso" senza attese a tempo (il lavoro può durare un
// attimo). Va chiamata prima di premere il pulsante.
export async function trattieniAzioni(page: Page): Promise<{ rilascia: () => void }> {
  let rilascia: () => void = () => {};
  const trattenuta = new Promise<void>((risolvi) => (rilascia = risolvi));
  await page.route(
    (url) => url.pathname === PERCORSO_CRON_JOB,
    async (route) => {
      if (eRichiestaAzione(route.request())) await trattenuta;
      await route.fallback();
    }
  );
  return { rilascia: () => rilascia() };
}

// Preme "Sincronizza calendario ora" e verifica lo stato "in corso" (avviso
// annunciato, pulsante disabilitato) prima di lasciar rispondere il server;
// ritorna a risposta arrivata.
export async function sincronizzaAMano(page: Page): Promise<void> {
  const { rilascia } = await trattieniAzioni(page);
  const risposta = page.waitForResponse((r) => eRichiestaAzione(r.request()));
  await pulsanteSincronizza(page).click();
  await expect(avvisoSincronizzazioneInCorso(page)).toBeVisible();
  await expect(pulsanteSincronizza(page)).toBeDisabled();
  rilascia();
  await risposta;
  await expect(avvisoSincronizzazioneInCorso(page)).toHaveCount(0);
  await expect(pulsanteSincronizza(page)).toBeEnabled();
}
