// Requisito: specs/53 - calendario-scolastico.md
//
// ATTENZIONE: questi test scrivono davvero in `giorni_chiusura` sul
// progetto Supabase di test — vedi la nota in 13-segna-presenza.spec.ts.
// I test che creano un giorno di chiusura usano una data lontana nel
// futuro (dataFraGiorni con un n grande) per non collidere con "oggi"/
// "ieri", usate da altri test, e lo eliminano a fine test.
import { test, expect, type Page } from '@playwright/test';
import {
  dataFraGiorni,
  dataProssimoGiornoFeriale,
  dataProssimoSabato,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  statoAutenticazione,
} from './helpers';

async function apriPrimaClassePresenze(page: Page, data: string): Promise<boolean> {
  await page.goto(`/dashboard/presenze?data=${data}`);
  const primaClasse = page.locator('a.bg-emerald-50').first();
  if ((await primaClasse.count()) === 0) return false;
  await primaClasse.click();
  await page.waitForURL(/\/dashboard\/presenze\/.+/);
  return true;
}

async function apriPrimaClassePasti(page: Page, data: string): Promise<boolean> {
  await page.goto(`/dashboard/pasti?data=${data}`);
  const primaClasse = page.locator('a.bg-emerald-50').first();
  if ((await primaClasse.count()) === 0) return false;
  await primaClasse.click();
  await page.waitForURL(/\/dashboard\/pasti\/.+/);
  return true;
}

