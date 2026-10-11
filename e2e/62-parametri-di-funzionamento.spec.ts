// Requisito: specs/62 - parametri-di-funzionamento.md
//
// Solo navigazione e lettura: nessun dato scritto sul progetto di test.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

const PERCORSO = '/admin/parametri-funzionamento';

test.describe('62 — Parametri di funzionamento', () => {
  test.describe('admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('la voce è nel menu sotto "Impostazioni", rientrata, prima di "Utenti"', async ({ page }) => {
      await page.goto('/admin');
      const menu = page.getByRole('navigation');
      const impostazioni = menu.getByRole('link', { name: 'Impostazioni', exact: true });
      const parametri = menu.getByRole('link', { name: 'Parametri di funzionamento', exact: true });
      const utenti = menu.getByRole('link', { name: 'Utenti', exact: true });

      await expect(parametri).toHaveAttribute('href', PERCORSO);
      const y = async (l: typeof parametri) => (await l.boundingBox())!.y;
      const x = async (l: typeof parametri) => (await l.locator('span').first().boundingBox())!.x;
      expect(await y(impostazioni)).toBeLessThan(await y(parametri));
      expect(await y(parametri)).toBeLessThan(await y(utenti));
      expect(await x(parametri)).toBeGreaterThan(await x(impostazioni));
    });

    test('la pagina si apre dal menu e mostra titolo e breve descrizione', async ({ page }) => {
      await page.goto('/admin');
      await page.getByRole('navigation').getByRole('link', { name: 'Parametri di funzionamento', exact: true }).click();
      await page.waitForURL(PERCORSO);

      await expect(page.getByRole('heading', { name: 'Parametri di funzionamento', level: 1 })).toBeVisible();
      await expect(page.getByTestId('descrizione-pagina')).not.toBeEmpty();
      await expect(
        page.getByRole('navigation').getByRole('link', { name: 'Parametri di funzionamento', exact: true })
      ).toHaveAttribute('aria-current', 'page');
      await nessunaViolazioneA11yGrave(page);
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
      await expect(page.getByRole('link', { name: 'Parametri di funzionamento' })).toHaveCount(0);

      await page.goto(PERCORSO);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await context.close();
    }
  });
});
