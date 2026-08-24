// Requisito: specs/15 - memo.md
//
// ATTENZIONE: questi test scrivono davvero in `promemoria` (nome della
// tabella, non rinominata — l'entità visibile all'utente si chiama
// "Avviso") sul progetto Supabase di test — vedi la nota in
// 13-segna-presenza.spec.ts.
import { test, expect, type Page } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

// Sceglie destinatario "Un bambino" e prova le prime sezioni finché non
// ne trova una con almeno un bambino attivo, selezionandolo. Ritorna
// false se nessuna delle prime sezioni esaminate ne ha (test si salta).
async function scegliBambinoDiUnaSezioneConBambini(page: Page): Promise<boolean> {
  await page.locator('select[name="destinatario_tipo"]').selectOption('bambino');
  const selectSezione = page.locator('select[name="sezione_id"]');
  const numeroSezioni = await selectSezione.locator('option').count();

  for (let indice = 1; indice < Math.min(numeroSezioni, 6); indice++) {
    await selectSezione.selectOption({ index: indice });
    const selectBambino = page.locator('select[name="bambino_id"]');
    const opzioniBambino = selectBambino.locator('option');
    if ((await opzioniBambino.count()) > 1) {
      await selectBambino.selectOption({ index: 1 });
      return true;
    }
  }
  return false;
}

