// Requisito: specs/61 - email-pasti-rojac.md
//
// Il mese 2020-01 (gennaio 2020: 23 giorni feriali, nessuna chiusura né
// pasto comunicato nel DB di test) rende i numeri prevedibili: 0 pasti
// bambini, 23 giorni di scuola, 2 × 23 = 46 pasti insegnanti, totale 46.
//
// In CI ROJAC_EMAIL_DESTINATARIO è un indirizzo fittizio @example.com
// (.github/workflows/ci.yml) e RESEND_API_KEY non c'è: l'anteprima si
// vede, l'invio reale no (lo scenario "errore nell'invio" lo copre). Il
// test dell'invio riuscito gira solo con RESEND_API_KEY, come
// 56-comunicazione-retta-mensile.spec.ts; usa solo indirizzi @example.com
// per Rojac (mai un indirizzo reale).
import { test, expect } from '@playwright/test';
import {
  chiudiPopupErrore,
  hasCredenziali,
  meseSuccessivoRoma,
  nessunaViolazioneA11yGrave,
  popupErrore,
  statoAutenticazione,
} from './helpers';

const MESE_NOTO = '/dashboard/report?tipo=mensile&periodo=2020-01';
const ROJAC = process.env.ROJAC_EMAIL_DESTINATARIO;
const ASILO = process.env.REPORT_EMAIL_DESTINATARIO || 'info@asilosartorio.it';

function riquadro(page: import('@playwright/test').Page) {
  return page.getByRole('region', { name: 'Mail mensile a Rojac' });
}

