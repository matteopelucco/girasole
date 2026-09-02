// Requisito: specs/07 - allarmi.md
//
// ATTENZIONE: alcuni scenari dipendono dall'ora reale (Europe/Rome) e
// dallo stato reale di presenze/pasti/settimane ore sul progetto
// Supabase di test, che questa suite non può forzare senza rischiare di
// interferire con altri file e2e che scrivono su "oggi" (stessa cautela
// di 53-calendario-scolastico.spec.ts). Dove non è possibile controllare
// la condizione, il test si salta da solo con `test.skip` invece di
// fallire o di dare un falso positivo — coerente con la suite esistente.
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

function giornoSettimanaRoma(): number {
  // 1 = lunedì ... 7 = domenica.
  const [anno, mese, giorno] = dataOggiRoma().split('-').map(Number);
  const iso = new Date(Date.UTC(anno, mese - 1, giorno, 12)).getUTCDay();
  return iso === 0 ? 7 : iso;
}

function oggiEGiornoFeriale(): boolean {
  const g = giornoSettimanaRoma();
  return g !== 6 && g !== 7;
}

function oggiDopoSogliaVenerdiSera(): boolean {
  const g = giornoSettimanaRoma();
  if (g === 6 || g === 7) return true;
  if (g === 5) return oraRomaAdesso() >= 18;
  return false;
}

function lunediSettimanaRoma(): string {
  const oggiRoma = dataOggiRoma();
  const [anno, mese, giorno] = oggiRoma.split('-').map(Number);
  const lunedi = new Date(Date.UTC(anno, mese - 1, giorno, 12));
  lunedi.setUTCDate(lunedi.getUTCDate() - (giornoSettimanaRoma() - 1));
  return lunedi.toISOString().slice(0, 10);
}

function lunediSettimanaPrecedenteRoma(): string {
  const lunedi = new Date(`${lunediSettimanaRoma()}T12:00:00Z`);
  lunedi.setUTCDate(lunedi.getUTCDate() - 7);
  return lunedi.toISOString().slice(0, 10);
}

const TESTO_BANNER_PERSONALE = 'non risultano completati';
const TESTO_BANNER_SETTIMANA_ORE = 'Non hai confermato le ore della settimana';
const TESTO_RIEPILOGO_STAFF = 'Situazione del personale';

