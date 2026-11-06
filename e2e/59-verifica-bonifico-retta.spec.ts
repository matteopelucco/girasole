// Requisito: specs/59 - verifica-bonifico-retta.md
//
// La verifica del bonifico si fa in "Pagamenti bambino" (issue #417); in "Rette"
// resta lo stato in sola lettura con il link "Verifica". Ogni test usa il suo
// bambino fixture (e2e/fixture-bambino.ts) e inserisce direttamente nel DB di
// test la comunicazione già inviata (login admin con la chiave anon, RLS come
// l'app): niente email, quindi nessun test si salta per Resend. La comunicazione
// sparisce con il bambino (ON DELETE CASCADE).
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, type BambinoFixture } from './fixture-bambino';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione, verificaFocusTrattenuto } from './helpers';
import { meseCorrenteRoma, rigaRette } from './pagina-gettoni-retta';
import {
  apriPagamentiBambino,
  finestraImportoDiverso,
  inserisciComunicazioneDaVerificare,
  marcaImportoDiverso,
} from './pagina-pagamenti-bambino';

test.describe('59 — Verifica del bonifico di una retta', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async () => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  const MESE = meseCorrenteRoma();

  test('una comunicazione appena inviata è in attesa di verifica + accessibilità', async ({ page, bambino, adminDb }) => {
    await inserisciComunicazioneDaVerificare(adminDb!, bambino, MESE);
    const riga = await apriPagamentiBambino(page, bambino, MESE);

    await expect(riga.getByText('Bonifico da verificare')).toBeVisible();
    await expect(riga.getByRole('button', { name: 'Bonifico corretto' })).toBeVisible();
    await expect(riga.getByRole('button', { name: 'Importo diverso' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('in "Rette" lo stato del bonifico è in sola lettura con un link "Verifica"', async ({
    page,
    bambino,
    adminDb,
  }) => {
    await inserisciComunicazioneDaVerificare(adminDb!, bambino, MESE);
    await page.goto('/admin/rette');
    const riga = rigaRette(page, bambino);
    await expect(riga.getByText(/Inviata il/)).toBeVisible();

    await expect(riga.getByText('Bonifico da verificare')).toBeVisible();
    await expect(riga.getByRole('button', { name: 'Bonifico corretto' })).toHaveCount(0);
    await expect(riga.getByRole('button', { name: 'Importo diverso' })).toHaveCount(0);
    await expect(riga.getByRole('button', { name: 'Annulla verifica' })).toHaveCount(0);

    // Con il bonifico ancora in attesa "Annulla invio" c'è (specs/56).
    await expect(riga.getByRole('button', { name: 'Annulla invio' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);

    await riga.getByRole('link', { name: `Verifica il bonifico di ${bambino.nomeCompleto}` }).click();
    await page.waitForURL(new RegExp(`${bambino.id}.*#mese-${MESE}`));
    await expect(page.getByRole('heading', { name: bambino.nomeCompleto, level: 2 })).toBeVisible();
  });

  test('marcare un bonifico come corretto', async ({ page, bambino, adminDb }) => {
    await inserisciComunicazioneDaVerificare(adminDb!, bambino, MESE, { retta_mensile: 120 });
    const riga = await apriPagamentiBambino(page, bambino, MESE);
    page.once('dialog', (dialog) => dialog.accept());
    await riga.getByRole('button', { name: 'Bonifico corretto' }).click();

    await expect(riga.getByText('Bonifico ricevuto (importo corretto)', { exact: false })).toBeVisible({
      timeout: 20_000,
    });
    await expect(riga.getByRole('button', { name: 'Bonifico corretto' })).toHaveCount(0);

    // Nessun credito/debito generato: la scheda del bambino non ne mostra.
    await page.goto(`/admin/bambini/${bambino.id}`);
    await expect(page.getByText(/Debito di|Credito di/)).toHaveCount(0);
  });

  test('marcare un bonifico con importo diverso genera un credito/debito', async ({ page, bambino, adminDb }) => {
    await inserisciComunicazioneDaVerificare(adminDb!, bambino, MESE, { retta_mensile: 130, totale: 132 });
    const riga = await apriPagamentiBambino(page, bambino, MESE);
    await marcaImportoDiverso(page, riga, bambino, '100', 'Bonifico incompleto, il resto arriverà il mese prossimo');

    await expect(riga.getByText('Bonifico ricevuto (importo diverso)', { exact: false })).toBeVisible();
    await expect(riga).toContainText('100,00');
    await expect(riga).toContainText('132,00');

    // La differenza (132 - 100 = 32, un debito) è confluita come credito/debito
    // "da conteggiare" sulla scheda del bambino.
    await page.goto(`/admin/bambini/${bambino.id}`);
    await expect(page.getByText('Debito di 32,00', { exact: false })).toBeVisible();
    await expect(page.getByText('Bonifico incompleto, il resto arriverà il mese prossimo', { exact: false })).toBeVisible();
  });

  test('la nota è obbligatoria per un importo diverso', async ({ page, bambino, adminDb }) => {
    await inserisciComunicazioneDaVerificare(adminDb!, bambino, MESE);
    const riga = await apriPagamentiBambino(page, bambino, MESE);
    await riga.getByRole('button', { name: 'Importo diverso' }).click();

    const popup = finestraImportoDiverso(page, bambino);
    await popup.getByLabel('Importo ricevuto (€)').fill('50');
    // Nota lasciata vuota: la validazione JS (VerificaBonifico.tsx) blocca
    // l'invio, nessuna richiesta arriva al server.
    await popup.getByRole('button', { name: 'Conferma' }).click();
    await expect(popup.getByText('Scrivi una nota che spieghi la differenza.')).toBeVisible();
    await expect(riga.getByText('Bonifico ricevuto (importo diverso)', { exact: false })).toHaveCount(0);
  });

  // Finestre di dialogo (components/ui/finestra.tsx, issue #342): Esc, focus
  // trattenuto e focus restituito sulla finestra "Importo diverso".
  async function apriImportoDiverso(page: Page, bambino: BambinoFixture, adminDb: SupabaseClient) {
    await inserisciComunicazioneDaVerificare(adminDb, bambino, MESE);
    const riga = await apriPagamentiBambino(page, bambino, MESE);
    const apri = riga.getByRole('button', { name: 'Importo diverso' });
    await apri.click();
    const popup = finestraImportoDiverso(page, bambino);
    await expect(popup).toBeVisible();
    return { riga, apri, popup };
  }

  test('Esc chiude la finestra "Importo diverso" senza registrare nulla', async ({ page, bambino, adminDb }) => {
    const { riga, popup } = await apriImportoDiverso(page, bambino, adminDb!);
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await expect(riga.getByText('Bonifico da verificare')).toBeVisible();
  });

  test('la finestra "Importo diverso" trattiene il focus', async ({ page, bambino, adminDb }) => {
    const { popup } = await apriImportoDiverso(page, bambino, adminDb!);
    await verificaFocusTrattenuto(page, popup);
  });

  test('chiudendo la finestra "Importo diverso" il focus torna al pulsante', async ({ page, bambino, adminDb }) => {
    const { apri, popup } = await apriImportoDiverso(page, bambino, adminDb!);
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
    bambino,
    adminDb,
  }) => {
    await inserisciComunicazioneDaVerificare(adminDb!, bambino, MESE);
    const riga = await apriPagamentiBambino(page, bambino, MESE);
    page.once('dialog', (dialog) => dialog.accept());
    await riga.getByRole('button', { name: 'Bonifico corretto' }).click();
    await expect(riga.getByText('Bonifico ricevuto (importo corretto)', { exact: false })).toBeVisible({
      timeout: 20_000,
    });

    await expect(riga.getByRole('button', { name: 'Importo diverso' })).toHaveCount(0);
    await expect(riga.getByRole('button', { name: 'Bonifico corretto' })).toHaveCount(0);
    await expect(riga.getByRole('button', { name: 'Annulla verifica' })).toBeVisible();

    // In "Rette" stesso stato, nessun pulsante e nessun "Annulla invio".
    await page.goto('/admin/rette');
    const rigaInRette = rigaRette(page, bambino);
    await expect(rigaInRette.getByText('Bonifico ricevuto (importo corretto)', { exact: false })).toBeVisible();
    await expect(rigaInRette.getByRole('button', { name: 'Annulla invio' })).toHaveCount(0);
    await expect(rigaInRette.getByRole('button', { name: 'Annulla verifica' })).toHaveCount(0);
  });

  test('annullare la verifica di un bonifico corretto torna "da verificare", senza altri avvisi', async ({
    page,
    bambino,
    adminDb,
  }) => {
    await inserisciComunicazioneDaVerificare(adminDb!, bambino, MESE);
    const riga = await apriPagamentiBambino(page, bambino, MESE);
    page.once('dialog', (dialog) => dialog.accept());
    await riga.getByRole('button', { name: 'Bonifico corretto' }).click();
    await expect(riga.getByRole('button', { name: 'Annulla verifica' })).toBeVisible({ timeout: 20_000 });

    page.once('dialog', (dialog) => dialog.accept());
    await riga.getByRole('button', { name: 'Annulla verifica' }).click();

    await expect(riga.getByText('Bonifico da verificare')).toBeVisible({ timeout: 20_000 });
    await expect(riga.getByRole('button', { name: 'Bonifico corretto' })).toBeVisible();
    await expect(riga.getByRole('button', { name: 'Importo diverso' })).toBeVisible();
    await expect(riga.getByText('ricontrolla i crediti/debiti', { exact: false })).toHaveCount(0);
  });

  test('annullare la verifica di un bonifico con importo diverso avvisa di ricontrollare i crediti/debiti', async ({
    page,
    bambino,
    adminDb,
  }) => {
    await inserisciComunicazioneDaVerificare(adminDb!, bambino, MESE, { retta_mensile: 170 });
    const riga = await apriPagamentiBambino(page, bambino, MESE);
    await marcaImportoDiverso(page, riga, bambino, '150', 'Bonifico incompleto E2E annullo');

    page.once('dialog', (dialog) => dialog.accept());
    await riga.getByRole('button', { name: 'Annulla verifica' }).click();

    await expect(riga.getByText('Bonifico da verificare')).toBeVisible({ timeout: 20_000 });
    const avviso = riga.getByText('ricontrolla i crediti/debiti', { exact: false });
    await expect(avviso).toBeVisible();
    await avviso.getByRole('link', { name: 'vai alla scheda' }).click();
    await page.waitForURL(/\/admin\/bambini\/.+/);
    await expect(page.getByRole('heading', { name: new RegExp(bambino.cognome) })).toBeVisible();
  });

  test('verificare il bonifico anche su un mese passato', async ({ page, bambino, adminDb }) => {
    const mesePassato = '2019-11';
    await inserisciComunicazioneDaVerificare(adminDb!, bambino, mesePassato);
    const riga = await apriPagamentiBambino(page, bambino, mesePassato);

    await expect(riga.getByRole('button', { name: 'Bonifico corretto' })).toBeEnabled();
    await expect(riga.getByRole('button', { name: 'Importo diverso' })).toBeEnabled();
    page.once('dialog', (dialog) => dialog.accept());
    await riga.getByRole('button', { name: 'Bonifico corretto' }).click();
    await expect(riga.getByText('Bonifico ricevuto (importo corretto)', { exact: false })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('la finestra "Importo diverso" è leggibile su telefono (360 px) + accessibilità', async ({
    page,
    bambino,
    adminDb,
  }) => {
    const mese = '2019-11';
    await inserisciComunicazioneDaVerificare(adminDb!, bambino, mese);
    await page.setViewportSize({ width: 360, height: 740 });
    const riga = await apriPagamentiBambino(page, bambino, mese);
    await nessunaViolazioneA11yGrave(page);

    await riga.getByRole('button', { name: 'Importo diverso' }).click();
    const popup = finestraImportoDiverso(page, bambino);
    await expect(popup).toBeVisible();

    // Il testo va a capo e il contenuto sta dentro la finestra: nessuno
    // scorrimento orizzontale della finestra.
    await expect(popup).toHaveCSS('white-space', 'normal');
    const scorrimentoOrizzontale = await popup.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scorrimentoOrizzontale).toBe(false);

    const riquadroFinestra = (await popup.boundingBox())!;
    const campoMese = (await popup.getByLabel('Mese su cui conteggiare la differenza').boundingBox())!;
    expect(campoMese.x + campoMese.width).toBeLessThanOrEqual(riquadroFinestra.x + riquadroFinestra.width);
    await expect(popup.getByText(/^Importo atteso:/)).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });
});
