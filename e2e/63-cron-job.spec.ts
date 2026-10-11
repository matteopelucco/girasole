// Requisito: specs/63 - cron-job.md
//
// Dati: i lanci di prova vengono da `supabase/seed.sql` (25 lanci del report
// notturno nel gennaio 2019, 3 del riepilogo allarmi nel febbraio 2019, tra
// cui un KO con messaggio e uno senza esito), ricaricati dal reset del DB di
// test a ogni CI. I test non scrivono nulla, tranne l'ultimo che chiama
// davvero il cron degli allarmi (solo con CRON_SECRET e RESEND_API_KEY, come
// e2e/07 ed e2e/52): un lancio reale, più recente, compare in cima al suo
// blocco, quindi i controlli sotto non contano le righe "esatte" ma i limiti.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';
import { PERCORSO_CRON_JOB, bloccoCron, caricaAltri, iniziLanci, lanciCron } from './pagina-cron-job';

test.describe('63 — Cron Job', () => {
  test.describe('admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('"Cron Job" è nel menu sotto "Impostazioni", rientrata, dopo "Parametri di funzionamento" e prima di "Utenti"', async ({
      page,
    }) => {
      await page.goto('/admin');
      const menu = page.getByRole('navigation');
      const impostazioni = menu.getByRole('link', { name: 'Impostazioni', exact: true });
      const parametri = menu.getByRole('link', { name: 'Parametri di funzionamento', exact: true });
      const cron = menu.getByRole('link', { name: 'Cron Job', exact: true });
      const utenti = menu.getByRole('link', { name: 'Utenti', exact: true });

      await expect(cron).toHaveAttribute('href', PERCORSO_CRON_JOB);
      const y = async (l: typeof cron) => (await l.boundingBox())!.y;
      const x = async (l: typeof cron) => (await l.locator('span').first().boundingBox())!.x;
      expect(await y(impostazioni)).toBeLessThan(await y(parametri));
      expect(await y(parametri)).toBeLessThan(await y(cron));
      expect(await y(cron)).toBeLessThan(await y(utenti));
      expect(await x(cron)).toBeGreaterThan(await x(impostazioni));
    });

    test('i lanci sono raggruppati per job, con nome, data e ora, stato', async ({ page }) => {
      await page.goto('/admin');
      await page.getByRole('navigation').getByRole('link', { name: 'Cron Job', exact: true }).click();
      await page.waitForURL(PERCORSO_CRON_JOB);

      await expect(page.getByRole('heading', { name: 'Cron Job', level: 1 })).toBeVisible();
      await expect(page.getByRole('navigation').getByRole('link', { name: 'Cron Job', exact: true })).toHaveAttribute(
        'aria-current',
        'page'
      );

      for (const titolo of ['Report notturno', 'Riepilogo allarmi'] as const) {
        const blocco = bloccoCron(page, titolo);
        await expect(blocco.getByRole('heading', { name: titolo, level: 2 })).toBeVisible();
        const lanci = lanciCron(blocco);
        await expect(lanci.first()).toBeVisible();
        // Ogni lancio: nome del job, data e ora, stato.
        for (const lancio of await lanci.all()) {
          await expect(lancio).toContainText(titolo);
          await expect(lancio).toContainText(/\d{2}\/\d{2}\/\d{4} alle \d{2}:\d{2}/);
          await expect(lancio.getByTestId('stato-lancio')).toHaveText(/^(OK|KO|In corso)$/);
        }
        // Dal più recente al più vecchio.
        const inizi = await iniziLanci(blocco);
        expect(inizi).toEqual([...inizi].sort().reverse());
      }

      await nessunaViolazioneA11yGrave(page);
    });

    test('ultimi 20 lanci e "Carica altri"', async ({ page }) => {
      await page.goto(PERCORSO_CRON_JOB);
      const report = bloccoCron(page, 'Report notturno');
      const allarmi = bloccoCron(page, 'Riepilogo allarmi');

      // Il seed ha 25 lanci del report notturno: se ne vedono 20.
      await expect(lanciCron(report)).toHaveCount(20);
      await expect(caricaAltri(report)).toBeVisible();
      const lanciAllarmiPrima = await iniziLanci(allarmi);

      await caricaAltri(report).click();
      await page.waitForURL(/report-presenze=40/);

      await expect.poll(() => lanciCron(report).count()).toBeGreaterThan(20);
      const quanti = await lanciCron(report).count();
      expect(quanti).toBeLessThanOrEqual(40);
      // Meno di 40 vuol dire che non ce ne sono altri: niente più pulsante.
      if (quanti < 40) await expect(caricaAltri(report)).toHaveCount(0);
      // L'altro blocco resta com'era.
      expect(await iniziLanci(allarmi)).toEqual(lanciAllarmiPrima);
    });

    test('un lancio KO mostra il messaggio di errore, se ricavabile', async ({ page }) => {
      await page.goto(PERCORSO_CRON_JOB);
      const allarmi = bloccoCron(page, 'Riepilogo allarmi');

      const fallito = lanciCron(allarmi).filter({ hasText: 'Invio email fallito (500)' });
      await expect(fallito).toHaveCount(1);
      await expect(fallito.getByTestId('stato-lancio')).toHaveText('KO');
      await expect(fallito).not.toContainText('@');

      const interrotto = lanciCron(allarmi).filter({ hasText: 'Esecuzione interrotta: nessun esito registrato.' });
      await expect(interrotto).toHaveCount(1);
      await expect(interrotto.getByTestId('stato-lancio')).toHaveText('KO');
    });

    test('ogni lancio di un job viene registrato senza toccare il lavoro del job', async ({ page, request }) => {
      test.skip(
        !process.env.CRON_SECRET || !process.env.RESEND_API_KEY,
        'richiede CRON_SECRET e RESEND_API_KEY configurate per invocare davvero la route del cron'
      );

      // Senza il secret corretto la route rifiuta la chiamata prima di registrarla.
      const rifiutata = await request.get('/api/cron/allarmi', {
        headers: { Authorization: 'Bearer secret-sbagliato' },
      });
      expect(rifiutata.status()).toBe(401);

      const prima = new Date(Date.now() - 1000).toISOString();
      const risposta = await request.get('/api/cron/allarmi', {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      expect(risposta.ok()).toBe(true);

      await page.goto(PERCORSO_CRON_JOB);
      const allarmi = bloccoCron(page, 'Riepilogo allarmi');
      const [ultimo] = await iniziLanci(allarmi);
      expect(new Date(ultimo).getTime()).toBeGreaterThanOrEqual(new Date(prima).getTime());
      await expect(lanciCron(allarmi).first().getByTestId('stato-lancio')).toHaveText(/^(OK|KO)$/);
    });
  });

  test('maestra, assistente e genitore non vedono la voce e vengono reindirizzati', async ({ browser }) => {
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);

      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Cron Job' })).toHaveCount(0);

      await page.goto(PERCORSO_CRON_JOB);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await context.close();
    }
  });
});
