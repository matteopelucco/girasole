// Requisito: specs/13 - segna-presenza.md
//
// ATTENZIONE: questi test scrivono davvero in `presenze` sul progetto
// Supabase puntato da NEXT_PUBLIC_SUPABASE_URL (di test in locale, quello
// configurato nei secret in CI) — mai contro un progetto di produzione.
import { test, expect, type Page } from '@playwright/test';
import { dataIeriRoma, dataOggiRoma, hasCredenziali, statoAutenticazione } from './helpers';

// Apre "Presenze" per la data indicata e seleziona la prima classe
// dell'elenco (flusso calendario → Presenze → classe, specs/12).
// Ritorna false se l'account non ha nessuna classe (test si salta).
async function apriPrimaClassePresenze(page: Page, data: string): Promise<boolean> {
  await page.goto(`/dashboard/presenze?data=${data}`);
  const primaClasse = page.locator('a.bg-emerald-50').first();
  if ((await primaClasse.count()) === 0) return false;
  await primaClasse.click();
  await page.waitForURL(/\/dashboard\/presenze\/.+/);
  return true;
}

test.describe('13 — Segna presenza', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      const haClassi = await apriPrimaClassePresenze(page, dataOggiRoma());
      test.skip(!haClassi, 'nessuna classe attiva per questo account');
    });

    test('riepilogo presenze della classe', async ({ page }) => {
      await expect(page.getByText(/^Presenti: \d+\/\d+$/)).toBeVisible();
      await expect(page.getByRole('heading', { name: /^Presenze giornaliere - Sezione /i })).toBeVisible();
    });

    test('segnare un bambino presente evidenzia il pulsante corretto', async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Presente' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      const bottonePresente = primaRiga.getByRole('button', { name: 'Presente' });
      await bottonePresente.click();

      await expect(bottonePresente).toHaveClass(/bg-emerald-700/);
    });

    test("segnare un'assenza con nota", async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Assente' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      await primaRiga.getByPlaceholder('Nota (opzionale)').fill('influenza, rientra lunedì');
      const bottoneAssente = primaRiga.getByRole('button', { name: 'Assente' });
      await bottoneAssente.click();

      await expect(bottoneAssente).toHaveClass(/bg-stone-600/);
      // Bug reale trovato durante un test con un'insegnante: il
      // pulsante selezionato appariva come uno spazio bianco perché
      // lib/classiStato.ts non era incluso nel content di Tailwind
      // (tailwind.config.ts) — la classe bg-stone-600 non veniva mai
      // generata nel CSS finale, pur comparendo nell'attributo class.
      // Verifico il colore di sfondo REALE, non solo il nome classe.
      await expect(bottoneAssente).toHaveCSS('background-color', 'rgb(87, 83, 78)');
      await expect(primaRiga.getByPlaceholder('Nota (opzionale)')).toHaveValue(
        'influenza, rientra lunedì'
      );

      // La nota deve restare salvata anche dopo un ricaricamento, non
      // solo visibile finché l'input non viene rimontato.
      await page.reload();
      await expect(primaRiga.getByPlaceholder('Nota (opzionale)')).toHaveValue(
        'influenza, rientra lunedì'
      );
    });

    test('salvare una nota senza cambiare lo stato', async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Presente' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      // Serve uno stato già segnato: "Salva nota" richiede un record di
      // presenza esistente (la colonna stato non è nullable).
      await primaRiga.getByRole('button', { name: 'Presente' }).click();
      await expect(primaRiga.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);

      await primaRiga.getByPlaceholder('Nota (opzionale)').fill('entra alle 9:03');
      await primaRiga.getByRole('button', { name: 'Salva nota' }).click();

      // Lo stato non cambia: resta "presente".
      await expect(primaRiga.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);

      await page.reload();
      await expect(primaRiga.getByPlaceholder('Nota (opzionale)')).toHaveValue('entra alle 9:03');
      await expect(primaRiga.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
    });

    test('correggere uno stato in malattia: upsert, nota e tag negli elenchi', async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Presente' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');
      const nomeBambino = (await primaRiga.locator('span.font-medium').first().textContent())?.trim();

      await primaRiga.getByRole('button', { name: 'Presente' }).click();
      await expect(primaRiga.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);

      // Ricarico e correggo in malattia: se l'upsert funziona resta un
      // solo record (nessun duplicato, nessuno stato "fantasma").
      await page.reload();
      await primaRiga.getByPlaceholder('Nota (opzionale)').fill('febbre alta');
      const bottoneMalattia = primaRiga.getByRole('button', { name: 'Malattia' });
      await bottoneMalattia.click();

      await expect(bottoneMalattia).toHaveClass(/bg-rose-600/);
      await expect(primaRiga.getByRole('button', { name: 'Presente' })).not.toHaveClass(/bg-emerald-700/);
      await expect(primaRiga.getByText('🤒 Malattia')).toBeVisible();

      // Lo stato malattia appare come tag anche nell'elenco Pasti dello
      // stesso bambino, stessa data (specs/13, stesso scenario).
      const url = new URL(page.url());
      const sezioneId = url.pathname.split('/').pop();
      const data = url.searchParams.get('data') ?? dataOggiRoma();
      await page.goto(`/dashboard/pasti/${sezioneId}?data=${data}`);
      const rigaPasto = page.locator('li', { hasText: nomeBambino ?? '' }).first();
      await expect(rigaPasto.getByText('🤒 Malattia')).toBeVisible();
    });

    test('non posso modificare una data diversa da oggi: sola lettura', async ({ page }) => {
      const haClassi = await apriPrimaClassePresenze(page, dataIeriRoma());
      test.skip(!haClassi, 'nessuna classe attiva per questo account');

      await expect(page.getByText('Sola lettura: puoi modificare solo la data di oggi.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Presente' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Assente' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Malattia' })).toHaveCount(0);
    });

    test('riepilogo mostra i conteggi pre-asilo/post-asilo', async ({ page }) => {
      await expect(page.getByText(/^Pre-asilo: \d+$/)).toBeVisible();
      await expect(page.getByText(/^Post-asilo: \d+$/)).toBeVisible();
    });

    test('segnare pre-asilo forza presente e attiva l\'indicatore', async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Pre-asilo' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      const bottonePreAsilo = primaRiga.getByRole('button', { name: 'Pre-asilo' });
      await bottonePreAsilo.click();

      await expect(bottonePreAsilo).toHaveClass(/bg-sky-700/);
      await expect(primaRiga.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
    });

    test('pre-asilo e post-asilo sono indipendenti e cumulabili', async ({ page }) => {
      const primaRiga = page
        .locator('li', { has: page.getByRole('button', { name: 'Post-asilo' }) })
        .first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      // Riparte da una base nota (nessun pre/post-asilo attivo): un test
      // precedente in questo stesso describe può aver già lasciato
      // pre-asilo attivo sullo stesso bambino, e un secondo click su un
      // toggle già attivo lo disattiva invece di (ri)attivarlo.
      await primaRiga.getByRole('button', { name: 'Presente' }).click();
      await expect(primaRiga.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);

      await primaRiga.getByRole('button', { name: 'Pre-asilo' }).click();
      const bottonePostAsilo = primaRiga.getByRole('button', { name: 'Post-asilo' });
      await bottonePostAsilo.click();

      await expect(primaRiga.getByRole('button', { name: 'Pre-asilo' })).toHaveClass(/bg-sky-700/);
      await expect(bottonePostAsilo).toHaveClass(/bg-sky-700/);
    });

    test('ripremere pre-asilo lo disattiva, restando presente', async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Pre-asilo' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      const bottonePreAsilo = primaRiga.getByRole('button', { name: 'Pre-asilo' });
      await bottonePreAsilo.click();
      await expect(bottonePreAsilo).toHaveClass(/bg-sky-700/);

      await bottonePreAsilo.click();
      await expect(bottonePreAsilo).not.toHaveClass(/bg-sky-700/);
      await expect(primaRiga.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
    });

    test('segnare assente resetta pre-asilo e post-asilo', async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Pre-asilo' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      await primaRiga.getByRole('button', { name: 'Pre-asilo' }).click();
      await expect(primaRiga.getByRole('button', { name: 'Pre-asilo' })).toHaveClass(/bg-sky-700/);

      await primaRiga.getByRole('button', { name: 'Assente' }).click();
      await expect(primaRiga.getByRole('button', { name: 'Pre-asilo' })).not.toHaveClass(/bg-sky-700/);
      await expect(primaRiga.getByRole('button', { name: 'Post-asilo' })).not.toHaveClass(/bg-sky-700/);
    });
  });

  test.describe('come assistente, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
      const haClassi = await apriPrimaClassePresenze(page, dataOggiRoma());
      test.skip(!haClassi, 'nessuna classe attiva per questo account');
    });

    test("l'assistente può segnare una presenza, come una maestra", async ({ page }) => {
      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Presente' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      const bottonePresente = primaRiga.getByRole('button', { name: 'Presente' });
      await bottonePresente.click();

      await expect(bottonePresente).toHaveClass(/bg-emerald-700/);
    });
  });

  test.describe("come admin, l'admin può modificare qualunque data", () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('i pulsanti restano attivi anche su una data diversa da oggi', async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      const haClassi = await apriPrimaClassePresenze(page, dataIeriRoma());
      test.skip(!haClassi, 'nessuna classe per questo account');

      const primaRiga = page.locator('li', { has: page.getByRole('button', { name: 'Presente' }) }).first();
      test.skip((await primaRiga.count()) === 0, 'nessun bambino in questa classe');

      await expect(page.getByText('Sola lettura: puoi modificare solo la data di oggi.')).toHaveCount(0);
      const bottonePresente = primaRiga.getByRole('button', { name: 'Presente' });
      await bottonePresente.click();
      await expect(bottonePresente).toHaveClass(/bg-emerald-700/);
    });
  });
});
