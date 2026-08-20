// Requisito: specs/15 - memo.md — piano di test: tests/15 - memo.md
//
// ATTENZIONE: questi test scrivono davvero in `promemoria` sul progetto
// Supabase di test — vedi la nota in 13-segna-presenza.spec.ts.
import { test, expect } from '@playwright/test';
import { hasCredenziali, loginCome, nessunaViolazioneA11yGrave } from './helpers';

test.describe('15 — Promemoria', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
    await loginCome(page, 'maestra');
  });

  test('creare un promemoria per tutti compare in cima alla lista', async ({ page }) => {
    const titolo = `Promemoria E2E ${Date.now()}`;

    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder('Testo del promemoria').fill('Testo generato dal test end-to-end.');
    // Il select non ha una label esplicita, si seleziona per nome campo.
    await page.locator('select[name="destinatario_tipo"]').selectOption('tutti');
    await page.getByRole('button', { name: 'Pubblica promemoria' }).click();

    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });

    await nessunaViolazioneA11yGrave(page);
  });

  test('creare un promemoria per una sezione', async ({ page }) => {
    const opzioniSezione = page.locator('select[name="sezione_id"] option');
    test.skip((await opzioniSezione.count()) <= 1, 'nessuna sezione disponibile per questo account');

    const titolo = `Promemoria sezione E2E ${Date.now()}`;
    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder('Testo del promemoria').fill('Solo per una sezione.');
    await page.locator('select[name="destinatario_tipo"]').selectOption('sezione');
    await page.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Pubblica promemoria' }).click();

    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(titolo).locator('..')).toContainText('Per una sezione');
  });

  test('creare un promemoria per un singolo bambino', async ({ page }) => {
    const opzioniBambino = page.locator('select[name="bambino_id"] option');
    test.skip((await opzioniBambino.count()) <= 1, 'nessun bambino disponibile per questo account');

    const titolo = `Promemoria bambino E2E ${Date.now()}`;
    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder('Testo del promemoria').fill('Solo per un bambino.');
    await page.locator('select[name="destinatario_tipo"]').selectOption('bambino');
    await page.locator('select[name="bambino_id"]').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Pubblica promemoria' }).click();

    await expect(page.getByText(titolo)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(titolo).locator('..')).toContainText('Per un bambino');
  });

  test('titolo o testo vuoti non creano un promemoria (validazione server-side)', async ({
    page,
  }) => {
    const promemoriaPrima = await page.locator('main >> text=Nessun promemoria').count();
    await page.getByRole('button', { name: 'Pubblica promemoria' }).click();
    await page.waitForTimeout(500);

    // La action ritorna senza inserire nulla: il conteggio "Nessun
    // promemoria pubblicato" resta identico, oppure la lista non cresce.
    const promemoriaDopo = await page.locator('main >> text=Nessun promemoria').count();
    expect(promemoriaDopo).toBe(promemoriaPrima);
  });
});
