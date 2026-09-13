// Requisito: specs/55 - parametri-retta.md
//
// ATTENZIONE: questo test crea davvero un bambino sul progetto Supabase
// di test (stesso pattern di 50-amministrazione_base.spec.ts) e scrive
// nella tabella `rette_bambini`. Il bambino di test non viene eliminato
// (in questa app i bambini non si eliminano mai, solo disattivano —
// vedi specs/50), coerente con le altre suite e2e.
import { test, expect } from '@playwright/test';
import { formCreaBambino, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('55 — Parametri di retta', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  // Crea un bambino di prova e apre la sua scheda di dettaglio,
  // restituendo il cognome usato per identificarlo altrove.
  async function creaBambinoDiProva(page: import('@playwright/test').Page) {
    const cognome = `E2eRetta${Date.now()}`;
    await page.goto('/admin');
    const form = formCreaBambino(page);
    await page.getByPlaceholder('Nome', { exact: true }).fill('Retta');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2021-04-04');
    await page.getByLabel('Sesso').selectOption('F');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const link = page.getByRole('link', { name: new RegExp(cognome) });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await page.waitForURL(/\/admin\/bambini\/.+/);
    return cognome;
  }

  test('sezione Retta presente sulla scheda bambino + accessibilità', async ({ page }) => {
    await creaBambinoDiProva(page);
    await expect(page.getByRole('heading', { name: 'Retta' })).toBeVisible();
    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue('0');
    await expect(page.getByLabel('Prezzo buono pasto (€)')).toHaveValue('0');
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue('');
    await nessunaViolazioneA11yGrave(page);
  });

  test('impostare per la prima volta i parametri di retta li salva e restano dopo un ricaricamento', async ({
    page,
  }) => {
    await creaBambinoDiProva(page);

    await page.getByLabel('Prezzo retta mensile (€)').fill('250');
    await page.getByLabel('Prezzo buono pasto (€)').fill('5.5');
    await page.getByLabel('Email promemoria retta').fill('genitore.test@example.com');
    await page.getByRole('button', { name: 'Salva retta' }).click();

    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue('250', { timeout: 20_000 });

    await page.reload();
    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue('250');
    await expect(page.getByLabel('Prezzo buono pasto (€)')).toHaveValue('5.5');
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue('genitore.test@example.com');
  });

  test('modificare parametri di retta già impostati aggiorna i valori salvati', async ({ page }) => {
    await creaBambinoDiProva(page);

    await page.getByLabel('Prezzo retta mensile (€)').fill('200');
    await page.getByLabel('Prezzo buono pasto (€)').fill('4');
    await page.getByRole('button', { name: 'Salva retta' }).click();
    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue('200', { timeout: 20_000 });

    await page.getByLabel('Prezzo retta mensile (€)').fill('220');
    await page.getByRole('button', { name: 'Salva retta' }).click();
    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue('220', { timeout: 20_000 });

    await page.reload();
    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue('220');
  });

  test("l'email di promemoria è facoltativa: si possono salvare solo i prezzi", async ({ page }) => {
    await creaBambinoDiProva(page);

    await page.getByLabel('Prezzo retta mensile (€)').fill('180');
    await page.getByLabel('Prezzo buono pasto (€)').fill('5');
    await page.getByRole('button', { name: 'Salva retta' }).click();

    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue('180', { timeout: 20_000 });
    await page.reload();
    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue('180');
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue('');
  });

  test('un formato email non valido viene rifiutato e non salva nulla', async ({ page }) => {
    await creaBambinoDiProva(page);

    await page.getByLabel('Prezzo retta mensile (€)').fill('300');
    await page.getByLabel('Email promemoria retta').fill('non-una-email');
    await page.getByRole('button', { name: 'Salva retta' }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });

    // Nulla è stato salvato: dopo un ricaricamento i campi tornano vuoti.
    await page.reload();
    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue('0');
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue('');
  });
});
