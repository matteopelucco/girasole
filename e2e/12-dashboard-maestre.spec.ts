// Requisito: specs/12 - dashboard-maestre.md
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('12 — Dashboard maestra/admin', () => {
  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('aprire la dashboard mostra il calendario e le due attività', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(page.getByLabel('Data')).toBeVisible();

      const linkPresenze = page.getByRole('link', { name: 'Presenze' });
      const linkPasti = page.getByRole('link', { name: 'Pasti' });
      // Una maestra di test senza sezioni assegnate non vede i pulsanti:
      // in quel caso questo scenario non si applica (coperto a parte).
      test.skip((await linkPresenze.count()) === 0, 'nessuna sezione assegnata a questo account');

      await expect(linkPresenze).toBeVisible();
      await expect(linkPasti).toBeVisible();
      await expect(linkPresenze).toContainText('☑️');
      await expect(linkPasti).toContainText('🍝');
      await expect(page.getByRole('link', { name: 'Report' })).toContainText('📊');

      await nessunaViolazioneA11yGrave(page);
    });

    test('da Presenze si arriva alle classi e poi ai bambini', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      const linkPresenze = page.getByRole('link', { name: 'Presenze' });
      test.skip((await linkPresenze.count()) === 0, 'nessuna sezione assegnata a questo account');
      await linkPresenze.click();
      await page.waitForURL(/\/dashboard\/presenze\?/);
      await expect(page.getByRole('heading', { name: 'Presenze' })).toBeVisible();

      const primaClasse = page.locator('a.bg-emerald-50').first();
      test.skip((await primaClasse.count()) === 0, 'nessuna classe attiva per questo account');
      await primaClasse.click();
      await page.waitForURL(/\/dashboard\/presenze\/.+/);
      await expect(page.getByRole('heading', { name: /^Presenze —/ })).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });

    test('riepilogo aggregato di tutte le classi nell\'elenco classi di Presenze', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard/presenze');
      const riepilogo = page.getByText(/^Presenti: \d+\/\d+$/);
      test.skip((await riepilogo.count()) === 0, 'nessun bambino in nessuna classe di questo account');

      await expect(page.getByRole('heading', { name: 'Presenze giornaliere', exact: true })).toBeVisible();
      await expect(riepilogo).toBeVisible();
      await expect(page.getByText(/^Pre-asilo: \d+$/)).toBeVisible();
      await expect(page.getByText(/^Post-asilo: \d+$/)).toBeVisible();

      // Compare prima dell'elenco classi, non dopo (specs/12).
      const elenco = page.locator('a.bg-emerald-50').first();
      if ((await elenco.count()) > 0) {
        const yPosRiepilogo = await riepilogo.first().evaluate((el) => el.getBoundingClientRect().top);
        const yPosElenco = await elenco.evaluate((el) => el.getBoundingClientRect().top);
        expect(yPosRiepilogo).toBeLessThan(yPosElenco);
      }
    });

    test('riepilogo aggregato di tutte le classi nell\'elenco classi di Pasti', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard/pasti');
      const riepilogo = page.getByText(/^Pasti: \d+\/\d+$/);
      test.skip((await riepilogo.count()) === 0, 'nessun bambino in nessuna classe di questo account');

      await expect(page.getByRole('heading', { name: 'Pasti giornalieri', exact: true })).toBeVisible();
      await expect(riepilogo).toBeVisible();
    });

    test('da Pasti si arriva alle classi e poi ai bambini', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      const linkPasti = page.getByRole('link', { name: 'Pasti' });
      test.skip((await linkPasti.count()) === 0, 'nessuna sezione assegnata a questo account');
      await linkPasti.click();
      await page.waitForURL(/\/dashboard\/pasti\?/);
      await expect(page.getByRole('heading', { name: 'Pasti' })).toBeVisible();

      const primaClasse = page.locator('a.bg-emerald-50').first();
      test.skip((await primaClasse.count()) === 0, 'nessuna classe attiva per questo account');
      await primaClasse.click();
      await page.waitForURL(/\/dashboard\/pasti\/.+/);
      await expect(page.getByRole('heading', { name: /^Pasti —/ })).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe("come assistente", () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test('la dashboard mostra Presenze ma non Pasti', async ({ page }) => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      const linkPresenze = page.getByRole('link', { name: 'Presenze' });
      test.skip((await linkPresenze.count()) === 0, 'nessuna sezione assegnata a questo account');

      await expect(linkPresenze).toBeVisible();
      await expect(page.getByRole('link', { name: 'Pasti' })).toHaveCount(0);

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test('maestra senza sezioni assegnate vede il messaggio corretto, non un errore', async ({
    page,
  }) => {
    // Account distinto da E2E_MAESTRA_*, usato solo qui: niente sessione
    // precalcolata, un login in più non pesa sul rate limiting.
    test.skip(
      !process.env.E2E_MAESTRA_SENZA_SEZIONE_EMAIL || !process.env.E2E_MAESTRA_SENZA_SEZIONE_PASSWORD,
      'richiede un secondo account maestra di test SENZA sezioni assegnate (E2E_MAESTRA_SENZA_SEZIONE_*)'
    );

    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_MAESTRA_SENZA_SEZIONE_EMAIL!);
    await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_MAESTRA_SENZA_SEZIONE_PASSWORD!);
    await page.getByRole('button', { name: 'Accedi' }).click();
    await page.waitForURL('/dashboard', { timeout: 20_000 });

    await expect(page.getByText('Non hai ancora nessuna sezione assegnata')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Presenze' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Pasti' })).toHaveCount(0);
  });

  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test("l'admin apre la dashboard: calendario, Presenze/Pasti e rimando alle pagine di amministrazione", async ({
      page,
    }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Sezioni e bambini' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Utenti' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Presenze' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Pasti' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Avvisi' })).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('come genitore', () => {
    test.use({ storageState: statoAutenticazione('genitore') });

    test('un genitore apre la dashboard: solo il placeholder, nessun dato di bambini', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('genitore'), 'richiede E2E_GENITORE_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(
        page.getByText('Il portale genitori è in arrivo in una fase successiva.')
      ).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });
});