test.describe('53 — Calendario scolastico', () => {
  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('/admin/calendario: elementi presenti + accessibilità', async ({ page }) => {
      await page.goto('/admin/calendario');
      await expect(page.getByRole('heading', { name: 'Calendario scolastico' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Aggiungi giorno di chiusura' })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('creare un giorno di chiusura con nota lo mostra in elenco', async ({ page }) => {
      const inizio = dataFraGiorni(300);
      const fine = dataFraGiorni(305);
      const nota = `Nota E2E ${Date.now()}`;

      await page.goto('/admin/calendario');
      await page.getByLabel('Data di inizio').fill(inizio);
      await page.getByLabel('Data di fine').fill(fine);
      await page.getByPlaceholder('Nota (opzionale, es. Vacanze di Natale)').fill(nota);
      await page.getByRole('button', { name: 'Aggiungi giorno di chiusura' }).click();

      const riga = page.getByText(nota, { exact: false });
      await expect(riga).toBeVisible({ timeout: 20_000 });

      // Pulizia: elimino il giorno appena creato per non lasciare uno
      // stato che blocchi permanentemente quella data per altri test.
      await riga.click();
      await page.waitForURL(/\/admin\/calendario\/.+/);
      await page.getByRole('button', { name: 'Elimina giorno di chiusura' }).click();
      await page.getByRole('button', { name: 'Sì' }).click();
      await page.waitForURL('/admin/calendario');
    });

    test('un solo giorno di chiusura (data di inizio = data di fine)', async ({ page }) => {
      const giorno = dataFraGiorni(310);
      const nota = `Ponte E2E ${Date.now()}`;

      await page.goto('/admin/calendario');
      await page.getByLabel('Data di inizio').fill(giorno);
      await page.getByLabel('Data di fine').fill(giorno);
      await page.getByPlaceholder('Nota (opzionale, es. Vacanze di Natale)').fill(nota);
      await page.getByRole('button', { name: 'Aggiungi giorno di chiusura' }).click();

      const riga = page.getByText(nota, { exact: false });
      await expect(riga).toBeVisible({ timeout: 20_000 });

      // Pulizia.
      await riga.click();
      await page.waitForURL(/\/admin\/calendario\/.+/);
      await page.getByRole('button', { name: 'Elimina giorno di chiusura' }).click();
      await page.getByRole('button', { name: 'Sì' }).click();
    });

    test('la data di fine non può precedere quella di inizio', async ({ page }) => {
      const inizio = dataFraGiorni(320);
      const fine = dataFraGiorni(315);

      await page.goto('/admin/calendario');
      await page.getByLabel('Data di inizio').fill(inizio);
      await page.getByLabel('Data di fine').fill(fine);
      await page.getByRole('button', { name: 'Aggiungi giorno di chiusura' }).click();

      await expect(page.getByRole('alert')).toContainText('non può precedere');
      await expect(page.getByText('Nessun giorno di chiusura ancora inserito.')).toBeVisible();
    });

    test('modificare un giorno di chiusura', async ({ page }) => {
      const inizio = dataFraGiorni(330);
      const fine = dataFraGiorni(332);
      const notaIniziale = `Modifica E2E ${Date.now()}`;

      await page.goto('/admin/calendario');
      await page.getByLabel('Data di inizio').fill(inizio);
      await page.getByLabel('Data di fine').fill(fine);
      await page.getByPlaceholder('Nota (opzionale, es. Vacanze di Natale)').fill(notaIniziale);
      await page.getByRole('button', { name: 'Aggiungi giorno di chiusura' }).click();

      const riga = page.getByText(notaIniziale, { exact: false });
      await expect(riga).toBeVisible({ timeout: 20_000 });
      await riga.click();
      await page.waitForURL(/\/admin\/calendario\/.+/);
      await nessunaViolazioneA11yGrave(page);

      const notaModificata = `${notaIniziale} - aggiornata`;
      await page.getByPlaceholder('Nota (opzionale, es. Vacanze di Natale)').fill(notaModificata);
      await page.getByRole('button', { name: 'Salva modifiche' }).click();

      await expect(page.getByPlaceholder('Nota (opzionale, es. Vacanze di Natale)')).toHaveValue(
        notaModificata,
        { timeout: 20_000 }
      );

      // Resta salvato anche dopo un ricaricamento.
      await page.reload();
      await expect(page.getByPlaceholder('Nota (opzionale, es. Vacanze di Natale)')).toHaveValue(
        notaModificata
      );

      // Pulizia.
      await page.getByRole('button', { name: 'Elimina giorno di chiusura' }).click();
      await page.getByRole('button', { name: 'Sì' }).click();
    });

    test('eliminare un giorno di chiusura lo rimuove dall\'elenco', async ({ page }) => {
      const inizio = dataFraGiorni(340);
      const fine = dataFraGiorni(340);
      const nota = `Elimina E2E ${Date.now()}`;

      await page.goto('/admin/calendario');
      await page.getByLabel('Data di inizio').fill(inizio);
      await page.getByLabel('Data di fine').fill(fine);
      await page.getByPlaceholder('Nota (opzionale, es. Vacanze di Natale)').fill(nota);
      await page.getByRole('button', { name: 'Aggiungi giorno di chiusura' }).click();

      const riga = page.getByText(nota, { exact: false });
      await expect(riga).toBeVisible({ timeout: 20_000 });
      await riga.click();
      await page.waitForURL(/\/admin\/calendario\/.+/);

      await page.getByRole('button', { name: 'Elimina giorno di chiusura' }).click();
      await page.getByRole('button', { name: 'Sì' }).click();
      await page.waitForURL('/admin/calendario');

      await expect(page.getByText(nota, { exact: false })).toHaveCount(0);
    });

    test('un giorno di chiusura registrato blocca Presenze e Pasti, anche per l\'admin', async ({
      page,
    }) => {
      const giorno = dataFraGiorni(350);
      const nota = `Chiusura E2E ${Date.now()}`;

      await page.goto('/admin/calendario');
      await page.getByLabel('Data di inizio').fill(giorno);
      await page.getByLabel('Data di fine').fill(giorno);
      await page.getByPlaceholder('Nota (opzionale, es. Vacanze di Natale)').fill(nota);
      await page.getByRole('button', { name: 'Aggiungi giorno di chiusura' }).click();
      await expect(page.getByText(nota, { exact: false })).toBeVisible({ timeout: 20_000 });

      try {
        const haClassiPresenze = await apriPrimaClassePresenze(page, giorno);
        if (haClassiPresenze) {
          await expect(page.getByText(nota, { exact: false })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Presente' })).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Assente' })).toHaveCount(0);
        }

        const haClassiPasti = await apriPrimaClassePasti(page, giorno);
        if (haClassiPasti) {
          await expect(page.getByText(nota, { exact: false })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Sì', exact: true })).toHaveCount(0);
        }
      } finally {
        // Pulizia, anche se un'asserzione sopra fallisce.
        await page.goto('/admin/calendario');
        await page.getByText(nota, { exact: false }).click();
        await page.waitForURL(/\/admin\/calendario\/.+/);
        await page.getByRole('button', { name: 'Elimina giorno di chiusura' }).click();
        await page.getByRole('button', { name: 'Sì' }).click();
      }
    });

    test('un sabato è chiusura implicita anche senza un giorno registrato', async ({ page }) => {
      const sabato = dataProssimoSabato();
      const haClassi = await apriPrimaClassePresenze(page, sabato);
      test.skip(!haClassi, 'nessuna classe attiva per questo account');

      await expect(page.getByText("L'asilo è chiuso", { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Presente' })).toHaveCount(0);
    });
  });

  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
    });

    test('un sabato mostra la chiusura anche alla maestra, senza pulsanti', async ({ page }) => {
      const sabato = dataProssimoSabato();
      const haClassi = await apriPrimaClassePresenze(page, sabato);
      test.skip(!haClassi, 'nessuna classe attiva per questo account');

      await expect(page.getByText("L'asilo è chiuso", { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Presente' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Assente' })).toHaveCount(0);
    });

    test('un giorno feriale resta scrivibile (nessun falso positivo di chiusura)', async ({ page }) => {
      const haClassi = await apriPrimaClassePresenze(page, dataProssimoGiornoFeriale());
      test.skip(!haClassi, 'nessuna classe attiva per questo account');

      await expect(page.getByText("L'asilo è chiuso", { exact: false })).toHaveCount(0);
      await expect(page.getByText('Giorno di chiusura scolastica', { exact: false })).toHaveCount(0);
    });
  });
});
