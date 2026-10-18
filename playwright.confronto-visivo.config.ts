import { defineConfig } from '@playwright/test';
import { loadEnvConfig } from '@next/env';

// Confronto visivo delle pagine prima/dopo una modifica grafica (issue #333,
// serie "UX REVIEW"). Strumento di verifica LOCALE, separato dall'e2e di
// `playwright.config.ts`: stessa libreria, altra cartella
// (`e2e-confronto-visivo/`), nessuna corrispondenza con `specs/` (la regola
// `specs/NN <-> e2e/NN` vale solo per `e2e/`). Non gira in CI e non fa parte
// di `npx playwright test`. Istruzioni in docs/sviluppo-dettagli.md, sezione
// "Confronto visivo delle pagine".
//
// Le immagini vivono in `confronto-visivo/` (ignorata da git):
//   riferimento/<progetto>/<pagina>.png   le foto "prima"
//   differenze/                           attuale / atteso / differenza dei test rossi
//   report/                               report HTML (npx playwright show-report confronto-visivo/report)
loadEnvConfig(process.cwd());

if (process.env.CI) {
  throw new Error(
    'Il confronto visivo è uno strumento locale e non va lanciato in CI (issue #333).'
  );
}

export default defineConfig({
  testDir: './e2e-confronto-visivo',
  outputDir: './confronto-visivo/differenze',
  // Stessa cartella per "riferimento" e "confronto": cambia solo il comando
  // (con o senza --update-snapshots). Niente suffisso di piattaforma: lo
  // strumento si usa sulla stessa macchina, prima e dopo la modifica.
  snapshotDir: './confronto-visivo/riferimento',
  snapshotPathTemplate: '{snapshotDir}/{projectName}/{arg}{ext}',
  // `next dev` compila ogni pagina alla prima visita: margini larghi.
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      // Qualunque pixel diverso conta: è una rete di sicurezza.
      maxDiffPixels: 0,
      // Soglia colore a zero: con 0.1 un fondo da slate-100 a slate-200
      // passava inosservato (provato). Sullo stesso server il rendering è stabile.
      threshold: 0,
      // Nasconde l'indicatore di Next in sviluppo (non è parte dell'app).
      stylePath: './e2e-confronto-visivo/nascondi-strumenti-dev.css',
    },
  },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'confronto-visivo/report' }]],

  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    deviceScaleFactor: 1,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  },

  projects: [
    {
      // Login admin una volta sola, sessione salvata in playwright/.auth/
      // (cartella già ignorata da git) con un nome proprio.
      name: 'setup',
      testMatch: /accesso\.setup\.ts/,
      // Il primo login dopo l'avvio di `next dev` può cadere mentre Next
      // compila la pagina: un nuovo tentativo basta (nessun altro test
      // viene ritentato, un confronto rosso deve restare rosso).
      retries: 2,
    },
    {
      name: 'telefono',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      dependencies: ['setup'],
      testMatch: /pagine\.spec\.ts/,
    },
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 } },
      dependencies: ['setup'],
      testMatch: /pagine\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
