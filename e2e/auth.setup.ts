// Progetto "setup" di Playwright: gira una sola volta prima della suite
// vera e propria e salva la sessione autenticata di ogni ruolo su disco
// (playwright/.auth/<ruolo>.json), così i test la riusano con
// test.use({ storageState }) invece di rifare login ognuno per conto suo.
// Vedi e2e/helpers.ts per il perché (rate limiting di Supabase Auth su
// tanti login concorrenti allo stesso account).
import { test as setup } from '@playwright/test';
import { credenziali, fileSessione, hasCredenziali, type Ruolo } from './helpers';

const RUOLI: Ruolo[] = ['admin', 'maestra', 'genitore'];

for (const ruolo of RUOLI) {
  setup(`autentica ${ruolo}`, async ({ page }) => {
    setup.skip(
      !hasCredenziali(ruolo),
      `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD — vedi .env.example`
    );

    const cred = credenziali(ruolo)!;
    await page.goto('/login');
    await page.getByLabel('Email').fill(cred.email);
    await page.getByLabel('Password', { exact: true }).fill(cred.password);
    await page.getByRole('button', { name: 'Accedi' }).click();
    await page.waitForURL('/dashboard', { timeout: 20_000 });

    await page.context().storageState({ path: fileSessione(ruolo) });
  });
}
