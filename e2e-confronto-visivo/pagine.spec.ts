// Confronto visivo delle pagine principali (issue #333, serie "UX REVIEW").
//
// NON è l'e2e di `e2e/` e non risponde a nessuno `specs/NN`: non controlla
// comportamenti, solo che l'aspetto delle pagine non cambi. Si lancia a mano:
//   npm run test:visivo:riferimento   salva le foto "prima"
//   npm run test:visivo               le confronta con lo stato attuale
// Vedi docs/sviluppo-dettagli.md, sezione "Confronto visivo delle pagine".
//
// Solo dati di test (account E2E_ADMIN_*, DB di test): le foto stanno in
// `confronto-visivo/`, ignorata da git, e non vanno mai committate.
import { test, expect } from '@playwright/test';
import { SESSIONE_ADMIN } from './sessione';

type Pagina = { nome: string; percorso: string; anonima?: boolean };

// Pagine rappresentative; i percorsi sono quelli dell'app (nessun id
// dinamico: le foto devono essere ripetibili).
const PAGINE: Pagina[] = [
  { nome: 'accesso', percorso: '/login', anonima: true },
  { nome: 'dashboard', percorso: '/dashboard' },
  { nome: 'giornata', percorso: '/dashboard/giornata' },
  { nome: 'report-giornaliero', percorso: '/dashboard/report?tipo=giornaliero' },
  { nome: 'report-mensile', percorso: '/dashboard/report?tipo=mensile' },
  { nome: 'ore-lavoro', percorso: '/admin/ore-lavoro' },
  { nome: 'calendario', percorso: '/dashboard/calendario' },
  { nome: 'calendario-chiusure', percorso: '/dashboard/calendario?scheda=chiusure' },
  { nome: 'amministrazione', percorso: '/admin' },
  { nome: 'azioni-cron-job', percorso: '/admin/cron-job' },
  { nome: 'azioni-lancio-manuale', percorso: '/admin/cron-job?scheda=azioni' },
  { nome: 'rette', percorso: '/admin/rette' },
  { nome: 'maestre', percorso: '/admin/maestre' },
  { nome: 'parametri-di-funzionamento', percorso: '/admin/parametri-funzionamento' },
  { nome: 'impostazioni-avanzate', percorso: '/admin/impostazioni-avanzate' },
];

for (const pagina of PAGINE) {
  test.describe(pagina.nome, () => {
    test.use({
      storageState: pagina.anonima
        ? { cookies: [], origins: [] }
        : SESSIONE_ADMIN,
    });

    test(`foto di ${pagina.percorso}`, async ({ page }) => {
      await page.goto(pagina.percorso);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      // La pagina giusta, non un rimando al login per sessione scaduta.
      expect(new URL(page.url()).pathname).toBe(new URL(pagina.percorso, page.url()).pathname);

      await expect(page).toHaveScreenshot(`${pagina.nome}.png`, {
        fullPage: true,
        // Il piè di pagina porta versione e data di build: cambiano a ogni
        // avvio del server e non sono grafica da confrontare.
        mask: [page.locator('footer')],
      });
    });
  });
}
