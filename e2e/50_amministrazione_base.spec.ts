// Requisito: specs/50_amministrazione_base.md — piano di test: tests/50_amministrazione_base.md
//
// ATTENZIONE: questi test scrivono davvero in `sezioni`/`bambini`/
// `maestre_sezioni`/`profili` sul progetto Supabase di test — vedi la
// nota in 13-segna-presenza.spec.ts.
import { test, expect } from '@playwright/test';
import { hasCredenziali, loginCome, nessunaViolazioneA11yGrave } from './helpers';

test.describe('50 — Amministrazione base', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    await loginCome(page, 'admin');
  });

  test('/admin: elementi presenti + accessibilità', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Sezioni' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bambini' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('creare una sezione la rende subito disponibile in elenco', async ({ page }) => {
    await page.goto('/admin');
    const nome = `Sezione E2E ${Date.now()}`;

    await page.getByPlaceholder('Nome sezione (es. Girasoli)').fill(nome);
    await page.getByRole('button', { name: 'Crea' }).click();

    await expect(page.getByText(nome)).toBeVisible({ timeout: 20_000 });
  });

  test('creare un bambino con note allergie lo mostra in evidenza', async ({ page }) => {
    await page.goto('/admin');
    const opzioniSezione = page.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip((await opzioniSezione.count()) === 0, 'nessuna sezione disponibile, crea prima una sezione');

    const cognome = `E2eTest${Date.now()}`;
    await page.getByPlaceholder('Nome').fill('Bimbo');
    await page.getByPlaceholder('Cognome').fill(cognome);
    await page.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await page.getByPlaceholder('Allergie o intolleranze (opzionale)').fill('Allergia test E2E');
    await page.getByRole('button', { name: 'Aggiungi bambino' }).click();

    const riga = page.getByText(cognome, { exact: false }).locator('..');
    await expect(riga).toContainText('Allergia test E2E', { timeout: 20_000 });
  });

  test('/admin/maestre: elementi presenti + accessibilità', async ({ page }) => {
    await page.goto('/admin/maestre');
    await expect(page.getByRole('heading', { name: 'Utenti e ruoli' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Assegna maestre alle sezioni' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('promuovere un utente a maestra ne aggiorna il ruolo', async ({ page }) => {
    test.skip(
      !process.env.E2E_UTENTE_DA_PROMUOVERE_EMAIL,
      'richiede E2E_UTENTE_DA_PROMUOVERE_EMAIL: email di un account esistente con ruolo genitore da promuovere'
    );

    await page.goto('/admin/maestre');
    const riga = page.getByText(process.env.E2E_UTENTE_DA_PROMUOVERE_EMAIL!).locator('..');
    await riga.locator('select[name="ruolo"]').selectOption('maestra');
    await riga.getByRole('button', { name: 'Aggiorna' }).click();

    await page.waitForTimeout(1000);
    await expect(riga.locator('select[name="ruolo"]')).toHaveValue('maestra');
  });

  test('assegnare e poi rimuovere una maestra da una sezione', async ({ page }) => {
    await page.goto('/admin/maestre');
    const opzioniMaestra = page.locator('select[name="maestra_id"] option:not([value=""])');
    const opzioniSezione = page.locator('select[name="sezione_id"] option:not([value=""])');
    test.skip(
      (await opzioniMaestra.count()) === 0 || (await opzioniSezione.count()) === 0,
      'serve almeno una maestra e una sezione esistenti'
    );

    await page.locator('select[name="maestra_id"]').selectOption({ index: 1 });
    await page.locator('select[name="sezione_id"]').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Assegna' }).click();
    await page.waitForTimeout(1000);

    // Rimuovo l'assegnazione appena creata (bottone "✕" nel badge sezione).
    const bottoneRimuovi = page.getByRole('button', { name: /✕$/ }).first();
    if (await bottoneRimuovi.count()) {
      await bottoneRimuovi.click();
    }
  });
});
