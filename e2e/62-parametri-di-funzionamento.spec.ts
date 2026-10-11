// Requisito: specs/62 - parametri-di-funzionamento.md
//
// Solo navigazione e lettura: nessun dato scritto sul progetto di test. La
// sezione "Variabili d'ambiente" verifica la password dell'admin di test con
// un login usa-e-getta (la sessione di verifica viene chiusa subito con scope
// 'local'): la sessione salvata da auth.setup.ts resta valida.
//
// Nessun valore di variabile viene stampato: i confronti sui valori usano
// booleani (`includes`, `===`), così un fallimento non li scrive nel report.
import { test, expect, type Page } from '@playwright/test';
import {
  clickEAttendiAzione,
  credenziali,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  statoAutenticazione,
} from './helpers';
import { SEGNAPOSTO_VALORE, valoriParametriPresenti } from '../lib/parametriAmbiente';
import { PARAMETRI_VISIBILI } from '../lib/parametriVisibili';

const PERCORSO = '/admin/parametri-funzionamento';

// Valori attesi, letti dallo stesso ambiente del server (in CI il server è
// avviato da Playwright con le stesse variabili; in locale entrambi leggono
// .env.local).
function parametriAttesi() {
  return valoriParametriPresenti(PARAMETRI_VISIBILI, process.env);
}

// Valori abbastanza lunghi da non comparire per caso nella pagina.
function valoriSignificativi() {
  return parametriAttesi().filter((p) => p.valore.length >= 8);
}

