// Requisito: specs/01 - ux.md
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

const MOBILE = { width: 375, height: 812 }; // priorità dichiarata nel requisito

test.describe('01 — UX', () => {
  test.describe('login (mobile)', () => {
    test.use({ viewport: MOBILE });

    test('login è usabile a larghezza mobile, senza overflow orizzontale', async ({ page }) => {
      await page.goto('/login');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('dashboard maestra (mobile)', () => {
    test.use({ viewport: MOBILE, storageState: statoAutenticazione('maestra') });

    test('dashboard maestra è usabile a larghezza mobile, azioni a un tap', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);

      // Gli stati presenza/pasto si impostano con un bottone diretto, non
      // con menu a tendina o form multi-step (vedi 01 - ux.md).
      const primoBottonePresenza = page.getByRole('button', { name: 'Presente' }).first();
      if (await primoBottonePresenza.count()) {
        await expect(primoBottonePresenza).toBeVisible();
      }

      await nessunaViolazioneA11yGrave(page);
    });
  });
});
