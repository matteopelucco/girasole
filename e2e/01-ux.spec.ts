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

  test.describe('barra di caricamento durante la navigazione', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('compare al click su un link e scompare quando la nuova pagina è pronta', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      const barra = page.getByRole('status', { name: 'Caricamento in corso' });
      await expect(barra).toHaveCount(0);

      // Rallenta le richieste di navigazione (non gli asset già in
      // cache) quanto basta perché il test possa osservare in modo
      // affidabile la barra, invece di dipendere dalla velocità reale
      // della rete (che la farebbe comparire e sparire troppo in
      // fretta per un assert deterministico).
      await page.route('**/dashboard/presenze*', async (route) => {
        await new Promise((r) => setTimeout(r, 400));
        await route.continue();
      });

      const linkPresenze = page.getByRole('link', { name: 'Presenze' });
      test.skip((await linkPresenze.count()) === 0, 'nessuna sezione assegnata a questo account');

      await linkPresenze.click();
      await expect(barra).toBeVisible();

      await page.waitForURL(/\/dashboard\/presenze\?/);
      await expect(barra).toHaveCount(0);
    });
  });

  test.describe('sidebar di navigazione (mobile: drawer)', () => {
    test.use({ viewport: MOBILE, storageState: statoAutenticazione('maestra') });

    test('la sidebar è chiusa di default e si apre/chiude con il pulsante hamburger', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');

      const sidebar = page.getByRole('link', { name: 'Dashboard' });
      const hamburger = page.getByRole('button', { name: 'Apri il menu' });
      await expect(hamburger).toBeVisible();
      await expect(sidebar).not.toBeInViewport();
      expect(await nessunOverflowOrizzontale(page)).toBe(false);

      await hamburger.click();
      await expect(sidebar).toBeInViewport();
      await nessunaViolazioneA11yGrave(page);

      await page.getByRole('button', { name: 'Chiudi il menu' }).click();
      await expect(sidebar).not.toBeInViewport();
    });
  });

  test.describe('sidebar di navigazione (desktop)', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('è sempre visibile e mostra le voci di amministrazione, con quella corrente evidenziata', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      await page.goto('/admin');

      // Da schermo lg in su niente hamburger: la sidebar è sempre in vista.
      await expect(page.getByRole('button', { name: 'Apri il menu' })).toBeHidden();
      for (const voce of ['Dashboard', 'Sezioni e bambini', 'Utenti', 'Calendario scolastico', 'Profili orari']) {
        await expect(page.getByRole('link', { name: voce })).toBeVisible();
      }

      await expect(page.getByRole('link', { name: 'Sezioni e bambini' })).toHaveAttribute(
        'aria-current',
        'page'
      );

      expect(await nessunOverflowOrizzontale(page)).toBe(false);
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
