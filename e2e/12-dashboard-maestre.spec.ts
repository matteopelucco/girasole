// Requisito: specs/12 - dashboard-maestre.md
import { test, expect } from '@playwright/test';
import { hasCredenziali, loginCome, nessunaViolazioneA11yGrave } from './helpers';

test.describe('12 — Dashboard maestra', () => {
  test('la maestra vede i bambini delle proprie sezioni con stato di oggi', async ({ page }) => {
    test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

    await loginCome(page, 'maestra');
    await expect(page.getByRole('heading', { name: 'Presenze e pasti di oggi' })).toBeVisible();

    await nessunaViolazioneA11yGrave(page);
  });

  test('maestra senza sezioni assegnate vede il messaggio corretto, non un errore', async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_MAESTRA_SENZA_SEZIONE_EMAIL || !process.env.E2E_MAESTRA_SENZA_SEZIONE_PASSWORD,
      'richiede un secondo account maestra di test SENZA sezioni assegnate (E2E_MAESTRA_SENZA_SEZIONE_*)'
    );

    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_MAESTRA_SENZA_SEZIONE_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_MAESTRA_SENZA_SEZIONE_PASSWORD!);
    await page.getByRole('button', { name: 'Accedi' }).click();
    await page.waitForURL('/dashboard', { timeout: 20_000 });

    await expect(
      page.getByText('Non hai ancora nessuna sezione assegnata')
    ).toBeVisible();
  });

  test('l\'admin apre la dashboard: rimando alle pagine di amministrazione', async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

    await loginCome(page, 'admin');
    await expect(page.getByRole('link', { name: 'Sezioni e bambini' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Maestre' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Promemoria' })).toBeVisible();

    await nessunaViolazioneA11yGrave(page);
  });

  test('un genitore apre la dashboard: solo il placeholder, nessun dato di bambini', async ({
    page,
  }) => {
    test.skip(!hasCredenziali('genitore'), 'richiede E2E_GENITORE_EMAIL/PASSWORD');

    await loginCome(page, 'genitore');
    await expect(
      page.getByText('Il portale genitori è in arrivo in una fase successiva.')
    ).toBeVisible();

    await nessunaViolazioneA11yGrave(page);
  });
});
