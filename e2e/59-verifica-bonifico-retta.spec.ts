// Requisito: specs/59 - verifica-bonifico-retta.md
//
// ATTENZIONE: questi test creano davvero un bambino, inviano davvero
// un'email via Resend (solo se RESEND_API_KEY è configurata — stesso
// pattern di 56-comunicazione-retta-mensile.spec.ts) e scrivono record
// reali in comunicazioni_retta/crediti_debiti_bambini sul progetto
// Supabase di test.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('59 — Verifica del bonifico di una retta', () => {
  // Stesso motivo di 56-comunicazione-retta-mensile.spec.ts: "Invia
  // comunicazioni" agisce su tutti i bambini "da inviare" del mese,
  // esecuzione seriale per evitare interferenze tra test paralleli.
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  async function creaBambinoEInviaComunicazione(
    page: import('@playwright/test').Page,
    prezzoMensile: string
  ) {
    const cognome = `E2eBonifico${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await page.goto('/admin');
    await page.getByPlaceholder('Nome', { exact: true }).fill('Bonifico');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2021-06-06');
    await page.getByLabel('Sesso').selectOption('F');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const link = page.getByRole('link', { name: new RegExp(cognome) });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await page.waitForURL(/\/admin\/bambini\/.+/);

    await page.getByLabel('Prezzo retta mensile (€)').fill(prezzoMensile);
    await page.getByLabel('Prezzo buono pasto (€)').fill('0');
    await page.getByLabel('Email promemoria retta').fill(`e2e-bonifico-${Date.now()}@example.com`);
    await page.getByRole('button', { name: 'Salva costi' }).click();
    await expect(page.getByLabel('Prezzo retta mensile (€)')).toHaveValue(prezzoMensile, { timeout: 20_000 });

    await page.goto('/admin/rette');
    // "Invia comunicazioni" è il pulsante di pagina (invio massivo), non
    // uno per riga — vive fuori dalla tabella (app/admin/rette/page.tsx,
    // `piePagina`).
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Invia comunicazioni' }).click();
    await page.waitForTimeout(3000);
    await page.reload();

    const rigaInviata = page.locator('tr', { hasText: cognome });
    await expect(rigaInviata.getByText(/Inviata il/)).toBeVisible({ timeout: 20_000 });
    return { cognome, rigaInviata };
  }

  test('una comunicazione appena inviata è in attesa di verifica + accessibilità', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const { rigaInviata } = await creaBambinoEInviaComunicazione(page, '100');
    await expect(rigaInviata.getByText('Bonifico da verificare')).toBeVisible();
    await expect(rigaInviata.getByRole('button', { name: 'Bonifico corretto' })).toBeVisible();
    await expect(rigaInviata.getByRole('button', { name: 'Importo diverso' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('marcare un bonifico come corretto', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const { rigaInviata } = await creaBambinoEInviaComunicazione(page, '120');
    page.once('dialog', (dialog) => dialog.accept());
    await rigaInviata.getByRole('button', { name: 'Bonifico corretto' }).click();

    await expect(rigaInviata.getByText('Bonifico ricevuto (importo corretto)', { exact: false })).toBeVisible({
      timeout: 20_000,
    });
    await expect(rigaInviata.getByRole('button', { name: 'Bonifico corretto' })).toHaveCount(0);
  });

  test('marcare un bonifico con importo diverso genera un credito/debito', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const { cognome, rigaInviata } = await creaBambinoEInviaComunicazione(page, '130');
    // 130 retta + 2 marca da bollo (default) = 132 atteso.
    await rigaInviata.getByRole('button', { name: 'Importo diverso' }).click();

    const popup = page.getByRole('dialog', { name: new RegExp(`Importo bonifico diverso per.*${cognome}`) });
    await expect(popup).toBeVisible();
    await popup.getByLabel('Importo ricevuto (€)').fill('100');
    await popup.getByLabel('Nota bonifico').fill('Bonifico incompleto, il resto arriverà il mese prossimo');
    await popup.getByRole('button', { name: 'Conferma' }).click();

    await expect(rigaInviata.getByText('Bonifico ricevuto (importo diverso)', { exact: false })).toBeVisible({
      timeout: 20_000,
    });
    await expect(rigaInviata).toContainText('100,00');
    await expect(rigaInviata).toContainText('132,00');

    // La differenza (132 - 100 = 32, un debito) è confluita come
    // credito/debito "da conteggiare" sulla scheda del bambino.
    const link = page.getByRole('link', { name: new RegExp(cognome) }).first();
    await link.click();
    await page.waitForURL(/\/admin\/bambini\/.+/);
    await expect(page.getByText('Debito di 32,00', { exact: false })).toBeVisible();
    await expect(page.getByText('Bonifico incompleto, il resto arriverà il mese prossimo', { exact: false })).toBeVisible();
  });

  test('la nota è obbligatoria per un importo diverso', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const { cognome, rigaInviata } = await creaBambinoEInviaComunicazione(page, '140');
    await rigaInviata.getByRole('button', { name: 'Importo diverso' }).click();

    const popup = page.getByRole('dialog', { name: new RegExp(`Importo bonifico diverso per.*${cognome}`) });
    await popup.getByLabel('Importo ricevuto (€)').fill('100');
    // Nota lasciata vuota: la validazione JS (VerificaBonifico.tsx, non
    // più un <form required> dopo il fix del bug "spagina" — vedi
    // TASKS.md) blocca l'invio, nessuna richiesta arriva al server.
    await popup.getByRole('button', { name: 'Conferma' }).click();
    await expect(rigaInviata.getByText('Bonifico ricevuto (importo diverso)', { exact: false })).toHaveCount(0);
  });

  test('un bonifico già verificato mostra solo lo stato, "Annulla verifica" e nasconde "Annulla invio"', async ({
    page,
  }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const { rigaInviata } = await creaBambinoEInviaComunicazione(page, '150');
    page.once('dialog', (dialog) => dialog.accept());
    await rigaInviata.getByRole('button', { name: 'Bonifico corretto' }).click();
    await expect(rigaInviata.getByText('Bonifico ricevuto (importo corretto)', { exact: false })).toBeVisible({
      timeout: 20_000,
    });

    await expect(rigaInviata.getByRole('button', { name: 'Importo diverso' })).toHaveCount(0);
    await expect(rigaInviata.getByRole('button', { name: 'Annulla invio' })).toHaveCount(0);
    await expect(rigaInviata.getByRole('button', { name: 'Annulla verifica' })).toBeVisible();
  });

  test('annullare la verifica di un bonifico corretto torna "da verificare", senza altri avvisi', async ({
    page,
  }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const { rigaInviata } = await creaBambinoEInviaComunicazione(page, '160');
    page.once('dialog', (dialog) => dialog.accept());
    await rigaInviata.getByRole('button', { name: 'Bonifico corretto' }).click();
    await expect(rigaInviata.getByRole('button', { name: 'Annulla verifica' })).toBeVisible({ timeout: 20_000 });

    page.once('dialog', (dialog) => dialog.accept());
    await rigaInviata.getByRole('button', { name: 'Annulla verifica' }).click();

    await expect(rigaInviata.getByText('Bonifico da verificare')).toBeVisible({ timeout: 20_000 });
    await expect(rigaInviata.getByRole('button', { name: 'Bonifico corretto' })).toBeVisible();
    await expect(rigaInviata.getByRole('button', { name: 'Importo diverso' })).toBeVisible();
    await expect(rigaInviata.getByText('ricontrolla i crediti/debiti', { exact: false })).toHaveCount(0);
  });

  test('annullare la verifica di un bonifico con importo diverso avvisa di ricontrollare i crediti/debiti', async ({
    page,
  }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const { cognome, rigaInviata } = await creaBambinoEInviaComunicazione(page, '170');
    await rigaInviata.getByRole('button', { name: 'Importo diverso' }).click();
    const popup = page.getByRole('dialog', { name: new RegExp(`Importo bonifico diverso per.*${cognome}`) });
    await popup.getByLabel('Importo ricevuto (€)').fill('150');
    await popup.getByLabel('Nota bonifico').fill('Bonifico incompleto E2E annullo');
    await popup.getByRole('button', { name: 'Conferma' }).click();
    await expect(rigaInviata.getByRole('button', { name: 'Annulla verifica' })).toBeVisible({ timeout: 20_000 });

    page.once('dialog', (dialog) => dialog.accept());
    await rigaInviata.getByRole('button', { name: 'Annulla verifica' }).click();

    await expect(rigaInviata.getByText('Bonifico da verificare')).toBeVisible({ timeout: 20_000 });
    const avviso = rigaInviata.getByText('ricontrolla i crediti/debiti', { exact: false });
    await expect(avviso).toBeVisible();
    await avviso.getByRole('link', { name: 'vai alla scheda' }).click();
    await page.waitForURL(/\/admin\/bambini\/.+/);
    await expect(page.getByRole('heading', { name: new RegExp(cognome) })).toBeVisible();
  });
});
