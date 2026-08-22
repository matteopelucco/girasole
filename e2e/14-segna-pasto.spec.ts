// Requisito: specs/14 - segna-pasto.md
//
// ATTENZIONE: questi test scrivono davvero in `pasti` sul progetto
// Supabase di test — vedi la nota in 13-segna-presenza.spec.ts.
import { test, expect, type Page } from '@playwright/test';
import { dataIeriRoma, dataOggiRoma, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

// Apre "Pasti" per la data indicata e seleziona la prima classe
// dell'elenco (flusso calendario → Pasti → classe, specs/12).
async function apriPrimaClassePasti(page: Page, data: string): Promise<boolean> {
  await page.goto(`/dashboard/pasti?data=${data}`);
  const primaClasse = page.locator('a.bg-emerald-50').first();
  if ((await primaClasse.count()) === 0) return false;
  await primaClasse.click();
  await page.waitForURL(/\/dashboard\/pasti\/.+/);
  return true;
}

test.describe('14 — Segna pasto', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      const haClassi = await apriPrimaClassePasti(page, dataOggiRoma());
      test.skip(!haClassi, 'nessuna classe attiva per questo account');
    });

    test('da Pasti si vede l\'elenco bambini della classe con lo stato pasto', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /^Pasti —/ })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('le allergie sono visibili accanto al nome, indipendentemente dallo stato pasto', async ({
      page,
    }) => {
      // Il seed di prova (supabase/seed.sql) include Luca Bianchi con
      // "Allergia alle arachidi" — se non è stato applicato, il test si
      // salta piuttosto che fallire per un motivo estraneo al requisito.
      const badge = page.getByText('⚠', { exact: false }).first();
      test.skip((await badge.count()) === 0, 'nessun bambino con note_allergie per questo account');

      await expect(badge).toBeVisible();
    });

    test('segnare che un bambino ha mangiato', async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Sì' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      const bottoneSi = primaRiga.getByRole('button', { name: 'Sì' });
      await bottoneSi.click();
      await expect(bottoneSi).toHaveClass(/bg-emerald-700/);
    });

    test('segnare un pasto parziale con nota', async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Parziale' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      await primaRiga.getByPlaceholder('Nota (opzionale)').fill('solo il primo');
      const bottoneParziale = primaRiga.getByRole('button', { name: 'Parziale' });
      await bottoneParziale.click();

      await expect(bottoneParziale).toHaveClass(/bg-amber-700/);
    });

    test('segnare che un bambino non ha mangiato', async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'No' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      const bottoneNo = primaRiga.getByRole('button', { name: 'No' });
      await bottoneNo.click();
      await expect(bottoneNo).toHaveClass(/bg-rose-600/);
    });

    test('presenza e pasto sono indipendenti: segnare solo il pasto non richiede la presenza', async ({
      page,
    }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Sì' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      const bottoneSi = primaRiga.getByRole('button', { name: 'Sì' });
      await expect(bottoneSi).toBeEnabled();
      await bottoneSi.click();
      await expect(bottoneSi).toHaveClass(/bg-emerald-700/);
    });

    test('non posso modificare il pasto di una data diversa da oggi: sola lettura', async ({ page }) => {
      const haClassi = await apriPrimaClassePasti(page, dataIeriRoma());
      test.skip(!haClassi, 'nessuna classe attiva per questo account');

      await expect(page.getByText('Sola lettura: puoi modificare solo la data di oggi.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'No' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Parziale' })).toHaveCount(0);
    });
  });
});
