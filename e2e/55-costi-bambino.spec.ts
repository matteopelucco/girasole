// Requisito: specs/55 - costi-bambino.md
//
// ATTENZIONE: questo test crea davvero bambini sul progetto Supabase di test
// (stesso pattern di 50-amministrazione_base.spec.ts) e scrive nella tabella
// `costi_bambini`. I bambini di test (cognome unico `E2eCosti...`) vengono
// eliminati alla fine con il client admin della fixture (e2e/fixture-prezzi.ts).
//
// Dal #396 i prezzi proposti vengono dalla sezione "Prezzi" (riga unica
// `prezzi_predefiniti`) e non sono più valori fissi: i test li rileggono dal
// database prima di verificare la scheda. Gli importi si scrivono con la virgola
// e due decimali ("6,00"); i campi prezzo sono di testo, non `number`.
import { test, expect, type Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione, alertApp, clickEAttendiAzione } from './helpers';
import { accediComeAdminDb } from './fixture-bambino';
import {
  creaSezioneConTipo,
  formatta,
  idBambinoPerCognome,
  impostaTipoSezione,
  leggiCosti,
  leggiPrezzi,
  pulisciSezioneEBambini,
  scriviPrezzi,
  salvaPrezziOriginali,
  ripristinaPrezzi,
  type Prezzi,
} from './fixture-prezzi';
import {
  ETICHETTA_ABBONAMENTO_POST,
  ETICHETTA_ABBONAMENTO_PRE,
  ETICHETTE_COSTI,
  MESSAGGIO_IMPORTO_NON_VALIDO,
  TESTO_AVVISO_RETTA_VUOTA,
  TITOLI_SEZIONI_SCHEDA,
  avvisoRettaVuota,
  creaBambinoDaForm,
  formCosti,
  pulsanteSalvaCosti,
  sezioneScheda,
} from './pagina-prezzi';

// I test cambiano i prezzi (riga unica): girano in sequenza.
test.describe.configure({ mode: 'serial' });

