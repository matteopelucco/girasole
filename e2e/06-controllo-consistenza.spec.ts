// Requisito: specs/06 - controllo-consistenza.md
//
// ATTENZIONE: questi test scrivono davvero in presenze/pasti sul
// progetto Supabase di test — vedi la nota in 13-segna-presenza.spec.ts.
//
// Dati propri (issue #228): i test lavorano su un bambino creato apposta
// in `beforeAll` (e2e/fixture-bambino.ts) ed eliminato in `afterAll`, che
// gira anche se un test fallisce. Non si usa la fixture per-test `bambino`
// perché qui lo stato passa da un test al successivo.
//
// I test sono in sequenza (mode: 'serial'): segnano deliberatamente
// prima il pasto "sì" e solo dopo correggono la presenza in "assente"
// sullo stesso bambino/giorno — lo stesso ordine di eventi reale che il
// requisito intercetta (vedi specs/06, "Perché il controllo serve
// comunque"). Da issue #186, se a segnare "assente" è la maestra l'app
// avvisa e azzera il pasto (specs/13): l'incoerenza resta raggiungibile
// da chi non vede i pasti, cioè l'assistente, che qui fa da "secondo
// attore" in un contesto di browser a parte. L'ultimo test riporta il
// bambino a "presente" e verifica che il warning sparisca.
import {
  test,
  expect,
  creaBambinoFixture,
  eliminaBambinoFixture,
  type BambinoFixture,
} from './fixture-bambino';
import {
  clickEAttendiAzione,
  dataOggiRoma,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  statoAutenticazione,
} from './helpers';
import {
  apriGiornata,
  cardBambino,
  colonnaPasto,
  colonnaPresenza,
  segnaAssenteOMalattia,
} from './pagina-giornata';

// Stessa formattazione di lib/date.ts:formattaDataItaliana, per
// individuare nel drill-down mensile la riga del giorno odierno.
function dataOggiFormattata(): string {
  const [anno, mese, giorno] = dataOggiRoma().split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(anno, mese - 1, giorno, 12)));
}

// Schermata unica "Presenze e pasti" (specs/10): presenza e pasto dello
// stesso bambino sono nella stessa card, colonne "Presenza" e "Pasto".
let bambino: BambinoFixture | undefined;
// Vero dopo che il primo test ha preparato la base coerente (presente con
// pasto "sì"): i test successivi si saltano se non è stato possibile.
let baseCoerentePronta = false;

test.describe('06 — Controllo di consistenza dei dati', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.describe.configure({ mode: 'serial' });
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeAll(async ({ adminDb }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      test.skip(adminDb === null, 'richiede E2E_ADMIN_EMAIL/PASSWORD (fixture bambino)');
      bambino = await creaBambinoFixture(adminDb!);
      baseCoerentePronta = false;
    });

    test.afterAll(async ({ adminDb }) => {
      if (bambino && adminDb) await eliminaBambinoFixture(adminDb, bambino.id);
      bambino = undefined;
    });

    test('nessun warning su un bambino con pasto "sì" coerente', async ({ page }) => {
      await apriGiornata(page, dataOggiRoma());

      const card = cardBambino(page, bambino!);
      await expect(card).toBeVisible();
      test.skip(
        (await colonnaPasto(card).getByRole('button', { name: 'Sì', exact: true }).count()) === 0,
        'nessun pulsante Sì/No disponibile (es. pasti già comunicati, giorno di chiusura)'
      );

      // Base coerente: presente con pasto "sì".
      await clickEAttendiAzione(page, colonnaPresenza(card).getByRole('button', { name: 'Presente' }));
      await clickEAttendiAzione(page, colonnaPasto(card).getByRole('button', { name: 'Sì' }));
      await expect(colonnaPasto(card).getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);
      await expect(card.getByText('Inconsistenza')).toHaveCount(0);
      baseCoerentePronta = true;

      await nessunaViolazioneA11yGrave(page);
    });

    test('segnare "assente" da chi non vede i pasti (assistente) crea l\'incoerenza e mostra il warning nella card', async ({
      page,
      browser,
    }) => {
      test.skip(!baseCoerentePronta, 'test precedente saltato (base coerente non preparata)');
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');

      const contestoAssistente = await browser.newContext({ storageState: statoAutenticazione('assistente') });
      try {
        const paginaAssistente = await contestoAssistente.newPage();
        await apriGiornata(paginaAssistente, dataOggiRoma());
        const cardAssistente = cardBambino(paginaAssistente, bambino!);
        await expect(cardAssistente).toBeVisible();
        const presenzaAssistente = colonnaPresenza(cardAssistente);
        test.skip(
          await presenzaAssistente.getByRole('button', { name: 'Assente' }).isDisabled(),
          'Assente bloccato (pasto già comunicato a Rojac): incoerenza non più raggiungibile'
        );
        await segnaAssenteOMalattia(paginaAssistente, presenzaAssistente, 'Assente');
        await expect(presenzaAssistente.getByRole('button', { name: 'Assente' })).toHaveClass(/bg-stone-600/);
      } finally {
        await contestoAssistente.close();
      }

      // Una sola card per bambino (specs/10): il warning è nella sua
      // intestazione, e la colonna Pasto mostra l'etichetta "Assente".
      await apriGiornata(page, dataOggiRoma());
      const card = cardBambino(page, bambino!);
      await expect(card.getByText('Inconsistenza')).toBeVisible();
      await expect(colonnaPasto(card).getByText('🚫 Assente')).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('il warning compare nel report a schermo (giornaliero)', async ({ page }) => {
      test.skip(!baseCoerentePronta, 'test precedente saltato (base coerente non preparata)');

      await page.goto(`/dashboard/report?tipo=giornaliero&periodo=${dataOggiRoma()}`);
      const riga = page.locator('tr', { hasText: bambino!.cognome }).first();
      await expect(riga).toBeVisible();

      await expect(riga.getByText('Inconsistenza')).toBeVisible();
    });

    test('il warning compare nel drill-down del giorno specifico (report mensile)', async ({ page }) => {
      test.skip(!baseCoerentePronta, 'test precedente saltato (base coerente non preparata)');

      await page.goto('/dashboard/report?tipo=mensile');
      const link = page.locator('a', { hasText: bambino!.cognome }).first();
      await expect(link).toBeVisible();

      await link.click();
      await page.waitForURL(/\/dashboard\/report\/bambino\/.+/);

      const rigaOggi = page.locator('tr', { hasText: dataOggiFormattata() });
      await expect(rigaOggi.getByText('Assente')).toBeVisible();
      await expect(rigaOggi.getByText('Sì')).toBeVisible();
      await expect(rigaOggi.getByText('Inconsistenza')).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });

    // Ripristino: il bambino torna presente e il warning sparisce (il
    // bambino viene comunque eliminato in afterAll).
    test('ripristino: il bambino torna presente e il warning sparisce', async ({ page }) => {
      test.skip(!baseCoerentePronta, 'test precedente saltato (base coerente non preparata)');

      await apriGiornata(page, dataOggiRoma());
      const card = cardBambino(page, bambino!);
      await clickEAttendiAzione(page, colonnaPresenza(card).getByRole('button', { name: 'Presente' }));
      await expect(card.getByText('Inconsistenza')).toHaveCount(0);
    });
  });
});
