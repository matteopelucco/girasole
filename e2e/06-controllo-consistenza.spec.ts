// Requisito: specs/06 - controllo-consistenza.md
//
// ATTENZIONE: questi test scrivono davvero in presenze/pasti sul
// progetto Supabase di test — vedi la nota in 13-segna-presenza.spec.ts.
// I test sono in sequenza (mode: 'serial'): segnano deliberatamente
// prima il pasto "sì" e solo dopo correggono la presenza in "assente"
// sullo stesso bambino/giorno — lo stesso ordine di eventi reale che il
// requisito intercetta (vedi specs/06, "Perché il controllo serve
// comunque").
import { test, expect, type Page } from '@playwright/test';
import { dataOggiRoma, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

// Stessa formattazione di lib/date.ts:formattaDataItaliana, per
// individuare nel drill-down mensile la riga del giorno odierno senza
// dipendere dall'ordine/quantità di righe accumulate da run precedenti
// della suite (che non ripulisce i dati creati).
function dataOggiFormattata(): string {
  const [anno, mese, giorno] = dataOggiRoma().split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(anno, mese - 1, giorno, 12)));
}

// Navigazione a 2 livelli (specs/12, v0.39.0): Presenze e Pasti mostrano
// direttamente i bambini di tutte le sezioni visibili, raggruppati per
// sezione — non c'è più una pagina per singola classe da aprire.
async function apriPagina(page: Page, sezione: 'presenze' | 'pasti', data: string): Promise<void> {
  await page.goto(`/dashboard/${sezione}?data=${data}`);
}

let nomeBambino: string | undefined;

test.describe('06 — Controllo di consistenza dei dati', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.describe.configure({ mode: 'serial' });
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
    });

    test('nessun warning su un bambino con pasto "sì" coerente', async ({ page }) => {
      await apriPagina(page, 'pasti', dataOggiRoma());

      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Sì' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino selezionabile per il pasto in questa classe');

      nomeBambino = (await primaRiga.locator('span.font-medium').first().textContent())?.trim();

      await primaRiga.getByRole('button', { name: 'Sì' }).click();
      await expect(primaRiga.getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);
      await expect(primaRiga.getByText('Inconsistenza')).toHaveCount(0);

      await nessunaViolazioneA11yGrave(page);
    });

    test('segnare "assente" sullo stesso bambino crea l\'incoerenza e mostra il warning in Presenze e Pasti', async ({
      page,
    }) => {
      test.skip(!nomeBambino, 'test precedente saltato (nessun bambino disponibile)');

      await apriPagina(page, 'presenze', dataOggiRoma());
      const rigaPresenze = page.locator('li', { hasText: nomeBambino! }).first();
      await rigaPresenze.getByRole('button', { name: 'Assente' }).click();
      await expect(rigaPresenze.getByRole('button', { name: 'Assente' })).toHaveClass(/bg-stone-600/);

      await expect(rigaPresenze.getByText('Inconsistenza')).toBeVisible();
      await nessunaViolazioneA11yGrave(page);

      await apriPagina(page, 'pasti', dataOggiRoma());
      const rigaPasti = page.locator('li', { hasText: nomeBambino! }).first();
      await expect(rigaPasti.getByText('Bambino assente: il pasto non è applicabile.')).toBeVisible();
      await expect(rigaPasti.getByText('Inconsistenza')).toBeVisible();
    });

    test('il warning compare nel report a schermo (giornaliero)', async ({ page }) => {
      test.skip(!nomeBambino, 'test precedente saltato (nessun bambino disponibile)');

      await page.goto(`/dashboard/report?tipo=giornaliero&periodo=${dataOggiRoma()}`);
      const riga = page.locator('tr', { hasText: nomeBambino! }).first();
      test.skip((await riga.count()) === 0, 'bambino non visibile nel report per questo account');

      await expect(riga.getByText('Inconsistenza')).toBeVisible();
    });

    test('il warning compare nel drill-down del giorno specifico (report mensile)', async ({ page }) => {
      test.skip(!nomeBambino, 'test precedente saltato (nessun bambino disponibile)');

      await page.goto('/dashboard/report?tipo=mensile');
      const link = page.locator('a', { hasText: nomeBambino! }).first();
      test.skip((await link.count()) === 0, 'bambino non visibile nel report per questo account');

      await link.click();
      await page.waitForURL(/\/dashboard\/report\/bambino\/.+/);

      const rigaOggi = page.locator('tr', { hasText: dataOggiFormattata() });
      await expect(rigaOggi.getByText('Assente')).toBeVisible();
      await expect(rigaOggi.getByText('Sì')).toBeVisible();
      await expect(rigaOggi.getByText('Inconsistenza')).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });
});
