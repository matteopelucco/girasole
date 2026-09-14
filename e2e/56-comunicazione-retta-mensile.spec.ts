// Requisito: specs/56 - comunicazione-retta-mensile.md
//
// ATTENZIONE: questi test creano davvero bambini sul progetto Supabase
// di test (stesso pattern di 55-costi-bambino.spec.ts). Il test "inviare
// le comunicazioni con un click" invia davvero un'email via Resend
// (solo se RESEND_API_KEY è configurata, come già in
// 52-report-email-automatico.spec.ts) e scrive un record immutabile in
// comunicazioni_retta: usa un indirizzo di dominio "example.com", mai
// un indirizzo reale.
import { test, expect } from '@playwright/test';
import { formCreaBambino, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('56 — Comunicazione retta mensile', () => {
  // "Invia comunicazioni" agisce su TUTTI i bambini attivi idonei del
  // mese corrente (specs/56), non solo su quello creato dal singolo
  // test: con l'esecuzione parallela di default (playwright.config.ts,
  // fullyParallel) un invio scattato da un test potrebbe intercettare
  // anche il bambino "in attesa" creato da un altro test ancora in
  // corso. Esecuzione seriale per evitare l'interferenza (stesso
  // pattern di 06-controllo-consistenza.spec.ts).
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  async function creaBambinoConCosti(
    page: import('@playwright/test').Page,
    opzioni: { email?: string; prezzoMensile?: string; prezzoBuonoPasto?: string } = {}
  ) {
    const cognome = `E2eComRetta${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await page.goto('/admin');
    const form = formCreaBambino(page);
    await page.getByPlaceholder('Nome', { exact: true }).fill('ComRetta');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2021-06-06');
    await page.getByLabel('Sesso').selectOption('F');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const link = page.getByRole('link', { name: new RegExp(cognome) });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await page.waitForURL(/\/admin\/bambini\/.+/);

    if (opzioni.prezzoMensile || opzioni.prezzoBuonoPasto || opzioni.email) {
      await page.getByLabel('Prezzo retta mensile (€)').fill(opzioni.prezzoMensile ?? '0');
      await page.getByLabel('Prezzo buono pasto (€)').fill(opzioni.prezzoBuonoPasto ?? '0');
      if (opzioni.email) await page.getByLabel('Email promemoria retta').fill(opzioni.email);
      await page.getByRole('button', { name: 'Salva costi' }).click();
      await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue(
        opzioni.prezzoMensile ?? '0',
        { timeout: 20_000 }
      );
    }

    return cognome;
  }

  test('tabella di revisione della comunicazione del mese corrente + accessibilità', async ({ page }) => {
    await page.goto('/admin/rette');
    await expect(page.getByRole('heading', { name: /Rette —/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Retta' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Costo pasti' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Conguaglio pasti' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Marca da bollo' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Pre-asilo' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Post-asilo' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Costi extra' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Totale' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('un bambino senza costi o email configurati mostra un avviso invece dei campi', async ({ page }) => {
    const cognome = `E2eComRettaMancante${Date.now()}`;
    await page.goto('/admin');
    const form = formCreaBambino(page);
    await page.getByPlaceholder('Nome', { exact: true }).fill('Mancante');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2021-07-07');
    await page.getByLabel('Sesso').selectOption('F');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();
    await expect(page.getByText(cognome, { exact: false })).toBeVisible({ timeout: 20_000 });

    await page.goto('/admin/rette');
    const riga = page.locator('tr', { hasText: cognome });
    await expect(riga.getByText('Costi o email non configurati', { exact: false })).toBeVisible();
  });

  test('il costo pasti mostrato è proporzionale ai giorni di apertura del mese', async ({ page }) => {
    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-${Date.now()}@example.com`,
      prezzoMensile: '250',
      prezzoBuonoPasto: '5',
    });

    await page.goto('/admin/rette');
    const testoIntestazione = await page.getByText(/Giorni di apertura stimati questo mese: \d+/).textContent();
    const giorniApertura = Number(testoIntestazione?.match(/(\d+)/)?.[1]);
    expect(giorniApertura).toBeGreaterThan(0);

    const costoPastiAtteso = (giorniApertura * 5).toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const riga = page.locator('tr', { hasText: cognome });
    await expect(riga).toContainText(costoPastiAtteso);
  });

  test('un bambino senza presenze registrate il mese precedente ha conguaglio pasti zero', async ({ page }) => {
    // Il calcolo completo (conguaglio negativo proporzionale ai giorni
    // di assenza) è coperto da unit test puri in
    // lib/comunicazioneRetta.test.ts — qui verifichiamo solo che un
    // bambino nuovo, senza presenze pregresse, non generi un conguaglio.
    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-${Date.now()}@example.com`,
      prezzoMensile: '200',
      prezzoBuonoPasto: '5',
    });

    await page.goto('/admin/rette');
    const riga = page.locator('tr', { hasText: cognome });
    const celle = riga.locator('td');
    // Colonne (0-based, il nome bambino è un <th>): 0 Retta, 1 Costo
    // pasti, 2 Conguaglio pasti, 3 Pre-asilo, ...
    await expect(celle.nth(2)).toHaveText('0,00');
  });

  test('inserire un costo extra lo somma al totale mostrato', async ({ page }) => {
    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-${Date.now()}@example.com`,
      prezzoMensile: '200',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    const riga = page.locator('tr', { hasText: cognome });
    await riga.getByLabel(new RegExp(`Costi extra per.*${cognome}`)).fill('15');

    // Il totale in pagina non ricalcola dal vivo (specs/56): verifichiamo
    // solo che il campo accetti il valore, l'effetto reale sul totale è
    // verificato dopo l'invio nel test successivo.
    await expect(riga.getByLabel(new RegExp(`Costi extra per.*${cognome}`))).toHaveValue('15');
  });

  test('inviare le comunicazioni con un click registra il log e mostra "Inviata"', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-invio-${Date.now()}@example.com`,
      prezzoMensile: '200',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    const riga = page.locator('tr', { hasText: cognome });
    await riga.getByLabel(new RegExp(`Costi extra per.*${cognome}`)).fill('10');
    await riga.getByLabel(new RegExp(`Nota costi extra per.*${cognome}`)).fill('Materiale didattico');

    await page.getByRole('button', { name: 'Invia comunicazioni' }).click();
    await page.waitForTimeout(3000);
    await page.reload();

    const rigaInviata = page.locator('tr', { hasText: cognome });
    await expect(rigaInviata.getByText(/Inviata il/)).toBeVisible({ timeout: 20_000 });
    // 200 retta + 10 extra + 2 marca da bollo (valore predefinito, non toccato dal test), 0 pasti.
    await expect(rigaInviata).toContainText('212,00');
    await expect(rigaInviata).toContainText('Materiale didattico');
  });

  test('un bambino già comunicato questo mese non viene reinviato', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-doppio-${Date.now()}@example.com`,
      prezzoMensile: '150',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    await page.getByRole('button', { name: 'Invia comunicazioni' }).click();
    await page.waitForTimeout(3000);
    await page.reload();

    const riga = page.locator('tr', { hasText: cognome });
    await expect(riga.getByText(/Inviata il/)).toBeVisible({ timeout: 20_000 });
    // Nessun campo "Costi extra" modificabile per un bambino già comunicato.
    await expect(riga.locator('input')).toHaveCount(0);
  });

  test('configurare il template della mail', async ({ page }) => {
    await page.goto('/admin/rette');
    await page.getByRole('link', { name: 'Modello email' }).click();
    await page.waitForURL('/admin/rette/template');
    await expect(page.getByRole('heading', { name: 'Modello email retta' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);

    const oggettoUnico = `Promemoria retta E2E ${Date.now()} {{mese}}`;
    await page.getByLabel('Oggetto').fill(oggettoUnico);
    await page.getByRole('button', { name: 'Salva modello' }).click();
    await expect(page.getByLabel('Oggetto')).toHaveValue(oggettoUnico, { timeout: 20_000 });

    await page.reload();
    await expect(page.getByLabel('Oggetto')).toHaveValue(oggettoUnico);
  });

  test('accesso negato a chi non è admin', async ({ browser }) => {
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);

      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      await page.goto('/admin/rette');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await page.goto('/admin/rette/template');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await context.close();
    }
  });
});
