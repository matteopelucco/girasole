// Requisito: specs/54 - profili-orari.md
//
// ATTENZIONE: questi test creano/modificano/eliminano davvero profili
// orari (e li assegnano all'account admin di test) sul progetto
// Supabase di test — vedi la nota in 53-calendario-scolastico.spec.ts.
// Ogni profilo creato viene eliminato dallo stesso test, e l'assegnazione
// sull'account admin viene ripristinata a "Nessun profilo orario"
// (try/finally, stesso pattern di 17-ore-di-lavoro.spec.ts).
//
// I selettori di utenti, profili orari e ore di lavoro stanno in
// `e2e/pagina-personale.ts` (issue #250).
import { test, expect, type Browser, type Page } from '@playwright/test';
import { eliminaUtenteDaScheda, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';
import {
  PERCORSO_ORE_LAVORO,
  PERCORSO_PROFILI_ORARI,
  PERCORSO_PROFILO_ORARIO_PERSONALE,
  PERCORSO_UTENTI,
  apriProfiloOrario,
  campoOreProfilo,
  creaProfiloOrario,
  creaUtenteDaForm,
  eliminaProfiloOrarioAperto,
  eliminaProfiloOrarioSeEsiste,
  eliminaUtentePerEmail,
  impostaProfiloOrario,
  rigaProfiloOrario,
  rigaUtente,
  schedaUtente,
  selectProfiloOrario,
  titoloProfiloOrarioPersonale,
} from './pagina-personale';

test.describe('54 — Profili orari', () => {
  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('/admin/profili-orari: elementi presenti + accessibilità', async ({ page }) => {
      await page.goto(PERCORSO_PROFILI_ORARI);
      await expect(page.getByRole('heading', { name: 'Profili orari' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Crea profilo orario' })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('creare un profilo orario lo mostra in elenco con il totale settimanale', async ({ page }) => {
      const nome = `E2E 35 ore ${Date.now()}`;

      const riga = await creaProfiloOrario(page, nome, [7, 7, 7, 7, 7]);
      await expect(page.getByText(/35\s*h\/settimana/)).toBeVisible();

      // Pulizia.
      await apriProfiloOrario(page, riga);
      await eliminaProfiloOrarioAperto(page);
    });

    test('modificare un profilo orario aggiorna nome, ore e totale', async ({ page }) => {
      const nome = `E2E modifica ${Date.now()}`;

      const riga = await creaProfiloOrario(page, nome, [4, 4, 4, 4, 4]);
      await apriProfiloOrario(page, riga);
      await nessunaViolazioneA11yGrave(page);

      await campoOreProfilo(page, 'Venerdì').fill('2');
      await page.getByRole('button', { name: 'Salva modifiche' }).click();
      await expect(page.getByText(/18\s*h\/settimana/)).toBeVisible({ timeout: 20_000 });

      // Resta salvato anche dopo un ricaricamento.
      await page.reload();
      await expect(campoOreProfilo(page, 'Venerdì')).toHaveValue('2');

      // Pulizia.
      await eliminaProfiloOrarioAperto(page);
    });

    test('eliminare un profilo orario lo rimuove dall\'elenco', async ({ page }) => {
      const nome = `E2E elimina ${Date.now()}`;

      const riga = await creaProfiloOrario(page, nome, [3, 3, 3, 3, 3]);
      await apriProfiloOrario(page, riga);

      await eliminaProfiloOrarioAperto(page);
      await expect(rigaProfiloOrario(page, nome)).toHaveCount(0);
    });

    test('assegnare/rimuovere un profilo orario a un utente esistente, e il profilo eliminato lo svuota', async ({
      page,
    }) => {
      const nome = `E2E assegna ${Date.now()}`;
      const emailAdmin = process.env.E2E_ADMIN_EMAIL!;

      await creaProfiloOrario(page, nome, [5, 5, 5, 5, 5]);

      try {
        await page.goto(PERCORSO_UTENTI);
        await impostaProfiloOrario(page, emailAdmin, nome);
        await page.reload();
        // L'opzione selezionata resta quella scelta anche dopo il
        // ricaricamento (non torna a "Nessun profilo orario").
        await expect(selectProfiloOrario(rigaUtente(page, emailAdmin)).locator('option:checked')).toHaveText(nome);

        // Rimozione dell'assegnazione.
        await impostaProfiloOrario(page, emailAdmin, 'Nessun profilo orario');
        await page.reload();
        await expect(selectProfiloOrario(rigaUtente(page, emailAdmin))).toHaveValue('');
      } finally {
        // Pulizia del profilo: elimino il profilo, l'utente eventualmente
        // ancora assegnato resta semplicemente senza profilo (specs/54).
        await eliminaProfiloOrarioSeEsiste(page, nome);
      }
    });

    test('creare un utente scegliendo subito un profilo orario', async ({ page }) => {
      const nomeProfilo = `E2E creazione ${Date.now()}`;
      const email = `e2e-profilo-orario-${Date.now()}@example.com`;

      await creaProfiloOrario(page, nomeProfilo, [6, 6, 6, 6, 6]);

      try {
        await creaUtenteDaForm(page, {
          nome: 'Prova',
          cognome: 'ProfiloOrario',
          email,
          password: 'PasswordE2E!1',
          profiloOrario: nomeProfilo,
        });

        const riga = schedaUtente(page, email);
        await expect(riga).toBeVisible({ timeout: 20_000 });
        await expect(selectProfiloOrario(riga)).not.toHaveValue('');

        await eliminaUtenteDaScheda(page, riga);
        await expect(page.getByText(email, { exact: false })).toHaveCount(0);
      } finally {
        await eliminaProfiloOrarioSeEsiste(page, nomeProfilo);
      }
    });

    test('accesso negato a chi non è admin', async ({ browser }) => {
      for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
        test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
        const stato = statoAutenticazione(ruolo);
        test.skip(!stato, `sessione non disponibile per ${ruolo}`);

        const context = await browser.newContext({ storageState: stato });
        const page = await context.newPage();
        await page.goto(PERCORSO_PROFILI_ORARI);
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

    // Il ruolo predefinito è genitore (nessun accesso allo staff): serve un ruolo staff.
    async function creaUtente(page: Page, email: string, opzioni: { abilitato: boolean; profilo?: string }) {
      await creaUtenteDaForm(page, {
        nome: 'Prova',
        cognome: 'PannelloProfilo',
        email,
        password: PASSWORD,
        ruolo: 'maestra',
        oreLavoro: opzioni.abilitato,
        profiloOrario: opzioni.profilo,
      });
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
      await creaProfiloOrario(page, nomeProfilo, [7, 6.5, 7, 4, 3]);
      try {
        await creaUtente(page, email, { abilitato: true, profilo: nomeProfilo });
        const { contesto, pagina } = await paginaComeUtente(browser, baseURL, email);
        try {
          await pagina.goto(PERCORSO_ORE_LAVORO);
          await pagina.getByRole('link', { name: 'Il mio profilo orario' }).click();
          await pagina.waitForURL(PERCORSO_PROFILO_ORARIO_PERSONALE);

          await expect(titoloProfiloOrarioPersonale(pagina)).toBeVisible();
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
        await eliminaUtentePerEmail(page, email);
        await eliminaProfiloOrarioSeEsiste(page, nomeProfilo);
      }
    });

    test('utente abilitato senza profilo assegnato: messaggio chiaro', async ({ page, browser, baseURL }) => {
      const email = `e2e-pannello-senza-${Date.now()}@example.com`;
      try {
        await creaUtente(page, email, { abilitato: true });
        const { contesto, pagina } = await paginaComeUtente(browser, baseURL, email);
        try {
          await pagina.goto(PERCORSO_PROFILO_ORARIO_PERSONALE);
          await expect(titoloProfiloOrarioPersonale(pagina)).toBeVisible();
          await expect(pagina.getByText('Nessun profilo orario assegnato')).toBeVisible();
          await expect(pagina.getByText(/chiedi all.admin/)).toBeVisible();
          await expect(pagina.getByRole('main').getByRole('button')).toHaveCount(0);
          await nessunaViolazioneA11yGrave(pagina);
        } finally {
          await contesto.close();
        }
      } finally {
        await eliminaUtentePerEmail(page, email);
      }
    });

    test('utente non abilitato al report ore: reindirizzato alla dashboard', async ({ page, browser, baseURL }) => {
      const email = `e2e-pannello-nonabil-${Date.now()}@example.com`;
      try {
        await creaUtente(page, email, { abilitato: false });
        const { contesto, pagina } = await paginaComeUtente(browser, baseURL, email);
        try {
          await pagina.goto(PERCORSO_PROFILO_ORARIO_PERSONALE);
          // goto attende già i redirect: l'URL finale deve essere la dashboard, non il pannello.
          await expect(pagina).toHaveURL(/\/dashboard$/);
          await expect(titoloProfiloOrarioPersonale(pagina)).toHaveCount(0);
        } finally {
          await contesto.close();
        }
      } finally {
        await eliminaUtentePerEmail(page, email);
      }
    });
  });
});
