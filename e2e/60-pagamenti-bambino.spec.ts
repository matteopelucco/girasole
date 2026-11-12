// Requisito: specs/60 - pagamenti-bambino.md
//
// I dati sono propri di ogni test (fixture `bambino`, e2e/fixture-bambino.ts):
// un bambino con nome unico creato e cancellato dal test, con login admin e
// chiave anon (RLS), mai service_role. Le comunicazioni retta del bambino
// vengono inserite direttamente nel DB (la vista è di sola lettura, e un
// invio vero passerebbe da Resend e dal calendario): spariscono con il
// bambino (ON DELETE CASCADE). Nessun test dipende dal giorno della
// settimana né scrive sulle presenze (trigger 0022, scritture chiuse la
// domenica), quindi nessuno salta per quel motivo: gli unici skip sono per
// credenziali o sessioni assenti (E2E_*_EMAIL/PASSWORD, NEXT_PUBLIC_SUPABASE_*).
//
// Gli scenari con dati usano un anno scolastico fisso e lontano (2020/2021,
// `?anno=2020`), così non dipendono dalla data in cui gira la suite.
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, type BambinoFixture } from './fixture-bambino';
import {
  clickEAttendiAzione,
  hasCredenziali,
  meseSuccessivoRoma,
  nessunaViolazioneA11yGrave,
  statoAutenticazione,
  verificaFocusTrattenuto,
} from './helpers';
import { inserisciRettaConGettoni, meseCorrenteRoma, rigaRette } from './pagina-gettoni-retta';
import {
  annoScolasticoDi,
  apriModificaImporti,
  apriPagamentiBambino,
  bottoneModificaImporti,
  campoMotivo,
  campoNota,
  campoVoce,
  finestraImportoDiverso,
  inserisciComunicazioneConVoci,
  inserisciComunicazioneDaVerificare,
  leggiComunicazione,
  leggiNotaPagamento,
  leggiStorico,
  marcaImportoDiverso,
  modificaViaFunzione,
  pulsanteSalvaModifica,
  rigaMese,
  type VociRiga,
} from './pagina-pagamenti-bambino';

const PERCORSO = '/admin/pagamenti-bambino';
const ANNO_FISSO = 2020;
const MESI_ANNO_SCOLASTICO = [
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
];

type VociComunicazione = {
  retta_mensile: number;
  costo_pasti?: number;
  conguaglio_pasti?: number;
  marca_da_bollo?: number;
  costo_pre_asilo?: number;
  costo_post_asilo?: number;
  costi_extra?: number;
  note_costi_extra?: string;
  credito_debito?: number;
  nota_credito_debito?: string;
  totale: number;
};

async function inserisciComunicazione(
  db: SupabaseClient,
  bambino: BambinoFixture,
  mese: string,
  voci: VociComunicazione
) {
  const { error } = await db.from('comunicazioni_retta').insert({
    bambino_id: bambino.id,
    mese,
    costo_pasti: 0,
    conguaglio_pasti: 0,
    costo_pre_asilo: 0,
    costo_post_asilo: 0,
    costi_extra: 0,
    email_destinatario: 'e2e-pagamenti@example.com',
    inviata_da_nome: 'E2E',
    ...voci,
  });
  if (error) throw new Error(`Inserimento della comunicazione di prova non riuscito: ${error.message}`);
}

function urlBambino(bambino: BambinoFixture, anno: number = ANNO_FISSO) {
  return `${PERCORSO}?bambino=${bambino.id}&anno=${anno}`;
}

