// Requisito: specs/50 - amministrazione_base.md
//
// ATTENZIONE: questi test scrivono davvero in `sezioni`/`bambini`/
// `maestre_sezioni`/`profili` sul progetto Supabase di test — vedi la
// nota in 13-segna-presenza.spec.ts.
//
// Gli scenari AMM-01..AMM-06 (tipo della sezione e costi iniziali del bambino,
// issue #396) sono nel blocco "50 — Tipo di sezione e costi iniziali" in fondo:
// usano sezioni di prova con nome unico e bambini con cognome unico, ripuliti
// alla fine con il client admin (e2e/fixture-prezzi.ts).
import { test, expect, type Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  alertApp,
  dataOggiRoma,
  formCreaBambino,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  rigaSezione,
  statoAutenticazione,
  clickEAttendiAzione,
} from './helpers';
import { cardBambini } from './pagina-giornata';
import { accediComeAdminDb, creaBambinoFixture, eliminaBambinoFixture } from './fixture-bambino';
import {
  creaSezioneConTipo,
  formatta,
  idBambinoPerCognome,
  leggiCosti,
  leggiPrezzi,
  leggiTipoSezione,
  pulisciSezioneEBambini,
  scriviCostiInModoEsplicito,
} from './fixture-prezzi';
import {
  ETICHETTE_COSTI,
  campoTipoNuovaSezione,
  campoTipoRiga,
  creaBambinoDaForm,
  formCosti,
  formCreaSezione,
  tipoSezioneInElenco,
} from './pagina-prezzi';
import { PERCORSO_UTENTI, aggiornaRigaUtente, schedaUtente, selectRuolo } from './pagina-personale';

function gruppoClassiAssegnate(page: Page) {
  return page.locator('#classi-e-bambini-assegnati');
}

function gruppoSenzaClasse(page: Page) {
  return page.locator('#bambini-senza-classe');
}

