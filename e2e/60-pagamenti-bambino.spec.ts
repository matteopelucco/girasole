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
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

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

      const utenti = menu.getByRole('link', { name: 'Utenti', exact: true });
      const rette = menu.getByRole('link', { name: 'Rette', exact: true });
      const pagamentiBambino = menu.getByRole('link', { name: 'Pagamenti bambino', exact: true });
      const avanzate = menu.getByRole('link', { name: 'Impostazioni avanzate' });
      await expect(rette).toBeVisible();
      await expect(pagamentiBambino).toBeVisible();

      // Ordine verticale: gruppo, Rette, Pagamenti bambino, poi il resto.
      const y = async (l: typeof rette) => (await l.boundingBox())!.y;
      // L'indentazione è il padding interno del link: si misura l'icona al suo interno.
      const x = async (l: typeof rette) => (await l.locator('span').first().boundingBox())!.x;
      expect(await y(gruppo)).toBeLessThan(await y(rette));
      expect(await y(rette)).toBeLessThan(await y(pagamentiBambino));
      expect(await y(pagamentiBambino)).toBeLessThan(await y(avanzate));
      // "Rette" non è più di primo livello: è rientrata rispetto alle voci di primo livello.
      expect(await x(rette)).toBeGreaterThan(await x(utenti));
      expect(await x(pagamentiBambino)).toBeGreaterThan(await x(utenti));

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

    test('un mese senza comunicazione non mostra importi', async ({ page, bambino, adminDb }) => {
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

    test('la pagina è di sola lettura', async ({ page, bambino, adminDb }) => {
      await inserisciComunicazione(adminDb!, bambino, `${ANNO_FISSO}-09`, { retta_mensile: 250, totale: 250 });

      await page.goto(urlBambino(bambino));
      await expect(page.getByRole('row', { name: /settembre 2020/ })).toBeVisible();
      const main = page.getByRole('main');
      // Nessun campo importo/nota né pulsanti di invio, annullo, verifica: solo
      // il selettore del bambino e il pulsante "Mostra" della selezione.
      await expect(main.locator('input:not([type="hidden"])')).toHaveCount(0);
      await expect(main.locator('textarea')).toHaveCount(0);
      await expect(main.locator('select')).toHaveCount(1);
      await expect(main.getByRole('button')).toHaveCount(1);
      await expect(main.getByRole('button', { name: 'Mostra' })).toBeVisible();
      await expect(main.getByRole('button', { name: /Annulla invio|Invia|Segna|Verific/ })).toHaveCount(0);
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
