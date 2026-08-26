// Requisito: specs/16 - comunicazione-pasti-rojac.md
//
// ATTENZIONE — a differenza degli altri file e2e di questo progetto,
// questi test NON premono mai "Conferma" nel riquadro di comunicazione
// pasti. Il motivo: la comunicazione è UNA sola al giorno per l'INTERO
// asilo (non per singola classe) e blocca la modifica dei pasti per la
// maestra in ogni classe per il resto della giornata — se il test
// automatizzato la attivasse davvero, romperebbe per il resto della
// giornata ogni altro test e2e che scrive pasti sullo stesso progetto
// Supabase di test (es. 06-controllo-consistenza.spec.ts,
// 14-segna-pasto.spec.ts). I test qui verificano quindi solo: che il
// pulsante e il riquadro di conferma mostrino le informazioni corrette
// (numero pasti, telefono Rojac, data) e che "Annulla" non registri
// nulla; gli scenari che presuppongono una comunicazione già avvenuta
// (blocco per la maestra, override admin, sezione nel report) si
// attivano solo se qualcuno l'ha già confermata manualmente in
// precedenza nello stesso giorno (test.skip altrimenti) — copertura
// completa richiede quindi ANCHE una verifica manuale una tantum del
// click "Conferma", vedi TASKS.md.
import { test, expect } from '@playwright/test';
import { dataOggiRoma, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

const TELEFONO_ROJAC = '0331 955630';

test.describe('16 — Comunicazione pasti a Rojac', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await page.goto(`/dashboard/pasti?data=${dataOggiRoma()}`);
    });

    test('il riquadro di conferma mostra numero pasti, telefono Rojac e data; "Annulla" non registra nulla', async ({
      page,
    }) => {
      const bottoneConferma = page.getByRole('button', { name: 'Conferma pasti' });
      test.skip(
        (await bottoneConferma.count()) === 0,
        'pasti già comunicati oggi (da un run precedente) oppure nessuna sezione/bambino per questo account'
      );

      await bottoneConferma.click();
      await expect(page.getByText(TELEFONO_ROJAC, { exact: false })).toBeVisible();
      await expect(page.getByText(/\d+ pasti/, { exact: false }).first()).toBeVisible();

      await page.getByRole('button', { name: 'Annulla' }).click();
      await expect(page.getByText(TELEFONO_ROJAC, { exact: false })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Conferma pasti' })).toBeVisible();
      await expect(page.getByText('Pasti comunicati a Rojac il', { exact: false })).toHaveCount(0);

      await nessunaViolazioneA11yGrave(page);
    });

    test('se i pasti di oggi sono già comunicati, il blocco vale per ogni classe della maestra', async ({ page }) => {
      const banner = page.getByText('Pasti comunicati a Rojac il', { exact: false });
      test.skip((await banner.count()) === 0, 'pasti non ancora comunicati oggi (nessuna comunicazione da verificare)');
      await expect(banner).toBeVisible();

      const classi = page.locator('a.bg-emerald-50');
      const numeroClassi = await classi.count();
      test.skip(numeroClassi === 0, 'nessuna classe per questo account');

      for (let i = 0; i < numeroClassi; i++) {
        await page.goto(`/dashboard/pasti?data=${dataOggiRoma()}`);
        await page.locator('a.bg-emerald-50').nth(i).click();
        await page.waitForURL(/\/dashboard\/pasti\/.+/);

        await expect(page.getByText('sono stati comunicati a Rojac il', { exact: false })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Sì', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Salva nota' })).toHaveCount(0);
      }

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('l\'admin vede comunque il messaggio, e può sempre modificare i pasti', async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      await page.goto(`/dashboard/pasti?data=${dataOggiRoma()}`);
      const banner = page.getByText('Pasti comunicati a Rojac il', { exact: false });
      test.skip((await banner.count()) === 0, 'pasti non ancora comunicati oggi (nessuna comunicazione da verificare)');
      await expect(banner).toBeVisible();

      const primaClasse = page.locator('a.bg-emerald-50').first();
      test.skip((await primaClasse.count()) === 0, 'nessuna classe attiva');
      await primaClasse.click();
      await page.waitForURL(/\/dashboard\/pasti\/.+/);

      await expect(page.getByText('Come admin puoi comunque modificare i pasti di qualunque classe.')).toBeVisible();
      const primoSi = page.getByRole('button', { name: 'Sì', exact: true }).first();
      test.skip((await primoSi.count()) === 0, 'nessun bambino in questa classe');
      await expect(primoSi).toBeEnabled();

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('report a schermo', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('la sezione "Comunicazione pasti" compare nel report giornaliero se oggi è stato comunicato', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

      await page.goto(`/dashboard/report?tipo=giornaliero&periodo=${dataOggiRoma()}`);
      const sezioneComunicazione = page.getByRole('heading', { name: 'Comunicazione pasti' });
      test.skip((await sezioneComunicazione.count()) === 0, 'pasti non ancora comunicati oggi');

      await expect(sezioneComunicazione).toBeVisible();
      await expect(page.getByText(/pasti \(.+\)/).first()).toBeVisible();
      await expect(page.getByText(/^Totale del periodo: \d+ pasti$/)).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });
});