test.describe('61 — Mail mensile dei pasti a Rojac', () => {
  test.describe('come admin', () => {
    // Il test sul modello cambia la riga unica `impostazioni_email_rojac`
    // da cui dipendono le anteprime: esecuzione seriale, e quel test sta
    // in fondo e ripristina il testo.
    test.describe.configure({ mode: 'serial' });
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('il report mensile mostra pasti bambini, pasti insegnanti (2 per giorno di scuola) e totale', async ({
      page,
    }) => {
      await page.goto(MESE_NOTO);
      const box = riquadro(page);
      await expect(box).toBeVisible();
      await expect(box.getByText('Pasti bambini:')).toBeVisible();
      await expect(box.locator('div', { hasText: /^Pasti bambini:\s*0$/ })).toBeVisible();
      await expect(box.getByText('23 giorni di scuola × 2')).toBeVisible();
      await expect(box.locator('div', { hasText: /^Totale pasti:\s*46$/ })).toBeVisible();
      await expect(box.getByRole('link', { name: 'Modello email Rojac' })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('il mese corrente mostra il riquadro (giorni di scuola solo fino a oggi)', async ({ page }) => {
      await page.goto('/dashboard/report?tipo=mensile');
      await expect(riquadro(page)).toBeVisible();
    });

    test('nelle viste settimanale e giornaliera il riquadro non c\'è', async ({ page }) => {
      await page.goto('/dashboard/report?tipo=settimanale');
      await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible();
      await expect(riquadro(page)).toHaveCount(0);
      await page.goto('/dashboard/report?tipo=giornaliero');
      await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible();
      await expect(riquadro(page)).toHaveCount(0);
    });

    test('su un mese futuro il riquadro non c\'è', async ({ page }) => {
      await page.goto(`/dashboard/report?tipo=mensile&periodo=${meseSuccessivoRoma()}`);
      await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible();
      await expect(riquadro(page)).toHaveCount(0);
    });

    test('indirizzo di Rojac non configurato: avviso al posto dell\'invio', async ({ page }) => {
      test.skip(!!ROJAC, 'ROJAC_EMAIL_DESTINATARIO è configurato in questo ambiente');
      await page.goto(MESE_NOTO);
      const box = riquadro(page);
      await expect(box.getByText(/indirizzo email di Rojac non è configurato/)).toBeVisible();
      await expect(box.getByRole('button', { name: 'Invia a Rojac' })).toHaveCount(0);
    });

    test('Invia a Rojac apre un\'anteprima con destinatario, copia, oggetto e corpo', async ({ page }) => {
      test.skip(!ROJAC, 'richiede ROJAC_EMAIL_DESTINATARIO');
      await page.goto(MESE_NOTO);
      await riquadro(page).getByRole('button', { name: 'Invia a Rojac' }).click();

      const popup = page.getByRole('dialog', { name: 'Anteprima mail a Rojac' });
      await expect(popup).toBeVisible();
      await expect(popup).toContainText(ROJAC!);
      await expect(popup).toContainText(ASILO);
      await expect(popup).toContainText('gennaio 2020');
      await expect(popup).toContainText('Pasti bambini: 0');
      await expect(popup).toContainText('23 giorni di scuola): 46');
      await expect(popup).toContainText('Totale pasti: 46');
      await expect(popup.getByRole('button', { name: 'Conferma invio' })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('annullare l\'anteprima non invia nulla', async ({ page }) => {
      test.skip(!ROJAC, 'richiede ROJAC_EMAIL_DESTINATARIO');
      await page.goto(MESE_NOTO);
      await riquadro(page).getByRole('button', { name: 'Invia a Rojac' }).click();
      const popup = page.getByRole('dialog', { name: 'Anteprima mail a Rojac' });
      await popup.getByRole('button', { name: 'Annulla' }).click();
      await expect(popup).toHaveCount(0);
      await expect(page.getByText('Riepilogo inviato a Rojac')).toHaveCount(0);
    });

    test('un errore del servizio email mostra un messaggio chiaro e non conta come inviato', async ({ page }) => {
      test.skip(!ROJAC, 'richiede ROJAC_EMAIL_DESTINATARIO');
      test.skip(!!process.env.RESEND_API_KEY, 'con RESEND_API_KEY l\'invio riesce davvero');
      await page.goto(MESE_NOTO);
      await riquadro(page).getByRole('button', { name: 'Invia a Rojac' }).click();
      await page
        .getByRole('dialog', { name: 'Anteprima mail a Rojac' })
        .getByRole('button', { name: 'Conferma invio' })
        .click();

      const errore = popupErrore(page, 'Mail non inviata');
      await expect(errore).toBeVisible({ timeout: 20_000 });
      await chiudiPopupErrore(errore);
      await expect(page.getByText('Riepilogo inviato a Rojac')).toHaveCount(0);
    });

    test('confermare l\'invio manda la mail e mostra la conferma', async ({ page }) => {
      test.skip(!ROJAC || !process.env.RESEND_API_KEY, 'richiede ROJAC_EMAIL_DESTINATARIO e RESEND_API_KEY');
      await page.goto(MESE_NOTO);
      await riquadro(page).getByRole('button', { name: 'Invia a Rojac' }).click();
      await page
        .getByRole('dialog', { name: 'Anteprima mail a Rojac' })
        .getByRole('button', { name: 'Conferma invio' })
        .click();
      await expect(page.getByText('Riepilogo inviato a Rojac')).toBeVisible({ timeout: 20_000 });
    });

    // Il Reply-To non è osservabile dall'interfaccia: il payload è verificato
    // dal test unit lib/email.test.ts. Qui si controlla solo che l'invio con
    // reply_to vada a buon fine (Resend rifiuta un payload non valido).
    test("una risposta di Rojac arriva all'asilo, non al mittente tecnico (Reply-To)", async ({ page }) => {
      test.skip(!ROJAC || !process.env.RESEND_API_KEY, 'richiede ROJAC_EMAIL_DESTINATARIO e RESEND_API_KEY');
      await page.goto(MESE_NOTO);
      await riquadro(page).getByRole('button', { name: 'Invia a Rojac' }).click();
      await page
        .getByRole('dialog', { name: 'Anteprima mail a Rojac' })
        .getByRole('button', { name: 'Conferma invio' })
        .click();
      await expect(page.getByText('Riepilogo inviato a Rojac')).toBeVisible({ timeout: 20_000 });
    });

    // Ultimo: modifica la riga unica del modello e la ripristina.
    test('modificare il modello: viene salvato, mostra l\'ultimo salvataggio ed è usato dall\'anteprima', async ({
      page,
    }) => {
      await page.goto('/admin/rojac/template');
      await expect(page.getByRole('heading', { name: 'Modello email Rojac' })).toBeVisible();
      // Il segnaposto compare anche dentro la textarea del corpo: si guarda
      // solo l'elenco dei segnaposto disponibili (il paragrafo mono).
      await expect(page.locator('p.font-mono', { hasText: '{{pasti_insegnanti}}' })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);

      const oggettoOriginale = await page.getByLabel('Oggetto').inputValue();
      const corpoOriginale = await page.getByLabel('Corpo').inputValue();
      const marcatore = `E2E Rojac ${Date.now()}`;

      try {
        await page.getByLabel('Oggetto').fill(`${marcatore} {{mese}}`);
        await page.getByLabel('Corpo').fill('Totale E2E: {{totale_pasti}}');
        await page.getByRole('button', { name: 'Salva modello' }).click();
        await expect(page.getByText(/Ultimo salvataggio:/)).toBeVisible({ timeout: 20_000 });

        if (ROJAC) {
          await page.goto(MESE_NOTO);
          await riquadro(page).getByRole('button', { name: 'Invia a Rojac' }).click();
          const popup = page.getByRole('dialog', { name: 'Anteprima mail a Rojac' });
          await expect(popup).toContainText(`${marcatore} gennaio 2020`);
          await expect(popup).toContainText('Totale E2E: 46');
        }
      } finally {
        await page.goto('/admin/rojac/template');
        await page.getByLabel('Oggetto').fill(oggettoOriginale);
        await page.getByLabel('Corpo').fill(corpoOriginale);
        await page.getByRole('button', { name: 'Salva modello' }).click();
        await expect(page.getByLabel('Oggetto')).toHaveValue(oggettoOriginale);
      }
    });
  });

  for (const ruolo of ['maestra', 'assistente'] as const) {
    test.describe(`come ${ruolo}`, () => {
      test.use({ storageState: statoAutenticazione(ruolo) });

      test.beforeEach(async () => {
        test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      });

      test(`${ruolo}: il report mensile non mostra il riquadro per Rojac`, async ({ page }) => {
        await page.goto(MESE_NOTO);
        await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible();
        await expect(riquadro(page)).toHaveCount(0);
      });

      test(`${ruolo}: /admin/rojac/template reindirizza alla dashboard`, async ({ page }) => {
        await page.goto('/admin/rojac/template');
        await page.waitForURL('/dashboard');
      });
    });
  }

  test.describe('come genitore', () => {
    test.use({ storageState: statoAutenticazione('genitore') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('genitore'), 'richiede E2E_GENITORE_EMAIL/PASSWORD');
    });

    test('genitore: /admin/rojac/template reindirizza alla dashboard', async ({ page }) => {
      await page.goto('/admin/rojac/template');
      await page.waitForURL('/dashboard');
    });
  });
});
