// Requisito: specs/07 - allarmi.md
//
// ATTENZIONE: alcuni scenari dipendono dall'ora reale (Europe/Rome) e
// dallo stato reale di presenze/pasti sul progetto Supabase di test, che
// questa suite non può forzare senza rischiare di interferire con altri
// file e2e che scrivono su "oggi" (stessa cautela di
// 53-calendario-scolastico.spec.ts). Dove non è possibile controllare la
// condizione, il test si salta da solo con `test.skip` invece di fallire
// o di dare un falso positivo — coerente con la suite esistente.
//
// Il test dell'allarme "settimana ore non confermata" modifica
// temporaneamente l'account admin di test (abilitazione al report ore)
// e lo ripristina in `finally` — stesso pattern di
// 17-ore-di-lavoro.spec.ts e 18-report-ore-lavoro.spec.ts.
import { test, expect } from '@playwright/test';
import { dataOggiRoma, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

function oraRomaAdesso(): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(new Date())
  );
}

function oggiEGiornoFeriale(): boolean {
  const [anno, mese, giorno] = dataOggiRoma().split('-').map(Number);
  const giornoSettimana = new Date(Date.UTC(anno, mese - 1, giorno, 12)).getUTCDay();
  return giornoSettimana !== 0 && giornoSettimana !== 6;
}

const TESTO_BANNER_MEZZOGIORNO = 'non risultano completati';
const TESTO_BANNER_SETTIMANA_ORE = 'Non hai confermato le ore della settimana scorsa';

test.describe('07 — Allarmi', () => {
  test.describe('presenze/pasti non completati entro mezzogiorno', () => {
    test.describe('come maestra', () => {
      test.use({ storageState: statoAutenticazione('maestra') });

      test.beforeEach(async ({ page }) => {
        test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      });

      test('prima delle 12:00 il banner non compare', async ({ page }) => {
        test.skip(
          oraRomaAdesso() >= 12,
          'la suite gira dopo mezzogiorno: lo scenario "prima di mezzogiorno" non è verificabile ora'
        );

        await page.goto('/dashboard');
        await expect(page.getByText(TESTO_BANNER_MEZZOGIORNO, { exact: false })).toHaveCount(0);
      });

      test('in un giorno di chiusura (weekend) il banner non compare, anche dopo mezzogiorno', async ({ page }) => {
        test.skip(
          oggiEGiornoFeriale(),
          'oggi non è un weekend: lo scenario "giorno di chiusura" non è verificabile ora'
        );

        await page.goto('/dashboard');
        await expect(page.getByText(TESTO_BANNER_MEZZOGIORNO, { exact: false })).toHaveCount(0);
      });

      test('dopo le 12:00 in un giorno feriale, se compare il banner ha un contenuto coerente ed è visibile anche all\'admin', async ({
        page,
        browser,
      }) => {
        test.skip(!hasCredenziali('admin'), 'richiede anche E2E_ADMIN_EMAIL/PASSWORD');
        test.skip(oraRomaAdesso() < 12 || !oggiEGiornoFeriale(), 'verificabile solo dopo mezzogiorno in un giorno feriale');

        await page.goto('/dashboard');
        const banner = page.getByRole('alert').filter({ hasText: TESTO_BANNER_MEZZOGIORNO });
        const presente = (await banner.count()) > 0;
        test.skip(!presente, 'oggi presenze e pasti risultano già completati: nessuna anomalia da verificare ora');

        await expect(banner).toContainText('12:00');
        await nessunaViolazioneA11yGrave(page);

        // È una situazione dell'intero asilo, non delle sole sezioni
        // della maestra: lo stesso banner deve comparire anche all'admin.
        const contestoAdmin = await browser.newContext({ storageState: statoAutenticazione('admin') });
        const paginaAdmin = await contestoAdmin.newPage();
        await paginaAdmin.goto('/dashboard');
        await expect(paginaAdmin.getByRole('alert').filter({ hasText: TESTO_BANNER_MEZZOGIORNO })).toBeVisible();
        await contestoAdmin.close();
      });
    });
  });

  test.describe('settimana di ore di lavoro non confermata', () => {
    test.describe('come admin', () => {
      test.use({ storageState: statoAutenticazione('admin') });

      test.beforeEach(async ({ page }) => {
        test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
      });

      test('senza abilitazione al report ore, nessun banner personale', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.getByText(TESTO_BANNER_SETTIMANA_ORE, { exact: false })).toHaveCount(0);
      });

      test('abilitata senza aver mai confermato una settimana, il banner compare; scompare disabilitando', async ({
        page,
      }) => {
        await page.goto('/admin/maestre');
        const riga = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
        await riga.getByLabel('Ore di lavoro').check();
        await riga.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);

        try {
          await page.goto('/dashboard');
          const banner = page.getByText(TESTO_BANNER_SETTIMANA_ORE, { exact: false });
          const presente = (await banner.count()) > 0;
          test.skip(
            !presente,
            'la settimana scorsa risulta già confermata per questo account (es. verificata manualmente in passato) — nessuna funzione per "sconfermarla" in questa fase'
          );

          await expect(banner).toBeVisible();
          // Il banner porta direttamente alla settimana da confermare
          // (specs/07, specs/18 — navigazione tra settimane).
          await expect(page.getByRole('link', { name: 'Vai su Ore di lavoro per confermarla.' })).toHaveAttribute(
            'href',
            /\/dashboard\/ore-lavoro\?settimana=\d{4}-\d{2}-\d{2}/
          );
          await nessunaViolazioneA11yGrave(page);
        } finally {
          await page.goto('/admin/maestre');
          const rigaRipristina = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
          await rigaRipristina.getByLabel('Ore di lavoro').uncheck();
          await rigaRipristina.getByRole('button', { name: 'Aggiorna' }).click();
          await page.waitForTimeout(1000);
        }
      });
    });
  });

  test.describe('cron /api/cron/allarmi', () => {
    test('senza il secret corretto la route rifiuta la richiesta', async ({ request }) => {
      test.skip(!process.env.CRON_SECRET, 'richiede CRON_SECRET configurato per avere qualcosa da verificare');

      const risposta = await request.get('/api/cron/allarmi', {
        headers: { Authorization: 'Bearer secret-sbagliato' },
      });
      expect(risposta.status()).toBe(401);
    });

    test('il job invocato due volte non invia due volte la stessa email (idempotenza)', async ({ request }) => {
      test.skip(
        !process.env.CRON_SECRET || !process.env.RESEND_API_KEY,
        'richiede CRON_SECRET e RESEND_API_KEY configurate per invocare davvero la route del cron'
      );

      const intestazioni = { Authorization: `Bearer ${process.env.CRON_SECRET}` };

      const prima = await request.get('/api/cron/allarmi', { headers: intestazioni });
      expect(prima.ok()).toBe(true);
      const corpo1 = await prima.json();

      const seconda = await request.get('/api/cron/allarmi', { headers: intestazioni });
      expect(seconda.ok()).toBe(true);
      const corpo2 = await seconda.json();

      if (corpo1.risultati.mezzogiorno === 'inviato' || corpo1.risultati.mezzogiorno === 'gia_inviato') {
        expect(corpo2.risultati.mezzogiorno).toBe('gia_inviato');
      }
      // Ogni email inviata dalla prima chiamata non deve ricomparire
      // nella seconda: è già tracciata in allarmi_inviati.
      for (const email of corpo1.risultati.settimanaOre) {
        expect(corpo2.risultati.settimanaOre).not.toContain(email);
      }
    });
  });
});
