// Requisito: specs/58 - crediti-debiti-bambino.md
//
// ATTENZIONE: questi test creano davvero un bambino e righe di
// crediti_debiti_bambini sul progetto Supabase di test (stesso pattern
// di 55-costi-bambino.spec.ts).
import { test, expect } from '@playwright/test';
import { dataOggiRoma, formCreaBambino, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

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

  test('il credito/debito "da conteggiare" questo mese compare in "Rette" in un\'unica cella, di sola lettura', async ({
    page,
  }) => {
    const cognome = await creaBambinoDiProva(page);

    // Costi minimi per comparire come riga "da inviare" in "Rette"
    // (specs/56): senza email/prezzo configurati il bambino mostra solo
    // l'avviso "Costi o email non configurati".
    const email = `e2e-creddeb-rette-${Date.now()}@example.com`;
    await page.getByLabel('Prezzo retta mensile (€)').fill('100');
    await page.getByLabel('Prezzo buono pasto (€)').fill('0');
    await page.getByLabel('Email promemoria retta').fill(email);
    await page.getByRole('button', { name: 'Salva costi' }).click();
    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue('100', { timeout: 20_000 });

    // Il mese di competenza è precompilato sul mese successivo
    // (specs/58): lo sposto sul mese corrente perché compaia subito in
    // "Rette" (specs/56, mese corrente).
    await page.getByLabel('Mese di competenza').fill(dataOggiRoma().slice(0, 7));
    await page.getByLabel('Tipo').selectOption('debito');
    await page.getByLabel('Importo (€)').fill('30');
    await page.getByLabel('Nota').fill('Correzione di prova per Rette');
    await page.getByRole('button', { name: 'Aggiungi credito/debito' }).click();
    await expect(page.getByText('Debito di 30,00', { exact: false })).toBeVisible({ timeout: 20_000 });

    await page.goto('/admin/rette');
    const riga = page.locator('tr', { hasText: cognome });
    // Importo e nota condivisi in un'unica colonna "Credito/Debito".
    await expect(riga).toContainText('30,00');
    await expect(riga).toContainText('Correzione di prova per Rette');
    // Di sola lettura: nessun campo per modificare importo o nota, a
    // differenza di "Costi extra"/"Nota costi extra" sulla stessa riga.
    await expect(riga.getByLabel(new RegExp(`Credito/Debito per.*${cognome}`))).toHaveCount(0);
    await expect(riga.getByLabel(new RegExp(`Nota credito/debito per.*${cognome}`))).toHaveCount(0);
    await expect(riga.getByLabel(new RegExp(`Costi extra per.*${cognome}`))).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('il placeholder {{credito_debito}} è disponibile nel modello email', async ({ page }) => {
    await page.goto('/admin/rette/template');
    await expect(page.getByText('{{credito_debito}}', { exact: false })).toBeVisible();
    await expect(page.getByText('{{nota_credito_debito}}', { exact: false })).toBeVisible();
  });
});
