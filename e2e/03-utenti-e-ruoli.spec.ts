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
    await page.getByLabel('Password', { exact: true }).fill('PasswordE2E!1');
    await page.getByLabel('Conferma password').fill('PasswordE2E!1');
    await page.getByRole('button', { name: 'Crea utente' }).click();

    // Nessun banner di successo (specs/05 - feedback.md): l'effetto —
    // il nuovo utente in elenco — è già la conferma.
    const riga = page.getByText(email, { exact: false }).locator('..');
    await expect(riga).toBeVisible({ timeout: 20_000 });

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

  test('il form si svuota dopo aver creato un utente con successo', async ({ page }) => {
    const email = `e2e-svuota-${Date.now()}@example.com`;

    await page.goto('/admin/maestre');
    const formCreazione = page.locator('form', { has: page.getByRole('button', { name: 'Crea utente' }) });

    await page.getByPlaceholder('Nome').first().fill('Svuota');
    await page.getByPlaceholder('Cognome').first().fill('E2E');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Telefono').first().fill('3331234567');
    await page.getByLabel('Password', { exact: true }).fill('PasswordE2E!1');
    await page.getByLabel('Conferma password').fill('PasswordE2E!1');
    await formCreazione.getByLabel('Ruolo').selectOption('maestra');
    await page.getByRole('button', { name: 'Crea utente' }).click();

    const riga = page.getByText(email, { exact: false }).locator('..');
    await expect(riga).toBeVisible({ timeout: 20_000 });

    // Bug segnalato dopo l'uso reale: il form restava compilato con i
    // dati dell'utente appena creato, costringendo a cancellarlo a mano
    // prima di inserirne un altro (stesso pattern già corretto per gli
    // avvisi, specs/15 - memo.md).
    await expect(page.getByPlaceholder('Nome').first()).toHaveValue('');
    await expect(page.getByPlaceholder('Cognome').first()).toHaveValue('');
    await expect(page.getByPlaceholder('Email')).toHaveValue('');
    await expect(page.getByPlaceholder('Telefono').first()).toHaveValue('');
    await expect(formCreazione.getByLabel('Ruolo')).toHaveValue('genitore');

    await riga.getByRole('button', { name: 'Elimina utente' }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);
  });

  test('admin crea un nuovo utente con ruolo assistente', async ({ page }) => {
    const email = `e2e-assistente-${Date.now()}@example.com`;

    await page.goto('/admin/maestre');
    // Il <select> "Ruolo" compare anche una volta per riga utente
    // esistente: scelgo esplicitamente quello dentro al form di
    // creazione (identificato dal pulsante "Crea utente").
    const formCreazione = page.locator('form', { has: page.getByRole('button', { name: 'Crea utente' }) });

    await page.getByPlaceholder('Nome').first().fill('Prova');
    await page.getByPlaceholder('Cognome').first().fill('Assistente');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Telefono').first().fill('3331234567');
    await page.getByLabel('Password', { exact: true }).fill('PasswordE2E!1');
    await page.getByLabel('Conferma password').fill('PasswordE2E!1');
    await formCreazione.getByLabel('Ruolo').selectOption('assistente');
    await page.getByRole('button', { name: 'Crea utente' }).click();

    const riga = page.getByText(email, { exact: false }).locator('..');
    await expect(riga).toBeVisible({ timeout: 20_000 });
    await expect(riga.locator('select[name="ruolo"]')).toHaveValue('assistente');

    await riga.getByRole('button', { name: 'Elimina utente' }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);
  });

  test('conferma password in tempo reale', async ({ page }) => {
    await page.goto('/admin/maestre');
    const password = page.getByLabel('Password', { exact: true });
    const conferma = page.getByLabel('Conferma password');

    await password.fill('PasswordE2E!1');
    await conferma.fill('PasswordDiversa!1');
    await expect(page.getByText('Le password non coincidono.')).toBeVisible();

    await conferma.fill('PasswordE2E!1');
    await expect(page.getByText('Le password coincidono.')).toBeVisible();
  });

  test("l'occhietto della password resta ancorato al campo quando compare il riscontro conferma", async ({
    page,
  }) => {
    await page.goto('/admin/maestre');
    const formCreazione = page.locator('form', { has: page.getByRole('button', { name: 'Crea utente' }) });
    // Entrambi i campi (password e conferma) partono nascosti, quindi
    // condividono la stessa etichetta "Mostra password": il primo nel
    // DOM è quello del campo "Password".
    const occhioPassword = formCreazione.getByRole('button', { name: 'Mostra password' }).first();
    const campoPassword = formCreazione.getByLabel('Password', { exact: true });
    // CampoPassword è un componente client ('use client'): l'occhio
    // compare solo dopo l'idratazione, un attimo dopo l'input (già
    // presente via SSR) — aspetto che sia visibile prima di misurare,
    // altrimenti la prima lettura rischia di arrivare a bottone non
    // ancora montato.
    await occhioPassword.waitFor({ state: 'visible' });

    const boxOcchioPrima = await occhioPassword.boundingBox();
    const boxCampoPrima = await campoPassword.boundingBox();

    // Il riscontro "coincidono/non coincidono" compare solo quando il
    // campo conferma non è vuoto: prima che compaia, verifico che
    // l'occhio sia già allineato al campo (non solo dopo).
    expect(Math.abs((boxOcchioPrima?.y ?? 0) - (boxCampoPrima?.y ?? 0))).toBeLessThan(2);

    await campoPassword.fill('PasswordE2E!1');
    await formCreazione.getByLabel('Conferma password').fill('PasswordE2E!1');
    await expect(page.getByText('Le password coincidono.')).toBeVisible();

    // Bug: il riscontro comparendo allungava la cella del campo password
    // nel layout a griglia, e l'occhio (assoluto rispetto al proprio
    // contenitore, non al campo) seguiva quell'allungamento, finendo
    // centrato su un'area che comprendeva anche il testo del riscontro.
    const boxOcchioDopo = await occhioPassword.boundingBox();
    const boxCampoDopo = await campoPassword.boundingBox();
    expect(Math.abs((boxOcchioDopo?.y ?? 0) - (boxCampoDopo?.y ?? 0))).toBeLessThan(2);
    expect(Math.abs((boxOcchioDopo?.height ?? 0) - (boxCampoDopo?.height ?? 0))).toBeLessThan(2);
  });

  test('creazione con password non confermata correttamente', async ({ page }) => {
    const email = `e2e-conferma-${Date.now()}@example.com`;

    await page.goto('/admin/maestre');
    await page.getByPlaceholder('Nome').first().fill('Conferma');
    await page.getByPlaceholder('Cognome').first().fill('E2E');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Telefono').first().fill('3331234567');
    await page.getByLabel('Password', { exact: true }).fill('PasswordE2E!1');
    await page.getByLabel('Conferma password').fill('PasswordDiversa!1');
    await page.getByRole('button', { name: 'Crea utente' }).click();

    await expect(page.getByText('Le due password inserite non coincidono.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);
  });

  test('creazione con password debole mostra un errore e non crea l\'utente', async ({ page }) => {
    const email = `e2e-debole-${Date.now()}@example.com`;

    await page.goto('/admin/maestre');
    await page.getByPlaceholder('Nome').first().fill('Debole');
    await page.getByPlaceholder('Cognome').first().fill('E2E');
    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Telefono').first().fill('3331234567');
    await page.getByLabel('Password', { exact: true }).fill('debole');
    await page.getByLabel('Conferma password').fill('debole');
    await page.getByRole('button', { name: 'Crea utente' }).click();

    await expect(page.getByText(/lettera minuscola|maiuscola|carattere speciale/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);

    // Bug segnalato da un'insegnante: un errore non deve svuotare i
    // campi già compilati, altrimenti tocca reinserirli da capo.
    await expect(page.getByPlaceholder('Nome').first()).toHaveValue('Debole');
    await expect(page.getByPlaceholder('Cognome').first()).toHaveValue('E2E');
    await expect(page.getByPlaceholder('Email')).toHaveValue(email);
    await expect(page.getByPlaceholder('Telefono').first()).toHaveValue('3331234567');
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
    await page.getByLabel('Password', { exact: true }).fill('PasswordE2E!1');
    await page.getByLabel('Conferma password').fill('PasswordE2E!1');
    await page.getByRole('button', { name: 'Crea utente' }).click();

    await expect(page.getByText('Esiste già un utente con questa email.')).toBeVisible({
      timeout: 20_000,
    });
    // Un solo utente con quell'email in elenco (l'admin stesso), non
    // due. Scelgo l'elenco (<main>) ed escludo l'intestazione
    // (<header>), che mostra la stessa email quando il profilo non ha
    // un nome impostato.
    await expect(page.getByRole('main').getByText(emailEsistente, { exact: false })).toHaveCount(1);
  });

  test('creazione con campi obbligatori mancanti mostra un errore', async ({ page }) => {
    await page.goto('/admin/maestre');
    // CampiPasswordConferma è un componente client: la sua comparsa
    // segnala che l'idratazione React è completa. Senza aspettarla, la
    // rimozione dell'attributo required via JS subito dopo può correre
    // contro l'idratazione e perdere — React la ripristina riconciliando
    // il DOM, e il browser blocca l'invio con il proprio tooltip nativo
    // invece di lasciar passare la richiesta alla validazione server.
    await page.getByRole('button', { name: 'Mostra password' }).first().waitFor({ state: 'visible' });
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
    await expect(rigaPropria).toBeVisible();
  });

  test('maestra, assistente e genitore non possono aprire /admin/maestre', async ({ browser }) => {
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
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
