// Requisito: specs/04 - data-types.md
//
// ATTENZIONE: questi test scrivono davvero in `anni_scolastici`/
// `sezioni`/`bambini`/`profili` sul progetto Supabase di test — vedi la
// nota in 50_amministrazione_base.spec.ts.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('04 — Tipi di dato ed entità', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  test('/admin: sezione "Anni scolastici" presente + accessibilità', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Anni scolastici' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('admin crea un anno scolastico, poi lo sceglie per una nuova classe', async ({ page }) => {
    const nomeAnno = `E2E ${Date.now()}`;

    await page.goto('/admin');
    await page.getByPlaceholder('Nome anno scolastico (es. 2026/2027)').fill(nomeAnno);
    await page.getByRole('button', { name: 'Crea' }).first().click();
    await expect(page.getByText(nomeAnno)).toBeVisible({ timeout: 20_000 });

    const nomeSezione = `Sezione E2E ${Date.now()}`;
    await page.getByPlaceholder('Nome sezione (es. Girasoli)').fill(nomeSezione);
    await page.locator('select[name="anno_scolastico_id"]').selectOption({ label: nomeAnno });
    await page.getByRole('button', { name: 'Crea' }).nth(1).click();

    await expect(page.getByText(nomeSezione)).toBeVisible({ timeout: 20_000 });
  });

  test('admin disattiva e riattiva una classe', async ({ page }) => {
    await page.goto('/admin');
    const nomeSezione = `Sezione Toggle E2E ${Date.now()}`;
    await page.getByPlaceholder('Nome sezione (es. Girasoli)').fill(nomeSezione);
    await page.getByRole('button', { name: 'Crea' }).nth(1).click();
    await expect(page.getByText(nomeSezione)).toBeVisible({ timeout: 20_000 });

    const riga = page.getByText(nomeSezione, { exact: false }).locator('..');
    await riga.getByRole('button', { name: 'Disattiva' }).click();
    await expect(riga.getByText('non attiva')).toBeVisible({ timeout: 20_000 });

    await riga.getByRole('button', { name: 'Riattiva' }).click();
    await expect(riga.getByText('non attiva')).toHaveCount(0, { timeout: 20_000 });
  });

  test('admin inserisce un alunno con data di nascita e sesso', async ({ page }) => {
    await page.goto('/admin');
    const opzioniSezione = page.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip((await opzioniSezione.count()) === 0, 'nessuna sezione disponibile, crea prima una sezione');

    const cognome = `E2eAlunno${Date.now()}`;
    await page.getByPlaceholder('Nome').fill('Alunno');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2021-05-10');
    await page.getByLabel('Sesso').selectOption('M');
    await page.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await page.getByPlaceholder('Altre note (opzionale)').fill('Nota E2E');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    await expect(page.getByText(cognome, { exact: false })).toBeVisible({ timeout: 20_000 });
  });

  test('admin aggiunge indirizzo e note a un utente in fase di creazione', async ({ page }) => {
    const email = `e2e-indirizzo-${Date.now()}@example.com`;

    await page.goto('/admin/maestre');
    await page.getByPlaceholder('Nome').first().fill('Indirizzo');
    await page.getByPlaceholder('Cognome').first().fill('E2E');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Telefono').first().fill('3331234567');
    await page.getByPlaceholder('Indirizzo di residenza (opzionale)').fill('Via Test 1, Torino');
    await page.getByPlaceholder('Note (opzionale)').first().fill('Nota utente E2E');
    await page.getByPlaceholder('Password').fill('PasswordE2E!1');
    await page.getByRole('button', { name: 'Crea utente' }).click();

    await expect(page.getByText('Utente creato con successo.')).toBeVisible({ timeout: 20_000 });
    const riga = page.getByText(email, { exact: false }).locator('..');
    await expect(riga.locator('input[name="indirizzo_residenza"]')).toHaveValue('Via Test 1, Torino');
    await expect(riga.locator('input[name="note"]')).toHaveValue('Nota utente E2E');

    // Pulizia: elimino l'utente creato per questo test.
    await riga.getByRole('button', { name: 'Elimina utente' }).click();
  });
});
