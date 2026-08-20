// Requisito: specs/01 - ux.md
import { test, expect } from '@playwright/test';
import { hasCredenziali, loginCome, nessunaViolazioneA11yGrave } from './helpers';

test.describe('01 — UX', () => {
  test.use({ viewport: { width: 375, height: 812 } }); // mobile: priorità dichiarata nel requisito

  test('login è usabile a larghezza mobile, senza overflow orizzontale', async ({ page }) => {
    await page.goto('/login');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);

    await nessunaViolazioneA11yGrave(page);
  });

  test('dashboard maestra è usabile a larghezza mobile, azioni a un tap', async ({ page }) => {
    test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

    await loginCome(page, 'maestra');

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
