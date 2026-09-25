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

// File e2e che modificano flag degli account di test condivisi (vedi il
// progetto 'chromium-stato-condiviso' sotto).
const FILE_STATO_CONDIVISO =
  /(06-controllo-consistenza|13-segna-presenza|14-segna-pasto|16-comunicazione-pasti-rojac|17-ore-di-lavoro|18-report-ore-lavoro|19-monte-ore|53-calendario-scolastico)\.spec\.ts/;

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
    // Senza questi limiti un click/fill/goto su qualcosa che non arriva mai
    // aspetta fino al timeout del test, e il report dice solo "Test timeout"
    // senza il passo bloccato (19-monte-ore, issue #70).
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
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
      testIgnore: FILE_STATO_CONDIVISO,
    },
    {
      // 17/18/19 abilitano e disabilitano "Ore di lavoro" sugli stessi
      // account condivisi (admin, maestra): in parallelo tra loro un test
      // abilita mentre un altro verifica che l'account NON sia abilitato
      // (issue #70). 53 crea ed elimina giorni di chiusura, che valgono
      // per tutto l'asilo. 06/13/14/16 segnano o leggono presenze e pasti
      // di oggi degli stessi bambini del seed (06 segna "Assente" mentre 13
      // segna "Presente" sullo stesso bambino). Un solo worker per questi
      // file, in sequenza.
      name: 'chromium-stato-condiviso',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testMatch: FILE_STATO_CONDIVISO,
      fullyParallel: false,
      workers: 1,
    },
  ],

  // Riusa un server già avviato in locale (es. `npm run dev` in un altro
  // terminale, come da workflow consigliato); se non c'è, ne avvia uno
  // (anche in CI, dove parte sempre da zero).
  //
  // In CI il server è `next start` sulla build di produzione già prodotta
  // dal passo 5 del workflow (stesse NEXT_PUBLIC_*), non `next dev`: con il
  // dev server ogni pagina viene compilata alla prima visita e l'idratazione
  // arriva tardi, così i test cliccavano bottoni di form ancora non idratati
  // ("A React form was unexpectedly submitted", bottone bloccato in
  // aria-busy) e fallivano a caso (issue #70). In locale resta `next dev`.
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
