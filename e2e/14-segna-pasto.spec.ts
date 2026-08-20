// Requisito: specs/14 - segna-pasto.md
//
// ATTENZIONE: questi test scrivono davvero in `pasti` sul progetto
// Supabase di test — vedi la nota in 13-segna-presenza.spec.ts.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('14 — Segna pasto', () => {
  test.use({ storageState: statoAutenticazione('maestra') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
    await page.goto('/dashboard');
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
    await nessunaViolazioneA11yGrave(page);
  });

  test('segnare che un bambino ha mangiato', async ({ page }) => {
    const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Sì' }) }).first();
    test.skip((await primaRiga.count()) === 0, 'nessun bambino in dashboard per questo account');

    const bottoneSi = primaRiga.getByRole('button', { name: 'Sì' });
    await bottoneSi.click();
    await expect(bottoneSi).toHaveClass(/bg-stone-900/);
  });

  test('segnare un pasto parziale con nota', async ({ page }) => {
    const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Parziale' }) }).first();
    test.skip((await primaRiga.count()) === 0, 'nessun bambino in dashboard per questo account');

    await primaRiga.getByPlaceholder('Nota (opzionale)').last().fill('solo il primo');
    const bottoneParziale = primaRiga.getByRole('button', { name: 'Parziale' });
    await bottoneParziale.click();

    await expect(bottoneParziale).toHaveClass(/bg-stone-900/);
  });

  test('segnare che un bambino non ha mangiato', async ({ page }) => {
    const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'No' }) }).first();
    test.skip((await primaRiga.count()) === 0, 'nessun bambino in dashboard per questo account');

    const bottoneNo = primaRiga.getByRole('button', { name: 'No' });
    await bottoneNo.click();
    await expect(bottoneNo).toHaveClass(/bg-stone-900/);
  });

  test('presenza e pasto sono indipendenti: segnare solo il pasto non richiede la presenza', async ({
    page,
  }) => {
    const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Sì' }) }).first();
    test.skip((await primaRiga.count()) === 0, 'nessun bambino in dashboard per questo account');

    // Nessun click sui bottoni presenza in questo test: verifichiamo solo
    // che segnare il pasto non sia bloccato da uno stato presenza assente.
    const bottoneSi = primaRiga.getByRole('button', { name: 'Sì' });
    await expect(bottoneSi).toBeEnabled();
    await bottoneSi.click();
    await expect(bottoneSi).toHaveClass(/bg-stone-900/);
  });
});
