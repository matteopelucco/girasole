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

    test('riepilogo pasti della classe', async ({ page }) => {
      await expect(page.getByText(/^Pasti: \d+\/\d+$/)).toBeVisible();
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

    test('salvare una nota senza cambiare lo stato', async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Sì' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      await primaRiga.getByRole('button', { name: 'Sì' }).click();
      await expect(primaRiga.getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);

      await primaRiga.getByPlaceholder('Nota (opzionale)').fill('ha finito tutto');
      await primaRiga.getByRole('button', { name: 'Salva nota' }).click();

      await expect(primaRiga.getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);

      await page.reload();
      await expect(primaRiga.getByPlaceholder('Nota (opzionale)')).toHaveValue('ha finito tutto');
      await expect(primaRiga.getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);
    });

    test('segnare che un bambino non ha mangiato', async ({ page }) => {
      const primaRiga = page
        .locator('li', { has: page.getByRole('button', { name: 'No', exact: true }) })
        .first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      const bottoneNo = primaRiga.getByRole('button', { name: 'No', exact: true });
      await bottoneNo.click();
      await expect(bottoneNo).toHaveClass(/bg-rose-600/);
      // Stesso bug del pulsante "Assente" in Presenze (vedi
      // 13-segna-presenza.spec.ts): verifico il colore reale, non solo
      // il nome della classe, dato che lib/classiStato.ts non era
      // incluso nel content di Tailwind.
      await expect(bottoneNo).toHaveCSS('background-color', 'rgb(225, 29, 72)');
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
      await expect(page.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);
    });

    // Ultimo del describe: segna un bambino come assente, cosa che
    // altrimenti condizionerebbe i test precedenti (un bambino assente
    // non ha più pulsanti Sì/No in questa pagina).
    test('un bambino assente non è selezionabile per il pasto', async ({ page }) => {
      await page.goto(`/dashboard/presenze?data=${dataOggiRoma()}`);
      const primaClassePresenze = page.locator('a.bg-emerald-50').first();
      test.skip((await primaClassePresenze.count()) === 0, 'nessuna classe attiva per questo account');
      await primaClassePresenze.click();
      await page.waitForURL(/\/dashboard\/presenze\/.+/);

      const primaRigaPresenza = page
        .locator('li', { has: page.getByRole('button', { name: 'Assente' }) })
        .first();
      test.skip((await primaRigaPresenza.count()) === 0, 'nessun bambino in questa classe');
      const nomeBambino = (await primaRigaPresenza.locator('span.font-medium').first().textContent())?.trim();

      await primaRigaPresenza.getByRole('button', { name: 'Assente' }).click();
      await expect(primaRigaPresenza.getByRole('button', { name: 'Assente' })).toHaveClass(/bg-stone-600/);

      const sezioneId = new URL(page.url()).pathname.split('/').pop();
      await page.goto(`/dashboard/pasti/${sezioneId}?data=${dataOggiRoma()}`);
      const rigaPasto = page.locator('li', { hasText: nomeBambino ?? '' }).first();
      await expect(rigaPasto.getByText('🚫 Assente')).toBeVisible();
      await expect(rigaPasto.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      await expect(rigaPasto.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);
    });
  });
});
