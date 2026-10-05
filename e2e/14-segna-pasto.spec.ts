// Requisito: specs/14 - segna-pasto.md
//
// ATTENZIONE: questi test scrivono davvero in `pasti` sul progetto
// Supabase di test — vedi la nota in 13-segna-presenza.spec.ts.
//
// Dati propri (issue #229): ogni test lavora su un bambino creato apposta
// (fixture `bambino`, e2e/fixture-bambino.ts) ed eliminato a fine test, non
// sulla "prima card" del seed: nessun ripristino a "presente" e nessuna
// dipendenza dallo stato lasciato da altri test.
//
// Il pasto si segna dalla sezione "Pasto" della card di ogni bambino
// nella schermata unica "Presenze e pasti" (specs/10).
import {
  test,
  expect,
  cardBambino,
  cardConPulsante,
  creaBambinoFixture,
  eliminaBambinoFixture,
} from './fixture-bambino';
import {
  apriGiornata,
  clickEAttendiAzione,
  colonnaPasto,
  colonnaPresenza,
  dataUltimoGiornoApertoPrimaDiOggi,
  dataOggiRoma,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  segnaAssenteOMalattia,
  statoAutenticazione,
} from './helpers';

const MOTIVO_NIENTE_SI_NO = 'nessun pulsante Sì/No disponibile (es. pasti già comunicati, giorno di chiusura)';

test.describe('14 — Segna pasto', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    // `bambino` è nei parametri anche quando il test non lo usa: così la
    // fixture è creata prima di aprire la pagina, che deve già mostrarlo.
    test.beforeEach(async ({ page, bambino }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();
    });

    test('la sezione Pasto mostra lo stato pasto di ogni bambino', async ({ page, bambino }) => {
      await expect(page.getByRole('heading', { name: 'Presenze e pasti', exact: true })).toBeVisible();
      await expect(colonnaPasto(cardBambino(page, bambino))).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('riepilogo pasti della classe', async ({ page }) => {
      // Il riepilogo aggregato (in cima) e quello per sezione condividono
      // lo stesso formato: .first() basta a verificare che compaia.
      await expect(page.getByText(/^Pasti: \d+\/\d+$/).first()).toBeVisible();
      const intestazioneSezione = page.getByRole('heading', { name: /^Sezione / }).last().locator('..');
      await expect(intestazioneSezione.getByText(/^Pasti: \d+\/\d+$/)).toBeVisible();
    });

    test("le allergie sono visibili nell'intestazione della card, indipendentemente dallo stato pasto", async ({
      page,
      adminDb,
    }) => {
      test.skip(adminDb === null, 'richiede E2E_ADMIN_EMAIL/PASSWORD (fixture bambino)');

      // Un bambino con allergia creato apposta (non quello del seed).
      const conAllergia = await creaBambinoFixture(adminDb!, { noteAllergie: 'Allergia alle arachidi (prova)' });
      try {
        await apriGiornata(page, dataOggiRoma());
        const card = cardBambino(page, conAllergia);
        await expect(card).toBeVisible();
        await expect(card.getByText('⚠', { exact: false })).toBeVisible();
        await expect(card.getByText('Allergia alle arachidi (prova)', { exact: false })).toBeVisible();
      } finally {
        await eliminaBambinoFixture(adminDb!, conAllergia.id);
      }
    });

    test('segnare che un bambino ha mangiato', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Pasto', 'Sì', MOTIVO_NIENTE_SI_NO);

      const bottoneSi = colonnaPasto(card).getByRole('button', { name: 'Sì' });
      await clickEAttendiAzione(page, bottoneSi);
      await expect(bottoneSi).toHaveClass(/bg-emerald-700/);
    });

    test('segnare che un bambino non ha mangiato', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Pasto', 'No', MOTIVO_NIENTE_SI_NO);

      const bottoneNo = colonnaPasto(card).getByRole('button', { name: 'No', exact: true });
      await clickEAttendiAzione(page, bottoneNo);
      await expect(bottoneNo).toHaveClass(/bg-rose-600/);
      // Stesso bug del pulsante "Assente" (vedi 13-segna-presenza.spec.ts):
      // verifico il colore reale, non solo il nome della classe.
      await expect(bottoneNo).toHaveCSS('background-color', 'rgb(225, 29, 72)');
    });

    test('presenza e pasto sono indipendenti: segnare solo il pasto non richiede la presenza', async ({
      page,
      bambino,
    }) => {
      const card = await cardConPulsante(page, bambino, 'Pasto', 'Sì', MOTIVO_NIENTE_SI_NO);

      const bottoneSi = colonnaPasto(card).getByRole('button', { name: 'Sì' });
      await expect(bottoneSi).toBeEnabled();
      await clickEAttendiAzione(page, bottoneSi);
      await expect(bottoneSi).toHaveClass(/bg-emerald-700/);
    });

    test('non posso modificare il pasto di una data diversa da oggi: sola lettura', async ({ page, bambino }) => {
      await apriGiornata(page, dataUltimoGiornoApertoPrimaDiOggi());
      await expect(cardBambino(page, bambino)).toBeVisible();

      await expect(page.getByText('Sola lettura: puoi modificare solo la data di oggi.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);
    });

    test('un bambino assente non è selezionabile per il pasto', async ({ page, bambino }) => {
      const card = await cardConPulsante(
        page,
        bambino,
        'Presenza',
        'Assente',
        'nessun pulsante di presenza (giorno di chiusura)'
      );
      const presenza = colonnaPresenza(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Assente' }).isDisabled(),
        'Assente bloccato (pasto già comunicato a Rojac)'
      );

      await segnaAssenteOMalattia(page, presenza, 'Assente');
      await expect(presenza.getByRole('button', { name: 'Assente' })).toHaveClass(/bg-stone-600/);

      const pasto = colonnaPasto(card);
      await expect(pasto.getByText('🚫 Assente')).toBeVisible();
      await expect(pasto.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      await expect(pasto.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);
    });

    test('un bambino malato non è selezionabile per il pasto', async ({ page, bambino }) => {
      const card = await cardConPulsante(
        page,
        bambino,
        'Presenza',
        'Malattia',
        'nessun pulsante di presenza (giorno di chiusura)'
      );
      const presenza = colonnaPresenza(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Malattia' }).isDisabled(),
        'Malattia bloccata (pasto già comunicato a Rojac)'
      );

      await segnaAssenteOMalattia(page, presenza, 'Malattia');
      await expect(presenza.getByRole('button', { name: 'Malattia' })).toHaveClass(/bg-rose-600/);

      const pasto = colonnaPasto(card);
      await expect(pasto.getByText('🤒 Malattia')).toBeVisible();
      await expect(pasto.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      await expect(pasto.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);
    });
  });

  test.describe("l'assistente non vede alcun dato pasto", () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
    });

    test('né in "Presenze e pasti" né aprendo il vecchio indirizzo /dashboard/pasti', async ({ page, bambino }) => {
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();
      await expect(colonnaPasto(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      await expect(page.getByText(/^Pasti: \d+\/\d+$/)).toHaveCount(0);

      await page.goto(`/dashboard/pasti?data=${dataOggiRoma()}`);
      await page.waitForURL(`/dashboard/giornata?data=${dataOggiRoma()}`);
      await expect(colonnaPasto(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sì' })).toHaveCount(0);
    });
  });
});
