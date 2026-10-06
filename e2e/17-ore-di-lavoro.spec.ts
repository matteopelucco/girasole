// Requisito: specs/17 - ore-di-lavoro.md
//
// Dati propri (issue #230): il test di abilitazione non tocca il flag
// abilitato_ore_lavoro degli account condivisi (admin, maestra) ma quello di
// un utente creato apposta ed eliminato a fine test (e2e/fixture-utente.ts):
// per questo i test che verificano "senza abilitazione" sugli account
// condivisi non possono più essere disturbati da un altro test in parallelo.
import { test, expect } from './fixture-utente';
import { eliminaUtenteDaScheda, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione, clickEAttendiAzione } from './helpers';

test.describe('17 — Ore di lavoro', () => {
  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('senza abilitazione: nessuna card in dashboard e accesso diretto reindirizza alla dashboard', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Ore di lavoro', exact: true })).toHaveCount(0);

      await page.goto('/dashboard/ore-lavoro');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    // Dati propri (issue #230): l'abilitazione si prova su un utente admin
    // creato apposta (e2e/fixture-utente.ts), non sull'account admin condiviso,
    // così nessun altro test vede mai il flag acceso.
    test('abilitare/disabilitare un utente esistente mostra/nasconde la card e la sezione, che non ha alcuna form', async ({
      creaUtente,
      apriComeUtente,
    }) => {
      const utente = await creaUtente({ ruolo: 'admin' });
      const page = await apriComeUtente(utente);

      await page.goto('/admin/maestre');
      const rigaPropria = page.locator('li', { hasText: utente.email });
      const checkbox = rigaPropria.getByLabel('Ore di lavoro');

      // Abilitazione: la spunta resta visibile riaprendo la pagina, la
      // card compare in dashboard e apre la sezione dedicata (il
      // contenuto vero e proprio — tabella settimanale, conferma,
      // malattia/assenza — è testato in dettaglio in
      // 18-report-ore-lavoro.spec.ts, non qui).
      await checkbox.check();
      await clickEAttendiAzione(page, rigaPropria.getByRole('button', { name: 'Aggiorna' }));
      await page.reload();
      await expect(page.locator('li', { hasText: utente.email }).getByLabel('Ore di lavoro')).toBeChecked();

      await page.goto('/dashboard');
      const link = page.getByRole('link', { name: 'Ore di lavoro', exact: true });
      await expect(link).toBeVisible();
      await expect(link).toContainText('🕒');

      await link.click();
      await page.waitForURL('/dashboard/ore-lavoro');
      await expect(page.getByRole('heading', { name: 'Ore di lavoro' })).toBeVisible();

      await nessunaViolazioneA11yGrave(page);

      // Disabilitazione: la card sparisce e l'accesso diretto reindirizza.
      await page.goto('/admin/maestre');
      const rigaDaDisabilitare = page.locator('li', { hasText: utente.email });
      await rigaDaDisabilitare.getByLabel('Ore di lavoro').uncheck();
      await clickEAttendiAzione(page, rigaDaDisabilitare.getByRole('button', { name: 'Aggiorna' }));
      await page.reload();
      await expect(page.locator('li', { hasText: utente.email }).getByLabel('Ore di lavoro')).not.toBeChecked();

      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Ore di lavoro', exact: true })).toHaveCount(0);
      await page.goto('/dashboard/ore-lavoro');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    test('creazione di un utente con abilitazione al report ore già attiva', async ({ page }) => {
      const email = `e2e-ore-lavoro-${Date.now()}@example.com`;

      await page.goto('/admin/maestre');
      const formCreazione = page.locator('form', { has: page.getByRole('button', { name: 'Crea utente' }) });

      await page.getByPlaceholder('Nome').first().fill('Prova');
      await page.getByPlaceholder('Cognome').first().fill('OreLavoro');
      await page.getByPlaceholder('Email').fill(email);
      await page.getByPlaceholder('Telefono').first().fill('3331234567');
      await page.getByLabel('Password', { exact: true }).fill('PasswordE2E!1');
      await page.getByLabel('Conferma password').fill('PasswordE2E!1');
      await formCreazione.getByLabel('Ore di lavoro').check();
      await page.getByRole('button', { name: 'Crea utente' }).click();

      const riga = page.getByText(email, { exact: false }).locator('..');
      await expect(riga).toBeVisible({ timeout: 20_000 });
      await expect(riga.getByLabel('Ore di lavoro')).toBeChecked();

      await eliminaUtenteDaScheda(page, riga);
      await expect(page.getByText(email, { exact: false })).toHaveCount(0);
    });
  });

  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('senza abilitazione non vede la card "Ore di lavoro"', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Ore di lavoro', exact: true })).toHaveCount(0);
    });
  });
});
