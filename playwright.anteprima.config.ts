import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { valutaUrlAnteprima } from './lib/guardiaAnteprima';

// Giro di fumo sull'anteprima di Vercel (issue #267), separato dall'e2e di
// `playwright.config.ts`: stessa libreria, altra cartella (`e2e-anteprima/`),
// nessuna corrispondenza con `specs/` (la regola `specs/NN <-> e2e/NN` vale
// solo per `e2e/`). Vedi docs/sviluppo-dettagli.md, sezione "Giro di fumo
// sull'anteprima di Vercel".
//
// Qui non c'è nessun `webServer`: l'app gira già su Vercel, l'indirizzo
// arriva da ANTEPRIMA_URL (in CI lo scrive il job `guardia` del workflow
// `anteprima-fumo.yml`; a mano: `ANTEPRIMA_URL=https://girasole-... npm run
// test:anteprima`). Lo stesso controllo del workflow gira anche qui, così un
// giro lanciato per sbaglio contro la produzione o contro localhost si
// ferma prima di aprire un browser.
loadEnvConfig(process.cwd());

const controllo = valutaUrlAnteprima(process.env.ANTEPRIMA_URL);
if (!controllo.ok) {
  throw new Error(
    `Giro di fumo non avviato: ${controllo.motivo} Imposta ANTEPRIMA_URL con l'indirizzo di una anteprima Vercel.`
  );
}

export default defineConfig({
  testDir: './e2e-anteprima',
  // Cartelle dedicate: non pestano quelle dell'e2e (test-results/,
  // playwright-report/), che la CI e i suoi script leggono.
  outputDir: './test-results-anteprima',
  // Il primo accesso a una anteprima può essere a freddo (funzioni Vercel e
  // Supabase da svegliare): margini più larghi dell'e2e contro `next start`.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Un test per ruolo, ognuno con il suo account: nessun conflitto tra
  // loro. Due worker bastano per tenere il giro sotto qualche minuto.
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  maxFailures: process.env.CI ? 8 : 0,
  reporter: process.env.CI
    ? [['html', { open: 'never', outputFolder: 'playwright-report-anteprima' }], ['github']]
    : 'list',

  use: {
    baseURL: controllo.url,
    trace: 'on-first-retry',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'anteprima', use: { ...devices['Desktop Chrome'] } }],
});