test.describe('60 — Pagamenti bambino', () => {
  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('il menu raggruppa "Rette" e "Pagamenti bambino" sotto "Pagamenti"', async ({ page }) => {
      await page.goto('/admin');
      const menu = page.getByRole('navigation');

      // "Pagamenti" è solo l'intestazione del gruppo, non un link.
      const gruppo = menu.getByRole('group', { name: 'Pagamenti', exact: true });
      await expect(gruppo).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Pagamenti', exact: true })).toHaveCount(0);

      // Voce di primo livello, per confrontare l'indentazione (il gruppo "Calendario" ha voci rientrate).
      const calendario = menu.getByRole('link', { name: 'Sezioni e bambini', exact: true });
      const rette = menu.getByRole('link', { name: 'Rette', exact: true });
      const pagamentiBambino = menu.getByRole('link', { name: 'Pagamenti bambino', exact: true });
      const impostazioni = menu.getByRole('link', { name: 'Impostazioni', exact: true });
      await expect(rette).toBeVisible();
      await expect(pagamentiBambino).toBeVisible();

      // Ordine verticale: gruppo, Rette, Pagamenti bambino, poi il resto.
      const y = async (l: typeof rette) => (await l.boundingBox())!.y;
      // L'indentazione è il padding interno del link: si misura l'icona al suo interno.
      const x = async (l: typeof rette) => (await l.locator('span').first().boundingBox())!.x;
      expect(await y(gruppo)).toBeLessThan(await y(rette));
      expect(await y(rette)).toBeLessThan(await y(pagamentiBambino));
      expect(await y(pagamentiBambino)).toBeLessThan(await y(impostazioni));
      // "Rette" non è più di primo livello: è rientrata rispetto alle voci di primo livello.
      expect(await x(rette)).toBeGreaterThan(await x(calendario));
      expect(await x(pagamentiBambino)).toBeGreaterThan(await x(calendario));

      await rette.click();
      await page.waitForURL('/admin/rette');
      await expect(page.getByRole('heading', { name: /Rette —/ })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Rette', exact: true })).toHaveAttribute('aria-current', 'page');
    });

    test('aprire la pagina senza aver scelto un bambino mostra il selettore e nessuna tabella', async ({ page }) => {
      await page.goto('/admin');
      await page.getByRole('navigation').getByRole('link', { name: 'Pagamenti bambino', exact: true }).click();
      await page.waitForURL(PERCORSO);

      await expect(page.getByRole('heading', { name: 'Pagamenti bambino', level: 1 })).toBeVisible();
      await expect(page.getByLabel('Bambino')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Mostra' })).toBeVisible();
      await expect(page.getByText('Scegli un bambino')).toBeVisible();
      await expect(page.getByRole('table')).toHaveCount(0);
      await nessunaViolazioneA11yGrave(page);
    });

    test('scegliendo un bambino vedo i mesi dell\'anno scolastico, da settembre a giugno, in ordine', async ({
      page,
      bambino,
    }) => {
      await page.goto(PERCORSO);
      await page.getByLabel('Bambino').selectOption(bambino.id);
      await page.getByRole('button', { name: 'Mostra' }).click();
      await page.waitForURL(new RegExp(`bambino=${bambino.id}`));

      await expect(page.getByRole('heading', { name: bambino.nomeCompleto, level: 2 })).toBeVisible();
      // L'anno scolastico di riferimento (quello del mese corrente): "AAAA/AAAA+1".
      const anno = page.getByText(/Anno scolastico \d{4}\/\d{4}/);
      await expect(anno).toBeVisible();
      const inizio = Number(((await anno.textContent()) ?? '').match(/(\d{4})\/\d{4}/)![1]);

      const intestazioniMese = page.getByRole('rowheader');
      await expect(intestazioniMese).toHaveCount(10);
      const testi = (await intestazioniMese.allTextContents()).map((t) => t.trim());
      expect(testi).toEqual(
        MESI_ANNO_SCOLASTICO.map((nome, i) => `${nome} ${i < 4 ? inizio : inizio + 1}`)
      );
      await nessunaViolazioneA11yGrave(page);
    });

    test('un mese comunicato mostra le voci che compongono l\'importo richiesto', async ({
      page,
      bambino,
      adminDb,
    }) => {
      await inserisciComunicazione(adminDb!, bambino, `${ANNO_FISSO}-09`, {
        retta_mensile: 250,
        marca_da_bollo: 2,
        costo_pasti: 66,
        conguaglio_pasti: -11,
        costo_pre_asilo: 30,
        costo_post_asilo: 20,
        costi_extra: 15,
        note_costi_extra: 'Gita di prova',
        credito_debito: -5,
        nota_credito_debito: 'Rimborso di prova',
        totale: 367,
      });

      await page.goto(urlBambino(bambino));
      const riga = page.getByRole('row', { name: /settembre 2020/ });
      for (const voce of ['250,00 €', '2,00 €', '66,00 €', '-11,00 €', '30,00 €', '20,00 €', '15,00 €', '-5,00 €']) {
        // Il nome della cella può includere la nota sotto l'importo: conta l'inizio.
        await expect(riga.getByRole('cell', { name: new RegExp(`^${voce}`) })).toBeVisible();
      }
      await expect(riga.getByText('Gita di prova')).toBeVisible();
      await expect(riga.getByText('Rimborso di prova')).toBeVisible();
      await expect(riga.getByText(/Inviata il/)).toBeVisible();

      for (const colonna of [
        'Retta mensile',
        'Marca da bollo',
        'Pasti',
        'Conguaglio pasti',
        'Pre-asilo',
        'Post-asilo',
        'Gettoni pre-asilo',
        'Gettoni post-asilo',
        'Costi extra',
        'Credito/Debito',
        'Totale',
      ]) {
        await expect(page.getByRole('columnheader', { name: colonna, exact: true })).toBeVisible();
      }
      await nessunaViolazioneA11yGrave(page);
    });

    test('il totale di ogni mese è ben visibile ed è quello registrato nella comunicazione', async ({
      page,
      bambino,
      adminDb,
    }) => {
      await inserisciComunicazione(adminDb!, bambino, `${ANNO_FISSO}-10`, {
        retta_mensile: 250,
        marca_da_bollo: 2,
        costo_pasti: 66,
        totale: 318,
      });

      await page.goto(urlBambino(bambino));
      const riga = page.getByRole('row', { name: /ottobre 2020/ });
      const totale = riga.getByRole('cell', { name: '318,00 €', exact: true });
      await expect(totale).toBeVisible();

      const stile = (cella: typeof totale) =>
        cella.evaluate((el) => {
          const s = getComputedStyle(el);
          return { dimensione: parseFloat(s.fontSize), peso: Number(s.fontWeight) };
        });
      const stileTotale = await stile(totale);
      const stileRetta = await stile(riga.getByRole('cell', { name: '250,00 €', exact: true }));
      expect(stileTotale.peso).toBeGreaterThanOrEqual(600);
      expect(stileTotale.dimensione).toBeGreaterThan(stileRetta.dimensione);
    });

    test('PAG-01: i gettoni sono nel dettaglio e nel totale del mese', async ({ page, bambino, adminDb }) => {
      // Mese con gettoni: 250 retta + 21 (3 gettoni pre) + 16 (2 gettoni post) = 287.
      await inserisciRettaConGettoni(adminDb!, bambino, `${ANNO_FISSO}-09`, {
        rettaMensile: 250,
        gettoniPre: { importo: 21, numero: 3 },
        gettoniPost: { importo: 16, numero: 2 },
        totale: 287,
      });
      // Mese inviato prima dei gettoni (colonne nuove a default 0): totale di sempre.
      await inserisciRettaConGettoni(adminDb!, bambino, `${ANNO_FISSO}-10`, { rettaMensile: 100, totale: 100 });

      await page.goto(urlBambino(bambino));
      const riga = page.getByRole('row', { name: /settembre 2020/ });
      await expect(riga.getByRole('cell', { name: /^21,00 €.*3 gettoni$/ })).toBeVisible();
      await expect(riga.getByRole('cell', { name: /^16,00 €.*2 gettoni$/ })).toBeVisible();
      await expect(riga.getByRole('cell', { name: '287,00 €', exact: true })).toBeVisible();

      const rigaVecchia = page.getByRole('row', { name: /ottobre 2020/ });
      await expect(rigaVecchia.getByRole('cell', { name: /^0,00 €.*0 gettoni$/ })).toHaveCount(2);
      await expect(rigaVecchia.getByRole('cell', { name: '100,00 €', exact: true }).last()).toBeVisible();

      // Totale richiesto dell'anno: 287 + 100.
      const piede = page.getByRole('row', { name: /Totale richiesto/ });
      await expect(piede.getByRole('cell', { name: '387,00 €', exact: true })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('un mese senza comunicazione non mostra importi',async ({ page, bambino, adminDb }) => {
      await inserisciComunicazione(adminDb!, bambino, `${ANNO_FISSO}-09`, { retta_mensile: 100, totale: 100 });

      await page.goto(urlBambino(bambino));
      const riga = page.getByRole('row', { name: /novembre 2020/ });
      await expect(riga.getByText('Non ancora comunicata')).toBeVisible();
      await expect(riga).not.toContainText('€');
      // 9 mesi su 10 non sono comunicati.
      await expect(page.getByText('Non ancora comunicata')).toHaveCount(9);
    });

    test('vedo il totale complessivo richiesto nell\'anno scolastico', async ({ page, bambino, adminDb }) => {
      await inserisciComunicazione(adminDb!, bambino, `${ANNO_FISSO}-09`, { retta_mensile: 250, totale: 250 });
      await inserisciComunicazione(adminDb!, bambino, `${ANNO_FISSO + 1}-02`, { retta_mensile: 400.5, totale: 400.5 });

      await page.goto(urlBambino(bambino));
      const piede = page.getByRole('row', { name: /Totale richiesto/ });
      await expect(piede).toBeVisible();
      await expect(piede.getByRole('cell', { name: '650,50 €', exact: true })).toBeVisible();
    });

    test('posso navigare all\'anno scolastico precedente e tornare a quello successivo', async ({ page, bambino }) => {
      await page.goto(`${PERCORSO}?bambino=${bambino.id}`);
      const titolo = page.getByText(/Anno scolastico \d{4}\/\d{4}/);
      const iniziale = (await titolo.textContent())!.match(/(\d{4})\/(\d{4})/)!;
      const annoInizio = Number(iniziale[1]);

      // L'anno di riferimento è l'ultimo raggiungibile: niente freccia in avanti.
      await expect(page.getByRole('link', { name: 'Anno scolastico successivo' })).toHaveCount(0);

      await page.getByRole('link', { name: 'Anno scolastico precedente' }).click();
      await expect(page.getByText(`Anno scolastico ${annoInizio - 1}/${annoInizio}`, { exact: true })).toBeVisible();
      await expect(page.getByRole('rowheader').first()).toHaveText(`settembre ${annoInizio - 1}`);
      await expect(page.getByRole('heading', { name: bambino.nomeCompleto, level: 2 })).toBeVisible();

      await page.getByRole('link', { name: 'Anno scolastico successivo' }).click();
      await expect(page.getByText(`Anno scolastico ${annoInizio}/${annoInizio + 1}`, { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Anno scolastico successivo' })).toHaveCount(0);
    });

    test('la pagina si modifica solo da «Modifica importi»', async ({ page, bambino, adminDb }) => {
      await inserisciComunicazione(adminDb!, bambino, `${ANNO_FISSO}-09`, { retta_mensile: 250, totale: 250 });

      await page.goto(urlBambino(bambino));
      await expect(page.getByRole('row', { name: /settembre 2020/ })).toBeVisible();
      const main = page.getByRole('main');
      // Nessun campo per gli importi (solo la nota di testo e, sul mese
      // comunicato, i pulsanti del bonifico e "Salva") né pulsanti di invio o
      // annullo della comunicazione.
      await expect(main.locator('input:not([type="hidden"])')).toHaveCount(0);
      await expect(main.locator('textarea')).toHaveCount(1);
      await expect(main.locator('select')).toHaveCount(1);
      await expect(main.getByRole('button', { name: /Annulla invio|Invia|Segna/ })).toHaveCount(0);
      const nomi = (await main.getByRole('button').allTextContents()).map((t) => t.trim());
      // A finestra chiusa i soli pulsanti sono quelli del selettore, del bonifico, della nota
      // e «Modifica importi» (PAG-02, issue #421): nessun campo per gli importi.
      expect(nomi.sort()).toEqual(['Bonifico corretto', 'Importo diverso', 'Modifica importi', 'Mostra', 'Salva']);
      await expect(main.getByRole('dialog')).toHaveCount(0);
    });

    // --- Modifica importi (issue #421, PAG-02..PAG-15) -----------------------

    // Mese comunicato di partenza, con le cifre di specs/60:
    // 250 + 2 + 108 + 70 - 20 = 410.
    const MESE_MOD = `${ANNO_FISSO}-09`;
    const ETICHETTA_MESE_MOD = 'settembre 2020';
    const VOCI_BASE: VociRiga = {
      retta_mensile: 250,
      marca_da_bollo: 2,
      costo_pasti: 108,
      costo_pre_asilo: 70,
      credito_debito: -20,
      nota_credito_debito: 'Rimborso di prova',
      totale: 410,
    };

    test('PAG-02: il pulsante compare solo sui mesi comunicati', async ({ page, bambino, adminDb }) => {
      await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);

      await page.goto(urlBambino(bambino));
      await expect(bottoneModificaImporti(rigaMese(page, MESE_MOD))).toBeVisible();
      await expect(bottoneModificaImporti(rigaMese(page, `${ANNO_FISSO}-10`))).toHaveCount(0);

      // Anche sui mesi di un anno scolastico passato (2020/2021) e sui bambini non più attivi.
      const { error } = await adminDb!.from('bambini').update({ attiva: false }).eq('id', bambino.id);
      expect(error).toBeNull();
      await page.reload();
      await expect(bottoneModificaImporti(rigaMese(page, MESE_MOD))).toBeEnabled();
    });

    test('PAG-03: la finestra propone tutte le voci con i valori attuali', async ({ page, bambino, adminDb }) => {
      await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, {
        ...VOCI_BASE,
        conguaglio_pasti: -11,
        gettoni_pre_asilo: 21,
        numero_gettoni_pre_asilo: 3,
        gettoni_post_asilo: 16,
        numero_gettoni_post_asilo: 2,
        costi_extra: 15,
        note_costi_extra: 'Gita di prova',
        totale: 451,
      });

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      const finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);

      await expect(
        finestra.getByRole('heading', { name: new RegExp(`${bambino.nomeCompleto}.*settembre 2020`) })
      ).toBeVisible();
      const attesi: Record<string, string> = {
        'Retta mensile': '250,00',
        'Marca da bollo': '2,00',
        Pasti: '108,00',
        'Conguaglio pasti': '-11,00',
        'Pre-asilo': '70,00',
        'Post-asilo': '0,00',
        'Gettoni pre-asilo': '21,00',
        'Gettoni post-asilo': '16,00',
        'Costi extra': '15,00',
        'Credito/Debito': '-20,00',
      };
      for (const [voce, valore] of Object.entries(attesi)) {
        await expect(campoVoce(finestra, voce)).toHaveValue(valore);
      }
      await expect(finestra.getByLabel('Nota costi extra')).toHaveValue('Gita di prova');
      await expect(finestra.getByLabel('Nota credito/debito')).toHaveValue('Rimborso di prova');
      // Il numero dei gettoni è solo testo, non un campo.
      await expect(finestra.getByText('3 gettoni')).toBeVisible();
      await expect(finestra.getByText('2 gettoni')).toBeVisible();
      await expect(finestra.getByLabel(/numero.*gettoni/i)).toHaveCount(0);
      await expect(campoMotivo(finestra)).toHaveValue('');
      await expect(finestra.getByText('non invia nessuna mail alla famiglia')).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('PAG-04: il totale si aggiorna mentre scrivo', async ({ page, bambino, adminDb }) => {
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      const finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);
      await expect(finestra.getByText('Totale: 410,00 €')).toBeVisible();

      await campoVoce(finestra, 'Pasti').fill('100');
      await expect(finestra.getByText('Totale: 402,00 €')).toBeVisible();
      // Un conguaglio negativo riduce il totale.
      await campoVoce(finestra, 'Conguaglio pasti').fill('-10');
      await expect(finestra.getByText('Totale: 392,00 €')).toBeVisible();

      // Il totale non è un campo e non si è salvato nulla.
      await expect(finestra.getByRole('textbox', { name: /^Totale/ })).toHaveCount(0);
      expect((await leggiComunicazione(adminDb!, id)).totale).toBe(410);
    });

    test('PAG-05: salvare la modifica aggiorna il mese senza inviare mail', async ({ page, bambino, adminDb }) => {
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);
      const prima = await leggiComunicazione(adminDb!, id);

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      const finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);
      await campoVoce(finestra, 'Pasti').fill('100');
      await campoMotivo(finestra).fill('Pasti contati male');
      await clickEAttendiAzione(page, pulsanteSalvaModifica(finestra));

      await expect(finestra).toBeHidden();
      await expect(riga.getByRole('cell', { name: '100,00 €', exact: true })).toBeVisible();
      await expect(riga.getByRole('cell', { name: '402,00 €', exact: true })).toBeVisible();
      await expect(
        page.getByRole('row', { name: /Totale richiesto/ }).getByRole('cell', { name: '402,00 €', exact: true })
      ).toBeVisible();

      // Il totale è ricalcolato dal server come somma delle voci; invio e destinatario non cambiano.
      await expect.poll(async () => (await leggiComunicazione(adminDb!, id)).totale).toBe(402);
      const dopo = await leggiComunicazione(adminDb!, id);
      expect(dopo.costo_pasti).toBe(100);
      expect(dopo.inviata_il).toBe(prima.inviata_il);
      expect(dopo.inviata_da_nome).toBe(prima.inviata_da_nome);
      expect(dopo.email_destinatario).toBe(prima.email_destinatario);
      await expect(riga.getByText(/Inviata il/)).toBeVisible();
    });

    test('PAG-06: dati non validi non salvano nulla', async ({ page, bambino, adminDb }) => {
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      const finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);

      const casi: { voce: string; originale: string; scritto: string; motivo: string; messaggio: RegExp }[] = [
        { voce: 'Pasti', originale: '108,00', scritto: '100', motivo: '', messaggio: /Scrivi il motivo/ },
        { voce: 'Pasti', originale: '108,00', scritto: 'abc', motivo: 'Prova', messaggio: /Pasti: scrivi un importo/ },
        { voce: 'Pasti', originale: '108,00', scritto: '1,234', motivo: 'Prova', messaggio: /Pasti: scrivi un importo/ },
        { voce: 'Retta mensile', originale: '250,00', scritto: '1000000', motivo: 'Prova', messaggio: /troppo grande/ },
        { voce: 'Retta mensile', originale: '250,00', scritto: '-5', motivo: 'Prova', messaggio: /non può essere negativo/ },
        { voce: 'Costi extra', originale: '0,00', scritto: '-5', motivo: 'Prova', messaggio: /non può essere negativo/ },
        { voce: 'Pasti', originale: '108,00', scritto: '108,00', motivo: 'Prova', messaggio: /nessun valore/ },
      ];
      for (const caso of casi) {
        await campoVoce(finestra, caso.voce).fill(caso.scritto);
        await campoMotivo(finestra).fill(caso.motivo);
        await clickEAttendiAzione(page, pulsanteSalvaModifica(finestra));
        // La finestra resta aperta con i dati scritti e spiega cosa correggere.
        await expect(finestra.getByRole('alert').filter({ hasText: caso.messaggio })).toBeVisible();
        await expect(campoVoce(finestra, caso.voce)).toHaveValue(caso.scritto);
        await campoVoce(finestra, caso.voce).fill(caso.originale);
      }

      const dopo = await leggiComunicazione(adminDb!, id);
      expect(dopo.totale).toBe(410);
      expect(dopo.modificata_il).toBeNull();
      expect(await leggiStorico(adminDb!, id)).toHaveLength(0);
    });

    test('PAG-07: un mese modificato mostra che è stato corretto', async ({ page, bambino, adminDb }) => {
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);
      await modificaViaFunzione(adminDb!, id, 'Prima correzione', { retta_mensile: 250, costo_pasti: 100 });
      await modificaViaFunzione(adminDb!, id, 'Seconda correzione', { retta_mensile: 250, costo_pasti: 90 });

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      await expect(riga.getByText(/Inviata il/)).toBeVisible();
      await expect(riga.getByText(/Modificata il .* da /)).toBeVisible();
      // Il totale della mail è quello originale, anche dopo più modifiche.
      await expect(riga.getByText('Totale della mail: 410,00 €')).toBeVisible();
      await expect(riga.getByRole('cell', { name: '392,00 €', exact: true })).toBeVisible();
    });

    test('PAG-08: lo storico delle modifiche resta consultabile', async ({ page, bambino, adminDb }) => {
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);
      await modificaViaFunzione(adminDb!, id, 'Prima correzione', { retta_mensile: 250, costo_pasti: 100 });
      await modificaViaFunzione(adminDb!, id, 'Seconda correzione', {
        retta_mensile: 250,
        costo_pasti: 100,
        credito_debito: -50,
      });
      await inserisciComunicazioneConVoci(adminDb!, bambino, `${ANNO_FISSO}-10`, { retta_mensile: 100, totale: 100 });

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      await riga.getByText('Storico modifiche').click();
      const voci = riga.getByRole('listitem').filter({ hasText: 'Motivo:' });
      await expect(voci).toHaveCount(2);
      // Dalla più recente.
      await expect(voci.nth(0)).toContainText('Motivo: Seconda correzione');
      await expect(voci.nth(0)).toContainText('Credito/Debito: -20,00 € → -50,00 €');
      await expect(voci.nth(0)).toContainText('Totale: 402,00 € → 372,00 €');
      await expect(voci.nth(0)).not.toContainText('Pasti:');
      await expect(voci.nth(1)).toContainText('Motivo: Prima correzione');
      await expect(voci.nth(1)).toContainText('Pasti: 108,00 € → 100,00 €');
      await expect(voci.nth(1)).toContainText('Totale: 410,00 € → 402,00 €');
      await expect(voci.nth(1)).not.toContainText('Retta mensile:');
      await expect(voci.nth(0)).toContainText(/\d{2}\/\d{2}\/\d{4}/);
      await nessunaViolazioneA11yGrave(page);

      // Un mese mai modificato non mostra "Storico modifiche".
      await expect(rigaMese(page, `${ANNO_FISSO}-10`).getByText('Storico modifiche')).toHaveCount(0);

      // Dall'app lo storico non si cancella né si cambia.
      await adminDb!.from('modifiche_comunicazioni_retta').delete().eq('comunicazione_id', id);
      await adminDb!.from('modifiche_comunicazioni_retta').update({ motivo: 'Cambiato' }).eq('comunicazione_id', id);
      const storico = await leggiStorico(adminDb!, id);
      expect(storico.map((r) => r.motivo)).toEqual(['Seconda correzione', 'Prima correzione']);
    });

    test('PAG-09: con il bonifico verificato non si modifica', async ({ page, bambino, adminDb }) => {
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, {
        ...VOCI_BASE,
        bonifico_stato: 'corretto',
      });

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      await expect(bottoneModificaImporti(riga)).toBeDisabled();
      await expect(riga.getByText('annulla prima la verifica', { exact: false })).toBeVisible();

      // Dopo "Annulla verifica" il pulsante torna attivo.
      page.once('dialog', (dialog) => dialog.accept());
      await riga.getByRole('button', { name: 'Annulla verifica' }).click();
      await expect(bottoneModificaImporti(riga)).toBeEnabled({ timeout: 20_000 });
      expect((await leggiComunicazione(adminDb!, id)).totale).toBe(410);
    });

    test('PAG-09: la richiesta arrivata al server dopo una verifica fatta altrove è rifiutata', async ({
      page,
      bambino,
      adminDb,
    }) => {
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      const finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);
      // Nel frattempo il bonifico viene verificato in un'altra scheda.
      const { error } = await adminDb!
        .from('comunicazioni_retta')
        .update({ bonifico_stato: 'corretto', bonifico_importo_ricevuto: 410 })
        .eq('id', id);
      expect(error).toBeNull();

      await campoVoce(finestra, 'Pasti').fill('100');
      await campoMotivo(finestra).fill('Pasti contati male');
      await clickEAttendiAzione(page, pulsanteSalvaModifica(finestra));
      await expect(finestra.getByRole('alert').filter({ hasText: /bonifico.*verificato/ })).toBeVisible();

      const dopo = await leggiComunicazione(adminDb!, id);
      expect(dopo.totale).toBe(410);
      expect(dopo.costo_pasti).toBe(108);
      expect(await leggiStorico(adminDb!, id)).toHaveLength(0);
    });

    test('PAG-10: togliere o aggiungere pre/post-asilo avvisa delle conseguenze', async ({ page, bambino, adminDb }) => {
      await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);
      const idSuccessiva = await inserisciComunicazioneConVoci(adminDb!, bambino, `${ANNO_FISSO}-10`, VOCI_BASE);
      const successivaPrima = await leggiComunicazione(adminDb!, idSuccessiva);

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      const finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);
      const avviso = finestra.getByText('non risultano più coperti', { exact: false });
      await expect(avviso).toHaveCount(0);

      // Da importo a zero: avviso. Restando maggiore di zero: nessun avviso.
      await campoVoce(finestra, 'Pre-asilo').fill('60');
      await expect(avviso).toHaveCount(0);
      await campoVoce(finestra, 'Pre-asilo').fill('0,00');
      await expect(avviso).toBeVisible();
      await expect(avviso).toContainText('Pre-asilo');
      await expect(avviso).toContainText('retta successiva');
      await campoVoce(finestra, 'Pre-asilo').fill('70');
      await expect(avviso).toHaveCount(0);

      // Da zero a un importo, per il post-asilo.
      await campoVoce(finestra, 'Post-asilo').fill('30');
      await expect(avviso).toBeVisible();
      await expect(avviso).toContainText('Post-asilo');
      await campoVoce(finestra, 'Post-asilo').fill('0');
      await expect(avviso).toHaveCount(0);

      // Salvando il pre-asilo a zero, una retta successiva già inviata non cambia.
      await campoVoce(finestra, 'Pre-asilo').fill('0');
      await campoMotivo(finestra).fill('Pre-asilo non richiesto');
      await clickEAttendiAzione(page, pulsanteSalvaModifica(finestra));
      await expect(finestra).toBeHidden();
      expect(await leggiComunicazione(adminDb!, idSuccessiva)).toEqual(successivaPrima);
    });

    test('PAG-11: gli altri mesi non vengono ricalcolati', async ({ page, bambino, adminDb }) => {
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);
      const idOttobre = await inserisciComunicazioneConVoci(adminDb!, bambino, `${ANNO_FISSO}-10`, {
        ...VOCI_BASE,
        conguaglio_pasti: -7,
        totale: 403,
      });

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      const finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);
      await campoVoce(finestra, 'Pasti').fill('100');
      await campoMotivo(finestra).fill('Pasti contati male');
      await clickEAttendiAzione(page, pulsanteSalvaModifica(finestra));
      await expect.poll(async () => (await leggiComunicazione(adminDb!, id)).totale).toBe(402);

      const ottobre = await leggiComunicazione(adminDb!, idOttobre);
      expect(ottobre.costo_pasti).toBe(108);
      expect(ottobre.conguaglio_pasti).toBe(-7);
      expect(ottobre.totale).toBe(403);
      expect(ottobre.modificata_il).toBeNull();
      await expect(
        rigaMese(page, `${ANNO_FISSO}-10`).getByRole('cell', { name: '403,00 €', exact: true })
      ).toBeVisible();
    });

    test('PAG-12: il credito/debito cambia solo nella retta', async ({ page, bambino, adminDb }) => {
      const { error } = await adminDb!.from('crediti_debiti_bambini').insert({
        bambino_id: bambino.id,
        mese_competenza: MESE_MOD,
        importo: 185,
        nota: 'Differenza di prova',
        origine: 'manuale',
        creato_da_nome: 'E2E',
        applicato_il: new Date().toISOString(),
      });
      expect(error).toBeNull();
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, {
        retta_mensile: 100,
        credito_debito: 185,
        totale: 285,
      });

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      const finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);
      await campoVoce(finestra, 'Credito/Debito').fill('150');
      await campoMotivo(finestra).fill('Il debito reale era 150');
      await clickEAttendiAzione(page, pulsanteSalvaModifica(finestra));
      await expect.poll(async () => (await leggiComunicazione(adminDb!, id)).totale).toBe(250);
      expect((await leggiComunicazione(adminDb!, id)).credito_debito).toBe(150);

      // La scheda del bambino non cambia: resta "conteggiato" con 185,00 €.
      const { data: credito } = await adminDb!
        .from('crediti_debiti_bambini')
        .select('importo, applicato_il')
        .eq('bambino_id', bambino.id)
        .single();
      expect(credito?.importo).toBe(185);
      expect(credito?.applicato_il).not.toBeNull();
      await page.goto(`/admin/bambini/${bambino.id}`);
      await expect(page.getByText('Conteggiato nella retta di settembre 2020')).toBeVisible();
      await expect(page.getByText('185,00', { exact: false }).first()).toBeVisible();
      expect((await leggiStorico(adminDb!, id))[0].motivo).toBe('Il debito reale era 150');
    });

    test('PAG-13: anche «Rette» mostra gli importi corretti', async ({ page, bambino, adminDb }) => {
      const mese = meseCorrenteRoma();
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, mese, VOCI_BASE);
      await modificaViaFunzione(adminDb!, id, 'Pasti contati male', { retta_mensile: 250, costo_pasti: 100 });

      await page.goto('/admin/rette');
      await expect(rigaRette(page, bambino).getByTestId('totale-riga')).toHaveText('402,00 €');

      // L'importo atteso del bonifico è il nuovo totale.
      await page.goto(`${PERCORSO}?bambino=${bambino.id}&anno=${annoScolasticoDi(mese)}`);
      await rigaMese(page, mese).getByRole('button', { name: 'Importo diverso' }).click();
      await expect(finestraImportoDiverso(page, bambino).getByText('Importo atteso: 402,00')).toBeVisible();
    });

    test("PAG-14: annullare l'invio di una retta modificata", async ({ page, bambino, adminDb }) => {
      const mese = meseCorrenteRoma();
      const { error } = await adminDb!.from('crediti_debiti_bambini').insert({
        bambino_id: bambino.id,
        mese_competenza: mese,
        importo: 185,
        nota: 'Differenza di prova',
        origine: 'manuale',
        creato_da_nome: 'E2E',
        applicato_il: new Date().toISOString(),
      });
      expect(error).toBeNull();
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, mese, {
        retta_mensile: 100,
        credito_debito: 185,
        totale: 285,
      });
      await modificaViaFunzione(adminDb!, id, 'Il debito reale era 150', { retta_mensile: 100, credito_debito: 150 });
      expect(await leggiStorico(adminDb!, id)).toHaveLength(1);

      await page.goto('/admin/rette');
      await clickEAttendiAzione(page, rigaRette(page, bambino).getByRole('button', { name: 'Annulla invio' }));

      // La retta e il suo storico spariscono.
      await expect
        .poll(async () => (await adminDb!.from('comunicazioni_retta').select('id').eq('id', id)).data?.length)
        .toBe(0);
      expect(await leggiStorico(adminDb!, id)).toHaveLength(0);
      // Il credito/debito torna "da conteggiare" con l'importo della scheda, non quello corretto.
      await expect
        .poll(async () => {
          const { data } = await adminDb!
            .from('crediti_debiti_bambini')
            .select('importo, applicato_il')
            .eq('bambino_id', bambino.id)
            .single();
          return { importo: data?.importo, applicato_il: data?.applicato_il };
        })
        .toEqual({ importo: 185, applicato_il: null });
    });

    test('PAG-15: la finestra si chiude con Esc o «Annulla» senza salvare, e tiene il focus', async ({
      page,
      bambino,
      adminDb,
    }) => {
      const id = await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      const pulsante = bottoneModificaImporti(riga);

      // Esc: chiude, il focus torna sul pulsante, nulla è salvato.
      let finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);
      await verificaFocusTrattenuto(page, finestra);
      await campoVoce(finestra, 'Pasti').fill('100');
      await campoMotivo(finestra).fill('Prova');
      await page.keyboard.press('Escape');
      await expect(finestra).toBeHidden();
      await expect(pulsante).toBeFocused();

      // «Annulla»: stessa cosa, e alla riapertura i valori sono quelli registrati.
      finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);
      await expect(campoVoce(finestra, 'Pasti')).toHaveValue('108,00');
      await expect(campoMotivo(finestra)).toHaveValue('');
      await finestra.getByRole('button', { name: 'Annulla', exact: true }).click();
      await expect(finestra).toBeHidden();
      await expect(pulsante).toBeFocused();

      expect((await leggiComunicazione(adminDb!, id)).totale).toBe(410);
      expect(await leggiStorico(adminDb!, id)).toHaveLength(0);
    });

    test('PAG-15: su telefono (360 px) la finestra si legge e si compila senza scorrere in orizzontale', async ({
      page,
      bambino,
      adminDb,
    }) => {
      await inserisciComunicazioneConVoci(adminDb!, bambino, MESE_MOD, VOCI_BASE);
      await page.setViewportSize({ width: 360, height: 740 });

      const riga = await apriPagamentiBambino(page, bambino, MESE_MOD);
      const finestra = await apriModificaImporti(page, riga, bambino, ETICHETTA_MESE_MOD);
      const senzaScorrimentoOrizzontale = await finestra.evaluate((el) => el.scrollWidth <= el.clientWidth);
      expect(senzaScorrimentoOrizzontale).toBe(true);
      await expect(campoVoce(finestra, 'Credito/Debito')).toBeVisible();
      await nessunaViolazioneA11yGrave(page);

      // «Salva» è raggiungibile (si scorre solo in verticale dentro la finestra).
      await pulsanteSalvaModifica(finestra).scrollIntoViewIfNeeded();
      await expect(pulsanteSalvaModifica(finestra)).toBeInViewport();
    });

    test('PAG-16: un mese comunicato ha la colonna "Pagamento" con le azioni di verifica', async ({
      page,
      bambino,
      adminDb,
    }) => {
      await inserisciComunicazioneDaVerificare(adminDb!, bambino, `${ANNO_FISSO}-09`);

      await page.goto(urlBambino(bambino));
      await expect(page.getByRole('columnheader', { name: 'Pagamento', exact: true })).toBeVisible();
      const riga = rigaMese(page, `${ANNO_FISSO}-09`);
      await expect(riga.getByText('Bonifico da verificare')).toBeVisible();
      page.once('dialog', (dialog) => dialog.accept());
      await riga.getByRole('button', { name: 'Bonifico corretto' }).click();
      await expect(riga.getByText('Bonifico ricevuto (importo corretto)', { exact: false })).toBeVisible({
        timeout: 20_000,
      });
      await expect(riga.getByRole('button', { name: 'Annulla verifica' })).toBeVisible();

      // Un mese senza comunicazione non ha né stato né pulsanti del bonifico.
      const rigaVuota = rigaMese(page, `${ANNO_FISSO}-10`);
      await expect(rigaVuota.getByText('Non ancora comunicata')).toBeVisible();
      await expect(rigaVuota.getByRole('button')).toHaveCount(0);
      await nessunaViolazioneA11yGrave(page);
    });

    for (const larghezza of [1440, 1920]) {
      test(`PAG-23: a ${larghezza} px la tabella sta nella pagina, senza scroll orizzontale né «Salva» tagliato`, async ({
        page,
        bambino,
        adminDb,
      }) => {
        await page.setViewportSize({ width: larghezza, height: 1000 });
        // Dieci mesi comunicati, con importi grandi e note lunghe.
        for (const [i, mese] of MESI_ANNO_SCOLASTICO.entries()) {
          const numeroMese = i < 4 ? 9 + i : i - 3;
          const anno = i < 4 ? ANNO_FISSO : ANNO_FISSO + 1;
          await inserisciComunicazione(adminDb!, bambino, `${anno}-${String(numeroMese).padStart(2, '0')}`, {
            retta_mensile: 480.5,
            marca_da_bollo: 2,
            costo_pasti: 166,
            conguaglio_pasti: -11,
            costo_pre_asilo: 130,
            costo_post_asilo: 120,
            costi_extra: 35,
            note_costi_extra: `Gita di ${mese} con una descrizione piuttosto lunga`,
            credito_debito: -25,
            nota_credito_debito: 'Rimborso di una differenza dei mesi passati',
            totale: 917.5,
          });
        }
        await page.goto(urlBambino(bambino));
        await expect(rigaMese(page, `${ANNO_FISSO}-09`)).toBeVisible();

        const misure = await page.evaluate(() => {
          const tabella = document.querySelector('table')!;
          const contenitore = tabella.parentElement!;
          return {
            paginaScroll: document.documentElement.scrollWidth,
            paginaLarga: document.documentElement.clientWidth,
            contenitoreScroll: contenitore.scrollWidth,
            contenitoreLarga: contenitore.clientWidth,
            tabellaScroll: tabella.scrollWidth,
            tabellaLarga: tabella.clientWidth,
          };
        });
        expect(misure.paginaScroll).toBeLessThanOrEqual(misure.paginaLarga);
        expect(misure.contenitoreScroll).toBeLessThanOrEqual(misure.contenitoreLarga);
        expect(misure.tabellaScroll).toBeLessThanOrEqual(misure.tabellaLarga);

        // «Salva» della nota è interamente nella finestra, in ogni riga.
        const salva = page.getByRole('button', { name: 'Salva', exact: true });
        await expect(salva).toHaveCount(10);
        for (let i = 0; i < 10; i++) {
          const riquadro = await salva.nth(i).boundingBox();
          expect(riquadro).not.toBeNull();
          expect(riquadro!.x).toBeGreaterThanOrEqual(0);
          expect(riquadro!.x + riquadro!.width).toBeLessThanOrEqual(larghezza);
        }
        await nessunaViolazioneA11yGrave(page);
      });
    }

    test('PAG-23: su telefono (360 px) la pagina resta accessibile', async ({ page, bambino, adminDb }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await inserisciComunicazione(adminDb!, bambino, `${ANNO_FISSO}-09`, { retta_mensile: 250, totale: 250 });
      await page.goto(urlBambino(bambino));
      await expect(rigaMese(page, `${ANNO_FISSO}-09`)).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('PAG-17: un mese passato è sempre verificabile', async ({ page, bambino, adminDb }) => {
      await inserisciComunicazioneDaVerificare(adminDb!, bambino, `${ANNO_FISSO}-11`);

      await page.goto(urlBambino(bambino));
      const riga = rigaMese(page, `${ANNO_FISSO}-11`);
      await expect(riga.getByRole('button', { name: 'Bonifico corretto' })).toBeEnabled();
      await expect(riga.getByRole('button', { name: 'Importo diverso' })).toBeEnabled();
    });

    test('PAG-18: il link "Verifica" di "Rette" porta alla riga del mese', async ({ page, bambino, adminDb }) => {
      const mese = meseCorrenteRoma();
      await inserisciComunicazioneDaVerificare(adminDb!, bambino, mese);

      await page.goto('/admin/rette');
      await rigaRette(page, bambino)
        .getByRole('link', { name: `Verifica il bonifico di ${bambino.nomeCompleto}` })
        .click();
      await page.waitForURL(new RegExp(`bambino=${bambino.id}&anno=${annoScolasticoDi(mese)}#mese-${mese}$`));
      await expect(page.getByRole('heading', { name: bambino.nomeCompleto, level: 2 })).toBeVisible();
      const riga = rigaMese(page, mese);
      await expect(riga).toBeVisible();
      await expect(riga.getByRole('button', { name: 'Bonifico corretto' })).toBeVisible();
    });

    test('PAG-19: scrivere e salvare una nota per riga', async ({ page, bambino, adminDb }) => {
      const id = await inserisciComunicazioneDaVerificare(adminDb!, bambino, `${ANNO_FISSO}-09`);

      const riga = await apriPagamentiBambino(page, bambino, `${ANNO_FISSO}-09`);
      await campoNota(riga).fill('Pagato in contanti alla segreteria');
      await clickEAttendiAzione(page, riga.getByRole('button', { name: 'Salva', exact: true }));
      await expect(riga.getByText('Nota salvata')).toBeVisible();

      await expect.poll(() => leggiNotaPagamento(adminDb!, id)).toBe('Pagato in contanti alla segreteria');
      await page.reload();
      await expect(campoNota(rigaMese(page, `${ANNO_FISSO}-09`))).toHaveValue('Pagato in contanti alla segreteria');

      // Un mese senza comunicazione non ha il campo nota.
      await expect(campoNota(rigaMese(page, `${ANNO_FISSO}-10`))).toHaveCount(0);
      await nessunaViolazioneA11yGrave(page);
    });

    test('PAG-20: modificare e svuotare la nota', async ({ page, bambino, adminDb }) => {
      const id = await inserisciComunicazioneDaVerificare(adminDb!, bambino, `${ANNO_FISSO}-09`, {
        nota_pagamento: 'Prima versione',
      });

      const riga = await apriPagamentiBambino(page, bambino, `${ANNO_FISSO}-09`);
      await expect(campoNota(riga)).toHaveValue('Prima versione');
      await campoNota(riga).fill('Seconda versione');
      await clickEAttendiAzione(page, riga.getByRole('button', { name: 'Salva', exact: true }));
      await expect.poll(() => leggiNotaPagamento(adminDb!, id)).toBe('Seconda versione');

      await campoNota(riga).fill('');
      await clickEAttendiAzione(page, riga.getByRole('button', { name: 'Salva', exact: true }));
      await expect.poll(() => leggiNotaPagamento(adminDb!, id)).toBeNull();
      await page.reload();
      await expect(campoNota(rigaMese(page, `${ANNO_FISSO}-09`))).toHaveValue('');
    });

    test('PAG-21: la nota ha un limite di 500 caratteri', async ({ page, bambino, adminDb }) => {
      const id = await inserisciComunicazioneDaVerificare(adminDb!, bambino, `${ANNO_FISSO}-09`, {
        nota_pagamento: 'Nota di partenza',
      });

      const riga = await apriPagamentiBambino(page, bambino, `${ANNO_FISSO}-09`);
      await expect(campoNota(riga)).toHaveAttribute('maxlength', '500');
      // Il campo non permette di scrivere oltre il limite.
      await campoNota(riga).fill('x'.repeat(500));
      await campoNota(riga).pressSequentially('yyy');
      await expect(campoNota(riga)).toHaveValue('x'.repeat(500));
      await expect(riga.getByText(/^500\/500/)).toBeVisible();

      // Un testo troppo lungo che arriva comunque al server è respinto, e la nota già salvata non cambia.
      await campoNota(riga).evaluate((el) => el.removeAttribute('maxlength'));
      await campoNota(riga).fill('x'.repeat(501));
      await clickEAttendiAzione(page, riga.getByRole('button', { name: 'Salva', exact: true }));
      await expect(riga.getByText('al massimo 500 caratteri', { exact: false })).toBeVisible();
      await expect(riga.getByText('Nota salvata')).toHaveCount(0);
      await expect.poll(() => leggiNotaPagamento(adminDb!, id)).toBe('Nota di partenza');
    });

    test('PAG-22: la nota resta com\'è con "Annulla verifica" e "Importo diverso"', async ({
      page,
      bambino,
      adminDb,
    }) => {
      const id = await inserisciComunicazioneDaVerificare(adminDb!, bambino, `${ANNO_FISSO}-09`, {
        retta_mensile: 150,
        nota_pagamento: 'Nota privata della segreteria',
      });

      const riga = await apriPagamentiBambino(page, bambino, `${ANNO_FISSO}-09`);
      await marcaImportoDiverso(page, riga, bambino, '100', 'Nota del bonifico', meseSuccessivoRoma());
      await expect(campoNota(riga)).toHaveValue('Nota privata della segreteria');
      await expect.poll(() => leggiNotaPagamento(adminDb!, id)).toBe('Nota privata della segreteria');

      page.once('dialog', (dialog) => dialog.accept());
      await riga.getByRole('button', { name: 'Annulla verifica' }).click();
      await expect(riga.getByText('Bonifico da verificare')).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => leggiNotaPagamento(adminDb!, id)).toBe('Nota privata della segreteria');
      await expect(campoNota(riga)).toHaveValue('Nota privata della segreteria');
      // La nota del bonifico non si è mescolata con quella della riga.
      await expect(riga.getByText('Nota del bonifico')).toHaveCount(0);
    });

    test('la pagina con una nota e un bonifico è leggibile su telefono (360 px) + accessibilità', async ({
      page,
      bambino,
      adminDb,
    }) => {
      await inserisciComunicazioneDaVerificare(adminDb!, bambino, `${ANNO_FISSO}-09`, { nota_pagamento: 'Nota breve' });
      await page.setViewportSize({ width: 360, height: 740 });
      const riga = await apriPagamentiBambino(page, bambino, `${ANNO_FISSO}-09`);
      await expect(campoNota(riga)).toHaveValue('Nota breve');
      await nessunaViolazioneA11yGrave(page);
    });
  });

  test('accesso negato a chi non è admin', async ({ browser }) => {
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);

      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      // La voce non compare nel menu di chi non è admin...
      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Pagamenti' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Pagamenti bambino' })).toHaveCount(0);

      // ...e la pagina respinge alla dashboard.
      await page.goto(PERCORSO);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await context.close();
    }
  });
});
