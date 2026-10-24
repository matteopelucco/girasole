// Requisito: specs/59 - verifica-bonifico-retta.md
//
// ATTENZIONE: questi test creano davvero un bambino, inviano davvero
// un'email via Resend (solo se RESEND_API_KEY è configurata — stesso
// pattern di 56-comunicazione-retta-mensile.spec.ts) e scrivono record
// reali in comunicazioni_retta/crediti_debiti_bambini sul progetto
// Supabase di test.
import { test, expect } from '@playwright/test';
import { accediComeAdminDb, creaBambinoFixture, eliminaBambinoFixture } from './fixture-bambino';
import {
  clickEAttendiAzione,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  statoAutenticazione,
  verificaFocusTrattenuto,
} from './helpers';

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
    await clickEAttendiAzione(page, page.getByRole('button', { name: 'Invia comunicazioni' }));
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
    // docs/tasks-archivio.md) blocca l'invio, nessuna richiesta arriva al server.
    await popup.getByRole('button', { name: 'Conferma' }).click();
    await expect(rigaInviata.getByText('Bonifico ricevuto (importo diverso)', { exact: false })).toHaveCount(0);
  });

  // Finestre di dialogo (components/ui/finestra.tsx, issue #342): Esc, focus
  // trattenuto e focus restituito sulla finestra "Importo diverso".
  async function apriImportoDiverso(page: import('@playwright/test').Page, prezzoMensile: string) {
    const { cognome, rigaInviata } = await creaBambinoEInviaComunicazione(page, prezzoMensile);
    const apri = rigaInviata.getByRole('button', { name: 'Importo diverso' });
    await apri.click();
    const popup = page.getByRole('dialog', { name: new RegExp(`Importo bonifico diverso per.*${cognome}`) });
    await expect(popup).toBeVisible();
    return { rigaInviata, apri, popup };
  }

  test('Esc chiude la finestra "Importo diverso" senza registrare nulla', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const { rigaInviata, popup } = await apriImportoDiverso(page, '150');
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await expect(rigaInviata.getByText('Bonifico da verificare')).toBeVisible();
  });

  test('la finestra "Importo diverso" trattiene il focus', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const { popup } = await apriImportoDiverso(page, '160');
    await verificaFocusTrattenuto(page, popup);
  });

  test('chiudendo la finestra "Importo diverso" il focus torna al pulsante', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const { apri, popup } = await apriImportoDiverso(page, '170');
    await popup.getByRole('button', { name: 'Annulla' }).click();
    await expect(popup).toHaveCount(0);
    await expect(apri).toBeFocused();

    await apri.click();
    await expect(popup).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await expect(apri).toBeFocused();
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

// Fuori dal blocco seriale qui sopra: nella CI i test di quel blocco sono tutti
// saltati (servono email vere via Resend) e in modalità seriale il test
// seguente resterebbe saltato con loro. Questo prepara da sé i suoi dati nel DB
// di test, senza email, e deve girare sempre.
test.describe('59 — Verifica del bonifico di una retta (telefono)', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async () => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  test('la finestra "Importo diverso" è leggibile su telefono (360 px) + accessibilità', async ({ page }) => {
    // Nessuna email: la comunicazione già inviata di un mese passato viene
    // inserita direttamente nel DB di test (login admin con la chiave anon,
    // RLS come l'app; sparisce con il bambino, ON DELETE CASCADE). Il mese
    // passato mostra la stessa riga con la cella "Inviata il" e la verifica
    // del bonifico (specs/59, "verificare il bonifico anche su un mese
    // passato"), quindi il test gira anche in CI, dove RESEND_API_KEY non c'è.
    const db = await accediComeAdminDb();
    test.skip(db === null, 'richiede E2E_ADMIN_EMAIL/PASSWORD e NEXT_PUBLIC_SUPABASE_URL/ANON_KEY');
    const bambino = await creaBambinoFixture(db!);
    try {
      const mese = '2019-11';
      const { error } = await db!.from('comunicazioni_retta').insert({
        bambino_id: bambino.id,
        mese,
        retta_mensile: 100,
        costo_pasti: 0,
        conguaglio_pasti: 0,
        costo_pre_asilo: 0,
        costo_post_asilo: 0,
        costi_extra: 0,
        totale: 100,
        email_destinatario: 'e2e-finestra-bonifico@example.com',
        inviata_da_nome: 'E2E',
      });
      if (error) throw new Error(`Inserimento della comunicazione di prova non riuscito: ${error.message}`);

      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(`/admin/rette?mese=${mese}`);
      const riga = page.locator('tr', { hasText: bambino.cognome });
      await riga.getByRole('button', { name: 'Importo diverso' }).click();
      const popup = page.getByRole('dialog', { name: new RegExp(`Importo bonifico diverso per.*${bambino.cognome}`) });
      await expect(popup).toBeVisible();

      // Il testo va a capo (non eredita `whitespace-nowrap` dalla cella
      // "Inviata il") e il contenuto sta dentro la finestra: nessuno scorrimento
      // orizzontale della finestra.
      await expect(popup).toHaveCSS('white-space', 'normal');
      const scorrimentoOrizzontale = await popup.evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(scorrimentoOrizzontale).toBe(false);

      const riquadroFinestra = (await popup.boundingBox())!;
      const campoMese = (await popup.getByLabel('Mese su cui conteggiare la differenza').boundingBox())!;
      expect(campoMese.x + campoMese.width).toBeLessThanOrEqual(riquadroFinestra.x + riquadroFinestra.width);
      await expect(popup.getByText(/^Importo atteso:/)).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    } finally {
      await eliminaBambinoFixture(db!, bambino.id);
    }
  });
});
