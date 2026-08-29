// Requisito: specs/17 - ore-di-lavoro.md
//
// ATTENZIONE: il test di abilitazione modifica davvero il flag
// abilitato_ore_lavoro sul profilo admin di test e lo ripristina a fine
// test (try/finally, stesso pattern di 53-calendario-scolastico.spec.ts)
// — un solo test lo fa, per evitare che due esecuzioni parallele
// sull'unico account admin si contendano lo stesso flag (fullyParallel:
// true, stessa cautela già presa in 16-comunicazione-pasti-rojac.spec.ts).
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

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
      await expect(page.getByRole('link', { name: 'Ore di lavoro' })).toHaveCount(0);

      await page.goto('/dashboard/ore-lavoro');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    test('abilitare/disabilitare un utente esistente mostra/nasconde la card e la sezione, che non ha alcuna form', async ({
      page,
    }) => {
      await page.goto('/admin/maestre');
      const rigaPropria = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
      const checkbox = rigaPropria.getByLabel('Ore di lavoro');

      try {
        // Abilitazione: la spunta resta visibile riaprendo la pagina, la
        // card compare in dashboard e apre la sezione dedicata, senza
        // alcuna form (specs/17: solo l'abilitazione, non la funzione).
        await checkbox.check();
        await rigaPropria.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! }).getByLabel('Ore di lavoro')).toBeChecked();

        await page.goto('/dashboard');
        const link = page.getByRole('link', { name: 'Ore di lavoro' });
        await expect(link).toBeVisible();
        await expect(link).toContainText('🕒');

        await link.click();
        await page.waitForURL('/dashboard/ore-lavoro');
        await expect(page.getByRole('heading', { name: 'Ore di lavoro' })).toBeVisible();
        await expect(page.getByText(/fase successiva/)).toBeVisible();
        await expect(page.locator('form')).toHaveCount(0);
        await expect(page.locator('input')).toHaveCount(0);

        await nessunaViolazioneA11yGrave(page);

        // Disabilitazione: la card sparisce e l'accesso diretto reindirizza.
        await page.goto('/admin/maestre');
        const rigaDaDisabilitare = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
        await rigaDaDisabilitare.getByLabel('Ore di lavoro').uncheck();
        await rigaDaDisabilitare.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(
          page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! }).getByLabel('Ore di lavoro')
        ).not.toBeChecked();

        await page.goto('/dashboard');
        await expect(page.getByRole('link', { name: 'Ore di lavoro' })).toHaveCount(0);
        await page.goto('/dashboard/ore-lavoro');
        await page.waitForURL('/dashboard', { timeout: 20_000 });
      } finally {
        await page.goto('/admin/maestre');
        const rigaDaRipristinare = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
        const checkboxDaRipristinare = rigaDaRipristinare.getByLabel('Ore di lavoro');
        if (await checkboxDaRipristinare.isChecked()) {
          await checkboxDaRipristinare.uncheck();
          await rigaDaRipristinare.getByRole('button', { name: 'Aggiorna' }).click();
          await page.waitForTimeout(1000);
        }
      }
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

      await riga.getByRole('button', { name: 'Elimina utente' }).click();
      await page.waitForTimeout(1000);
      await expect(page.getByText(email, { exact: false })).toHaveCount(0);
    });
  });

  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('senza abilitazione non vede la card "Ore di lavoro"', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Ore di lavoro' })).toHaveCount(0);
    });
  });
});
