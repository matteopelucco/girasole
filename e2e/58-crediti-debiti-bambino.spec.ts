// Requisito: specs/58 - crediti-debiti-bambino.md
//
// ATTENZIONE: questi test creano davvero un bambino e righe di
// crediti_debiti_bambini sul progetto Supabase di test (stesso pattern
// di 55-costi-bambino.spec.ts).
import { test, expect } from '@playwright/test';
import { formCreaBambino, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('58 — Crediti e debiti di un bambino', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  async function creaBambinoDiProva(page: import('@playwright/test').Page) {
    const cognome = `E2eCredDeb${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await page.goto('/admin');
    const form = formCreaBambino(page);
    await page.getByPlaceholder('Nome', { exact: true }).fill('CredDeb');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2021-05-05');
    await page.getByLabel('Sesso').selectOption('F');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const link = page.getByRole('link', { name: new RegExp(cognome) });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await page.waitForURL(/\/admin\/bambini\/.+/);
    return cognome;
  }

  test('sezione "Crediti e debiti" presente sulla scheda + accessibilità', async ({ page }) => {
    await creaBambinoDiProva(page);
    await expect(page.getByRole('heading', { name: 'Crediti e debiti' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('il mese di competenza è precompilato con la prossima retta utile', async ({ page }) => {
    await creaBambinoDiProva(page);
    const oggi = new Date();
    const meseSuggerito = new Date(Date.UTC(oggi.getFullYear(), oggi.getMonth() + 1, 1))
      .toISOString()
      .slice(0, 7);
    await expect(page.getByLabel('Mese di competenza')).toHaveValue(meseSuggerito);
  });

  test('aggiungere un debito lo mostra nell\'elenco "da conteggiare"', async ({ page }) => {
    await creaBambinoDiProva(page);

    await page.getByLabel('Tipo').selectOption('debito');
    await page.getByLabel('Importo (€)').fill('25');
    await page.getByLabel('Nota').fill('Uscita didattica non pagata');
    await page.getByRole('button', { name: 'Aggiungi credito/debito' }).click();

    await expect(page.getByText('Debito di 25,00', { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Uscita didattica non pagata', { exact: false })).toBeVisible();
    await expect(page.getByText('Da conteggiare su', { exact: false })).toBeVisible();
  });

  test('aggiungere un credito lo mostra nell\'elenco "da conteggiare"', async ({ page }) => {
    await creaBambinoDiProva(page);

    await page.getByLabel('Tipo').selectOption('credito');
    await page.getByLabel('Importo (€)').fill('15');
    await page.getByLabel('Nota').fill('Rimborso materiale non usato');
    await page.getByRole('button', { name: 'Aggiungi credito/debito' }).click();

    await expect(page.getByText('Credito di 15,00', { exact: false })).toBeVisible({ timeout: 20_000 });
  });

  test('la nota è obbligatoria', async ({ page }) => {
    await creaBambinoDiProva(page);

    await page.getByLabel('Importo (€)').fill('10');
    // Il campo "Nota" ha l'attributo required: il browser blocca il
    // submit senza nemmeno raggiungere il server — verifichiamo che il
    // form non venga inviato (nessuna riga aggiunta all'elenco).
    await page.getByRole('button', { name: 'Aggiungi credito/debito' }).click();
    await expect(page.getByText('Debito di 10,00', { exact: false })).toHaveCount(0);
  });

  test('un credito/debito non ancora applicato può essere eliminato', async ({ page }) => {
    await creaBambinoDiProva(page);

    await page.getByLabel('Importo (€)').fill('40');
    await page.getByLabel('Nota').fill('Da eliminare');
    await page.getByRole('button', { name: 'Aggiungi credito/debito' }).click();
    await expect(page.getByText('Da eliminare', { exact: false })).toBeVisible({ timeout: 20_000 });

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Elimina' }).click();
    await expect(page.getByText('Da eliminare', { exact: false })).toHaveCount(0, { timeout: 20_000 });
  });

  test('un secondo credito/debito sullo stesso mese viene rifiutato', async ({ page }) => {
    await creaBambinoDiProva(page);

    await page.getByLabel('Importo (€)').fill('10');
    await page.getByLabel('Nota').fill('Primo');
    await page.getByRole('button', { name: 'Aggiungi credito/debito' }).click();
    await expect(page.getByText('Primo', { exact: false })).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('Importo (€)').fill('20');
    await page.getByLabel('Nota').fill('Secondo, stesso mese');
    await page.getByRole('button', { name: 'Aggiungi credito/debito' }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Secondo, stesso mese', { exact: false })).toHaveCount(0);
  });

  test('il placeholder {{credito_debito}} è disponibile nel modello email', async ({ page }) => {
    await page.goto('/admin/rette/template');
    await expect(page.getByText('{{credito_debito}}', { exact: false })).toBeVisible();
    await expect(page.getByText('{{nota_credito_debito}}', { exact: false })).toBeVisible();
  });
});