test.describe('50 — Amministrazione base', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  test('/admin: elementi presenti + accessibilità', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Sezioni', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bambini', exact: true })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('creare una sezione la rende subito disponibile in elenco', async ({ page }) => {
    await page.goto('/admin');
    const nome = `Sezione E2E ${Date.now()}`;

    await page.getByPlaceholder('Nome sezione (es. Girasoli)').fill(nome);
    // Due form "Crea" in pagina (Anni scolastici + Sezioni, in quest'ordine
    // nel DOM — vedi specs/04 - data-types.md): questo è quello di Sezioni.
    await page.getByRole('button', { name: 'Crea' }).nth(1).click();

    await expect(rigaSezione(page, nome)).toBeVisible({ timeout: 20_000 });
  });

  test('creare un bambino con note allergie lo mostra in evidenza', async ({ page }) => {
    await page.goto('/admin');
    const form = formCreaBambino(page);
    const opzioniSezione = form.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip((await opzioniSezione.count()) === 0, 'nessuna sezione disponibile, crea prima una sezione');

    const cognome = `E2eTest${Date.now()}`;
    await page.getByPlaceholder('Nome', { exact: true }).fill('Bimbo');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2020-01-01');
    await page.getByLabel('Sesso').selectOption('F');
    await form.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await page.getByPlaceholder('Allergie o intolleranze (opzionale)').fill('Allergia test E2E');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const riga = page.getByText(cognome, { exact: false }).locator('..');
    await expect(riga).toContainText('Allergia test E2E', { timeout: 20_000 });
  });

  test('vedere le classi con i bambini assegnati', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Classi e bambini assegnati' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Bambini senza classe o disattivati' })
    ).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('creare un bambino senza sezione lo mette nell\'elenco "senza classe"', async ({ page }) => {
    await page.goto('/admin');
    const cognome = `E2eSenzaSezione${Date.now()}`;

    await page.getByPlaceholder('Nome', { exact: true }).fill('Orfano');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2020-06-01');
    await page.getByLabel('Sesso').selectOption('M');
    // Nessuna sezione scelta: la sezione è facoltativa alla creazione.
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    await expect(gruppoSenzaClasse(page).locator('li', { hasText: cognome })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('assegnare rapidamente una sezione a un bambino senza classe', async ({ page }) => {
    await page.goto('/admin');
    const form = formCreaBambino(page);
    const opzioniSezione = form.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip((await opzioniSezione.count()) === 0, 'nessuna sezione disponibile, crea prima una sezione');

    const cognome = `E2eAssegnaRapido${Date.now()}`;
    await page.getByPlaceholder('Nome', { exact: true }).fill('DaAssegnare');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2020-07-01');
    await page.getByLabel('Sesso').selectOption('F');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const riga = gruppoSenzaClasse(page).locator('li', { hasText: cognome });
    await expect(riga).toBeVisible({ timeout: 20_000 });

    await riga.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await riga.getByRole('button', { name: 'Assegna' }).click();

    await expect(gruppoSenzaClasse(page).locator('li', { hasText: cognome })).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(gruppoClassiAssegnate(page).locator('li', { hasText: cognome })).toBeVisible();
  });

  test('modificare i dati di un bambino dalla scheda di dettaglio', async ({ page }) => {
    await page.goto('/admin');
    const form = formCreaBambino(page);
    const opzioniSezione = form.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip((await opzioniSezione.count()) === 0, 'nessuna sezione disponibile, crea prima una sezione');

    const cognome = `E2eModifica${Date.now()}`;
    await page.getByPlaceholder('Nome', { exact: true }).fill('Modifica');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2020-02-02');
    await page.getByLabel('Sesso').selectOption('F');
    await form.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const link = page.getByRole('link', { name: new RegExp(cognome) });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await page.waitForURL(/\/admin\/bambini\/.+/);

    await page.getByPlaceholder('Altre note (opzionale)').fill('Nota aggiornata E2E');
    await clickEAttendiAzione(page, page.getByRole('button', { name: 'Salva modifiche' }));

    await expect(page.getByPlaceholder('Altre note (opzionale)')).toHaveValue(
      'Nota aggiornata E2E',
      { timeout: 20_000 }
    );

    // La modifica resta salvata anche dopo un ricaricamento.
    await page.reload();
    await expect(page.getByPlaceholder('Altre note (opzionale)')).toHaveValue('Nota aggiornata E2E');
  });

  test('disattivare un bambino lo rimuove da Presenze/Pasto, riattivarlo lo fa ricomparire', async ({
    page,
  }) => {
    await page.goto('/admin');
    const form = formCreaBambino(page);
    const opzioniSezione = form.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip((await opzioniSezione.count()) === 0, 'nessuna sezione disponibile, crea prima una sezione');

    const cognome = `E2eDisattiva${Date.now()}`;
    await page.getByPlaceholder('Nome', { exact: true }).fill('Disattiva');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.getByLabel('Data di nascita').fill('2020-03-03');
    await page.getByLabel('Sesso').selectOption('M');
    await form.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const link = page.getByRole('link', { name: new RegExp(cognome) });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await page.waitForURL(/\/admin\/bambini\/.+/);

    // Prima di disattivarlo, il bambino ha la sua card nella schermata
    // unica "Presenze e pasti" (specs/10), raggruppata per sezione
    // (verifico come admin, che vede tutte le sezioni). Il nome può
    // comparire anche nell'elenco "Bambini senza presenza" del box Rojac,
    // quindi mi limito alle card.
    await page.goto(`/dashboard/giornata?data=${dataOggiRoma()}`);
    await expect(cardBambini(page).filter({ hasText: cognome })).toHaveCount(1);

    // Torno alla scheda di dettaglio tramite l'elenco.
    await page.goto('/admin');
    await page.getByRole('link', { name: new RegExp(cognome) }).click();
    await page.waitForURL(/\/admin\/bambini\/.+/);

    await page.getByRole('button', { name: 'Disattiva bambino' }).click();
    await expect(page.getByRole('button', { name: 'Riattiva bambino' })).toBeVisible({
      timeout: 20_000,
    });

    // Non compare più tra i bambini assegnati, ma tra "senza classe o
    // disattivati", né più in Presenze per la sua ex classe.
    await page.goto('/admin');
    await expect(gruppoClassiAssegnate(page).locator('li', { hasText: cognome })).toHaveCount(0);
    await expect(gruppoSenzaClasse(page).locator('li', { hasText: cognome })).toBeVisible();

    await page.goto(`/dashboard/giornata?data=${dataOggiRoma()}`);
    await expect(cardBambini(page).filter({ hasText: cognome })).toHaveCount(0);

    // Riattivo dal dettaglio: torna a comparire tra i bambini assegnati.
    await page.goto('/admin');
    await gruppoSenzaClasse(page).locator('li', { hasText: cognome }).getByRole('link').click();
    await page.waitForURL(/\/admin\/bambini\/.+/);
    await page.getByRole('button', { name: 'Riattiva bambino' }).click();
    await expect(page.getByRole('button', { name: 'Disattiva bambino' })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto(`/dashboard/giornata?data=${dataOggiRoma()}`);
    await expect(cardBambini(page).filter({ hasText: cognome })).toHaveCount(1);
  });

  test('/admin/maestre: elementi presenti + accessibilità', async ({ page }) => {
    await page.goto(PERCORSO_UTENTI);
    await expect(page.getByRole('heading', { name: 'Utenti e ruoli' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Assegna maestre e assistenti alle sezioni' })
    ).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('promuovere un utente a maestra ne aggiorna il ruolo', async ({ page }) => {
    test.skip(
      !process.env.E2E_UTENTE_DA_PROMUOVERE_EMAIL,
      'richiede E2E_UTENTE_DA_PROMUOVERE_EMAIL: email di un account esistente con ruolo genitore da promuovere'
    );

    await page.goto(PERCORSO_UTENTI);
    const riga = schedaUtente(page, process.env.E2E_UTENTE_DA_PROMUOVERE_EMAIL!);
    await selectRuolo(riga).selectOption('maestra');
    await aggiornaRigaUtente(page, riga);

    await expect(selectRuolo(riga)).toHaveValue('maestra');
  });

  test('assegnare e poi rimuovere una maestra da una sezione', async ({ page }) => {
    await page.goto(PERCORSO_UTENTI);
    const selectMaestra = page.locator('select[name="maestra_id"]');
    const selectSezione = page.locator('select[name="sezione_id"]');
    const opzioniMaestra = selectMaestra.locator('option:not([value=""])');
    const opzioniSezione = selectSezione.locator('option:not([value=""])');
    test.skip(
      (await opzioniMaestra.count()) === 0 || (await opzioniSezione.count()) === 0,
      'serve almeno una maestra e una sezione esistenti'
    );

    // Id (non il testo, che per un account di test può anche essere
    // vuoto) delle due opzioni scelte, per individuare più avanti
    // esattamente e solo l'assegnazione di questo test.
    const idMaestra = await opzioniMaestra.first().getAttribute('value');
    const idSezione = await opzioniSezione.first().getAttribute('value');

    const formAssegnazione = () =>
      page
        .locator('form', { has: page.locator(`input[name="maestra_id"][value="${idMaestra}"]`) })
        .filter({ has: page.locator(`input[name="sezione_id"][value="${idSezione}"]`) });

    // "select[name=...] option:not([value=''])" prende sempre la prima
    // opzione reale: su un progetto di test con pochi dati può
    // coincidere con un'assegnazione fixture già esistente (es. la
    // maestra di test sulla sua sezione, usata da altri requisiti). In
    // quel caso il click "Assegna" è solo un no-op idempotente: non
    // rimuovo poi nulla, non è compito di questo test ripulire un
    // fixture che non ha creato lui.
    const assegnazioneGiaEsistente = (await formAssegnazione().count()) > 0;

    await selectMaestra.selectOption({ index: 1 });
    await selectSezione.selectOption({ index: 1 });
    await clickEAttendiAzione(page, page.getByRole('button', { name: 'Assegna' }));

    if (assegnazioneGiaEsistente) return;

    const bottoneRimuovi = formAssegnazione().getByRole('button');
    if (await bottoneRimuovi.count()) {
      await bottoneRimuovi.click();
    }
  });
});

// ---------------------------------------------------------------------------
// Tipo della sezione e costi iniziali del bambino (issue #396, AMM-01..AMM-06)
// ---------------------------------------------------------------------------
test.describe('50 — Tipo di sezione e costi iniziali', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  let db: SupabaseClient | null = null;
  const sezioniCreate: string[] = [];
  const nomiSezioniUI: string[] = [];
  const cognomiCreati: string[] = [];
  const idFixtureCreati: string[] = [];

  test.beforeAll(async () => {
    db = await accediComeAdminDb();
  });

  test.afterAll(async () => {
    if (!db) return;
    for (const id of idFixtureCreati) await eliminaBambinoFixture(db, id);
    await pulisciSezioneEBambini(db, null, cognomiCreati);
    for (const id of sezioniCreate) await pulisciSezioneEBambini(db, id, []);
    for (const nome of nomiSezioniUI) await db.from('sezioni').delete().eq('nome', nome);
  });

  test.beforeEach(async () => {
    test.skip(!hasCredenziali('admin') || !db, 'richiede E2E_ADMIN_EMAIL/PASSWORD e le variabili Supabase');
  });

  function cognomeUnico(prefisso: string): string {
    const cognome = `${prefisso}${Date.now()}${Math.floor(Math.random() * 1000)}`;
    cognomiCreati.push(cognome);
    return cognome;
  }

  test('AMM-01: creare una sezione scegliendo il tipo (facoltativo)', async ({ page }) => {
    await page.goto('/admin');
    const campoTipo = campoTipoNuovaSezione(page);
    await expect(campoTipo).toHaveValue(''); // "Nessuno" è il valore iniziale
    await expect(campoTipo.locator('option')).toHaveText(['Nessuno', 'Materna', 'Primavera']);
    await expect(campoTipo.locator('option')).toHaveCount(3);

    const conTipo = `Sezione E2E tipo ${Date.now()}`;
    const senzaTipo = `Sezione E2E nessuno ${Date.now()}`;
    nomiSezioniUI.push(conTipo, senzaTipo);

    await page.getByPlaceholder('Nome sezione (es. Girasoli)').fill(conTipo);
    await campoTipo.selectOption('primavera');
    await clickEAttendiAzione(page, formCreaSezione(page).getByRole('button', { name: 'Crea' }));
    await expect(rigaSezione(page, conTipo)).toBeVisible({ timeout: 20_000 });
    await expect(tipoSezioneInElenco(rigaSezione(page, conTipo))).toHaveText('Primavera');

    // Il tipo è facoltativo: con "Nessuno" la sezione si crea comunque, senza indicazione.
    await page.getByPlaceholder('Nome sezione (es. Girasoli)').fill(senzaTipo);
    await clickEAttendiAzione(page, formCreaSezione(page).getByRole('button', { name: 'Crea' }));
    await expect(rigaSezione(page, senzaTipo)).toBeVisible({ timeout: 20_000 });
    await expect(tipoSezioneInElenco(rigaSezione(page, senzaTipo))).toHaveCount(0);

    const { data } = await db!.from('sezioni').select('nome, tipo').in('nome', [conTipo, senzaTipo]);
    const tipi = Object.fromEntries((data ?? []).map((r) => [r.nome as string, r.tipo as string | null]));
    expect(tipi[conTipo]).toBe('primavera');
    expect(tipi[senzaTipo]).toBeNull();
    await nessunaViolazioneA11yGrave(page);
  });

  test('AMM-02: modificare il tipo di una sezione non tocca i bambini già presenti', async ({ page }) => {
    const sezione = await creaSezioneConTipo(db!, null); // come le sezioni create prima di questa funzione
    sezioniCreate.push(sezione.id);
    const bambino = await creaBambinoFixture(db!);
    idFixtureCreati.push(bambino.id);
    await db!.from('bambini').update({ sezione_id: sezione.id }).eq('id', bambino.id);
    const costi = {
      prezzo_mensile: 123.45,
      prezzo_buono_pasto: 5.55,
      prezzo_marca_da_bollo: 1.99,
      pre_asilo_richiesto: false,
      prezzo_pre_asilo: 33.33,
      post_asilo_richiesto: true,
      prezzo_post_asilo: 44.44,
      email_promemoria: null,
    };
    await scriviCostiInModoEsplicito(db!, bambino.id, costi);

    await page.goto('/admin');
    const riga = rigaSezione(page, sezione.nome);
    await expect(tipoSezioneInElenco(riga)).toHaveCount(0);

    await campoTipoRiga(riga, sezione.nome).selectOption('materna');
    await clickEAttendiAzione(page, riga.getByRole('button', { name: 'Salva tipo' }));
    await expect.poll(async () => leggiTipoSezione(db!, sezione.id)).toBe('materna');
    await page.reload();
    await expect(tipoSezioneInElenco(rigaSezione(page, sezione.nome))).toHaveText('Materna');

    await campoTipoRiga(rigaSezione(page, sezione.nome), sezione.nome).selectOption('primavera');
    await clickEAttendiAzione(page, rigaSezione(page, sezione.nome).getByRole('button', { name: 'Salva tipo' }));
    await expect.poll(async () => leggiTipoSezione(db!, sezione.id)).toBe('primavera');
    await page.reload();
    await expect(tipoSezioneInElenco(rigaSezione(page, sezione.nome))).toHaveText('Primavera');

    await campoTipoRiga(rigaSezione(page, sezione.nome), sezione.nome).selectOption('');
    await clickEAttendiAzione(page, rigaSezione(page, sezione.nome).getByRole('button', { name: 'Salva tipo' }));
    await expect.poll(async () => leggiTipoSezione(db!, sezione.id)).toBeNull();
    await page.reload();
    await expect(tipoSezioneInElenco(rigaSezione(page, sezione.nome))).toHaveCount(0);

    // Il bambino e i suoi costi sono rimasti identici, al centesimo.
    expect(await leggiCosti(db!, bambino.id)).toEqual(costi);
    const { data } = await db!.from('bambini').select('sezione_id').eq('id', bambino.id).single();
    expect(data?.sezione_id).toBe(sezione.id);
  });

  test('AMM-03: creare un bambino in una sezione con tipo: i costi nascono subito', async ({ page }) => {
    const sezione = await creaSezioneConTipo(db!, 'primavera');
    sezioniCreate.push(sezione.id);
    // Legge i prezzi del momento: la retta attesa è quella del tipo della sezione.
    const prezzi = await leggiPrezzi(db!);

    const cognome = cognomeUnico('E2eAmm03');
    await creaBambinoDaForm(page, cognome, sezione.nome);
    const id = await idBambinoPerCognome(db!, cognome);

    await expect
      .poll(async () => {
        const c = await leggiCosti(db!, id);
        return c && { ...c, email_promemoria: c.email_promemoria ?? '' };
      })
      .toEqual({
        prezzo_mensile: prezzi.retta_primavera,
        prezzo_buono_pasto: prezzi.buono_pasto,
        prezzo_marca_da_bollo: prezzi.marca_da_bollo,
        pre_asilo_richiesto: false,
        prezzo_pre_asilo: prezzi.abbonamento_pre_asilo,
        post_asilo_richiesto: false,
        prezzo_post_asilo: prezzi.abbonamento_post_asilo,
        email_promemoria: '',
      });

    // La scheda mostra già i valori come salvati (c'è la data dell'ultimo salvataggio).
    await page.goto(`/admin/bambini/${id}`);
    await expect(page.getByLabel(ETICHETTE_COSTI.retta, { exact: true })).toHaveValue(formatta(prezzi.retta_primavera));
    await expect(page.getByLabel(ETICHETTE_COSTI.buonoPasto, { exact: true })).toHaveValue(formatta(prezzi.buono_pasto));
    await expect(formCosti(page).getByText('Ultimo salvataggio:', { exact: false })).toBeVisible();
  });

  test('AMM-04: creare un bambino senza sezione o in una sezione senza tipo: nessuna riga di costi', async ({ page }) => {
    const senzaTipo = await creaSezioneConTipo(db!, null);
    sezioniCreate.push(senzaTipo.id);

    for (const nomeSezione of [null, senzaTipo.nome]) {
      const cognome = cognomeUnico('E2eAmm04');
      await creaBambinoDaForm(page, cognome, nomeSezione);
      // La creazione riesce come oggi: nessun errore in pagina.
      await expect(alertApp(page)).toHaveCount(0);
      const id = await idBambinoPerCognome(db!, cognome);
      expect(await leggiCosti(db!, id), cognome).toBeNull();

      // Nella scheda i costi sono solo proposti, non salvati.
      await page.goto(`/admin/bambini/${id}`);
      await expect(page.getByRole('heading', { name: 'Costi', exact: true })).toBeVisible();
      await expect(formCosti(page).getByText('Ultimo salvataggio:', { exact: false })).toHaveCount(0);
    }
  });

  // AMM-05: se i costi iniziali non si possono scrivere, il bambino non viene
  // creato. NON TESTABILE IN E2E (per farlo fallire bisognerebbe rompere lo schema
  // del database di test condiviso): è coperto a livello di funzione del database
  // dal test pgTAP `supabase/tests/database/crea_bambino_con_costi.test.sql`
  // (sezione "AMM-05"), perché la creazione è un'unica funzione
  // `crea_bambino_con_costi` (una sola transazione).

  test('AMM-06: spostare un bambino in un\'altra sezione non tocca i suoi costi', async ({ page }) => {
    const destinazione = await creaSezioneConTipo(db!, 'primavera');
    sezioniCreate.push(destinazione.id);

    // Bambino 1: ha la riga di costi (valori distintivi).
    const conCosti = await creaBambinoFixture(db!);
    idFixtureCreati.push(conCosti.id);
    const costi = {
      prezzo_mensile: 123.45,
      prezzo_buono_pasto: 5.55,
      prezzo_marca_da_bollo: 1.99,
      pre_asilo_richiesto: true,
      prezzo_pre_asilo: 33.33,
      post_asilo_richiesto: false,
      prezzo_post_asilo: 44.44,
      email_promemoria: null,
    };
    await scriviCostiInModoEsplicito(db!, conCosti.id, costi);
    // Bambino 2: nessuna riga di costi.
    const senzaCosti = await creaBambinoFixture(db!);
    idFixtureCreati.push(senzaCosti.id);
    // Entrambi senza sezione, così compaiono tra quelli da assegnare.
    await db!.from('bambini').update({ sezione_id: null }).in('id', [conCosti.id, senzaCosti.id]);

    await page.goto('/admin');
    for (const b of [conCosti, senzaCosti]) {
      const riga = gruppoSenzaClasse(page).locator('li', { hasText: b.cognome });
      await riga.locator('select[name="sezione_id"]').selectOption({ label: destinazione.nome });
      await clickEAttendiAzione(page, riga.getByRole('button', { name: 'Assegna' }));
      await expect(gruppoSenzaClasse(page).locator('li', { hasText: b.cognome })).toHaveCount(0, { timeout: 20_000 });
    }

    // Costi identici; e per chi non li aveva, l'assegnazione non ha creato la riga.
    expect(await leggiCosti(db!, conCosti.id)).toEqual(costi);
    expect(await leggiCosti(db!, senzaCosti.id)).toBeNull();

    // La scheda del secondo propone la retta del tipo della nuova sezione.
    const prezzi = await leggiPrezzi(db!);
    await page.goto(`/admin/bambini/${senzaCosti.id}`);
    await expect(page.getByLabel(ETICHETTE_COSTI.retta, { exact: true })).toHaveValue(formatta(prezzi.retta_primavera));
  });
});
