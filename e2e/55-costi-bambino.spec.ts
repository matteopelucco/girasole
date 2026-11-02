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
import { ETICHETTE_COSTI, MESSAGGIO_IMPORTO_NON_VALIDO, creaBambinoDaForm, formCosti } from './pagina-prezzi';

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
    await clickEAttendiAzione(page, page.getByRole('button', { name: 'Salva costi' }));
    // La conferma del salvataggio è "Ultimo salvataggio" nel form (specs/05).
    await expect(formCosti(page).getByText('Ultimo salvataggio:', { exact: false })).toBeVisible({ timeout: 20_000 });
  }

  const campo = (page: Page, etichetta: string) => page.getByLabel(etichetta, { exact: true });

  test('COS-01: impostare per la prima volta i costi: salvati solo alla conferma', async ({ page }) => {
    const { id } = await creaEApri(page);
    await expect(page.getByRole('heading', { name: 'Costi', exact: true })).toBeVisible();
    await expect(page.getByLabel('Pre-asilo richiesto')).not.toBeChecked();
    await expect(page.getByLabel('Post-asilo richiesto')).not.toBeChecked();
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
    await expect(page.getByLabel('Pre-asilo richiesto')).not.toBeChecked();
    await expect(page.getByLabel('Post-asilo richiesto')).not.toBeChecked();
    // I gettoni non fanno parte dei costi del bambino.
    await expect(page.getByLabel(/gettone/i)).toHaveCount(0);

    // Con la sezione, la retta segue il tipo (assegnazione fatta come admin).
    await db!.from('bambini').update({ sezione_id: materna.id }).eq('id', id);
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('161,11');
    await db!.from('bambini').update({ sezione_id: primavera.id }).eq('id', id);
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('201,22');

    // Se cambio un valore in "Prezzi", la proposta mostra il valore nuovo; non è salvata.
    await scriviPrezzi(db!, { buono_pasto: 6.5 });
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.buonoPasto)).toHaveValue('6,50');
    expect(await leggiCosti(db!, id)).toBeNull();
  });

  test('COS-03: un bambino con costi già salvati non cambia mai', async ({ page }) => {
    const sezioneA = await creaSezioneConTipo(db!, 'materna');
    const sezioneB = await creaSezioneConTipo(db!, 'primavera');
    sezioniCreate.push(sezioneA.id, sezioneB.id);
    await scriviPrezzi(db!, { retta_materna: 160, retta_primavera: 200, buono_pasto: 6, marca_da_bollo: 2 });

    // Il bambino nasce in una sezione con tipo: la riga dei costi c'è subito.
    const { id } = await creaEApri(page, sezioneA.nome);
    await expect.poll(async () => leggiCosti(db!, id)).not.toBeNull();
    const prima = await leggiCosti(db!, id);

    // Cambio un prezzo, il tipo della sezione, e sposto il bambino altrove.
    await scriviPrezzi(db!, { retta_materna: 999.99, buono_pasto: 8.88, marca_da_bollo: 3.33 });
    await impostaTipoSezione(db!, sezioneA.id, 'primavera');
    await db!.from('bambini').update({ sezione_id: sezioneB.id }).eq('id', id);

    expect(await leggiCosti(db!, id)).toEqual(prima);
    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue(formatta(prima!.prezzo_mensile));
    await expect(campo(page, ETICHETTE_COSTI.buonoPasto)).toHaveValue(formatta(prima!.prezzo_buono_pasto));
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
      await page.getByRole('button', { name: 'Salva costi' }).click();
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

    await page.getByLabel('Pre-asilo richiesto').check();
    await campo(page, ETICHETTE_COSTI.preAsilo).fill('30');
    await page.getByLabel('Post-asilo richiesto').check();
    await campo(page, ETICHETTE_COSTI.postAsilo).fill('40');
    await salvaCosti(page);

    await expect
      .poll(async () => leggiCosti(db!, id))
      .toMatchObject({ pre_asilo_richiesto: true, prezzo_pre_asilo: 30, post_asilo_richiesto: true, prezzo_post_asilo: 40 });

    await page.reload();
    await expect(page.getByLabel('Pre-asilo richiesto')).toBeChecked();
    await expect(campo(page, ETICHETTE_COSTI.preAsilo)).toHaveValue('30,00');
    await expect(page.getByLabel('Post-asilo richiesto')).toBeChecked();
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
    await page.getByRole('button', { name: 'Salva costi' }).click();

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
    await page.getByRole('button', { name: 'Salva costi' }).click();

    await expect(alertApp(page)).toBeVisible({ timeout: 20_000 });
    expect(await leggiCosti(db!, id)).toBeNull();

    await page.reload();
    await expect(campo(page, ETICHETTE_COSTI.retta)).toHaveValue('');
    await expect(page.getByLabel('Email promemoria retta')).toHaveValue('');
  });
});

