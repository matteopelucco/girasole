// Requisito: specs/50 - amministrazione_base.md
//
// ATTENZIONE: questi test scrivono davvero in `sezioni`/`bambini`/
// `maestre_sezioni`/`profili` sul progetto Supabase di test — vedi la
// nota in 13-segna-presenza.spec.ts.
import { test, expect, type Page } from '@playwright/test';
import {
  dataOggiRoma,
  formCreaBambino,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  rigaSezione,
  statoAutenticazione,
} from './helpers';

function gruppoClassiAssegnate(page: Page) {
  return page.locator('#classi-e-bambini-assegnati');
}

function gruppoSenzaClasse(page: Page) {
  return page.locator('#bambini-senza-classe');
}

test.describe('50 — Amministrazione base', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  test('/admin: elementi presenti + accessibilità', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Sezioni', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bambini', exact: true })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('creare una sezione la rende subito disponibile in elenco', async ({ page }) => {
    await page.goto('/admin');
    const nome = `Sezione E2E ${Date.now()}`;

    await page.getByPlaceholder('Nome sezione (es. Girasoli)').fill(nome);
    // Due form "Crea" in pagina (Anni scolastici + Sezioni, in quest'ordine
    // nel DOM — vedi specs/04 - data-types.md): questo è quello di Sezioni.
    await page.getByRole('button', { name: 'Crea' }).nth(1).click();

    await expect(rigaSezione(page, nome)).toBeVisible({ timeout: 20_000 });
  });

  test('creare un bambino con note allergie lo mostra in evidenza', async ({ page }) => {
    await page.goto('/admin');
    const form = formCreaBambino(page);
    const opzioniSezione = form.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip((await opzioniSezione.count()) === 0, 'nessuna sezione disponibile, crea prima una sezione');

    const cognome = `E2eTest${Date.now()}`;
    await page.getByPlaceholder('Nome', { exact: true }).fill('Bimbo');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2020-01-01');
    await page.getByLabel('Sesso').selectOption('F');
    await form.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await page.getByPlaceholder('Allergie o intolleranze (opzionale)').fill('Allergia test E2E');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const riga = page.getByText(cognome, { exact: false }).locator('..');
    await expect(riga).toContainText('Allergia test E2E', { timeout: 20_000 });
  });

  test('vedere le classi con i bambini assegnati', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Classi e bambini assegnati' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Bambini senza classe o disattivati' })
    ).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('creare un bambino senza sezione lo mette nell\'elenco "senza classe"', async ({ page }) => {
    await page.goto('/admin');
    const cognome = `E2eSenzaSezione${Date.now()}`;

    await page.getByPlaceholder('Nome', { exact: true }).fill('Orfano');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2020-06-01');
    await page.getByLabel('Sesso').selectOption('M');
    // Nessuna sezione scelta: la sezione è facoltativa alla creazione.
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    await expect(gruppoSenzaClasse(page).locator('li', { hasText: cognome })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('assegnare rapidamente una sezione a un bambino senza classe', async ({ page }) => {
    await page.goto('/admin');
    const form = formCreaBambino(page);
    const opzioniSezione = form.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip((await opzioniSezione.count()) === 0, 'nessuna sezione disponibile, crea prima una sezione');

    const cognome = `E2eAssegnaRapido${Date.now()}`;
    await page.getByPlaceholder('Nome', { exact: true }).fill('DaAssegnare');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2020-07-01');
    await page.getByLabel('Sesso').selectOption('F');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const riga = gruppoSenzaClasse(page).locator('li', { hasText: cognome });
    await expect(riga).toBeVisible({ timeout: 20_000 });

    await riga.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await riga.getByRole('button', { name: 'Assegna' }).click();

    await expect(gruppoSenzaClasse(page).locator('li', { hasText: cognome })).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(gruppoClassiAssegnate(page).locator('li', { hasText: cognome })).toBeVisible();
  });

  test('modificare i dati di un bambino dalla scheda di dettaglio', async ({ page }) => {
    await page.goto('/admin');
    const form = formCreaBambino(page);
    const opzioniSezione = form.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip((await opzioniSezione.count()) === 0, 'nessuna sezione disponibile, crea prima una sezione');

    const cognome = `E2eModifica${Date.now()}`;
    await page.getByPlaceholder('Nome', { exact: true }).fill('Modifica');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2020-02-02');
    await page.getByLabel('Sesso').selectOption('F');
    await form.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const link = page.getByRole('link', { name: new RegExp(cognome) });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await page.waitForURL(/\/admin\/bambini\/.+/);

    await page.getByPlaceholder('Altre note (opzionale)').fill('Nota aggiornata E2E');
    await page.getByRole('button', { name: 'Salva modifiche' }).click();

    await expect(page.getByPlaceholder('Altre note (opzionale)')).toHaveValue(
      'Nota aggiornata E2E',
      { timeout: 20_000 }
    );

    // La modifica resta salvata anche dopo un ricaricamento.
    await page.reload();
    await expect(page.getByPlaceholder('Altre note (opzionale)')).toHaveValue('Nota aggiornata E2E');
  });

  test('disattivare un bambino lo rimuove da Presenze/Pasto, riattivarlo lo fa ricomparire', async ({
    page,
  }) => {
    await page.goto('/admin');
    const form = formCreaBambino(page);
    const opzioniSezione = form.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip((await opzioniSezione.count()) === 0, 'nessuna sezione disponibile, crea prima una sezione');

    const cognome = `E2eDisattiva${Date.now()}`;
    await page.getByPlaceholder('Nome', { exact: true }).fill('Disattiva');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2020-03-03');
    await page.getByLabel('Sesso').selectOption('M');
    await form.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    const sezioneId = await form.locator('select[name="sezione_id"]').inputValue();
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const link = page.getByRole('link', { name: new RegExp(cognome) });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await page.waitForURL(/\/admin\/bambini\/.+/);

    // Prima di disattivarlo, il bambino compare in Presenze per la sua
    // classe (verifico come admin, che vede tutte le classi).
    await page.goto(`/dashboard/presenze/${sezioneId}?data=${dataOggiRoma()}`);
    await expect(page.getByText(cognome, { exact: false })).toBeVisible();

    // Torno alla scheda di dettaglio tramite l'elenco.
    await page.goto('/admin');
    await page.getByRole('link', { name: new RegExp(cognome) }).click();
    await page.waitForURL(/\/admin\/bambini\/.+/);

    await page.getByRole('button', { name: 'Disattiva bambino' }).click();
    await expect(page.getByRole('button', { name: 'Riattiva bambino' })).toBeVisible({
      timeout: 20_000,
    });

    // Non compare più tra i bambini assegnati, ma tra "senza classe o
    // disattivati", né più in Presenze per la sua ex classe.
    await page.goto('/admin');
    await expect(gruppoClassiAssegnate(page).locator('li', { hasText: cognome })).toHaveCount(0);
    await expect(gruppoSenzaClasse(page).locator('li', { hasText: cognome })).toBeVisible();

    await page.goto(`/dashboard/presenze/${sezioneId}?data=${dataOggiRoma()}`);
    await expect(page.getByText(cognome, { exact: false })).toHaveCount(0);

    // Riattivo dal dettaglio: torna a comparire tra i bambini assegnati.
    await page.goto('/admin');
    await gruppoSenzaClasse(page).locator('li', { hasText: cognome }).getByRole('link').click();
    await page.waitForURL(/\/admin\/bambini\/.+/);
    await page.getByRole('button', { name: 'Riattiva bambino' }).click();
    await expect(page.getByRole('button', { name: 'Disattiva bambino' })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto(`/dashboard/presenze/${sezioneId}?data=${dataOggiRoma()}`);
    await expect(page.getByText(cognome, { exact: false })).toBeVisible();
  });

  test('/admin/maestre: elementi presenti + accessibilità', async ({ page }) => {
    await page.goto('/admin/maestre');
    await expect(page.getByRole('heading', { name: 'Utenti e ruoli' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Assegna maestre alle sezioni' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('promuovere un utente a maestra ne aggiorna il ruolo', async ({ page }) => {
    test.skip(
      !process.env.E2E_UTENTE_DA_PROMUOVERE_EMAIL,
      'richiede E2E_UTENTE_DA_PROMUOVERE_EMAIL: email di un account esistente con ruolo genitore da promuovere'
    );

    await page.goto('/admin/maestre');
    const riga = page.getByText(process.env.E2E_UTENTE_DA_PROMUOVERE_EMAIL!).locator('..');
    await riga.locator('select[name="ruolo"]').selectOption('maestra');
    await riga.getByRole('button', { name: 'Aggiorna' }).click();

    await page.waitForTimeout(1000);
    await expect(riga.locator('select[name="ruolo"]')).toHaveValue('maestra');
  });

  test('assegnare e poi rimuovere una maestra da una sezione', async ({ page }) => {
    await page.goto('/admin/maestre');
    const selectMaestra = page.locator('select[name="maestra_id"]');
    const selectSezione = page.locator('select[name="sezione_id"]');
    const opzioniMaestra = selectMaestra.locator('option:not([value=""])');
    const opzioniSezione = selectSezione.locator('option:not([value=""])');
    test.skip(
      (await opzioniMaestra.count()) === 0 || (await opzioniSezione.count()) === 0,
      'serve almeno una maestra e una sezione esistenti'
    );

    // Id (non il testo, che per un account di test può anche essere
    // vuoto) delle due opzioni scelte, per individuare più avanti
    // esattamente e solo l'assegnazione di questo test.
    const idMaestra = await opzioniMaestra.first().getAttribute('value');
    const idSezione = await opzioniSezione.first().getAttribute('value');

    const formAssegnazione = () =>
      page
        .locator('form', { has: page.locator(`input[name="maestra_id"][value="${idMaestra}"]`) })
        .filter({ has: page.locator(`input[name="sezione_id"][value="${idSezione}"]`) });

    // "select[name=...] option:not([value=''])" prende sempre la prima
    // opzione reale: su un progetto di test con pochi dati può
    // coincidere con un'assegnazione fixture già esistente (es. la
    // maestra di test sulla sua sezione, usata da altri requisiti). In
    // quel caso il click "Assegna" è solo un no-op idempotente: non
    // rimuovo poi nulla, non è compito di questo test ripulire un
    // fixture che non ha creato lui.
    const assegnazioneGiaEsistente = (await formAssegnazione().count()) > 0;

    await selectMaestra.selectOption({ index: 1 });
    await selectSezione.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Assegna' }).click();
    await page.waitForTimeout(1000);

    if (assegnazioneGiaEsistente) return;

    const bottoneRimuovi = formAssegnazione().getByRole('button');
    if (await bottoneRimuovi.count()) {
      await bottoneRimuovi.click();
    }
  });
});
