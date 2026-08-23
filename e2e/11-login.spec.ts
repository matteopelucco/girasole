// Requisito: specs/11 - login.md
import { test, expect } from '@playwright/test';
import { hasCredenziali, loginCome, nessunaViolazioneA11yGrave } from './helpers';

test.describe('11 — Login', () => {
  test('schermata di login: elementi presenti + accessibilità', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Girasole' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible();

    await nessunaViolazioneA11yGrave(page);
  });

  test('credenziali errate: messaggio d\'errore ed email preservata', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('prova@esempio.it');
    await page.getByLabel('Password', { exact: true }).fill('password-sicuramente-sbagliata');
    await page.getByRole('button', { name: 'Accedi' }).click();

    await expect(page.getByText('Credenziali non valide. Riprova.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel('Email')).toHaveValue('prova@esempio.it');
    await expect(page.getByRole('link', { name: 'Non ricordi la password?' })).toBeVisible();
  });

  test('mostrare/nascondere la password durante la digitazione', async ({ page }) => {
    await page.goto('/login');
    const campoPassword = page.getByLabel('Password', { exact: true });
    await campoPassword.fill('unaPasswordDiProva');
    await expect(campoPassword).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Mostra password' }).click();
    await expect(campoPassword).toHaveAttribute('type', 'text');
    await expect(campoPassword).toHaveValue('unaPasswordDiProva');

    await page.getByRole('button', { name: 'Nascondi password' }).click();
    await expect(campoPassword).toHaveAttribute('type', 'password');
  });

  test('accesso a pagine protette senza login reindirizza a /login', async ({ page }) => {
    for (const percorso of ['/dashboard', '/admin', '/admin/maestre']) {
      await page.goto(percorso);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('accesso con credenziali valide e logout', async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

    await loginCome(page, 'admin');
    await expect(page).toHaveURL('/dashboard');

    await page.getByRole('button', { name: 'Esci' }).click();
    await expect(page).toHaveURL(/\/login/);

    // Dopo il logout, /dashboard deve tornare a chiedere l'accesso.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
