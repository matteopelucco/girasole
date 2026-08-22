// Requisito: specs/01 - ux.md
import { test, expect, type Page } from '@playwright/test';
import { dataOggiRoma, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

const MOBILE = { width: 375, height: 812 }; // priorità dichiarata nel requisito

async function nessunOverflowOrizzontale(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
}

test.describe('01 — UX/UI', () => {
  test.describe('login (mobile)', () => {
    test.use({ viewport: MOBILE });

    test('login è usabile a larghezza mobile, senza overflow orizzontale', async ({ page }) => {
      await page.goto('/login');

      expect(await nessunOverflowOrizzontale(page)).toBe(false);

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('dashboard maestra (mobile)', () => {
    test.use({ viewport: MOBILE, storageState: statoAutenticazione('maestra') });

    test('dashboard è usabile a larghezza mobile: calendario e azioni a un tap', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');

      expect(await nessunOverflowOrizzontale(page)).toBe(false);
      await expect(page.getByLabel('Data')).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('flusso Presenze (mobile)', () => {
    test.use({ viewport: MOBILE, storageState: statoAutenticazione('maestra') });

    test('elenco classi ed elenco bambini restano usabili a larghezza mobile', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto(`/dashboard/presenze?data=${dataOggiRoma()}`);
      expect(await nessunOverflowOrizzontale(page)).toBe(false);
      await nessunaViolazioneA11yGrave(page);

      const primaClasse = page.locator('a.bg-emerald-50').first();
      test.skip((await primaClasse.count()) === 0, 'nessuna classe attiva per questo account');
      await primaClasse.click();
      await page.waitForURL(/\/dashboard\/presenze\/.+/);

      expect(await nessunOverflowOrizzontale(page)).toBe(false);
      // Gli stati si impostano con un bottone diretto, non con menu a
      // tendina o form multi-step (vedi 01 - ux.md).
      const primoBottone = page.getByRole('button', { name: 'Presente' }).first();
      if (await primoBottone.count()) {
        await expect(primoBottone).toBeVisible();
      }

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('flusso Pasti (mobile)', () => {
    test.use({ viewport: MOBILE, storageState: statoAutenticazione('maestra') });

    test('elenco classi ed elenco bambini restano usabili a larghezza mobile', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto(`/dashboard/pasti?data=${dataOggiRoma()}`);
      expect(await nessunOverflowOrizzontale(page)).toBe(false);

      const primaClasse = page.locator('a.bg-emerald-50').first();
      test.skip((await primaClasse.count()) === 0, 'nessuna classe attiva per questo account');
      await primaClasse.click();
      await page.waitForURL(/\/dashboard\/pasti\/.+/);

      expect(await nessunOverflowOrizzontale(page)).toBe(false);
      await nessunaViolazioneA11yGrave(page);
    });
  });
});
