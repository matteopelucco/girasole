// Requisito: specs/16 - comunicazione-pasti-rojac.md
//
// ATTENZIONE: questi test scrivono davvero in `pasti_comunicati` sul
// progetto Supabase di test — vedi la nota in 13-segna-presenza.spec.ts.
// La comunicazione è irreversibile (una per classe/giorno): se la
// suite gira più volte nello stesso giorno, la classe scelta potrebbe
// risultare già comunicata da un run precedente — i test lo gestiscono
// verificando lo stato "già comunicato" invece di richiedere sempre il
// click, così restano verdi in entrambi i casi.
import { test, expect, type Page } from '@playwright/test';
import { dataOggiRoma, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

// Usa l'ULTIMA classe della lista, non la prima: la comunicazione è
// irreversibile e blocca la modifica dei pasti per la maestra, mentre
// altri file e2e (13, 14) scelgono la PRIMA classe per i loro test —
// con Playwright in esecuzione parallela tra file (fullyParallel: true
// in playwright.config.ts) evita che i due si contendano la stessa
// classe/giorno.
async function apriUltimaClassePasti(page: Page, data: string): Promise<string | null> {
  await page.goto(`/dashboard/pasti?data=${data}`);
  const ultimaClasse = page.locator('a.bg-emerald-50').last();
  if ((await ultimaClasse.count()) === 0) return null;
  await ultimaClasse.click();
  await page.waitForURL(/\/dashboard\/pasti\/.+/);
  return new URL(page.url()).pathname.split('/').pop() ?? null;
}

let sezioneId: string | undefined;

test.describe('16 — Comunicazione pasti a Rojac', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.describe.configure({ mode: 'serial' });
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
    });

    test('il pulsante chiede conferma, e "Annulla" non registra nulla', async ({ page }) => {
      sezioneId = (await apriUltimaClassePasti(page, dataOggiRoma())) ?? undefined;
      test.skip(!sezioneId, 'nessuna classe attiva per questo account');

      const bottoneComunica = page.getByRole('button', { name: 'Pasti comunicati a Rojac' });
      test.skip((await bottoneComunica.count()) === 0, 'pasti già comunicati per questa classe/data (run precedente)');

      await bottoneComunica.click();
      await expect(page.getByText('Confermi? Da questo momento', { exact: false })).toBeVisible();

      await page.getByRole('button', { name: 'Annulla' }).click();
      await expect(page.getByText('Confermi? Da questo momento', { exact: false })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Pasti comunicati a Rojac' })).toBeVisible();
      await expect(page.getByText('Pasti comunicati a Rojac il', { exact: false })).toHaveCount(0);

      await nessunaViolazioneA11yGrave(page);
    });

    test('comunicare registra data/ora/numero e blocca la modifica per la maestra', async ({ page }) => {
      test.skip(!sezioneId, 'test precedente saltato (nessuna classe)');
      await page.goto(`/dashboard/pasti/${sezioneId}?data=${dataOggiRoma()}`);

      const bottoneComunica = page.getByRole('button', { name: 'Pasti comunicati a Rojac' });
      if ((await bottoneComunica.count()) > 0) {
        await bottoneComunica.click();
        await page.getByRole('button', { name: 'Sì' }).click();
      }

      await expect(page.getByText('Pasti comunicati a Rojac il', { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sì', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Salva nota' })).toHaveCount(0);

      await nessunaViolazioneA11yGrave(page);
    });

    test('la comunicazione è irreversibile: il pulsante non ricompare dopo un reload', async ({ page }) => {
      test.skip(!sezioneId, 'test precedente saltato (nessuna classe)');
      await page.goto(`/dashboard/pasti/${sezioneId}?data=${dataOggiRoma()}`);
      await page.reload();

      await expect(page.getByText('Pasti comunicati a Rojac il', { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pasti comunicati a Rojac' })).toHaveCount(0);
    });
  });

  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('l\'admin può sempre modificare i pasti, anche dopo la comunicazione', async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
      test.skip(!sezioneId, 'nessuna classe comunicata nei test precedenti');

      await page.goto(`/dashboard/pasti/${sezioneId}?data=${dataOggiRoma()}`);

      await expect(page.getByText('Pasti comunicati a Rojac il', { exact: false })).toBeVisible();
      await expect(page.getByText('Come admin puoi comunque modificare i pasti.')).toBeVisible();
      const primoSi = page.getByRole('button', { name: 'Sì', exact: true }).first();
      test.skip((await primoSi.count()) === 0, 'nessun bambino in questa classe');
      await expect(primoSi).toBeEnabled();

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('report a schermo', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('la sezione "Comunicazione pasti" compare nel report giornaliero', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      test.skip(!sezioneId, 'nessuna classe comunicata nei test precedenti');

      await page.goto(`/dashboard/report?tipo=giornaliero&periodo=${dataOggiRoma()}`);
      const sezioneComunicazione = page.getByText('Comunicazione pasti');
      test.skip((await sezioneComunicazione.count()) === 0, 'nessuna classe con comunicazioni visibile per questo account');

      await expect(sezioneComunicazione.first()).toBeVisible();
      await expect(page.getByText(/pasti \(.+\)/).first()).toBeVisible();
      await expect(page.getByText(/^Totale: \d+ pasti$/).first()).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });
});
