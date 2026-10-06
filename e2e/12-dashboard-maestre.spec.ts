// Requisito: specs/12 - dashboard-maestre.md
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';
import { cardBambini } from './pagina-giornata';

const NOME_CARD = 'Presenze e pasti';

test.describe('12 — Dashboard maestra/admin', () => {
  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('aprire la dashboard mostra le attività del giorno: una sola card, senza selettore di data', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(page.getByLabel('Data')).toHaveCount(0);

      const linkGiornata = page.getByRole('link', { name: NOME_CARD });
      // Una maestra di test senza sezioni assegnate non vede la card:
      // in quel caso questo scenario non si applica (coperto a parte).
      test.skip((await linkGiornata.count()) === 0, 'nessuna sezione assegnata a questo account');

      await expect(linkGiornata).toBeVisible();
      await expect(linkGiornata).toContainText('📋');
      await expect(page.getByRole('link', { name: 'Presenze', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Pasti', exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Report' })).toContainText('📊');

      await nessunaViolazioneA11yGrave(page);
    });

    test('da "Presenze e pasti" si arriva direttamente ai bambini, raggruppati per classe', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      const linkGiornata = page.getByRole('link', { name: NOME_CARD });
      test.skip((await linkGiornata.count()) === 0, 'nessuna sezione assegnata a questo account');
      await linkGiornata.click();
      await page.waitForURL(/\/dashboard\/giornata\?/);
      await expect(page.getByRole('heading', { name: NOME_CARD, exact: true })).toBeVisible();

      // Niente elenco di classi da selezionare: i bambini (se ce ne sono)
      // sono già nella stessa pagina, raggruppati per sezione.
      if ((await cardBambini(page).count()) > 0) {
        await expect(page.getByRole('heading', { name: /^Sezione / }).first()).toBeVisible();
      }

      await nessunaViolazioneA11yGrave(page);
    });

    test('riepilogo aggregato di tutte le classi in cima alla pagina, prima dei gruppi per sezione', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard/giornata');
      const titolo = page.getByRole('heading', { name: 'Riepilogo giornaliero', exact: true });
      test.skip((await titolo.count()) === 0, 'nessun bambino in nessuna classe di questo account');

      const riepilogo = page.locator('div', { has: titolo }).last();
      await expect(riepilogo.getByText(/^Presenti: \d+\/\d+$/)).toBeVisible();
      await expect(riepilogo.getByText(/^Pre-asilo: \d+$/)).toBeVisible();
      await expect(riepilogo.getByText(/^Post-asilo: \d+$/)).toBeVisible();
      await expect(riepilogo.getByText(/^Pasti: \d+\/\d+$/)).toBeVisible();

      // Compare prima dell'elenco bambini raggruppato, non dopo (specs/12).
      const primaCard = cardBambini(page).first();
      if ((await primaCard.count()) > 0) {
        const yPosRiepilogo = await riepilogo.evaluate((el) => el.getBoundingClientRect().top);
        const yPosElenco = await primaCard.evaluate((el) => el.getBoundingClientRect().top);
        expect(yPosRiepilogo).toBeLessThan(yPosElenco);
      }
    });
  });

  test.describe('come assistente', () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test('la dashboard mostra "Presenze e pasti", che si apre con la sola parte presenze', async ({ page }) => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      const linkGiornata = page.getByRole('link', { name: NOME_CARD });
      test.skip((await linkGiornata.count()) === 0, 'nessuna sezione assegnata a questo account');

      await expect(linkGiornata).toBeVisible();
      await expect(page.getByRole('link', { name: 'Pasti', exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Avvisi' })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);

      await linkGiornata.click();
      await page.waitForURL(/\/dashboard\/giornata\?/);
      await expect(page.getByText(/^Pasti: \d+\/\d+$/)).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Comunicazione pasti a Rojac' })).toHaveCount(0);
    });
  });

  test('maestra senza sezioni assegnate vede il messaggio corretto, non un errore', async ({ page }) => {
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
    await expect(page.getByRole('link', { name: NOME_CARD })).toHaveCount(0);
  });

  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test("l'admin apre la dashboard: \"Presenze e pasti\", niente calendario né rimando testuale all'amministrazione", async ({
      page,
    }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(page.getByLabel('Data')).toHaveCount(0);
      await expect(page.getByText('Per creare sezioni e bambini')).toHaveCount(0);
      // Le pagine di amministrazione restano raggiungibili dal menu laterale.
      await expect(page.getByRole('link', { name: 'Sezioni e bambini' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Utenti' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: NOME_CARD })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Avvisi' })).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('come genitore', () => {
    test.use({ storageState: statoAutenticazione('genitore') });

    test('un genitore apre la dashboard: solo il placeholder, nessun dato di bambini', async ({ page }) => {
      test.skip(!hasCredenziali('genitore'), 'richiede E2E_GENITORE_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(page.getByText('Il portale genitori è in arrivo in una fase successiva.')).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });
});
