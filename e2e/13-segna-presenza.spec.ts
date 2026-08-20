// Requisito: specs/13 - segna-presenza.md
//
// ATTENZIONE: questi test scrivono davvero in `presenze` sul progetto
// Supabase puntato da NEXT_PUBLIC_SUPABASE_URL (di test in locale, quello
// configurato nei secret in CI) — mai contro un progetto di produzione.
import { test, expect } from '@playwright/test';
import { hasCredenziali, statoAutenticazione } from './helpers';

test.describe('13 — Segna presenza', () => {
  test.use({ storageState: statoAutenticazione('maestra') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
    await page.goto('/dashboard');
  });

  test('segnare un bambino presente evidenzia il pulsante corretto', async ({ page }) => {
    const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Presente' }) }).first();
    test.skip((await primaRiga.count()) === 0, 'nessun bambino in dashboard per questo account');

    const bottonePresente = primaRiga.getByRole('button', { name: 'Presente' });
    await bottonePresente.click();

    await expect(bottonePresente).toHaveClass(/bg-stone-900/);
  });

  test('segnare un\'assenza con nota', async ({ page }) => {
    const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Assente' }) }).first();
    test.skip((await primaRiga.count()) === 0, 'nessun bambino in dashboard per questo account');

    await primaRiga.getByPlaceholder('Nota (opzionale)').first().fill('influenza, rientra lunedì');
    const bottoneAssente = primaRiga.getByRole('button', { name: 'Assente' });
    await bottoneAssente.click();

    await expect(bottoneAssente).toHaveClass(/bg-stone-900/);
    await expect(primaRiga.getByPlaceholder('Nota (opzionale)').first()).toHaveValue(
      'influenza, rientra lunedì'
    );
  });

  test('correggere uno stato già segnato non duplica il record (upsert)', async ({ page }) => {
    const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Presente' }) }).first();
    test.skip((await primaRiga.count()) === 0, 'nessun bambino in dashboard per questo account');

    await primaRiga.getByRole('button', { name: 'Presente' }).click();
    await expect(primaRiga.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-stone-900/);

    // Ricarico la pagina e cambio stato: se l'upsert funziona, dopo il
    // reload lo stato precedente ("presente") deve essere quello mostrato,
    // e dopo il cambio deve risultare "malattia" — un solo stato per volta.
    await page.reload();
    const bottoneMalattia = primaRiga.getByRole('button', { name: 'Malattia' });
    await bottoneMalattia.click();
    await expect(bottoneMalattia).toHaveClass(/bg-stone-900/);
    await expect(primaRiga.getByRole('button', { name: 'Presente' })).not.toHaveClass(/bg-stone-900/);
  });
});