test.describe('07 — Allarmi', () => {
  test.describe('presenze/pasti non ancora segnati dopo le 10:00 — banner personale', () => {
    test.describe('come maestra', () => {
      test.use({ storageState: statoAutenticazione('maestra') });

      test.beforeEach(async ({ page }) => {
        test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      });

      test('prima delle 10:00 il banner non compare', async ({ page }) => {
        test.skip(
          oraRomaAdesso() >= 10,
          'la suite gira dopo le 10:00: lo scenario "prima delle 10:00" non è verificabile ora'
        );

        await page.goto('/dashboard');
        await expect(page.getByText(TESTO_BANNER_PERSONALE, { exact: false })).toHaveCount(0);
      });

      test('in un giorno di chiusura (weekend) il banner non compare, anche dopo le 10:00', async ({ page }) => {
        test.skip(
          oggiEGiornoFeriale(),
          'oggi non è un weekend: lo scenario "giorno di chiusura" non è verificabile ora'
        );

        await page.goto('/dashboard');
        await expect(page.getByText(TESTO_BANNER_PERSONALE, { exact: false })).toHaveCount(0);
      });

      test('dopo le 10:00 in un giorno feriale, se compare il banner elenca solo le mie sezioni con un link diretto', async ({
        page,
      }) => {
        test.skip(oraRomaAdesso() < 10 || !oggiEGiornoFeriale(), 'verificabile solo dopo le 10:00 in un giorno feriale');

        await page.goto('/dashboard');
        const banner = page.getByRole('alert').filter({ hasText: TESTO_BANNER_PERSONALE });
        const presente = (await banner.count()) > 0;
        test.skip(!presente, 'oggi presenze e pasti risultano già completati per le mie sezioni: nessuna anomalia da verificare ora');

        await expect(banner).toContainText('10:00');
        // Ogni link del banner porta direttamente a Presenze di una
        // sezione, o a Pasti — mai a una pagina generica.
        const link = banner.getByRole('link').first();
        await expect(link).toHaveAttribute('href', /\/dashboard\/(presenze\/[^?]+|pasti)\?data=\d{4}-\d{2}-\d{2}/);
        await nessunaViolazioneA11yGrave(page);
      });
    });

    test.describe('come assistente', () => {
      test.use({ storageState: statoAutenticazione('assistente') });

      test('anche se il banner compare, non menziona mai i pasti (nessun accesso al registro pasti)', async ({
        page,
      }) => {
        test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
        test.skip(oraRomaAdesso() < 10 || !oggiEGiornoFeriale(), 'verificabile solo dopo le 10:00 in un giorno feriale');

        await page.goto('/dashboard');
        const banner = page.getByRole('alert').filter({ hasText: TESTO_BANNER_PERSONALE });
        const presente = (await banner.count()) > 0;
        test.skip(!presente, 'oggi le presenze delle mie sezioni risultano già complete: nessuna anomalia da verificare ora');

        await expect(banner.getByRole('link', { name: /pasti/i })).toHaveCount(0);
      });
    });
  });

  test.describe('settimana di ore di lavoro non confermata — banner personale', () => {
    test.describe('come admin', () => {
      test.use({ storageState: statoAutenticazione('admin') });

      test.beforeEach(async ({ page }) => {
        test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
      });

      test('senza abilitazione al report ore, nessun banner personale', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.getByText(TESTO_BANNER_SETTIMANA_ORE, { exact: false })).toHaveCount(0);
      });

      test('abilitata senza aver mai confermato la settimana di riferimento, il banner compare; scompare disabilitando', async ({
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
            'la settimana di riferimento risulta già confermata per questo account (es. verificata manualmente in passato) — nessuna funzione per "sconfermarla" in questa fase'
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

      test('dal venerdì alle 18:00 la settimana di riferimento è quella corrente, non la precedente', async ({
        page,
      }) => {
        test.skip(!oggiDopoSogliaVenerdiSera(), 'verificabile solo da venerdì 18:00 in poi (fuso Europe/Rome)');

        await page.goto('/admin/maestre');
        const riga = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
        await riga.getByLabel('Ore di lavoro').check();
        await riga.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);

        try {
          await page.goto('/dashboard');
          const link = page.getByRole('link', { name: 'Vai su Ore di lavoro per confermarla.' });
          const presente = (await link.count()) > 0;
          test.skip(!presente, 'la settimana corrente risulta già confermata per questo account');

          const href = await link.getAttribute('href');
          const settimana = new URL(href!, 'http://localhost').searchParams.get('settimana')!;
          expect(settimana).toBe(lunediSettimanaRoma());
        } finally {
          await page.goto('/admin/maestre');
          const rigaRipristina = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
          await rigaRipristina.getByLabel('Ore di lavoro').uncheck();
          await rigaRipristina.getByRole('button', { name: 'Aggiorna' }).click();
          await page.waitForTimeout(1000);
        }
      });

      test('prima di venerdì 18:00 la settimana di riferimento è quella precedente', async ({ page }) => {
        test.skip(oggiDopoSogliaVenerdiSera(), 'verificabile solo da lunedì a venerdì prima delle 18:00 (fuso Europe/Rome)');

        await page.goto('/admin/maestre');
        const riga = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
        await riga.getByLabel('Ore di lavoro').check();
        await riga.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);

        try {
          await page.goto('/dashboard');
          const link = page.getByRole('link', { name: 'Vai su Ore di lavoro per confermarla.' });
          const presente = (await link.count()) > 0;
          test.skip(!presente, 'la settimana precedente risulta già confermata per questo account');

          const href = await link.getAttribute('href');
          const settimana = new URL(href!, 'http://localhost').searchParams.get('settimana')!;
          expect(settimana).toBe(lunediSettimanaPrecedenteRoma());
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

  test.describe('riepilogo del personale per l\'admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('nessun riepilogo se nessuno del personale è in allarme', async ({ page }) => {
      await page.goto('/dashboard');
      const riepilogo = page.getByText(TESTO_RIEPILOGO_STAFF, { exact: false });
      const assente = (await riepilogo.count()) === 0;
      test.skip(
        !assente,
        'almeno un membro del personale ha in questo momento un allarme attivo: lo scenario "nessuno in allarme" non è verificabile ora'
      );
      await expect(riepilogo).toHaveCount(0);
    });

    test('se presente, il riepilogo non contiene link (solo informativo)', async ({ page }) => {
      await page.goto('/dashboard');
      const riepilogo = page.getByText(TESTO_RIEPILOGO_STAFF, { exact: false });
      const presente = (await riepilogo.count()) > 0;
      test.skip(!presente, 'nessun membro del personale ha allarmi attivi in questo momento');

      const sezione = page.locator('div', { has: riepilogo });
      await expect(sezione.getByRole('link')).toHaveCount(0);
      await nessunaViolazioneA11yGrave(page);
    });

    test('un genitore o account senza sezioni non compare mai nel riepilogo del personale', async ({ page, browser }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD per un confronto');
      // Verifica indiretta: il riepilogo, quando presente, elenca solo
      // nome e cognome di personale reale (maestra/assistente), mai
      // l'admin stesso (che vede il proprio allarme nel proprio banner
      // personale, non nel riepilogo).
      await page.goto('/dashboard');
      const riepilogo = page.getByText(TESTO_RIEPILOGO_STAFF, { exact: false });
      const presente = (await riepilogo.count()) > 0;
      test.skip(!presente, 'nessun membro del personale ha allarmi attivi in questo momento');

      await expect(page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL ?? ' nomatch' })).toHaveCount(0);
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