test.describe('55 — Costi bambino', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  let db: SupabaseClient | null = null;
  let originali: Prezzi | null = null;
  const cognomiCreati: string[] = [];
  const sezioniCreate: string[] = [];

  test.beforeAll(async () => {
    db = await accediComeAdminDb();
    if (db) originali = await salvaPrezziOriginali(db);
  });

  test.afterAll(async () => {
    if (!db) return;
    for (const id of sezioniCreate) await pulisciSezioneEBambini(db, id, []);
    await pulisciSezioneEBambini(db, null, cognomiCreati);
    if (originali) await ripristinaPrezzi(db, originali);
  });

  test.beforeEach(async () => {
    test.skip(!hasCredenziali('admin') || !db, 'richiede E2E_ADMIN_EMAIL/PASSWORD e le variabili Supabase');
  });

  // Crea un bambino dal form (senza sezione, o nella sezione indicata) e apre la
  // sua scheda. Restituisce cognome e id.
  async function creaEApri(page: Page, nomeSezione: string | null = null) {
    const cognome = `E2eCosti${Date.now()}${Math.floor(Math.random() * 1000)}`;
    cognomiCreati.push(cognome);
    await creaBambinoDaForm(page, cognome, nomeSezione);
    const id = await idBambinoPerCognome(db!, cognome);
    await page.goto(`/admin/bambini/${id}`);
    return { cognome, id };
  }

  async function salvaCosti(page: Page) {
    await clickEAttendiAzione(page, pulsanteSalvaCosti(page));
    // La conferma del salvataggio è "Ultimo salvataggio" nel form (specs/05).
    await expect(formCosti(page).getByText('Ultimo salvataggio:', { exact: false })).toBeVisible({ timeout: 20_000 });
  }

  const campo = (page: Page, etichetta: string) => page.getByLabel(etichetta, { exact: true });
  const abbonamentoPre = (page: Page) => page.getByLabel(ETICHETTA_ABBONAMENTO_PRE, { exact: true });
  const abbonamentoPost = (page: Page) => page.getByLabel(ETICHETTA_ABBONAMENTO_POST, { exact: true });

  test('COS-01: impostare per la prima volta i costi: salvati solo alla conferma', async ({ page }) => {
    const { id } = await creaEApri(page);
    await expect(page.getByRole('heading', { name: 'Retta e pasti', exact: true })).toBeVisible();
    await expect(abbonamentoPre(page)).not.toBeChecked();
    await expect(abbonamentoPost(page)).not.toBeChecked();
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue('');
    await nessunaViolazioneA11yGrave(page);

    // Prima della conferma nulla è scritto nel database.
    expect(await leggiCosti(db!, id)).toBeNull();

    await campo(page, ETICHETTE_COSTI.retta).fill('250');
    await campo(page, ETICHETTE_COSTI.buonoPasto).fill('5,5');
    await page.getByLabel('Email promemoria retta').fill('genitore.test@example.com');
    await salvaCosti(page);

    await expect.poll(async () => leggiCosti(db!, id)).toMatchObject({
      prezzo_mensile: 250,
      prezzo_buono_pasto: 5.5,
      email_promemoria: 'genitore.test@example.com',
    });

    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('250,00');
    await expect(campo(page, ETICHETTE_COSTI.buonoPasto)).toHaveValue('5,50');
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue('genitore.test@example.com');
  });

  test('COS-02: i prezzi proposti vengono da "Prezzi", non da valori fissi', async ({ page }) => {
    // Valori diversi da quelli iniziali: una proposta con 6/2/70/70 fissi fallisce.
    await scriviPrezzi(db!, {
      retta_materna: 161.11,
      retta_primavera: 201.22,
      buono_pasto: 6.33,
      marca_da_bollo: 2.44,
      abbonamento_pre_asilo: 71.55,
      abbonamento_post_asilo: 72.66,
      gettone_pre_asilo: 7.77,
      gettone_post_asilo: 7.88,
    });
    const materna = await creaSezioneConTipo(db!, 'materna');
    const primavera = await creaSezioneConTipo(db!, 'primavera');
    sezioniCreate.push(materna.id, primavera.id);

    // Senza sezione: retta vuota, gli altri valori sono la proposta.
    const { id } = await creaEApri(page);
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('');
    await expect(campo(page, ETICHETTE_COSTI.buonoPasto)).toHaveValue('6,33');
    await expect(campo(page, ETICHETTE_COSTI.marcaDaBollo)).toHaveValue('2,44');
    await expect(campo(page, ETICHETTE_COSTI.preAsilo)).toHaveValue('71,55');
    await expect(campo(page, ETICHETTE_COSTI.postAsilo)).toHaveValue('72,66');
    await expect(abbonamentoPre(page)).not.toBeChecked();
    await expect(abbonamentoPost(page)).not.toBeChecked();
    // Anche i gettoni sono proposti da "Prezzi" (non ancora salvati).
    await expect(campo(page, ETICHETTE_COSTI.gettonePreAsilo)).toHaveValue('7,77');
    await expect(campo(page, ETICHETTE_COSTI.gettonePostAsilo)).toHaveValue('7,88');

    // Con la sezione, la retta segue il tipo (assegnazione fatta come admin).
    await db!.from('bambini').update({ sezione_id: materna.id }).eq('id', id);
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('161,11');
    await db!.from('bambini').update({ sezione_id: primavera.id }).eq('id', id);
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('201,22');

    // Se cambio un valore in "Prezzi", la proposta mostra il valore nuovo; non è salvata.
    await scriviPrezzi(db!, { buono_pasto: 6.5, gettone_pre_asilo: 7.5 });
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.buonoPasto)).toHaveValue('6,50');
    await expect(campo(page, ETICHETTE_COSTI.gettonePreAsilo)).toHaveValue('7,50');
    expect(await leggiCosti(db!, id)).toBeNull();
  });

  test('COS-03: un bambino con costi già salvati non cambia mai', async ({ page }) => {
    const sezioneA = await creaSezioneConTipo(db!, 'materna');
    const sezioneB = await creaSezioneConTipo(db!, 'primavera');
    sezioniCreate.push(sezioneA.id, sezioneB.id);
    await scriviPrezzi(db!, {
      retta_materna: 160,
      retta_primavera: 200,
      buono_pasto: 6,
      marca_da_bollo: 2,
      gettone_pre_asilo: 7.5,
      gettone_post_asilo: 8,
    });

    // Il bambino nasce in una sezione con tipo: la riga dei costi c'è subito.
    const { id } = await creaEApri(page, sezioneA.nome);
    await expect.poll(async () => leggiCosti(db!, id)).not.toBeNull();
    const prima = await leggiCosti(db!, id);

    // Cambio un prezzo, il tipo della sezione, e sposto il bambino altrove.
    await scriviPrezzi(db!, {
      retta_materna: 999.99,
      buono_pasto: 8.88,
      marca_da_bollo: 3.33,
      gettone_pre_asilo: 9.99,
      gettone_post_asilo: 9.98,
    });
    await impostaTipoSezione(db!, sezioneA.id, 'primavera');
    await db!.from('bambini').update({ sezione_id: sezioneB.id }).eq('id', id);

    expect(await leggiCosti(db!, id)).toEqual(prima);
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue(formatta(prima!.prezzo_mensile));
    await expect(campo(page, ETICHETTE_COSTI.buonoPasto)).toHaveValue(formatta(prima!.prezzo_buono_pasto));
    await expect(campo(page, ETICHETTE_COSTI.gettonePreAsilo)).toHaveValue('7,50');
    await expect(campo(page, ETICHETTE_COSTI.gettonePostAsilo)).toHaveValue('8,00');
  });

  test('COS-04: la retta proposta segue il tipo attuale della sezione finché non si salva', async ({ page }) => {
    const sezione = await creaSezioneConTipo(db!, null);
    sezioniCreate.push(sezione.id);
    await scriviPrezzi(db!, { retta_materna: 160, retta_primavera: 200 });

    // Bambino senza riga di costi (creato senza sezione).
    const { id } = await creaEApri(page);
    await db!.from('bambini').update({ sezione_id: sezione.id }).eq('id', id);

    // Sezione senza tipo: retta vuota.
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('');

    await impostaTipoSezione(db!, sezione.id, 'primavera');
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('200,00');

    await impostaTipoSezione(db!, sezione.id, 'materna');
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('160,00');

    // L'assegnazione e il cambio di tipo non hanno scritto nulla.
    expect(await leggiCosti(db!, id)).toBeNull();
  });

  test('COS-05: valori decimali con la virgola; valori non validi rifiutati; vuoto vale 0', async ({ page }) => {
    test.slow();
    const { id } = await creaEApri(page);

    // Valori non validi: errore sul campo, niente viene salvato (non diventa 0).
    for (const valore of ['abc', '-5', '160,555', '1e2']) {
      await campo(page, ETICHETTE_COSTI.retta).fill(valore);
      await campo(page, ETICHETTE_COSTI.buonoPasto).fill('9');
      await pulsanteSalvaCosti(page).click();
      await expect(alertApp(page), `valore "${valore}"`).toContainText(MESSAGGIO_IMPORTO_NON_VALIDO);
      await expect(campo(page, ETICHETTE_COSTI.retta), `valore "${valore}"`).toHaveAttribute('aria-invalid', 'true');
      expect(await leggiCosti(db!, id), `valore "${valore}"`).toBeNull();
      await page.reload();
    }

    // "160,50" vale 160,50, come "160.50".
    await campo(page, ETICHETTE_COSTI.retta).fill('160,50');
    await campo(page, ETICHETTE_COSTI.marcaDaBollo).fill('1.99');
    await salvaCosti(page);
    await expect.poll(async () => leggiCosti(db!, id)).toMatchObject({ prezzo_mensile: 160.5, prezzo_marca_da_bollo: 1.99 });
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('160,50');

    // Un prezzo vuoto vale 0 (nessun importo previsto).
    await campo(page, ETICHETTE_COSTI.preAsilo).fill('');
    await salvaCosti(page);
    await expect.poll(async () => (await leggiCosti(db!, id))?.prezzo_pre_asilo).toBe(0);
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.preAsilo)).toHaveValue('0,00');
  });

  test('COS-06: avviso quando la retta mensile è vuota (non bloccante, sparisce scrivendo)', async ({ page }) => {
    test.slow();
    const retta = campo(page, ETICHETTE_COSTI.retta);
    const avviso = avvisoRettaVuota(page);
    const sezioneSenzaTipo = await creaSezioneConTipo(db!, null);
    const sezioneMaterna = await creaSezioneConTipo(db!, 'materna');
    sezioniCreate.push(sezioneSenzaTipo.id, sezioneMaterna.id);
    await scriviPrezzi(db!, { retta_materna: 160, retta_primavera: 200 });

    // Bambino senza sezione, senza riga costi: retta vuota, avviso presente, non è un errore.
    const { id } = await creaEApri(page);
    await expect(retta).toHaveValue('');
    await expect(avviso).toBeVisible();
    await expect(avviso).toHaveText(TESTO_AVVISO_RETTA_VUOTA);
    await expect(alertApp(page)).toHaveCount(0);
    await expect(retta).not.toHaveAttribute('aria-invalid', 'true');
    await expect(retta).toHaveAccessibleDescription(new RegExp(TESTO_AVVISO_RETTA_VUOTA.slice(0, 20)));
    await nessunaViolazioneA11yGrave(page);

    // Sparisce subito scrivendo (senza salvare) e ricompare svuotando.
    await retta.fill('1');
    await expect(avviso).toHaveCount(0);
    await retta.fill('');
    await expect(avviso).toBeVisible();

    // Anche in una sezione senza tipo l'avviso c'è.
    await db!.from('bambini').update({ sezione_id: sezioneSenzaTipo.id }).eq('id', id);
    await page.reload();
    await expect(retta).toHaveValue('');
    await expect(avviso).toBeVisible();

    // Il salvataggio non è bloccato: la retta vuota vale 0; poi 0 è un valore, niente avviso.
    await salvaCosti(page);
    await expect.poll(async () => (await leggiCosti(db!, id))?.prezzo_mensile).toBe(0);
    await page.reload();
    await expect(retta).toHaveValue('0,00');
    await expect(avviso).toHaveCount(0);

    // "0" scritto apposta: nessun avviso, nemmeno prima di salvare.
    await retta.fill('');
    await expect(avviso).toBeVisible();
    await retta.fill('0');
    await expect(avviso).toHaveCount(0);

    // Retta già salvata (250): niente avviso; svuotandola torna.
    await retta.fill('250');
    await salvaCosti(page);
    await expect.poll(async () => (await leggiCosti(db!, id))?.prezzo_mensile).toBe(250);
    await page.reload();
    await expect(retta).toHaveValue('250,00');
    await expect(avviso).toHaveCount(0);
    await retta.fill('');
    await expect(avviso).toBeVisible();

    // Altri prezzi vuoti (con la retta compilata): nessun avviso, valgono 0.
    await retta.fill('250');
    for (const etichetta of [
      ETICHETTE_COSTI.buonoPasto,
      ETICHETTE_COSTI.marcaDaBollo,
      ETICHETTE_COSTI.preAsilo,
      ETICHETTE_COSTI.postAsilo,
      ETICHETTE_COSTI.gettonePreAsilo,
      ETICHETTE_COSTI.gettonePostAsilo,
    ]) {
      await campo(page, etichetta).fill('');
      await expect(avviso, etichetta).toHaveCount(0);
    }
    // Con retta vuota e altri vuoti l'avviso è uno solo (solo per la retta).
    await retta.fill('');
    await expect(avviso).toHaveCount(1);
    await expect(formCosti(page).getByText(TESTO_AVVISO_RETTA_VUOTA)).toHaveCount(1);
  });

  test('COS-06: nessun avviso con la retta proposta dal tipo della sezione', async ({ page }) => {
    const materna = await creaSezioneConTipo(db!, 'materna');
    const primavera = await creaSezioneConTipo(db!, 'primavera');
    sezioniCreate.push(materna.id, primavera.id);
    await scriviPrezzi(db!, { retta_materna: 160, retta_primavera: 200 });

    const { id } = await creaEApri(page);
    await db!.from('bambini').update({ sezione_id: materna.id }).eq('id', id);
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('160,00');
    await expect(avvisoRettaVuota(page)).toHaveCount(0);

    await db!.from('bambini').update({ sezione_id: primavera.id }).eq('id', id);
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('200,00');
    await expect(avvisoRettaVuota(page)).toHaveCount(0);
    await nessunaViolazioneA11yGrave(page);
  });

  test('COS-06: con un valore non valido vale solo l\'errore di COS-05, non l\'avviso', async ({ page }) => {
    const { id } = await creaEApri(page);
    const retta = campo(page, ETICHETTE_COSTI.retta);
    await expect(avvisoRettaVuota(page)).toBeVisible();

    await retta.fill('abc');
    await expect(avvisoRettaVuota(page)).toHaveCount(0);
    await pulsanteSalvaCosti(page).click();
    await expect(alertApp(page)).toContainText(MESSAGGIO_IMPORTO_NON_VALIDO);
    await expect(retta).toHaveAttribute('aria-invalid', 'true');
    await expect(avvisoRettaVuota(page)).toHaveCount(0);
    expect(await leggiCosti(db!, id)).toBeNull();
  });

  test('COS-07: la scheda è divisa in sei sezioni nell\'ordine previsto', async ({ page }) => {
    await creaEApri(page);

    // Ordine: i titoli delle sei sezioni compaiono in quest'ordine.
    const titoli = (await page.locator('main h2').allTextContents()).map((t) => t.trim());
    expect(titoli.filter((t) => (TITOLI_SEZIONI_SCHEDA as readonly string[]).includes(t))).toEqual([...TITOLI_SEZIONI_SCHEDA]);
    for (const titolo of TITOLI_SEZIONI_SCHEDA) {
      await expect(page.getByRole('heading', { name: titolo, exact: true })).toHaveCount(1);
      await expect(sezioneScheda(page, titolo)).toHaveCount(1);
    }
    // La sezione con l'unico titolo "Costi" non esiste più.
    await expect(page.getByRole('heading', { name: 'Costi', exact: true })).toHaveCount(0);

    // Anagrafica: nome, cognome, classe (sezione) e attivo.
    const anagrafica = sezioneScheda(page, 'Anagrafica');
    await expect(anagrafica.getByPlaceholder('Nome', { exact: true })).toBeVisible();
    await expect(anagrafica.getByPlaceholder('Cognome', { exact: true })).toBeVisible();
    await expect(anagrafica.getByLabel('Sezione', { exact: true })).toBeVisible();
    await expect(anagrafica.getByRole('button', { name: /^(Disattiva|Riattiva) bambino$/ })).toBeVisible();

    // Retta e pasti.
    const rettaEPasti = sezioneScheda(page, 'Retta e pasti');
    await expect(rettaEPasti.getByLabel(ETICHETTE_COSTI.retta, { exact: true })).toBeVisible();
    await expect(rettaEPasti.getByLabel(ETICHETTE_COSTI.buonoPasto, { exact: true })).toBeVisible();
    await expect(rettaEPasti.getByLabel(ETICHETTE_COSTI.marcaDaBollo, { exact: true })).toBeVisible();

    // Pre-asilo e Post-asilo: abbonamento (sì/no), il suo prezzo e il gettone.
    const pre = sezioneScheda(page, 'Pre-asilo');
    await expect(pre.getByLabel(ETICHETTA_ABBONAMENTO_PRE, { exact: true })).toBeVisible();
    await expect(pre.getByLabel(ETICHETTE_COSTI.preAsilo, { exact: true })).toBeVisible();
    await expect(pre.getByLabel(ETICHETTE_COSTI.gettonePreAsilo, { exact: true })).toBeVisible();
    const post = sezioneScheda(page, 'Post-asilo');
    await expect(post.getByLabel(ETICHETTA_ABBONAMENTO_POST, { exact: true })).toBeVisible();
    await expect(post.getByLabel(ETICHETTE_COSTI.postAsilo, { exact: true })).toBeVisible();
    await expect(post.getByLabel(ETICHETTE_COSTI.gettonePostAsilo, { exact: true })).toBeVisible();

    // Comunicazioni: l'email per il promemoria della retta.
    await expect(sezioneScheda(page, 'Comunicazioni').getByLabel('Email promemoria retta')).toBeVisible();

    // Crediti e debiti è invariata.
    await expect(sezioneScheda(page, 'Crediti e debiti')).toBeVisible();

    // Le quattro sezioni economiche stanno nello stesso form, con un solo "Salva".
    await expect(pulsanteSalvaCosti(page)).toHaveCount(1);
    await expect(formCosti(page).getByLabel(ETICHETTE_COSTI.retta, { exact: true })).toBeVisible();
    await expect(formCosti(page).getByLabel(ETICHETTE_COSTI.gettonePostAsilo, { exact: true })).toBeVisible();
    await expect(formCosti(page).getByLabel('Email promemoria retta')).toBeVisible();

    await nessunaViolazioneA11yGrave(page);
  });

  test('COS-08: le etichette dell\'abbonamento sono "Abbonamento mensile"', async ({ page }) => {
    await creaEApri(page);
    await expect(sezioneScheda(page, 'Pre-asilo').getByLabel('Abbonamento mensile pre-asilo', { exact: true })).toBeVisible();
    await expect(sezioneScheda(page, 'Post-asilo').getByLabel('Abbonamento mensile post-asilo', { exact: true })).toBeVisible();
    await expect(page.getByText('Pre-asilo richiesto')).toHaveCount(0);
    await expect(page.getByText('Post-asilo richiesto')).toHaveCount(0);
    await expect(page.getByLabel('Pre-asilo richiesto')).toHaveCount(0);
    await expect(page.getByLabel('Post-asilo richiesto')).toHaveCount(0);
  });

  test('COS-09: salvare i prezzi dei gettoni; valori non validi rifiutati (tutto o niente)', async ({ page }) => {
    test.slow();
    const { id } = await creaEApri(page);

    // Valori non validi: errore sul campo del gettone, nessun valore del form è salvato.
    for (const valore of ['abc', '-5', '7,555', '1e2', '10000']) {
      await campo(page, ETICHETTE_COSTI.gettonePreAsilo).fill(valore);
      await campo(page, ETICHETTE_COSTI.buonoPasto).fill('9');
      await pulsanteSalvaCosti(page).click();
      await expect(alertApp(page), `valore "${valore}"`).toContainText(MESSAGGIO_IMPORTO_NON_VALIDO);
      await expect(campo(page, ETICHETTE_COSTI.gettonePreAsilo), `valore "${valore}"`).toHaveAttribute('aria-invalid', 'true');
      expect(await leggiCosti(db!, id), `valore "${valore}"`).toBeNull();
      await page.reload();
    }
    // Lo stesso vale per il gettone post-asilo.
    await campo(page, ETICHETTE_COSTI.gettonePostAsilo).fill('abc');
    await pulsanteSalvaCosti(page).click();
    await expect(alertApp(page)).toContainText(MESSAGGIO_IMPORTO_NON_VALIDO);
    await expect(campo(page, ETICHETTE_COSTI.gettonePostAsilo)).toHaveAttribute('aria-invalid', 'true');
    expect(await leggiCosti(db!, id)).toBeNull();
    await page.reload();

    // "7,50" e "8": salvati come 7,50 e 8,00 e visibili riaprendo la scheda.
    await campo(page, ETICHETTE_COSTI.retta).fill('150');
    await campo(page, ETICHETTE_COSTI.gettonePreAsilo).fill('7,50');
    await campo(page, ETICHETTE_COSTI.gettonePostAsilo).fill('8');
    // L'avviso di COS-06 non compare per i gettoni.
    await campo(page, ETICHETTE_COSTI.gettonePreAsilo).fill('');
    await expect(avvisoRettaVuota(page)).toHaveCount(0);
    await campo(page, ETICHETTE_COSTI.gettonePreAsilo).fill('7,50');
    await salvaCosti(page);
    await expect.poll(async () => leggiCosti(db!, id)).toMatchObject({ gettone_pre_asilo: 7.5, gettone_post_asilo: 8 });
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.gettonePreAsilo)).toHaveValue('7,50');
    await expect(campo(page, ETICHETTE_COSTI.gettonePostAsilo)).toHaveValue('8,00');

    // Vuoto vale 0; il punto vale come la virgola.
    await campo(page, ETICHETTE_COSTI.gettonePreAsilo).fill('');
    await campo(page, ETICHETTE_COSTI.gettonePostAsilo).fill('9.25');
    await salvaCosti(page);
    await expect.poll(async () => leggiCosti(db!, id)).toMatchObject({ gettone_pre_asilo: 0, gettone_post_asilo: 9.25 });
  });

  test('COS-10: il gettone si imposta anche con l\'abbonamento attivo (e non si perde togliendolo)', async ({ page }) => {
    test.slow();
    const { id } = await creaEApri(page);

    // Pre-asilo: abbonamento spuntato, poi modifico il gettone e premo "Salva".
    await abbonamentoPre(page).check();
    await campo(page, ETICHETTE_COSTI.retta).fill('150');
    await campo(page, ETICHETTE_COSTI.gettonePreAsilo).fill('7,30');
    await salvaCosti(page);
    await expect
      .poll(async () => leggiCosti(db!, id))
      .toMatchObject({ pre_asilo_richiesto: true, gettone_pre_asilo: 7.3 });

    // Togliendo la spunta il prezzo del gettone resta quello salvato.
    await page.reload();
    await expect(abbonamentoPre(page)).toBeChecked();
    await expect(campo(page, ETICHETTE_COSTI.gettonePreAsilo)).toHaveValue('7,30');
    await abbonamentoPre(page).uncheck();
    await salvaCosti(page);
    await expect
      .poll(async () => leggiCosti(db!, id))
      .toMatchObject({ pre_asilo_richiesto: false, gettone_pre_asilo: 7.3 });
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.gettonePreAsilo)).toHaveValue('7,30');

    // Con l'abbonamento non spuntato il gettone si salva lo stesso.
    await campo(page, ETICHETTE_COSTI.gettonePreAsilo).fill('7,40');
    await salvaCosti(page);
    await expect.poll(async () => (await leggiCosti(db!, id))?.gettone_pre_asilo).toBe(7.4);

    // Post-asilo: stessa cosa.
    await abbonamentoPost(page).check();
    await campo(page, ETICHETTE_COSTI.gettonePostAsilo).fill('8,10');
    await salvaCosti(page);
    await expect
      .poll(async () => leggiCosti(db!, id))
      .toMatchObject({ post_asilo_richiesto: true, gettone_post_asilo: 8.1 });
    await page.reload();
    await abbonamentoPost(page).uncheck();
    await salvaCosti(page);
    await expect
      .poll(async () => leggiCosti(db!, id))
      .toMatchObject({ post_asilo_richiesto: false, gettone_post_asilo: 8.1 });
    await nessunaViolazioneA11yGrave(page);
  });

  // COS-11: i bambini già esistenti hanno i gettoni a 7 euro dopo il rilascio.
  // NON TESTABILE IN E2E (è l'effetto della migration su righe già presenti, e il
  // database di test è condiviso): è coperto dal test pgTAP
  // `supabase/tests/database/costi_bambini.test.sql` (sezione "COS-11"), che
  // prova le colonne `gettone_pre_asilo`/`gettone_post_asilo` (tipo, not null,
  // vincolo 0..9999,99, nessun default dopo la migration). Il caso "bambino senza
  // riga di costi" è coperto da COS-02.

  test('COS-12: i bambini nuovi prendono i gettoni da "Prezzi"', async ({ page }) => {
    const sezione = await creaSezioneConTipo(db!, 'materna');
    sezioniCreate.push(sezione.id);
    await scriviPrezzi(db!, { gettone_pre_asilo: 7.5, gettone_post_asilo: 8 });

    // Bambino creato in una sezione con tipo: la riga nasce con i gettoni di "Prezzi".
    const { id } = await creaEApri(page, sezione.nome);
    await expect.poll(async () => leggiCosti(db!, id)).toMatchObject({ gettone_pre_asilo: 7.5, gettone_post_asilo: 8 });
    await expect(campo(page, ETICHETTE_COSTI.gettonePreAsilo)).toHaveValue('7,50');
    await expect(campo(page, ETICHETTE_COSTI.gettonePostAsilo)).toHaveValue('8,00');

    // Bambino senza riga di costi: la scheda propone gli stessi valori, non salvati.
    const senzaRiga = await creaEApri(page);
    expect(await leggiCosti(db!, senzaRiga.id)).toBeNull();
    await expect(campo(page, ETICHETTE_COSTI.gettonePreAsilo)).toHaveValue('7,50');
    await expect(campo(page, ETICHETTE_COSTI.gettonePostAsilo)).toHaveValue('8,00');

    // Cambiando poi i gettoni in "Prezzi", chi ha i costi salvati non cambia.
    await scriviPrezzi(db!, { gettone_pre_asilo: 9, gettone_post_asilo: 9.5 });
    await page.goto(`/admin/bambini/${id}`);
    await expect(campo(page, ETICHETTE_COSTI.gettonePreAsilo)).toHaveValue('7,50');
    await expect(campo(page, ETICHETTE_COSTI.gettonePostAsilo)).toHaveValue('8,00');
    expect(await leggiCosti(db!, id)).toMatchObject({ gettone_pre_asilo: 7.5, gettone_post_asilo: 8 });
  });

  test('modificare i costi già impostati aggiorna i valori salvati', async ({ page }) => {
    const { id } = await creaEApri(page);
    await campo(page, ETICHETTE_COSTI.retta).fill('200');
    await salvaCosti(page);
    await expect.poll(async () => (await leggiCosti(db!, id))?.prezzo_mensile).toBe(200);

    await campo(page, ETICHETTE_COSTI.retta).fill('220');
    await campo(page, ETICHETTE_COSTI.marcaDaBollo).fill('3');
    await salvaCosti(page);

    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('220,00');
    await expect(campo(page, ETICHETTE_COSTI.marcaDaBollo)).toHaveValue('3,00');
  });

  test('richiedere il servizio pre-asilo e post-asilo salva flag e prezzo', async ({ page }) => {
    const { id } = await creaEApri(page);

    await abbonamentoPre(page).check();
    await campo(page, ETICHETTE_COSTI.preAsilo).fill('30');
    await abbonamentoPost(page).check();
    await campo(page, ETICHETTE_COSTI.postAsilo).fill('40');
    await salvaCosti(page);

    await expect
      .poll(async () => leggiCosti(db!, id))
      .toMatchObject({ pre_asilo_richiesto: true, prezzo_pre_asilo: 30, post_asilo_richiesto: true, prezzo_post_asilo: 40 });

    await page.reload();
    await expect(abbonamentoPre(page)).toBeChecked();
    await expect(campo(page, ETICHETTE_COSTI.preAsilo)).toHaveValue('30,00');
    await expect(abbonamentoPost(page)).toBeChecked();
    await expect(campo(page, ETICHETTE_COSTI.postAsilo)).toHaveValue('40,00');
  });

  test("l'email di promemoria è facoltativa: si possono salvare solo i prezzi", async ({ page }) => {
    const { id } = await creaEApri(page);

    await campo(page, ETICHETTE_COSTI.retta).fill('180');
    await campo(page, ETICHETTE_COSTI.buonoPasto).fill('5');
    await salvaCosti(page);

    await expect.poll(async () => leggiCosti(db!, id)).toMatchObject({ prezzo_mensile: 180, prezzo_buono_pasto: 5 });
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('180,00');
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue('');
  });

  test('un formato email non valido viene rifiutato e non salva nulla', async ({ page }) => {
    const { id } = await creaEApri(page);
    const proposto = formatta((await leggiPrezzi(db!)).buono_pasto);

    await campo(page, ETICHETTE_COSTI.retta).fill('300');
    await page.getByLabel('Email promemoria retta').fill('non-una-email');
    await pulsanteSalvaCosti(page).click();

    await expect(alertApp(page)).toBeVisible({ timeout: 20_000 });
    expect(await leggiCosti(db!, id)).toBeNull();

    // Nulla è stato salvato: dopo un ricaricamento tornano le proposte.
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('');
    await expect(campo(page, ETICHETTE_COSTI.buonoPasto)).toHaveValue(proposto);
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue('');
  });

  test('più indirizzi email separati da ";" vengono salvati', async ({ page }) => {
    const { id } = await creaEApri(page);

    const email = 'genitore1@esempio.it; genitore2@esempio.it';
    await campo(page, ETICHETTE_COSTI.retta).fill('150');
    await page.getByLabel('Email promemoria retta').fill(email);
    await salvaCosti(page);

    await expect.poll(async () => (await leggiCosti(db!, id))?.email_promemoria).toBe(email);
    await page.reload();
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue(email);
  });

  test('uno solo dei più indirizzi non valido viene rifiutato e non salva nulla', async ({ page }) => {
    const { id } = await creaEApri(page);

    await campo(page, ETICHETTE_COSTI.retta).fill('150');
    await page.getByLabel('Email promemoria retta').fill('genitore1@esempio.it; non-una-email');
    await pulsanteSalvaCosti(page).click();

    await expect(alertApp(page)).toBeVisible({ timeout: 20_000 });
    expect(await leggiCosti(db!, id)).toBeNull();

    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('');
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue('');
  });
});

