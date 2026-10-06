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
import { test, expect, creaBambinoFixture, eliminaBambinoFixture } from './fixture-bambino';
import {
  dataUltimoGiornoApertoPrimaDiOggi,
  dataOggiRoma,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  statoAutenticazione,
} from './helpers';
import {
  CLASSE_ATTIVO,
  apriGiornata,
  avvisoSolaLettura,
  bottonePasto,
  bottonePresenza,
  cardBambino,
  cardConPulsante,
  colonnaPasto,
  colonnaPresenza,
  conteggioRiepilogo,
  etichettaPastoAssente,
  etichettaPastoMalattia,
  saltaSeStatoBloccato,
  segnaAssenteOMalattia,
  segnaStato,
  titoloGiornata,
  titoloSezione,
} from './pagina-giornata';

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
      await expect(titoloGiornata(page)).toBeVisible();
      await expect(colonnaPasto(cardBambino(page, bambino))).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('riepilogo pasti della classe', async ({ page }) => {
      // Il riepilogo aggregato (in cima) e quello per sezione condividono
      // lo stesso formato: .first() basta a verificare che compaia.
      await expect(conteggioRiepilogo(page, 'Pasti').first()).toBeVisible();
      const intestazioneSezione = titoloSezione(page).last().locator('..');
      await expect(conteggioRiepilogo(intestazioneSezione, 'Pasti')).toBeVisible();
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
      const card = await cardConPulsante(page, bambino, 'Pasto', 'Sì');

      const bottoneSi = bottonePasto(card, 'Sì');
      await segnaStato(page, bottoneSi);
      await expect(bottoneSi).toHaveClass(CLASSE_ATTIVO.pastoSi);
    });

    test('segnare che un bambino non ha mangiato', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Pasto', 'No');

      const bottoneNo = bottonePasto(card, 'No');
      await segnaStato(page, bottoneNo);
      await expect(bottoneNo).toHaveClass(CLASSE_ATTIVO.pastoNo);
      // Stesso bug del pulsante "Assente" (vedi 13-segna-presenza.spec.ts):
      // verifico il colore reale, non solo il nome della classe.
      await expect(bottoneNo).toHaveCSS('background-color', 'rgb(225, 29, 72)');
    });

    test('presenza e pasto sono indipendenti: segnare solo il pasto non richiede la presenza', async ({
      page,
      bambino,
    }) => {
      const card = await cardConPulsante(page, bambino, 'Pasto', 'Sì');

      const bottoneSi = bottonePasto(card, 'Sì');
      await expect(bottoneSi).toBeEnabled();
      await segnaStato(page, bottoneSi);
      await expect(bottoneSi).toHaveClass(CLASSE_ATTIVO.pastoSi);
    });

    test('non posso modificare il pasto di una data diversa da oggi: sola lettura', async ({ page, bambino }) => {
      await apriGiornata(page, dataUltimoGiornoApertoPrimaDiOggi());
      await expect(cardBambino(page, bambino)).toBeVisible();

      await expect(avvisoSolaLettura(page)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);
    });

    test('un bambino assente non è selezionabile per il pasto', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Assente');
      const presenza = colonnaPresenza(card);
      await saltaSeStatoBloccato(card, 'Assente');

      await segnaAssenteOMalattia(page, presenza, 'Assente');
      await expect(bottonePresenza(card, 'Assente')).toHaveClass(CLASSE_ATTIVO.assente);

      await expect(etichettaPastoAssente(card)).toBeVisible();
      await expect(bottonePasto(card, 'Sì')).toHaveCount(0);
      await expect(bottonePasto(card, 'No')).toHaveCount(0);
    });

    test('un bambino malato non è selezionabile per il pasto', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Malattia');
      const presenza = colonnaPresenza(card);
      await saltaSeStatoBloccato(card, 'Malattia');

      await segnaAssenteOMalattia(page, presenza, 'Malattia');
      await expect(bottonePresenza(card, 'Malattia')).toHaveClass(CLASSE_ATTIVO.malattia);

      await expect(etichettaPastoMalattia(card)).toBeVisible();
      await expect(bottonePasto(card, 'Sì')).toHaveCount(0);
      await expect(bottonePasto(card, 'No')).toHaveCount(0);
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
      await expect(conteggioRiepilogo(page, 'Pasti')).toHaveCount(0);

      await page.goto(`/dashboard/pasti?data=${dataOggiRoma()}`);
      await page.waitForURL(`/dashboard/giornata?data=${dataOggiRoma()}`);
      await expect(colonnaPasto(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sì' })).toHaveCount(0);
    });
  });
});
