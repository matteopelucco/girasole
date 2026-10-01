// Requisito: specs/54 - profili-orari.md
//
// ATTENZIONE: questi test creano/modificano/eliminano davvero profili
// orari (e li assegnano all'account admin di test) sul progetto
// Supabase di test — vedi la nota in 53-calendario-scolastico.spec.ts.
// Ogni profilo creato viene eliminato dallo stesso test, e l'assegnazione
// sull'account admin viene ripristinata a "Nessun profilo orario"
// (try/finally, stesso pattern di 17-ore-di-lavoro.spec.ts).
import { test, expect, type Browser, type Page } from '@playwright/test';
import { eliminaUtenteDaScheda, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('54 — Profili orari', () => {
  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('/admin/profili-orari: elementi presenti + accessibilità', async ({ page }) => {
      await page.goto('/admin/profili-orari');
      await expect(page.getByRole('heading', { name: 'Profili orari' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Crea profilo orario' })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('creare un profilo orario lo mostra in elenco con il totale settimanale', async ({ page }) => {
      const nome = `E2E 35 ore ${Date.now()}`;

      await page.goto('/admin/profili-orari');
      await page.getByPlaceholder('Nome (es. 35 ore settimanali)').fill(nome);
      await page.getByLabel('Lunedì').fill('7');
      await page.getByLabel('Martedì').fill('7');
      await page.getByLabel('Mercoledì').fill('7');
      await page.getByLabel('Giovedì').fill('7');
      await page.getByLabel('Venerdì').fill('7');
      await page.getByRole('button', { name: 'Crea profilo orario' }).click();

      const riga = page.getByText(nome, { exact: false });
      await expect(riga).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/35\s*h\/settimana/)).toBeVisible();

      // Pulizia.
      await riga.click();
      await page.waitForURL(/\/admin\/profili-orari\/.+/);
      await page.getByRole('button', { name: 'Elimina profilo orario' }).click();
      await page.getByRole('button', { name: 'Sì' }).click();
      await page.waitForURL('/admin/profili-orari');
    });

    test('modificare un profilo orario aggiorna nome, ore e totale', async ({ page }) => {
      const nome = `E2E modifica ${Date.now()}`;

      await page.goto('/admin/profili-orari');
      await page.getByPlaceholder('Nome (es. 35 ore settimanali)').fill(nome);
      await page.getByLabel('Lunedì').fill('4');
      await page.getByLabel('Martedì').fill('4');
      await page.getByLabel('Mercoledì').fill('4');
      await page.getByLabel('Giovedì').fill('4');
      await page.getByLabel('Venerdì').fill('4');
      await page.getByRole('button', { name: 'Crea profilo orario' }).click();

      const riga = page.getByText(nome, { exact: false });
      await expect(riga).toBeVisible({ timeout: 20_000 });
      await riga.click();
      await page.waitForURL(/\/admin\/profili-orari\/.+/);
      await nessunaViolazioneA11yGrave(page);

      await page.getByLabel('Venerdì').fill('2');
      await page.getByRole('button', { name: 'Salva modifiche' }).click();
      await expect(page.getByText(/18\s*h\/settimana/)).toBeVisible({ timeout: 20_000 });

      // Resta salvato anche dopo un ricaricamento.
      await page.reload();
      await expect(page.getByLabel('Venerdì')).toHaveValue('2');

      // Pulizia.
      await page.getByRole('button', { name: 'Elimina profilo orario' }).click();
      await page.getByRole('button', { name: 'Sì' }).click();
    });

    test('eliminare un profilo orario lo rimuove dall\'elenco', async ({ page }) => {
      const nome = `E2E elimina ${Date.now()}`;

      await page.goto('/admin/profili-orari');
      await page.getByPlaceholder('Nome (es. 35 ore settimanali)').fill(nome);
      await page.getByLabel('Lunedì').fill('3');
      await page.getByLabel('Martedì').fill('3');
      await page.getByLabel('Mercoledì').fill('3');
      await page.getByLabel('Giovedì').fill('3');
      await page.getByLabel('Venerdì').fill('3');
      await page.getByRole('button', { name: 'Crea profilo orario' }).click();

      const riga = page.getByText(nome, { exact: false });
      await expect(riga).toBeVisible({ timeout: 20_000 });
      await riga.click();
      await page.waitForURL(/\/admin\/profili-orari\/.+/);

      await page.getByRole('button', { name: 'Elimina profilo orario' }).click();
      await page.getByRole('button', { name: 'Sì' }).click();
      await page.waitForURL('/admin/profili-orari');
      await expect(page.getByText(nome, { exact: false })).toHaveCount(0);
    });

    test('assegnare/rimuovere un profilo orario a un utente esistente, e il profilo eliminato lo svuota', async ({
      page,
    }) => {
      const nome = `E2E assegna ${Date.now()}`;

      await page.goto('/admin/profili-orari');
      await page.getByPlaceholder('Nome (es. 35 ore settimanali)').fill(nome);
      await page.getByLabel('Lunedì').fill('5');
      await page.getByLabel('Martedì').fill('5');
      await page.getByLabel('Mercoledì').fill('5');
      await page.getByLabel('Giovedì').fill('5');
      await page.getByLabel('Venerdì').fill('5');
      await page.getByRole('button', { name: 'Crea profilo orario' }).click();
      await expect(page.getByText(nome, { exact: false })).toBeVisible({ timeout: 20_000 });

      try {
        await page.goto('/admin/maestre');
        const rigaPropria = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
        await rigaPropria.getByLabel('Profilo orario').selectOption({ label: nome });
        await rigaPropria.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);
        await page.reload();
        // L'opzione selezionata resta quella scelta anche dopo il
        // ricaricamento (non torna a "Nessun profilo orario").
        await expect(
          page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! }).getByLabel('Profilo orario').locator('option:checked')
        ).toHaveText(nome);

        // Rimozione dell'assegnazione.
        const rigaDaAggiornare = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
        await rigaDaAggiornare.getByLabel('Profilo orario').selectOption({ label: 'Nessun profilo orario' });
        await rigaDaAggiornare.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(
          page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! }).getByLabel('Profilo orario')
        ).toHaveValue('');
      } finally {
        // Pulizia del profilo: elimino il profilo, l'utente eventualmente
        // ancora assegnato resta semplicemente senza profilo (specs/54).
        await page.goto('/admin/profili-orari');
        const rigaProfilo = page.getByText(nome, { exact: false });
        if ((await rigaProfilo.count()) > 0) {
          await rigaProfilo.click();
          await page.waitForURL(/\/admin\/profili-orari\/.+/);
          await page.getByRole('button', { name: 'Elimina profilo orario' }).click();
          await page.getByRole('button', { name: 'Sì' }).click();
        }
      }
    });

    test('creare un utente scegliendo subito un profilo orario', async ({ page }) => {
      const nomeProfilo = `E2E creazione ${Date.now()}`;
      const email = `e2e-profilo-orario-${Date.now()}@example.com`;

      await page.goto('/admin/profili-orari');
      await page.getByPlaceholder('Nome (es. 35 ore settimanali)').fill(nomeProfilo);
      await page.getByLabel('Lunedì').fill('6');
      await page.getByLabel('Martedì').fill('6');
      await page.getByLabel('Mercoledì').fill('6');
      await page.getByLabel('Giovedì').fill('6');
      await page.getByLabel('Venerdì').fill('6');
      await page.getByRole('button', { name: 'Crea profilo orario' }).click();
      await expect(page.getByText(nomeProfilo, { exact: false })).toBeVisible({ timeout: 20_000 });

      try {
        await page.goto('/admin/maestre');
        const formCreazione = page.locator('form', { has: page.getByRole('button', { name: 'Crea utente' }) });

        await page.getByPlaceholder('Nome').first().fill('Prova');
        await page.getByPlaceholder('Cognome').first().fill('ProfiloOrario');
        await page.getByPlaceholder('Email').fill(email);
        await page.getByPlaceholder('Telefono').first().fill('3331234567');
        await page.getByLabel('Password', { exact: true }).fill('PasswordE2E!1');
        await page.getByLabel('Conferma password').fill('PasswordE2E!1');
        await formCreazione.getByLabel('Profilo orario').selectOption({ label: nomeProfilo });
        await page.getByRole('button', { name: 'Crea utente' }).click();

        const riga = page.getByText(email, { exact: false }).locator('..');
        await expect(riga).toBeVisible({ timeout: 20_000 });
        await expect(riga.getByLabel('Profilo orario')).not.toHaveValue('');

        await eliminaUtenteDaScheda(page, riga);
        await expect(page.getByText(email, { exact: false })).toHaveCount(0);
      } finally {
        await page.goto('/admin/profili-orari');
        const rigaProfilo = page.getByText(nomeProfilo, { exact: false });
        if ((await rigaProfilo.count()) > 0) {
          await rigaProfilo.click();
          await page.waitForURL(/\/admin\/profili-orari\/.+/);
          await page.getByRole('button', { name: 'Elimina profilo orario' }).click();
          await page.getByRole('button', { name: 'Sì' }).click();
        }
      }
    });

    test('accesso negato a chi non è admin', async ({ browser }) => {
      for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
        test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
        const stato = statoAutenticazione(ruolo);
        test.skip(!stato, `sessione non disponibile per ${ruolo}`);

        const context = await browser.newContext({ storageState: stato });
        const page = await context.newPage();
        await page.goto('/admin/profili-orari');
        await page.waitForURL('/dashboard', { timeout: 20_000 });
        await context.close();
      }
    });
  });

  // Pannello staff (issue #92): ogni test crea un utente temporaneo con
  // cui fare login (contesto separato, nessuna sessione condivisa), così
  // non contende i flag "Ore di lavoro" / "Profilo orario" degli account
  // fissi (admin, maestra) già toccati da 17/18 in parallelo. L'utente e
  // l'eventuale profilo orario sono eliminati a fine test.
  test.describe('pannello staff: il proprio profilo orario', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    const PASSWORD = 'PasswordE2E!1';

    async function creaProfilo(page: Page, nome: string) {
      await page.goto('/admin/profili-orari');
      await page.getByPlaceholder('Nome (es. 35 ore settimanali)').fill(nome);
      await page.getByLabel('Lunedì').fill('7');
      await page.getByLabel('Martedì').fill('6.5');
      await page.getByLabel('Mercoledì').fill('7');
      await page.getByLabel('Giovedì').fill('4');
      await page.getByLabel('Venerdì').fill('3');
      await page.getByRole('button', { name: 'Crea profilo orario' }).click();
      await expect(page.getByText(nome, { exact: false })).toBeVisible({ timeout: 20_000 });
    }

    async function eliminaProfilo(page: Page, nome: string) {
      await page.goto('/admin/profili-orari');
      const rigaProfilo = page.getByText(nome, { exact: false });
      if ((await rigaProfilo.count()) > 0) {
        await rigaProfilo.click();
        await page.waitForURL(/\/admin\/profili-orari\/.+/);
        await page.getByRole('button', { name: 'Elimina profilo orario' }).click();
        await page.getByRole('button', { name: 'Sì' }).click();
      }
    }

    async function creaUtente(page: Page, email: string, opzioni: { abilitato: boolean; profilo?: string }) {
      await page.goto('/admin/maestre');
      const formCreazione = page.locator('form', { has: page.getByRole('button', { name: 'Crea utente' }) });
      await page.getByPlaceholder('Nome').first().fill('Prova');
      await page.getByPlaceholder('Cognome').first().fill('PannelloProfilo');
      await page.getByPlaceholder('Email').fill(email);
      await page.getByPlaceholder('Telefono').first().fill('3331234567');
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await page.getByLabel('Conferma password').fill(PASSWORD);
      if (opzioni.abilitato) await formCreazione.getByLabel('Ore di lavoro').check();
      if (opzioni.profilo) await formCreazione.getByLabel('Profilo orario').selectOption({ label: opzioni.profilo });
      await page.getByRole('button', { name: 'Crea utente' }).click();
      await expect(page.getByText(email, { exact: false })).toBeVisible({ timeout: 20_000 });
    }

    async function eliminaUtente(page: Page, email: string) {
      await page.goto('/admin/maestre');
      const riga = page.getByText(email, { exact: false }).locator('..');
      if ((await riga.count()) > 0) {
        await eliminaUtenteDaScheda(page, riga);
        await expect(page.getByText(email, { exact: false })).toHaveCount(0);
      }
    }

    // Apre una sessione separata come l'utente appena creato.
    async function paginaComeUtente(browser: Browser, baseURL: string | undefined, email: string) {
      const contesto = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      const pagina = await contesto.newPage();
      await pagina.goto('/login');
      await pagina.getByLabel('Email').fill(email);
      await pagina.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await pagina.getByRole('button', { name: 'Accedi' }).click();
      await pagina.waitForURL('/dashboard', { timeout: 20_000 });
      return { contesto, pagina };
    }

    test('utente abilitato con profilo assegnato: dal report ore al pannello in sola lettura', async ({
      page,
      browser,
      baseURL,
    }) => {
      const nomeProfilo = `E2E pannello ${Date.now()}`;
      const email = `e2e-pannello-profilo-${Date.now()}@example.com`;
      await creaProfilo(page, nomeProfilo);
      try {
        await creaUtente(page, email, { abilitato: true, profilo: nomeProfilo });
        const { contesto, pagina } = await paginaComeUtente(browser, baseURL, email);
        try {
          await pagina.goto('/dashboard/ore-lavoro');
          await pagina.getByRole('link', { name: 'Il mio profilo orario' }).click();
          await pagina.waitForURL('/dashboard/profilo-orario');

          await expect(pagina.getByRole('heading', { name: 'Il mio profilo orario' })).toBeVisible();
          const main = pagina.getByRole('main');
          await expect(main.getByText(nomeProfilo, { exact: false })).toBeVisible();
          for (const giorno of ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì']) {
            await expect(main.getByText(giorno, { exact: true })).toBeVisible();
          }
          await expect(main.getByText('6.5h', { exact: true })).toBeVisible();
          // Totale: 7 + 6.5 + 7 + 4 + 3
          await expect(main.getByText('27.5h', { exact: true })).toBeVisible();
          // Sola lettura: nessun pulsante né campo nel contenuto della pagina.
          await expect(main.getByRole('button')).toHaveCount(0);
          await expect(main.getByRole('textbox')).toHaveCount(0);
          await nessunaViolazioneA11yGrave(pagina);
        } finally {
          await contesto.close();
        }
      } finally {
        await eliminaUtente(page, email);
        await eliminaProfilo(page, nomeProfilo);
      }
    });

    test('utente abilitato senza profilo assegnato: messaggio chiaro', async ({ page, browser, baseURL }) => {
      const email = `e2e-pannello-senza-${Date.now()}@example.com`;
      try {
        await creaUtente(page, email, { abilitato: true });
        const { contesto, pagina } = await paginaComeUtente(browser, baseURL, email);
        try {
          await pagina.goto('/dashboard/profilo-orario');
          await expect(pagina.getByRole('heading', { name: 'Il mio profilo orario' })).toBeVisible();
          await expect(pagina.getByText('Nessun profilo orario assegnato')).toBeVisible();
          await expect(pagina.getByText(/chiedi all.admin/)).toBeVisible();
          await expect(pagina.getByRole('main').getByRole('button')).toHaveCount(0);
          await nessunaViolazioneA11yGrave(pagina);
        } finally {
          await contesto.close();
        }
      } finally {
        await eliminaUtente(page, email);
      }
    });

    test('utente non abilitato al report ore: reindirizzato alla dashboard', async ({ page, browser, baseURL }) => {
      const email = `e2e-pannello-nonabil-${Date.now()}@example.com`;
      try {
        await creaUtente(page, email, { abilitato: false });
        const { contesto, pagina } = await paginaComeUtente(browser, baseURL, email);
        try {
          await pagina.goto('/dashboard/profilo-orario');
          await pagina.waitForURL('/dashboard', { timeout: 20_000 });
        } finally {
          await contesto.close();
        }
      } finally {
        await eliminaUtente(page, email);
      }
    });
  });
});
