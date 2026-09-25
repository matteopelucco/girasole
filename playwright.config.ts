import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';

// Le variabili E2E_* (credenziali di test) e quelle Supabase/Turnstile
// vengono lette dall'ambiente: in locale da .env.local, in CI dai secret
// di GitHub Actions. Il server (`next dev`) carica .env.local da sé, ma
// il processo di Playwright no — usiamo il loader di Next.js (già una
// dipendenza del progetto, nessun pacchetto nuovo) per leggerlo anche
// qui, così i test vedono le stesse variabili del server che stanno
// interrogando. Vedi CLAUDE.md, sezione "Test end-to-end (Playwright)".
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000, // le chiamate reali a Supabase Auth possono richiedere diversi secondi
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // In CI la suite si ferma dopo 15 fallimenti: con molti test in timeout
  // (60s + retry) il job arrivava al proprio limite di 25 minuti e veniva
  // cancellato prima che il reporter HTML scrivesse playwright-report/ —
  // quindi niente artifact né screenshot per capire cosa vedeva il test
  // (issue #70). Fermandosi prima, la CI resta rossa ma il report c'è.
  maxFailures: process.env.CI ? 15 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      // Fa il login una volta per ruolo e salva la sessione su disco —
      // vedi e2e/auth.setup.ts ed e2e/helpers.ts.
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  // Riusa un server già avviato in locale (es. `npm run dev` in un altro
  // terminale, come da workflow consigliato); se non c'è, ne avvia uno
  // (anche in CI, dove parte sempre da zero).
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
