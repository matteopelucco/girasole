// Login dell'admin per il confronto visivo (issue #333). Solo variabili
// d'ambiente E2E_ADMIN_*: nessuna credenziale nel repo. Senza credenziali il
// giro FALLISCE (uno skip darebbe foto di riferimento della sola pagina di
// login, un falso senso di sicurezza).
import { test as setup } from '@playwright/test';
import { credenziali } from '../e2e/helpers';
import { SESSIONE_ADMIN } from './sessione';

setup('accedi come admin', async ({ page }) => {
  const cred = credenziali('admin');
  if (!cred) {
    throw new Error('Servono E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD (vedi .env.example).');
  }
  await page.goto('/login');
  await page.getByLabel('Email').fill(cred.email);
  await page.getByLabel('Password', { exact: true }).fill(cred.password);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await page.waitForURL('/dashboard', { timeout: 30_000 });
  await page.context().storageState({ path: SESSIONE_ADMIN });
});
