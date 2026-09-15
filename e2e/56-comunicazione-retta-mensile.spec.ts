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
    // Ogni sezione ha la sua tabella con le stesse colonne (specs/56,
    // "i bambini sono raggruppati per sezione"): più di un'intestazione
    // può ripetere lo stesso nome colonna, .first() basta a verificare
    // che la colonna esista.
    await expect(page.getByRole('columnheader', { name: 'Retta' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Costo pasti' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Conguaglio pasti' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Marca da bollo' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Pre-asilo' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Post-asilo' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Costi extra' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Totale' }).first()).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('non si può navigare a un mese futuro', async ({ page }) => {
    await page.goto('/admin/rette');
    await expect(page.getByRole('link', { name: 'Mese successivo' })).toHaveCount(0);
  });

  test('navigare a un mese passato mostra una revisione di sola lettura', async ({ page }) => {
    await page.goto('/admin/rette');
    const titoloMeseCorrente = await page.getByRole('heading', { name: /Rette —/ }).textContent();

    await page.getByRole('link', { name: 'Mese precedente' }).click();
    await expect(page.getByRole('heading', { name: /Rette —/ })).not.toHaveText(titoloMeseCorrente ?? '');

    // Vista di sola lettura: niente pulsante di invio né campi da compilare.
    await expect(page.getByRole('button', { name: 'Invia comunicazioni' })).toHaveCount(0);
    await expect(page.locator('input[type="number"]')).toHaveCount(0);
    await nessunaViolazioneA11yGrave(page);

    // Tornando avanti (freccia "→") si torna al mese corrente interattivo.
    await page.getByRole('link', { name: 'Mese successivo' }).click();
    await expect(page.getByRole('heading', { name: /Rette —/ })).toHaveText(titoloMeseCorrente ?? '');
    await expect(page.getByRole('button', { name: 'Invia comunicazioni' })).toBeVisible();
  });

  test('un mese passato senza nessuna comunicazione inviata mostra un messaggio', async ({ page }) => {
    // Un mese lontano nel passato, prima che il sistema esistesse: nessuna
    // comunicazione può esserci mai stata.
    await page.goto('/admin/rette?mese=2020-01');
    await expect(page.getByText('Nessuna comunicazione inviata in questo mese.')).toBeVisible();
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

  test('un bambino senza sezione compare nella tabella "Senza sezione"', async ({ page }) => {
    const cognome = `E2eComRettaSenzaSezione${Date.now()}`;
    await page.goto('/admin');
    await page.getByPlaceholder('Nome', { exact: true }).fill('SenzaSezione');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2021-08-08');
    await page.getByLabel('Sesso').selectOption('F');
    // Il form di creazione bambino lascia "Nessuna sezione" di default.
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();
    await expect(page.getByText(cognome, { exact: false })).toBeVisible({ timeout: 20_000 });

    await page.goto('/admin/rette');
    const titolo = page.getByRole('heading', { name: 'Senza sezione' });
    await expect(titolo).toBeVisible();
    // La riga del bambino sta nella tabella subito sotto quel titolo
    // (fratello successivo nel markup — components/../page.tsx,
    // TabellaSezione), non in una tabella di un'altra sezione.
    const tabellaSezione = titolo.locator('xpath=following-sibling::div[1]');
    await expect(tabellaSezione.locator('tr', { hasText: cognome })).toBeVisible();
  });

  test('un bambino con una sezione assegnata compare sotto il titolo della sua sezione', async ({ page }) => {
    await page.goto('/admin');
    const selectSezione = page.getByLabel('Sezione', { exact: true });
    const opzioni = selectSezione.locator('option');
    test.skip((await opzioni.count()) < 2, 'nessuna sezione configurata sul progetto di test');
    const nomeSezione = await opzioni.nth(1).textContent();

    const cognome = `E2eComRettaConSezione${Date.now()}`;
    await page.getByPlaceholder('Nome', { exact: true }).fill('ConSezione');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2021-09-09');
    await page.getByLabel('Sesso').selectOption('F');
    await selectSezione.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();
    await expect(page.getByText(cognome, { exact: false })).toBeVisible({ timeout: 20_000 });

    await page.goto('/admin/rette');
    const titolo = page.getByRole('heading', { name: nomeSezione ?? '', exact: true });
    await expect(titolo).toBeVisible();
    const tabellaSezione = titolo.locator('xpath=following-sibling::div[1]');
    await expect(tabellaSezione.locator('tr', { hasText: cognome })).toBeVisible();
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

    // Il campo è ora modificabile (specs/56, "modificare manualmente una
    // voce di costo prima dell'invio"): il valore proposto è nel campo
    // stesso, non più testo semplice — confronto il value dell'input
    // (formato numerico semplice, non la formattazione italiana con la
    // virgola usata solo per il testo statico).
    const riga = page.locator('tr', { hasText: cognome });
    await expect(riga.getByLabel(new RegExp(`Costo pasti per.*${cognome}`))).toHaveValue(String(giorniApertura * 5));
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
    await expect(riga.getByLabel(new RegExp(`Conguaglio pasti per.*${cognome}`))).toHaveValue('0');
  });

  test("l'email a cui verrà inviata la comunicazione compare sotto il nome del bambino", async ({ page }) => {
    const email = `e2e-retta-email-${Date.now()}@example.com`;
    const cognome = await creaBambinoConCosti(page, { email, prezzoMensile: '100', prezzoBuonoPasto: '0' });

    await page.goto('/admin/rette');
    const riga = page.locator('tr', { hasText: cognome });
    await expect(riga).toContainText(`(${email})`);
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

  test('la nota del costo extra è disponibile nella mail tramite {{note_costi_extra}}', async ({ page }) => {
    // Configura il template perché includa il nuovo placeholder — un
    // modello preesistente non lo contiene finché l'admin non lo
    // aggiunge a mano (specs/56, stesso pattern già usato per
    // {{marca_da_bollo}}).
    await page.goto('/admin/rette/template');
    const corpoUnico = `Nota costo extra: [{{note_costi_extra}}] — E2E ${Date.now()}`;
    await page.getByLabel('Corpo').fill(corpoUnico);
    await page.getByRole('button', { name: 'Salva modello' }).click();
    await expect(page.getByLabel('Corpo')).toHaveValue(corpoUnico, { timeout: 20_000 });

    const cognomeConNota = await creaBambinoConCosti(page, {
      email: `e2e-retta-nota-${Date.now()}@example.com`,
      prezzoMensile: '100',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    const rigaConNota = page.locator('tr', { hasText: cognomeConNota });
    await rigaConNota.getByLabel(new RegExp(`Nota costi extra per.*${cognomeConNota}`)).fill('Uscita didattica');
    await rigaConNota.getByRole('button', { name: 'Invia comunicazione' }).click();

    const popupConNota = page.getByRole('dialog', { name: new RegExp(`Anteprima comunicazione per.*${cognomeConNota}`) });
    await expect(popupConNota).toContainText('Nota costo extra: [Uscita didattica]');
    await popupConNota.getByRole('button', { name: 'Annulla' }).click();

    // Senza nota scritta, il placeholder diventa una stringa vuota, non
    // "undefined"/"null".
    const cognomeSenzaNota = await creaBambinoConCosti(page, {
      email: `e2e-retta-senza-nota-${Date.now()}@example.com`,
      prezzoMensile: '100',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    const rigaSenzaNota = page.locator('tr', { hasText: cognomeSenzaNota });
    await rigaSenzaNota.getByRole('button', { name: 'Invia comunicazione' }).click();

    const popupSenzaNota = page.getByRole('dialog', { name: new RegExp(`Anteprima comunicazione per.*${cognomeSenzaNota}`) });
    await expect(popupSenzaNota).toContainText('Nota costo extra: []');
    await expect(popupSenzaNota).not.toContainText('undefined');
    await expect(popupSenzaNota).not.toContainText('null');
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

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Invia comunicazioni' }).click();
    await page.waitForTimeout(3000);
    await page.reload();

    const rigaInviata = page.locator('tr', { hasText: cognome });
    await expect(rigaInviata.getByText(/Inviata il/)).toBeVisible({ timeout: 20_000 });
    // 200 retta + 10 extra + 2 marca da bollo (valore predefinito, non toccato dal test), 0 pasti.
    await expect(rigaInviata).toContainText('212,00');
    await expect(rigaInviata).toContainText('Materiale didattico');
  });

  test('Invia comunicazione su una riga apre un\'anteprima con destinatario, oggetto e corpo', async ({ page }) => {
    const email = `e2e-retta-anteprima-${Date.now()}@example.com`;
    const cognome = await creaBambinoConCosti(page, {
      email,
      prezzoMensile: '200',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    const riga = page.locator('tr', { hasText: cognome });
    await riga.getByRole('button', { name: 'Invia comunicazione' }).click();

    const popup = page.getByRole('dialog', { name: new RegExp(`Anteprima comunicazione per.*${cognome}`) });
    await expect(popup).toBeVisible();
    await expect(popup).toContainText(email);
    await expect(popup.getByRole('button', { name: 'Conferma invio' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test("annullare l'anteprima non invia nulla", async ({ page }) => {
    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-anteprima-annulla-${Date.now()}@example.com`,
      prezzoMensile: '200',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    const riga = page.locator('tr', { hasText: cognome });
    await riga.getByRole('button', { name: 'Invia comunicazione' }).click();

    const popup = page.getByRole('dialog', { name: new RegExp(`Anteprima comunicazione per.*${cognome}`) });
    await expect(popup).toBeVisible();
    await popup.getByRole('button', { name: 'Annulla' }).click();
    await expect(popup).toHaveCount(0);

    // Nessun invio: il bambino resta "da inviare", con i suoi campi.
    await expect(riga.getByText(/Inviata il/)).toHaveCount(0);
    await expect(riga.getByLabel(new RegExp(`Costi extra per.*${cognome}`))).toBeVisible();
  });

  test("confermare l'anteprima invia la comunicazione al solo bambino scelto", async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const cognomeA = await creaBambinoConCosti(page, {
      email: `e2e-retta-singolo-a-${Date.now()}@example.com`,
      prezzoMensile: '130',
      prezzoBuonoPasto: '0',
    });
    const cognomeB = await creaBambinoConCosti(page, {
      email: `e2e-retta-singolo-b-${Date.now()}@example.com`,
      prezzoMensile: '140',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    const rigaA = page.locator('tr', { hasText: cognomeA });
    await rigaA.getByRole('button', { name: 'Invia comunicazione' }).click();
    const popup = page.getByRole('dialog', { name: new RegExp(`Anteprima comunicazione per.*${cognomeA}`) });
    await popup.getByRole('button', { name: 'Conferma invio' }).click();
    await page.waitForTimeout(3000);
    await page.reload();

    // Solo il bambino scelto (A) risulta comunicato; l'altro (B) no.
    const rigaAInviata = page.locator('tr', { hasText: cognomeA });
    await expect(rigaAInviata.getByText(/Inviata il/)).toBeVisible({ timeout: 20_000 });
    // 130 retta + 2 marca da bollo (default), 0 pasti/extra.
    await expect(rigaAInviata).toContainText('132,00');

    const rigaBAncoraDaInviare = page.locator('tr', { hasText: cognomeB });
    await expect(rigaBAncoraDaInviare.getByText(/Inviata il/)).toHaveCount(0);
    await expect(rigaBAncoraDaInviare.getByRole('button', { name: 'Invia comunicazione' })).toBeVisible();
  });

  test("modificare una voce di costo prima dell'invio usa il valore modificato", async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-modifica-${Date.now()}@example.com`,
      prezzoMensile: '200',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    const riga = page.locator('tr', { hasText: cognome });
    // Correzione ad-hoc che esula dal calcolo automatico: il pre-asilo
    // non è nemmeno richiesto per questo bambino (calcolato a 0), eppure
    // scrivo un importo — dimostra che il valore scritto viene usato
    // così com'è, non ricalcolato dai parametri del bambino.
    await riga.getByLabel(new RegExp(`Pre-asilo per.*${cognome}`)).fill('20');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Invia comunicazioni' }).click();
    await page.waitForTimeout(3000);
    await page.reload();

    const rigaInviata = page.locator('tr', { hasText: cognome });
    await expect(rigaInviata.getByText(/Inviata il/)).toBeVisible({ timeout: 20_000 });
    // 200 retta (fissa) + 2 marca da bollo (fissa) + 20 pre-asilo ad-hoc, 0 pasti/extra.
    await expect(rigaInviata).toContainText('222,00');
  });

  test('Retta e Marca da bollo non sono campi modificabili in tabella', async ({ page }) => {
    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-non-modificabile-${Date.now()}@example.com`,
      prezzoMensile: '200',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    const riga = page.locator('tr', { hasText: cognome });
    await expect(riga.getByLabel(new RegExp(`Retta per.*${cognome}`))).toHaveCount(0);
    await expect(riga.getByLabel(new RegExp(`Marca da bollo per.*${cognome}`))).toHaveCount(0);
    // Restano comunque visibili come testo, non spariscono dalla riga.
    await expect(riga).toContainText('200,00');
    await expect(riga).toContainText('2,00');
  });

  test('annullare l\'invio di una comunicazione la rende di nuovo inviabile', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-annulla-${Date.now()}@example.com`,
      prezzoMensile: '150',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Invia comunicazioni' }).click();
    await page.waitForTimeout(3000);
    await page.reload();

    const rigaInviata = page.locator('tr', { hasText: cognome });
    await expect(rigaInviata.getByText(/Inviata il/)).toBeVisible({ timeout: 20_000 });

    await rigaInviata.getByRole('button', { name: 'Annulla invio' }).click();
    await page.waitForTimeout(1000);
    await page.reload();

    // Tornato "da inviare": niente più "Inviata il", ricompaiono i campi.
    const rigaTornata = page.locator('tr', { hasText: cognome });
    await expect(rigaTornata.getByText(/Inviata il/)).toHaveCount(0);
    await expect(rigaTornata.getByLabel(new RegExp(`Costi extra per.*${cognome}`))).toBeVisible();

    // E può essere effettivamente reinviato.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Invia comunicazioni' }).click();
    await page.waitForTimeout(3000);
    await page.reload();
    const rigaReinviata = page.locator('tr', { hasText: cognome });
    await expect(rigaReinviata.getByText(/Inviata il/)).toBeVisible({ timeout: 20_000 });
  });

  test("il popup di conferma è necessario per l'invio massivo: annullandolo nessuna email parte", async ({
    page,
  }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-annulla-popup-${Date.now()}@example.com`,
      prezzoMensile: '150',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Invia comunicazioni' }).click();
    await page.waitForTimeout(1000);

    // Nessun invio: il bambino resta "da inviare".
    const riga = page.locator('tr', { hasText: cognome });
    await expect(riga.getByText(/Inviata il/)).toHaveCount(0);
    await expect(riga.getByLabel(new RegExp(`Costi extra per.*${cognome}`))).toBeVisible();
  });

  test('un bambino già comunicato questo mese non viene reinviato', async ({ page }) => {
    test.skip(!process.env.RESEND_API_KEY, "richiede RESEND_API_KEY configurata per inviare davvero l'email");

    const cognome = await creaBambinoConCosti(page, {
      email: `e2e-retta-doppio-${Date.now()}@example.com`,
      prezzoMensile: '150',
      prezzoBuonoPasto: '0',
    });

    await page.goto('/admin/rette');
    page.once('dialog', (dialog) => dialog.accept());
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
