// Requisito: specs/03 - utenti-e-ruoli.md
//
// ATTENZIONE: questi test creano/modificano/eliminano davvero utenti
// (auth.users + profili) sul progetto Supabase di test — vedi la nota in
// 50-amministrazione_base.spec.ts. Ogni utente creato viene eliminato
// dallo stesso test per non accumulare account fittizi nel progetto.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('03 — Utenti e ruoli', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  test('/admin/maestre: form di creazione presente + accessibilità', async ({ page }) => {
    await page.goto('/admin/maestre');
    await expect(page.getByRole('heading', { name: 'Crea nuovo utente' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('admin crea un nuovo utente, lo modifica e lo elimina', async ({ page }) => {
    const email = `e2e-utente-${Date.now()}@example.com`;

    await page.goto('/admin/maestre');
    await page.getByPlaceholder('Nome').first().fill('Prova');
    await page.getByPlaceholder('Cognome').first().fill('E2E');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Telefono').first().fill('3331234567');
    await page.getByPlaceholder('Password').fill('PasswordE2E!1');
    await page.getByRole('button', { name: 'Crea utente' }).click();

    // La creazione redirige su ?ok=utente-creato e il nuovo utente compare in elenco.
    await expect(page.getByText('Utente creato con successo.')).toBeVisible({ timeout: 20_000 });
    const riga = page.getByText(email, { exact: false }).locator('..');
    await expect(riga).toBeVisible();

    // Modifica: cambio il ruolo a maestra dal form della riga.
    await riga.locator('select[name="ruolo"]').selectOption('maestra');
    await riga.getByRole('button', { name: 'Aggiorna' }).click();
    await page.waitForTimeout(1000);
    await expect(riga.locator('select[name="ruolo"]')).toHaveValue('maestra');

    // Eliminazione: l'account non deve più comparire in elenco.
    await riga.getByRole('button', { name: 'Elimina utente' }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);
  });

  test('creazione con password debole mostra un errore e non crea l\'utente', async ({ page }) => {
    const email = `e2e-debole-${Date.now()}@example.com`;

    await page.goto('/admin/maestre');
    await page.getByPlaceholder('Nome').first().fill('Debole');
    await page.getByPlaceholder('Cognome').first().fill('E2E');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Telefono').first().fill('3331234567');
    await page.getByPlaceholder('Password').fill('debole');
    await page.getByRole('button', { name: 'Crea utente' }).click();

    await expect(page.getByText(/lettera minuscola|maiuscola|carattere speciale/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);
  });

  test('creazione con email già in uso mostra un errore e non crea un secondo utente', async ({
    page,
  }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    const emailEsistente = process.env.E2E_ADMIN_EMAIL!;

    await page.goto('/admin/maestre');
    await page.getByPlaceholder('Nome').first().fill('Duplicato');
    await page.getByPlaceholder('Cognome').first().fill('E2E');
    await page.getByPlaceholder('Email').fill(emailEsistente);
    await page.getByPlaceholder('Telefono').first().fill('3331234567');
    await page.getByPlaceholder('Password').fill('PasswordE2E!1');
    await page.getByRole('button', { name: 'Crea utente' }).click();

    await expect(page.getByText('Esiste già un utente con questa email.')).toBeVisible({
      timeout: 20_000,
    });
    // Un solo utente con quell'email in elenco (l'admin stesso), non due.
    await expect(page.getByText(emailEsistente, { exact: false })).toHaveCount(1);
  });

  test('creazione con campi obbligatori mancanti mostra un errore', async ({ page }) => {
    await page.goto('/admin/maestre');
    // Compilo solo l'email, lascio nome/cognome/telefono/password vuoti:
    // il required lato browser impedirebbe l'invio, quindi rimuovo gli
    // attributi required via JS per verificare la validazione server-side.
    await page.evaluate(() => {
      document
        .querySelectorAll('form input[required]')
        .forEach((el) => el.removeAttribute('required'));
    });
    await page.getByPlaceholder('Email').fill(`e2e-mancanti-${Date.now()}@example.com`);
    await page.getByRole('button', { name: 'Crea utente' }).click();

    await expect(page.getByText('Compila tutti i campi')).toBeVisible({ timeout: 20_000 });
  });

  test("l'admin non può eliminare il proprio account", async ({ page }) => {
    await page.goto('/admin/maestre');
    const rigaPropria = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
    await rigaPropria.getByRole('button', { name: 'Elimina utente' }).click();

    await expect(page.getByText('Non puoi eliminare il tuo stesso account.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(process.env.E2E_ADMIN_EMAIL!)).toBeVisible();
  });

  test('maestra e genitore non possono aprire /admin/maestre', async ({ browser }) => {
    for (const ruolo of ['maestra', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);

      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      await page.goto('/admin/maestre');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await context.close();
    }
  });
});