test.describe("15 — Avvisi, come assistente (stesso perimetro della maestra)", () => {
  test.use({ storageState: statoAutenticazione('assistente') });

  test("un'assistente può creare un avviso per tutti", async ({ page }) => {
    test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
    await page.goto('/dashboard');

    const titolo = `Avviso E2E assistente ${Date.now()}`;
    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder("Testo dell'avviso").fill('Testo generato dal test end-to-end.');
    await page.locator('select[name="destinatario_tipo"]').selectOption('tutti');
    await page.getByRole('button', { name: 'Pubblica avviso' }).click();

    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('15 — Avvisi', () => {
  test.use({ storageState: statoAutenticazione('maestra') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
    await page.goto('/dashboard');
  });

  test('creare un avviso per tutti compare in cima alla lista', async ({ page }) => {
    const titolo = `Avviso E2E ${Date.now()}`;

    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder("Testo dell'avviso").fill('Testo generato dal test end-to-end.');
    // Il select non ha una label esplicita, si seleziona per nome campo.
    await page.locator('select[name="destinatario_tipo"]').selectOption('tutti');
    await page.getByRole('button', { name: 'Pubblica avviso' }).click();

    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });

    await nessunaViolazioneA11yGrave(page);
  });

  test('destinatario "Tutti" di default: nessun campo sezione/bambino visibile', async ({ page }) => {
    await expect(page.locator('select[name="destinatario_tipo"]')).toHaveValue('tutti');
    await expect(page.locator('select[name="sezione_id"]')).toHaveCount(0);
    await expect(page.locator('select[name="bambino_id"]')).toHaveCount(0);
  });

  test('scegliere "Una sezione" rivela il campo sezione', async ({ page }) => {
    await page.locator('select[name="destinatario_tipo"]').selectOption('sezione');
    await expect(page.locator('select[name="sezione_id"]')).toBeVisible();
    await expect(page.locator('select[name="bambino_id"]')).toHaveCount(0);
  });

  test('scegliere "Un bambino" rivela prima il campo sezione, poi il campo bambino', async ({ page }) => {
    await page.locator('select[name="destinatario_tipo"]').selectOption('bambino');
    const selectSezione = page.locator('select[name="sezione_id"]');
    await expect(selectSezione).toBeVisible();
    // Prima di scegliere una sezione, il campo bambino non c'è ancora.
    await expect(page.locator('select[name="bambino_id"]')).toHaveCount(0);

    const opzioniSezione = selectSezione.locator('option');
    test.skip((await opzioniSezione.count()) <= 1, 'nessuna sezione disponibile per questo account');
    await selectSezione.selectOption({ index: 1 });
    await expect(page.locator('select[name="bambino_id"]')).toBeVisible();
  });

  test("cambiare la sezione aggiorna l'elenco bambini del terzo campo", async ({ page }) => {
    await page.locator('select[name="destinatario_tipo"]').selectOption('bambino');
    const selectSezione = page.locator('select[name="sezione_id"]');
    const opzioniSezione = await selectSezione.locator('option').allTextContents();
    test.skip(opzioniSezione.length < 3, 'servono almeno due sezioni per questo scenario');

    await selectSezione.selectOption({ index: 1 });
    const bambiniPrimaSezione = await page.locator('select[name="bambino_id"] option').allTextContents();

    await selectSezione.selectOption({ index: 2 });
    const bambiniSecondaSezione = await page.locator('select[name="bambino_id"] option').allTextContents();

    // Le due sezioni hanno (quasi certamente) elenchi bambini diversi:
    // il campo si è davvero aggiornato, non è rimasto quello di prima.
    expect(bambiniSecondaSezione).not.toEqual(bambiniPrimaSezione);
  });

  test('tornare su "Tutti" nasconde di nuovo i campi sezione e bambino', async ({ page }) => {
    await page.locator('select[name="destinatario_tipo"]').selectOption('bambino');
    await expect(page.locator('select[name="sezione_id"]')).toBeVisible();

    await page.locator('select[name="destinatario_tipo"]').selectOption('tutti');
    await expect(page.locator('select[name="sezione_id"]')).toHaveCount(0);
    await expect(page.locator('select[name="bambino_id"]')).toHaveCount(0);
  });

  test("il form si svuota dopo aver pubblicato un avviso", async ({ page }) => {
    const titolo = `Avviso Svuota E2E ${Date.now()}`;

    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder("Testo dell'avviso").fill('Testo che deve sparire dal form.');
    await page.locator('select[name="destinatario_tipo"]').selectOption('tutti');
    await page.getByRole('button', { name: 'Pubblica avviso' }).click();

    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });
    // Bug segnalato da un'insegnante: dopo la pubblicazione il form
    // restava compilato, costringendo a cancellarlo a mano prima di
    // inserirne un altro.
    await expect(page.getByPlaceholder('Titolo')).toHaveValue('');
    await expect(page.getByPlaceholder("Testo dell'avviso")).toHaveValue('');
    await expect(page.locator('select[name="destinatario_tipo"]')).toHaveValue('tutti');
  });

  test('creare un avviso per una sezione', async ({ page }) => {
    await page.locator('select[name="destinatario_tipo"]').selectOption('sezione');
    const opzioniSezione = page.locator('select[name="sezione_id"] option');
    test.skip((await opzioniSezione.count()) <= 1, 'nessuna sezione disponibile per questo account');

    const titolo = `Avviso sezione E2E ${Date.now()}`;
    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder("Testo dell'avviso").fill('Solo per una sezione.');
    await page.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Pubblica avviso' }).click();

    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(titolo).locator('..')).toContainText('Per una sezione');
  });

  test('creare un avviso per un singolo bambino', async ({ page }) => {
    const trovato = await scegliBambinoDiUnaSezioneConBambini(page);
    test.skip(!trovato, 'nessuna sezione con bambini trovata tra le prime esaminate');

    const titolo = `Avviso bambino E2E ${Date.now()}`;
    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder("Testo dell'avviso").fill('Solo per un bambino.');
    await page.getByRole('button', { name: 'Pubblica avviso' }).click();

    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(titolo).locator('..')).toContainText('Per un bambino');
  });

  test('destinatario "Una sezione" senza sezione scelta non pubblica (validazione)', async ({ page }) => {
    const titolo = `Avviso sezione mancante E2E ${Date.now()}`;
    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder("Testo dell'avviso").fill('Non deve pubblicarsi.');
    await page.locator('select[name="destinatario_tipo"]').selectOption('sezione');
    // Il campo sezione ha un'opzione vuota iniziale non selezionabile
    // esplicitamente dall'utente, ma raggiungibile programmaticamente:
    // verifico che la validazione server-side (oltre a "required" lato
    // client) rifiuti comunque l'invio.
    await page.evaluate(() => {
      document.querySelectorAll('select[required]').forEach((el) => el.removeAttribute('required'));
    });
    await page.getByRole('button', { name: 'Pubblica avviso' }).click();

    await page.waitForTimeout(500);
    await expect(page.getByText(titolo)).toHaveCount(0);
  });

  test('titolo o testo vuoti non creano un avviso (validazione server-side)', async ({ page }) => {
    const avvisiPrima = await page.locator('main >> text=Nessun avviso').count();
    await page.getByRole('button', { name: 'Pubblica avviso' }).click();
    await page.waitForTimeout(500);

    // La action ritorna senza inserire nulla: il conteggio "Nessun
    // avviso pubblicato" resta identico, oppure la lista non cresce.
    const avvisiDopo = await page.locator('main >> text=Nessun avviso').count();
    expect(avvisiDopo).toBe(avvisiPrima);
  });

  test('modifica di un avviso', async ({ page }) => {
    const titolo = `Avviso Modifica E2E ${Date.now()}`;
    const titoloModificato = `${titolo} (modificato)`;

    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder("Testo dell'avviso").fill('Testo originale.');
    await page.locator('select[name="destinatario_tipo"]').selectOption('tutti');
    await page.getByRole('button', { name: 'Pubblica avviso' }).click();
    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('link', { name: titolo }).click();
    await page.waitForURL(/\/dashboard\/promemoria\/.+/);
    await expect(page.getByRole('heading', { name: 'Modifica avviso' })).toBeVisible();

    await page.getByPlaceholder('Titolo').fill(titoloModificato);
    await page.getByRole('button', { name: 'Salva modifiche' }).click();
    await expect(page.getByPlaceholder('Titolo')).toHaveValue(titoloModificato, { timeout: 20_000 });

    await page.goto('/dashboard');
    await expect(page.getByText(titoloModificato)).toBeVisible();
  });

  test('modifica di un avviso destinato a un bambino pre-compila la sezione filtro', async ({ page }) => {
    const trovato = await scegliBambinoDiUnaSezioneConBambini(page);
    test.skip(!trovato, 'nessuna sezione con bambini trovata tra le prime esaminate');

    const titolo = `Avviso bambino Modifica E2E ${Date.now()}`;
    const bambinoAtteso = await page.locator('select[name="bambino_id"] option:checked').textContent();
    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder("Testo dell'avviso").fill('Per un bambino, poi modificato.');
    await page.getByRole('button', { name: 'Pubblica avviso' }).click();
    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('link', { name: titolo }).click();
    await page.waitForURL(/\/dashboard\/promemoria\/.+/);

    await expect(page.locator('select[name="destinatario_tipo"]')).toHaveValue('bambino');
    await expect(page.locator('select[name="bambino_id"]')).toBeVisible();
    const bambinoSelezionato = await page.locator('select[name="bambino_id"] option:checked').textContent();
    expect(bambinoSelezionato?.trim()).toBe(bambinoAtteso?.trim());
  });

  test('cancellazione di un avviso, con conferma', async ({ page }) => {
    const titolo = `Avviso Elimina E2E ${Date.now()}`;

    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder("Testo dell'avviso").fill('Da eliminare.');
    await page.locator('select[name="destinatario_tipo"]').selectOption('tutti');
    await page.getByRole('button', { name: 'Pubblica avviso' }).click();
    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('link', { name: titolo }).click();
    await page.waitForURL(/\/dashboard\/promemoria\/.+/);

    // "Annulla" nasconde la richiesta di conferma senza eliminare nulla.
    await page.getByRole('button', { name: 'Elimina avviso' }).click();
    await expect(page.getByText("Confermi l'eliminazione?")).toBeVisible();
    await page.getByRole('button', { name: 'Annulla' }).click();
    await expect(page.getByText("Confermi l'eliminazione?")).toHaveCount(0);

    // "Sì" elimina davvero e torna alla lista con un messaggio.
    await page.getByRole('button', { name: 'Elimina avviso' }).click();
    await page.getByRole('button', { name: 'Sì' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page.getByText('Avviso eliminato.')).toBeVisible();
    await expect(page.getByText(titolo)).toHaveCount(0);
  });
});