// Segreti critici esclusi dalla lista: né i nomi né i valori devono uscire.
const SEGRETI_ESCLUSI = ['SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'RESEND_API_KEY', 'TURNSTILE_SECRET_KEY'];

function celleValore(page: Page) {
  return page.getByTestId('valore-variabile');
}

async function attendiValoriNascosti(page: Page): Promise<void> {
  const n = parametriAttesi().length;
  await expect
    .poll(async () => (await celleValore(page).allTextContents()).map((t) => t.includes(SEGNAPOSTO_VALORE)))
    .toEqual(Array(n).fill(true));
  const testo = (await page.locator('main').textContent()) ?? '';
  for (const p of valoriSignificativi()) {
    expect(testo.includes(p.valore), `il valore di ${p.nome} non deve essere in pagina`).toBe(false);
  }
}

async function verificaPassword(page: Page, password: string): Promise<void> {
  await page.getByRole('button', { name: 'Mostra valori', exact: true }).click();
  await page.getByLabel('La tua password', { exact: true }).fill(password);
  await clickEAttendiAzione(page, page.getByRole('button', { name: 'Verifica e mostra' }));
}

async function rivelaValori(page: Page): Promise<void> {
  await verificaPassword(page, credenziali('admin')!.password);
  await expect(page.getByRole('button', { name: 'Nascondi valori', exact: true })).toBeVisible();
  const attesi = parametriAttesi();
  await expect
    .poll(async () => (await celleValore(page).allTextContents()).map((t, i) => t === attesi[i]?.valore))
    .toEqual(attesi.map(() => true));
}

test.describe('62 — Parametri di funzionamento', () => {
  test.describe('admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('la voce è nel menu sotto "Impostazioni", rientrata, prima di "Utenti"', async ({ page }) => {
      await page.goto('/admin');
      const menu = page.getByRole('navigation');
      const impostazioni = menu.getByRole('link', { name: 'Impostazioni', exact: true });
      const parametri = menu.getByRole('link', { name: 'Parametri di funzionamento', exact: true });
      const utenti = menu.getByRole('link', { name: 'Utenti', exact: true });

      await expect(parametri).toHaveAttribute('href', PERCORSO);
      const y = async (l: typeof parametri) => (await l.boundingBox())!.y;
      const x = async (l: typeof parametri) => (await l.locator('span').first().boundingBox())!.x;
      expect(await y(impostazioni)).toBeLessThan(await y(parametri));
      expect(await y(parametri)).toBeLessThan(await y(utenti));
      expect(await x(parametri)).toBeGreaterThan(await x(impostazioni));
    });

    test('la pagina si apre dal menu e mostra titolo e breve descrizione', async ({ page }) => {
      await page.goto('/admin');
      await page.getByRole('navigation').getByRole('link', { name: 'Parametri di funzionamento', exact: true }).click();
      await page.waitForURL(PERCORSO);

      await expect(page.getByRole('heading', { name: 'Parametri di funzionamento', level: 1 })).toBeVisible();
      await expect(page.getByTestId('descrizione-pagina')).not.toBeEmpty();
      await expect(
        page.getByRole('navigation').getByRole('link', { name: 'Parametri di funzionamento', exact: true })
      ).toHaveAttribute('aria-current', 'page');
      await nessunaViolazioneA11yGrave(page);
    });

    test.describe('variabili d\'ambiente', () => {
      test.beforeEach(async () => {
        test.skip(parametriAttesi().length === 0, 'nessuna variabile della lista configurata in questo ambiente');
      });

      test('la sezione elenca i parametri con i valori nascosti', async ({ page }) => {
        const risposta = await page.goto(PERCORSO);
        expect(risposta?.headers()['cache-control'] ?? '').toContain('no-store');
        // HTML della risposta iniziale, compresi i dati RSC inviati al browser.
        const html = (await risposta?.text()) ?? '';

        await expect(page.getByRole('heading', { name: "Variabili d'ambiente", level: 2 })).toBeVisible();
        await expect(page.getByTestId('descrizione-variabili-ambiente')).not.toBeEmpty();
        await expect(page.getByTestId('nessuna-variabile')).toHaveCount(0);

        const nomi = parametriAttesi().map((p) => p.nome);
        await expect(page.getByTestId('nome-variabile')).toHaveText(nomi);
        expect(nomi).toEqual([...nomi].sort());
        await attendiValoriNascosti(page);
        await expect(page.getByRole('button', { name: 'Mostra valori', exact: true })).toBeVisible();

        for (const p of valoriSignificativi()) {
          expect(html.includes(p.valore), `il valore di ${p.nome} non deve essere nella risposta iniziale`).toBe(false);
        }
        for (const nome of SEGRETI_ESCLUSI) {
          expect(html.includes(nome), `${nome} non deve comparire`).toBe(false);
          const segreto = process.env[nome];
          if (segreto) expect(html.includes(segreto), `il valore di ${nome} non deve comparire`).toBe(false);
        }
        await nessunaViolazioneA11yGrave(page);
      });

      test('con la password sbagliata i valori restano nascosti', async ({ page }) => {
        await page.goto(PERCORSO);
        await verificaPassword(page, `password-sbagliata-${Date.now()}`);

        await expect(page.locator('#verifica-password-parametri').getByRole('alert')).toHaveText('Password non corretta.');
        await expect(page.getByRole('button', { name: 'Mostra valori', exact: true })).toBeVisible();
        await attendiValoriNascosti(page);
      });

      test('con la propria password i valori compaiono in chiaro', async ({ page }) => {
        await page.goto(PERCORSO);
        await rivelaValori(page);
        await nessunaViolazioneA11yGrave(page);

        for (const nome of SEGRETI_ESCLUSI) {
          const segreto = process.env[nome];
          const testo = (await page.locator('main').textContent()) ?? '';
          if (segreto) expect(testo.includes(segreto), `il valore di ${nome} non deve comparire`).toBe(false);
        }

        // La verifica non tocca la sessione con cui l'admin sta navigando.
        const dopo = await page.request.get(PERCORSO);
        expect(dopo.ok()).toBe(true);
        expect(new URL(dopo.url()).pathname).toBe(PERCORSO);
      });

      test('ricaricando la pagina i valori tornano nascosti', async ({ page }) => {
        await page.goto(PERCORSO);
        await rivelaValori(page);

        await page.reload();
        await expect(page.getByRole('button', { name: 'Mostra valori', exact: true })).toBeVisible();
        await expect(page.getByLabel('La tua password', { exact: true })).toHaveCount(0);
        await attendiValoriNascosti(page);
      });

      test('ricliccando il pulsante i valori si nascondono di nuovo', async ({ page }) => {
        await page.goto(PERCORSO);
        await rivelaValori(page);

        await page.getByRole('button', { name: 'Nascondi valori', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Mostra valori', exact: true })).toBeVisible();
        await attendiValoriNascosti(page);
      });
    });
  });

  test('maestra, assistente e genitore non vedono la voce e vengono reindirizzati', async ({ browser }) => {
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);

      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Parametri di funzionamento' })).toHaveCount(0);

      await page.goto(PERCORSO);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await expect(page.getByRole('heading', { name: "Variabili d'ambiente" })).toHaveCount(0);
      await context.close();
    }
  });
});
