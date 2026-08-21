// Requisito: specs/02 - password-recovery.md
import { test, expect } from '@playwright/test';
import { nessunaViolazioneA11yGrave } from './helpers';

const MESSAGGIO_GENERICO =
  "Se l'indirizzo esiste, riceverai a breve un'email con le istruzioni per reimpostare la password.";

test.describe('02 — Password recovery', () => {
  test('il link "non ricordi la password?" compare dopo un errore di login', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('prova@esempio.it');
    await page.getByLabel('Password').fill('sbagliata');
    await page.getByRole('button', { name: 'Accedi' }).click();

    const link = page.getByRole('link', { name: 'Non ricordi la password?' });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await expect(page).toHaveURL('/recupera-password');
  });

  test('schermata di richiesta reset: elementi presenti + accessibilità', async ({ page }) => {
    await page.goto('/recupera-password');
    await expect(page.getByRole('heading', { name: 'Recupera password' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('richiesta per email inesistente: messaggio generico (anti-enumeration)', async ({
    page,
  }) => {
    await page.goto('/recupera-password');
    await page.getByLabel('Email').fill(`non-esiste-${Date.now()}@esempio.it`);
    await page.getByRole('button', { name: 'Invia il link di recupero' }).click();

    await expect(page.getByText(MESSAGGIO_GENERICO)).toBeVisible({ timeout: 20_000 });
  });

  test('richiesta per un\'email esistente: stesso messaggio generico', async ({ page }) => {
    test.skip(
      !process.env.E2E_ADMIN_EMAIL,
      'richiede E2E_ADMIN_EMAIL (usato solo come email "esistente", non serve la password)'
    );

    await page.goto('/recupera-password');
    await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByRole('button', { name: 'Invia il link di recupero' }).click();

    // Stesso identico messaggio del caso "email inesistente": è la garanzia
    // di anti-enumeration, non un dettaglio implementativo.
    await expect(page.getByText(MESSAGGIO_GENERICO)).toBeVisible({ timeout: 20_000 });
  });

  test('richieste ripetute per la stessa email restano al riparo (stesso messaggio, nessun errore)', async ({
    page,
  }) => {
    // Verifica il contratto osservabile dall'UI del rate limit (1
    // richiesta/minuto per email, vedi puo_richiedere_reset_password in
    // supabase/migrations/0003_password_recovery.sql): anche superando la
    // soglia, l'utente vede sempre lo stesso messaggio generico, mai un
    // errore diverso che rivelerebbe il rate limiting stesso (che sarebbe
    // già una forma di enumeration). Il test non può verificare da UI se
    // la seconda email è stata effettivamente soppressa lato server: quel
    // dettaglio richiede ispezione DB/log, fuori dallo scope E2E.
    const email = `rate-limit-${Date.now()}@esempio.it`;

    await page.goto('/recupera-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Invia il link di recupero' }).click();
    await expect(page.getByText(MESSAGGIO_GENERICO)).toBeVisible({ timeout: 20_000 });

    await page.goto('/recupera-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Invia il link di recupero' }).click();
    await expect(page.getByText(MESSAGGIO_GENERICO)).toBeVisible({ timeout: 20_000 });
  });

  test('accesso a /reimposta-password senza una sessione di recovery', async ({ page }) => {
    await page.goto('/reimposta-password');
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText('Il link non è più valido o è scaduto. Richiedine uno nuovo.')
    ).toBeVisible();
  });

  test('widget captcha: presente solo se configurato, nessuna rottura se assente', async ({
    page,
  }) => {
    await page.goto('/recupera-password');
    const haSiteKey = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const widget = page.locator('.cf-turnstile');
    if (haSiteKey) {
      await expect(widget).toBeAttached();
    } else {
      await expect(widget).toHaveCount(0);
    }

    // In entrambi i casi il form resta utilizzabile.
    await expect(page.getByRole('button', { name: 'Invia il link di recupero' })).toBeEnabled();
  });
});
