// Requisito: specs/14 - segna-pasto.md
//
// ATTENZIONE: questi test scrivono davvero in `pasti` sul progetto
// Supabase di test — vedi la nota in 13-segna-presenza.spec.ts.
//
// Il pasto si segna dalla colonna "Pasto" della card di ogni bambino
// nella schermata unica "Presenze e pasti" (specs/10).
import { test, expect } from '@playwright/test';
import {
  apriGiornata,
  cardBambini,
  clickEAttendiAzione,
  colonnaPasto,
  colonnaPresenza,
  dataIeriRoma,
  dataOggiRoma,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  primaCardConPulsante,
  statoAutenticazione,
} from './helpers';

test.describe('14 — Segna pasto', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');
    });

    test('la colonna Pasto mostra lo stato pasto di ogni bambino', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Presenze e pasti', exact: true })).toBeVisible();
      await expect(colonnaPasto(cardBambini(page).first())).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('riepilogo pasti della classe', async ({ page }) => {
      // Il riepilogo aggregato (in cima) e quello per sezione condividono
      // lo stesso formato: .first() basta a verificare che compaia.
      await expect(page.getByText(/^Pasti: \d+\/\d+$/).first()).toBeVisible();
      const cardSezione = page.locator('div', { has: page.getByRole('heading', { name: /^Sezione / }) }).last();
      await expect(cardSezione.getByText(/^Pasti: \d+\/\d+$/)).toBeVisible();
    });

    test("le allergie sono visibili nell'intestazione della card, indipendentemente dallo stato pasto", async ({
      page,
    }) => {
      // Il seed di prova (supabase/seed.sql) include un bambino con
      // "Allergia alle arachidi" — se non è visibile a questo account,
      // il test si salta piuttosto che fallire per un motivo estraneo.
      const badge = cardBambini(page).getByText('⚠', { exact: false }).first();
      test.skip((await badge.count()) === 0, 'nessun bambino con note_allergie per questo account');

      await expect(badge).toBeVisible();
    });

    test('segnare che un bambino ha mangiato', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Pasto', 'Sì');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');

      const bottoneSi = colonnaPasto(card).getByRole('button', { name: 'Sì' });
      await bottoneSi.click();
      await expect(bottoneSi).toHaveClass(/bg-emerald-700/);
    });

    test('salvare una nota senza cambiare lo stato', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Pasto', 'Sì');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
      const pasto = colonnaPasto(card);

      // Aspetto la fine di ciascun salvataggio: il reload annullerebbe
      // il salvataggio della nota (#70).
      await clickEAttendiAzione(page, pasto.getByRole('button', { name: 'Sì' }));
      await expect(pasto.getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);

      await pasto.getByPlaceholder('Nota (opzionale)').fill('ha finito tutto');
      await clickEAttendiAzione(page, pasto.getByRole('button', { name: 'Salva nota' }));

      await expect(pasto.getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);

      await page.reload();
      await expect(pasto.getByPlaceholder('Nota (opzionale)')).toHaveValue('ha finito tutto');
      await expect(pasto.getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);
    });

    test('segnare che un bambino non ha mangiato', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Pasto', 'No');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');

      const bottoneNo = colonnaPasto(card).getByRole('button', { name: 'No', exact: true });
      await bottoneNo.click();
      await expect(bottoneNo).toHaveClass(/bg-rose-600/);
      // Stesso bug del pulsante "Assente" (vedi 13-segna-presenza.spec.ts):
      // verifico il colore reale, non solo il nome della classe.
      await expect(bottoneNo).toHaveCSS('background-color', 'rgb(225, 29, 72)');
    });

    test('presenza e pasto sono indipendenti: segnare solo il pasto non richiede la presenza', async ({
      page,
    }) => {
      const card = primaCardConPulsante(page, 'Pasto', 'Sì');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');

      const bottoneSi = colonnaPasto(card).getByRole('button', { name: 'Sì' });
      await expect(bottoneSi).toBeEnabled();
      await bottoneSi.click();
      await expect(bottoneSi).toHaveClass(/bg-emerald-700/);
    });

    test('non posso modificare il pasto di una data diversa da oggi: sola lettura', async ({ page }) => {
      const haBambini = await apriGiornata(page, dataIeriRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      await expect(page.getByText('Sola lettura: puoi modificare solo la data di oggi.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);
    });

    // Segna un bambino assente e poi lo riporta a "presente", per non
    // condizionare gli altri test (un bambino assente non ha più
    // pulsanti Sì/No nella colonna Pasto).
    test('un bambino assente non è selezionabile per il pasto', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Assente');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
      const presenza = colonnaPresenza(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Assente' }).isDisabled(),
        'Assente bloccato (pasto già comunicato a Rojac)'
      );

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Assente' }));
      await expect(presenza.getByRole('button', { name: 'Assente' })).toHaveClass(/bg-stone-600/);

      const pasto = colonnaPasto(card);
      await expect(pasto.getByText('🚫 Assente')).toBeVisible();
      await expect(pasto.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      await expect(pasto.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
    });

    test('un bambino malato non è selezionabile per il pasto', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Malattia');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
      const presenza = colonnaPresenza(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Malattia' }).isDisabled(),
        'Malattia bloccata (pasto già comunicato a Rojac)'
      );

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Malattia' }));
      await expect(presenza.getByRole('button', { name: 'Malattia' })).toHaveClass(/bg-rose-600/);

      const pasto = colonnaPasto(card);
      await expect(pasto.getByText('🤒 Malattia')).toBeVisible();
      await expect(pasto.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      await expect(pasto.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
    });
  });

  test.describe("l'assistente non vede alcun dato pasto", () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
    });

    test('né in "Presenze e pasti" né aprendo il vecchio indirizzo /dashboard/pasti', async ({ page }) => {
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');
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
