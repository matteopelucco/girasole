// Requisito: specs/12 - dashboard-maestre.md
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('12 — Dashboard maestra/admin', () => {
  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('aprire la dashboard mostra le attività del giorno, senza selettore di data', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(page.getByLabel('Data')).toHaveCount(0);

      const linkPresenze = page.getByRole('link', { name: 'Presenze', exact: true });
      const linkPasti = page.getByRole('link', { name: 'Pasti', exact: true });
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

    test('da Presenze si arriva direttamente ai bambini, raggruppati per classe', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      const linkPresenze = page.getByRole('link', { name: 'Presenze', exact: true });
      test.skip((await linkPresenze.count()) === 0, 'nessuna sezione assegnata a questo account');
      await linkPresenze.click();
      await page.waitForURL(/\/dashboard\/presenze\?/);
      await expect(page.getByRole('heading', { name: 'Presenze', exact: true })).toBeVisible();

      // Niente più un elenco di classi da selezionare: i bambini (se ce
      // ne sono) sono già nella stessa pagina, raggruppati per sezione.
      const primaRiga = page.locator('li').first();
      if ((await primaRiga.count()) > 0) {
        await expect(page.getByRole('heading', { name: /^Presenze giornaliere - Sezione /i }).first()).toBeVisible();
      }

      await nessunaViolazioneA11yGrave(page);
    });

    test('riepilogo aggregato di tutte le classi compare prima dei gruppi per sezione, in Presenze', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard/presenze');
      const riepilogo = page.getByText(/^Presenti: \d+\/\d+$/).first();
      test.skip((await riepilogo.count()) === 0, 'nessun bambino in nessuna classe di questo account');

      // Il riepilogo aggregato (senza suffisso "- Sezione") ha lo stesso
      // titolo "Presenze giornaliere" di quello per sezione (che invece
      // lo ha) — distinguo con `exact`.
      await expect(page.getByRole('heading', { name: 'Presenze giornaliere', exact: true })).toBeVisible();
      await expect(riepilogo).toBeVisible();
      await expect(page.getByText(/^Pre-asilo: \d+$/).first()).toBeVisible();
      await expect(page.getByText(/^Post-asilo: \d+$/).first()).toBeVisible();

      // Compare prima dell'elenco bambini raggruppato, non dopo (specs/12).
      const primaRiga = page.locator('li').first();
      if ((await primaRiga.count()) > 0) {
        const yPosRiepilogo = await riepilogo.evaluate((el) => el.getBoundingClientRect().top);
        const yPosElenco = await primaRiga.evaluate((el) => el.getBoundingClientRect().top);
        expect(yPosRiepilogo).toBeLessThan(yPosElenco);
      }
    });

    test('riepilogo aggregato di tutte le classi compare prima dei gruppi per sezione, in Pasti', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard/pasti');
      const riepilogo = page.getByText(/^Pasti: \d+\/\d+$/).first();
      test.skip((await riepilogo.count()) === 0, 'nessun bambino in nessuna classe di questo account');

      await expect(page.getByRole('heading', { name: 'Pasti giornalieri', exact: true })).toBeVisible();
      await expect(riepilogo).toBeVisible();
    });

    test('da Pasti si arriva direttamente ai bambini, raggruppati per classe', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      const linkPasti = page.getByRole('link', { name: 'Pasti', exact: true });
      test.skip((await linkPasti.count()) === 0, 'nessuna sezione assegnata a questo account');
      await linkPasti.click();
      await page.waitForURL(/\/dashboard\/pasti\?/);
      await expect(page.getByRole('heading', { name: 'Pasti', exact: true })).toBeVisible();

      const primaRiga = page.locator('li').first();
      if ((await primaRiga.count()) > 0) {
        await expect(page.getByRole('heading', { name: /^Pasti giornalieri - Sezione /i }).first()).toBeVisible();
      }

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe("come assistente", () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test('la dashboard mostra Presenze ma non Pasti', async ({ page }) => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      const linkPresenze = page.getByRole('link', { name: 'Presenze', exact: true });
      test.skip((await linkPresenze.count()) === 0, 'nessuna sezione assegnata a questo account');

      await expect(linkPresenze).toBeVisible();
      await expect(page.getByRole('link', { name: 'Pasti', exact: true })).toHaveCount(0);

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
    await expect(page.getByRole('link', { name: 'Presenze', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Pasti', exact: true })).toHaveCount(0);
  });

  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test("l'admin apre la dashboard: Presenze/Pasti, niente calendario né rimando testuale all'amministrazione", async ({
      page,
    }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(page.getByLabel('Data')).toHaveCount(0);
      await expect(page.getByText('Per creare sezioni e bambini')).toHaveCount(0);
      // Le pagine di amministrazione restano raggiungibili dal menu laterale.
      await expect(page.getByRole('link', { name: 'Sezioni e bambini' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Utenti' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Presenze', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Pasti', exact: true })).toBeVisible();
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
