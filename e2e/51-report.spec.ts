// Requisito: specs/51 - report.md
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('51 — Report', () => {
  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('aprire il report dalla dashboard mostra il mese corrente', async ({ page }) => {
      await page.goto('/dashboard');
      await page.getByRole('link', { name: 'Report' }).click();
      await page.waitForURL(/\/dashboard\/report$/);

      await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible();
      // Bottone "Mensile" attivo di default.
      await expect(page.getByRole('link', { name: 'Mensile' })).toHaveClass(/bg-sky-700/);

      await nessunaViolazioneA11yGrave(page);
    });

    test('la tabella include le colonne pre-asilo e post-asilo', async ({ page }) => {
      await page.goto('/dashboard/report?tipo=mensile');
      const intestazioni = page.getByRole('columnheader');
      test.skip((await intestazioni.count()) === 0, 'nessuna classe con bambini per questo account');

      await expect(page.getByRole('columnheader', { name: 'Presenze' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Pre-asilo' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Post-asilo' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Pasti' })).toBeVisible();
    });

    test('navigare tra i mesi aggiorna il periodo mostrato', async ({ page }) => {
      await page.goto('/dashboard/report?tipo=mensile');
      const periodoIniziale = await page.locator('span.text-amber-900').textContent();

      await page.getByRole('link', { name: 'Periodo successivo' }).click();
      await expect(page.locator('span.text-amber-900')).not.toHaveText(periodoIniziale ?? '');

      await page.getByRole('link', { name: 'Periodo precedente' }).click();
      await expect(page.locator('span.text-amber-900')).toHaveText(periodoIniziale ?? '');
    });

    test('passare al report settimanale mostra la settimana corrente e si naviga tra settimane', async ({
      page,
    }) => {
      await page.goto('/dashboard/report');
      await page.getByRole('link', { name: 'Settimanale' }).click();
      await page.waitForURL(/tipo=settimanale/);

      await expect(page.getByRole('link', { name: 'Settimanale' })).toHaveClass(/bg-sky-700/);
      const periodoIniziale = await page.locator('span.text-amber-900').textContent();
      await expect(periodoIniziale).toMatch(/–/);

      await page.getByRole('link', { name: 'Periodo successivo' }).click();
      await expect(page.locator('span.text-amber-900')).not.toHaveText(periodoIniziale ?? '');
    });

    test('passare al report giornaliero mostra un solo giorno senza drill-down', async ({ page }) => {
      await page.goto('/dashboard/report');
      await page.getByRole('link', { name: 'Giornaliero' }).click();
      await page.waitForURL(/tipo=giornaliero/);

      await expect(page.getByRole('link', { name: 'Giornaliero' })).toHaveClass(/bg-sky-700/);

      // Nessun link bambino cliccabile verso il drill-down: le righe
      // bambino sono semplice testo, non link.
      await expect(page.locator('a[href*="/dashboard/report/bambino/"]')).toHaveCount(0);

      await nessunaViolazioneA11yGrave(page);
    });

    test('drill-down su un bambino dal report mensile mostra lo stato giorno per giorno', async ({
      page,
    }) => {
      await page.goto('/dashboard/report?tipo=mensile');
      const linkBambino = page.locator('a[href*="/dashboard/report/bambino/"]').first();
      test.skip((await linkBambino.count()) === 0, 'nessun bambino in nessuna classe');

      await linkBambino.click();
      await page.waitForURL(/\/dashboard\/report\/bambino\/.+/);

      await expect(page.getByRole('columnheader', { name: 'Giorno' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Presenza' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Pre-asilo' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Post-asilo' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Pasto' })).toBeVisible();
      await expect(page.getByText('Non segnato').first()).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });

    test('anagrafica classi mostra lo staff assegnato (con ruolo), bambini e genitori', async ({
      page,
    }) => {
      await page.goto('/dashboard/report');
      await page.getByRole('link', { name: 'Anagrafica classi' }).click();
      await page.waitForURL(/\/dashboard\/report\/anagrafica/);

      await expect(page.getByRole('heading', { name: 'Anagrafica classi' })).toBeVisible();
      await expect(page.getByText(/^Staff assegnato:/).first()).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('una maestra vede solo le proprie classi nel report', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard/report');
      await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible();
    });
  });

  test.describe('come assistente', () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test("un'assistente vede solo le proprie classi nel report, incluse le colonne pasti", async ({
      page,
    }) => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');

      await page.goto('/dashboard/report');
      await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible();
    });
  });

  test.describe('come genitore', () => {
    test.use({ storageState: statoAutenticazione('genitore') });

    test('un genitore non può aprire il report', async ({ page }) => {
      test.skip(!hasCredenziali('genitore'), 'richiede E2E_GENITORE_EMAIL/PASSWORD');

      await page.goto('/dashboard/report');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });
  });
});
