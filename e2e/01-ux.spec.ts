// Requisito: specs/01 - ux.md
import { test, expect, type Page } from '@playwright/test';
import { colonnaPasto, dataOggiRoma, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

const MOBILE = { width: 375, height: 812 }; // priorità dichiarata nel requisito

async function nessunOverflowOrizzontale(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
}

test.describe('01 — UX/UI', () => {
  test.describe('login (mobile)', () => {
    test.use({ viewport: MOBILE });

    test('login è usabile a larghezza mobile, senza overflow orizzontale', async ({ page }) => {
      await page.goto('/login');

      expect(await nessunOverflowOrizzontale(page)).toBe(false);

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('dashboard maestra (mobile)', () => {
    test.use({ viewport: MOBILE, storageState: statoAutenticazione('maestra') });

    test('dashboard è usabile a larghezza mobile: azioni a un tap', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');

      expect(await nessunOverflowOrizzontale(page)).toBe(false);
      // Niente selettore di data in dashboard (specs/12): "Presenze e
      // pasti" è raggiungibile con un solo tap sulla sua scheda.
      await expect(page.getByLabel('Data')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Presenze e pasti' })).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('flusso "Presenze e pasti", sezione presenza (mobile)', () => {
    test.use({ viewport: MOBILE, storageState: statoAutenticazione('maestra') });

    test('elenco bambini per sezione resta usabile a larghezza mobile', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      // Navigazione a 2 livelli (specs/12, v0.39.0): la pagina mostra
      // direttamente i bambini raggruppati per sezione, senza un elenco
      // classi intermedio da cliccare.
      await page.goto(`/dashboard/giornata?data=${dataOggiRoma()}`);
      expect(await nessunOverflowOrizzontale(page)).toBe(false);

      // Gli stati si impostano con un bottone diretto, non con menu a
      // tendina o form multi-step (vedi 01 - ux.md).
      const primoBottone = page.getByRole('button', { name: 'Presente' }).first();
      test.skip((await primoBottone.count()) === 0, 'nessun bambino visibile per questo account');
      await expect(primoBottone).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('barra di caricamento durante la navigazione', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('compare al click su un link e scompare quando la nuova pagina è pronta', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      // La richiesta di navigazione vera (quella del click, senza header
      // `next-router-prefetch`) viene tenuta in sospeso e rilasciata
      // esplicitamente dal test: la barra si osserva finché la richiesta
      // è ferma, senza dipendere da un ritardo fisso né dalla velocità
      // del runner. Il prefetch dei link (Next.js in produzione) NON va
      // abortito: un prefetch fallito resta nella cache del router e il
      // click successivo diventa una navigazione nativa a pagina intera
      // (nessuna richiesta `_rsc`), durante la quale `expect` aspetta la
      // fine della navigazione e trova la nuova pagina senza barra
      // (issue #196). Lo lascio quindi passare invariato. Il route va
      // installato prima di aprire la dashboard, perché il prefetch
      // parte appena i link sono visibili.
      let rilasciaNavigazione!: () => void;
      const navigazioneRilasciata = new Promise<void>((resolve) => {
        rilasciaNavigazione = resolve;
      });
      await page.route('**/dashboard/giornata**', async (route) => {
        if (!route.request().headers()['next-router-prefetch']) {
          await navigazioneRilasciata;
        }
        await route.continue();
      });

      await page.goto('/dashboard');
      const barra = page.getByRole('status', { name: 'Caricamento in corso' });
      await expect(barra).toHaveCount(0);

      const linkGiornata = page.getByRole('link', { name: 'Presenze e pasti' });
      test.skip((await linkGiornata.count()) === 0, 'nessuna sezione assegnata a questo account');

      // Il click prima dell'idratazione sarebbe una navigazione nativa a
      // pagina intera (il listener della barra non esiste ancora) e la
      // barra non comparirebbe mai: in CI, con `next start`, succedeva a
      // caso al primo tentativo (issue #155). Attendo il segnale che il
      // componente espone quando ha installato il listener.
      await expect(page.locator('body')).toHaveAttribute('data-barra-caricamento-pronta', 'true');

      try {
        await linkGiornata.click();
        // La richiesta è ferma: la barra deve essere visibile.
        await expect(barra).toBeVisible();
      } finally {
        // Anche se l'assert fallisce, non lascio il route in sospeso.
        rilasciaNavigazione();
      }

      // Rilasciata la richiesta la nuova pagina arriva e la barra sparisce.
      await page.waitForURL(/\/dashboard\/giornata\?/);
      await expect(barra).toHaveCount(0);
    });
  });

  test.describe('sidebar di navigazione (mobile: drawer)', () => {
    test.use({ viewport: MOBILE, storageState: statoAutenticazione('maestra') });

    test('la sidebar è chiusa di default e si apre/chiude con il pulsante hamburger', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto('/dashboard');

      const sidebar = page.getByRole('link', { name: 'Dashboard' });
      const hamburger = page.getByRole('button', { name: 'Apri il menu' });
      await expect(hamburger).toBeVisible();
      await expect(sidebar).not.toBeInViewport();
      expect(await nessunOverflowOrizzontale(page)).toBe(false);

      await hamburger.click();
      await expect(sidebar).toBeInViewport();
      await nessunaViolazioneA11yGrave(page);

      // "Chiudi il menu" è lo sfondo scuro dietro il drawer (largo 256px):
      // un tap al centro dello schermo cadrebbe sulla sidebar stessa,
      // quindi tocco lo sfondo alla sua destra.
      await page.getByRole('button', { name: 'Chiudi il menu' }).click({ position: { x: 330, y: 400 } });
      await expect(sidebar).not.toBeInViewport();
    });
  });

  test.describe('sidebar di navigazione (desktop)', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('è sempre visibile e mostra le voci di amministrazione, con quella corrente evidenziata', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      await page.goto('/admin');

      // Da schermo lg in su niente hamburger: la sidebar è sempre in vista.
      await expect(page.getByRole('button', { name: 'Apri il menu' })).toBeHidden();
      for (const voce of [
        'Dashboard',
        'Sezioni e bambini',
        'Utenti',
        'Calendario scolastico',
        'Profili orari',
        'Ore di lavoro del personale',
      ]) {
        await expect(page.getByRole('link', { name: voce })).toBeVisible();
      }

      await expect(page.getByRole('link', { name: 'Sezioni e bambini' })).toHaveAttribute(
        'aria-current',
        'page'
      );

      expect(await nessunOverflowOrizzontale(page)).toBe(false);
      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('flusso "Presenze e pasti", sezione pasto (mobile)', () => {
    test.use({ viewport: MOBILE, storageState: statoAutenticazione('maestra') });

    test('elenco bambini per sezione resta usabile a larghezza mobile', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto(`/dashboard/giornata?data=${dataOggiRoma()}`);
      expect(await nessunOverflowOrizzontale(page)).toBe(false);
      const primoBottone = colonnaPasto(page).getByRole('button', { name: 'Sì' }).first();
      test.skip((await primoBottone.count()) === 0, 'nessun bambino con Sì/No disponibili per questo account');
      await expect(primoBottone).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });
  });
});
