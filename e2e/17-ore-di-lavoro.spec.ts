// Requisito: specs/17 - ore-di-lavoro.md
//
// Dati propri (issue #230): il test di abilitazione non tocca il flag
// abilitato_ore_lavoro degli account condivisi (admin, maestra) ma quello di
// un utente creato apposta ed eliminato a fine test (e2e/fixture-utente.ts):
// per questo i test che verificano "senza abilitazione" sugli account
// condivisi non possono più essere disturbati da un altro test in parallelo.
import { test, expect } from './fixture-utente';
import { eliminaUtenteDaScheda, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';
import {
  PERCORSO_ORE_LAVORO,
  PERCORSO_UTENTI,
  cardOreLavoro,
  creaUtenteDaForm,
  impostaOreLavoro,
  rigaUtente,
  schedaUtente,
  spuntaOreLavoro,
  titoloOreLavoro,
} from './pagina-personale';

test.describe('17 — Ore di lavoro', () => {
  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('senza abilitazione: nessuna card in dashboard e accesso diretto reindirizza alla dashboard', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await expect(cardOreLavoro(page)).toHaveCount(0);

      await page.goto(PERCORSO_ORE_LAVORO);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    // Dati propri (issue #230): l'abilitazione si prova su un utente admin
    // creato apposta (e2e/fixture-utente.ts), non sull'account admin condiviso,
    // così nessun altro test vede mai il flag acceso.
    test('abilitare/disabilitare un utente esistente mostra/nasconde la card e la sezione, che non ha alcuna form', async ({
      creaUtente,
      apriComeUtente,
    }) => {
      const utente = await creaUtente({ ruolo: 'admin' });
      const page = await apriComeUtente(utente);

      await page.goto(PERCORSO_UTENTI);

      // Abilitazione: la spunta resta visibile riaprendo la pagina, la
      // card compare in dashboard e apre la sezione dedicata (il
      // contenuto vero e proprio — tabella settimanale, conferma,
      // malattia/assenza — è testato in dettaglio in
      // 18-report-ore-lavoro.spec.ts, non qui).
      await impostaOreLavoro(page, utente.email, true);
      await page.reload();
      await expect(spuntaOreLavoro(rigaUtente(page, utente.email))).toBeChecked();

      await page.goto('/dashboard');
      const link = cardOreLavoro(page);
      await expect(link).toBeVisible();
      await expect(link).toContainText('🕒');

      await link.click();
      await page.waitForURL('/dashboard/ore-lavoro');
      await expect(titoloOreLavoro(page)).toBeVisible();

      await nessunaViolazioneA11yGrave(page);

      // Disabilitazione: la card sparisce e l'accesso diretto reindirizza.
      await page.goto(PERCORSO_UTENTI);
      await impostaOreLavoro(page, utente.email, false);
      await page.reload();
      await expect(spuntaOreLavoro(rigaUtente(page, utente.email))).not.toBeChecked();

      await page.goto('/dashboard');
      await expect(cardOreLavoro(page)).toHaveCount(0);
      await page.goto(PERCORSO_ORE_LAVORO);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    test('creazione di un utente con abilitazione al report ore già attiva', async ({ page }) => {
      const email = `e2e-ore-lavoro-${Date.now()}@example.com`;

      await creaUtenteDaForm(page, {
        nome: 'Prova',
        cognome: 'OreLavoro',
        email,
        password: 'PasswordE2E!1',
        oreLavoro: true,
      });

      const riga = schedaUtente(page, email);
      await expect(riga).toBeVisible({ timeout: 20_000 });
      await expect(spuntaOreLavoro(riga)).toBeChecked();

      await eliminaUtenteDaScheda(page, riga);
      await expect(page.getByText(email, { exact: false })).toHaveCount(0);
    });
  });

  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('senza abilitazione non vede la card "Ore di lavoro"', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');
      await expect(cardOreLavoro(page)).toHaveCount(0);
    });
  });
});
