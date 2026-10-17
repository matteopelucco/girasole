// Requisito: specs/64 - calendario-eventi.md
//
// Un test per ogni scenario della spec. Il feed iCal è FINTO: un piccolo server
// HTTP avviato dal test stesso (e2e/feed-ical-finto.ts), mai il calendario
// reale. Perché l'app lo accetti, playwright.config.ts imposta
// CALENDARIO_ICAL_PROVA_ORIGINE anche per il server dell'app: se in locale si
// riusa un server già avviato, va riavviato.
//
// Le impostazioni e gli eventi sono uno solo per tutto l'asilo: i test girano
// in sequenza (un solo worker per questo file) e alla fine rimettono tutto a
// posto (indirizzo svuotato, nessun evento di prova). I test che lanciano il
// cron (come e2e/52) richiedono CRON_SECRET e RESEND_API_KEY; verificano gli
// effetti sul totale degli eventi, perché un altro lancio del cron in parallelo
// (e2e/52) potrebbe già aver sincronizzato lo stesso feed.
//
// Nessun indirizzo reale compare nei test; l'indirizzo finto (locale) non è
// stampato nei messaggi di fallimento: i confronti usano booleani.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';
import { SEGNAPOSTO_VALORE } from '../lib/parametriAmbiente';
import { bloccoCron, lanciCron, PERCORSO_CRON_JOB } from './pagina-cron-job';
import {
  FEED_VUOTO,
  avviaFeedFinto,
  feedAggiornato,
  feedConRegolaOstile,
  feedIniziale,
  indirizzoFeedFinto,
  origineFeedFinto,
  type FeedFinto,
} from './feed-ical-finto';
import {
  PERCORSO_PARAMETRI,
  STATO_ATTIVA,
  STATO_DISATTIVATA,
  campoIndirizzo,
  impostaIndirizzo,
  indirizzoCalendario,
  lanciaCronNotturno,
  passwordAdmin,
  pulsanteMostraIndirizzo,
  pulsanteNascondiIndirizzo,
  salvaIndirizzo,
  sezioneCalendario,
  statoCalendario,
  verificaPassword,
} from './pagina-calendario';

const RICHIEDE_CRON = !process.env.CRON_SECRET || !process.env.RESEND_API_KEY;
const MOTIVO_CRON = 'richiede CRON_SECRET e RESEND_API_KEY configurate per invocare davvero la route del cron';

test.describe.configure({ mode: 'serial' });

test.describe('64 — Calendario eventi', () => {
  let feed: FeedFinto;

  test.beforeAll(async () => {
    test.skip(!origineFeedFinto(), 'richiede CALENDARIO_ICAL_PROVA_ORIGINE (impostata da playwright.config.ts)');
    feed = await avviaFeedFinto({ stato: 200, corpo: feedIniziale() });
  });

  // Rimette a posto lo stato condiviso: indirizzo salvato, un feed vuoto e un
  // lancio del cron svuotano gli eventi di prova; poi l'indirizzo è svuotato.
  test.afterAll(async ({ browser, playwright }) => {
    if (!feed) return;
    if (!RICHIEDE_CRON && hasCredenziali('admin')) {
      const contesto = await browser.newContext({ storageState: statoAutenticazione('admin') });
      const pagina = await contesto.newPage();
      const api = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
      try {
        feed.imposta({ stato: 200, corpo: FEED_VUOTO });
        await impostaIndirizzo(pagina, indirizzoFeedFinto());
        await lanciaCronNotturno(api);
        await impostaIndirizzo(pagina, '');
      } finally {
        await api.dispose();
        await contesto.close();
      }
    }
    await feed.chiudi();
  });

  test.describe('admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
      feed.imposta({ stato: 200, corpo: feedIniziale() });
    });

    test('la sezione "Calendario Google" compare con la sincronizzazione disattivata', async ({ page }) => {
      await impostaIndirizzo(page, '');
      await page.reload();

      const sezione = sezioneCalendario(page);
      await expect(sezione.getByRole('heading', { name: 'Calendario Google', level: 2 })).toBeVisible();
      await expect(sezione.getByTestId('descrizione-calendario')).not.toBeEmpty();
      await expect(statoCalendario(page)).toHaveText(STATO_DISATTIVATA);
      await expect(campoIndirizzo(page)).toHaveValue('');
      await expect(sezione.getByRole('button', { name: 'Salva indirizzo', exact: true })).toBeVisible();
      await expect(pulsanteMostraIndirizzo(page)).toHaveCount(0);
      await nessunaViolazioneA11yGrave(page);
    });

    test('salvare un indirizzo valido attiva la sincronizzazione e lo nasconde', async ({ page }) => {
      await impostaIndirizzo(page, '');
      await salvaIndirizzo(page, indirizzoFeedFinto());

      await expect(statoCalendario(page)).toHaveText(STATO_ATTIVA);
      await expect(sezioneCalendario(page).getByTestId('ultimo-salvataggio-calendario')).toContainText('Ultimo salvataggio:');
      await expect(indirizzoCalendario(page)).toContainText(SEGNAPOSTO_VALORE);
      await expect(campoIndirizzo(page)).toHaveValue('');
      const testo = (await page.locator('main').innerHTML()) ?? '';
      expect(testo.includes(indirizzoFeedFinto()), "l'indirizzo non deve essere in pagina").toBe(false);
      await nessunaViolazioneA11yGrave(page);

      await page.reload();
      await expect(statoCalendario(page)).toHaveText(STATO_ATTIVA);
      expect((await page.content()).includes(indirizzoFeedFinto()), "l'indirizzo non deve essere nella pagina").toBe(false);
    });

    test('un indirizzo non valido è rifiutato senza mostrarlo', async ({ page }) => {
      await impostaIndirizzo(page, '');
      const nonValidi = [
        'http://calendar.google.com/calendar/ical/prova/private-prova/basic.ics',
        'https://example.com/calendar/ical/prova/private-prova/basic.ics',
        'https://calendar.google.com/calendar/ical/prova/private-prova/basic.txt',
      ];
      for (const valore of nonValidi) {
        await salvaIndirizzo(page, valore);
        const errore = sezioneCalendario(page).getByRole('alert');
        await expect(errore).toContainText('non è un indirizzo iCal di Google Calendar valido');
        expect((await errore.textContent())?.includes(valore), "il messaggio non deve riportare l'indirizzo").toBe(false);
        await expect(statoCalendario(page)).toHaveText(STATO_DISATTIVATA);
      }
    });

    test.describe('con un indirizzo salvato', () => {
      test.beforeEach(async ({ page }) => {
        await impostaIndirizzo(page, indirizzoFeedFinto());
      });

      test('con la password sbagliata l\'indirizzo resta nascosto', async ({ page }) => {
        await verificaPassword(page, `password-sbagliata-${Date.now()}`);

        await expect(sezioneCalendario(page).getByRole('alert')).toHaveText('Password non corretta.');
        await expect(pulsanteMostraIndirizzo(page)).toBeVisible();
        await expect(indirizzoCalendario(page)).toContainText(SEGNAPOSTO_VALORE);
        expect((await page.content()).includes(indirizzoFeedFinto()), "l'indirizzo non deve essere in pagina").toBe(false);
      });

      test("con la propria password l'indirizzo compare in chiaro, ricaricando torna nascosto", async ({ page }) => {
        await verificaPassword(page, passwordAdmin());

        await expect(pulsanteNascondiIndirizzo(page)).toBeVisible();
        await expect.poll(async () => (await indirizzoCalendario(page).textContent())?.includes(indirizzoFeedFinto())).toBe(true);
        await nessunaViolazioneA11yGrave(page);

        // La verifica non tocca la sessione con cui l'admin sta navigando.
        const dopo = await page.request.get(PERCORSO_PARAMETRI);
        expect(dopo.ok()).toBe(true);
        expect(new URL(dopo.url()).pathname).toBe(PERCORSO_PARAMETRI);

        await pulsanteNascondiIndirizzo(page).click();
        await expect(pulsanteMostraIndirizzo(page)).toBeVisible();
        await expect(indirizzoCalendario(page)).toContainText(SEGNAPOSTO_VALORE);

        await verificaPassword(page, passwordAdmin());
        await expect(pulsanteNascondiIndirizzo(page)).toBeVisible();
        await page.reload();
        await expect(pulsanteMostraIndirizzo(page)).toBeVisible();
        await expect(indirizzoCalendario(page)).toContainText(SEGNAPOSTO_VALORE);
        await expect(sezioneCalendario(page).getByLabel('La tua password', { exact: true })).toHaveCount(0);
      });

      test('svuotare il campo disattiva la sincronizzazione', async ({ page }) => {
        await salvaIndirizzo(page, '');

        await expect(statoCalendario(page)).toHaveText(STATO_DISATTIVATA);
        await expect(indirizzoCalendario(page)).toHaveCount(0);
        await expect(pulsanteMostraIndirizzo(page)).toHaveCount(0);
        await nessunaViolazioneA11yGrave(page);
      });
    });

    test.describe('cron notturno', () => {
      test.beforeEach(async () => {
        test.skip(RICHIEDE_CRON, MOTIVO_CRON);
      });

      test('senza indirizzo non sincronizza e non disturba il report notturno', async ({ page, request }) => {
        await impostaIndirizzo(page, '');
        const { json } = await lanciaCronNotturno(request);

        expect(json.calendario.stato).toBe('disattivata');
        expect(json.ok).toBe(true);
        expect(json.risultati).toBeDefined();
      });

      test('legge il feed e salva gli eventi nella finestra di tempo', async ({ page, request }) => {
        await impostaIndirizzo(page, indirizzoFeedFinto());
        const { testo, json } = await lanciaCronNotturno(request);

        // 1 con orario + 1 di tutto il giorno + 6 occorrenze + 1 da annullare.
        expect(json.calendario).toMatchObject({ stato: 'ok', totale: 9 });
        expect(json.ok).toBe(true);
        expect(json.risultati).toBeDefined();
        expect(testo.includes(indirizzoFeedFinto()), "l'indirizzo non deve essere nella risposta").toBe(false);
        expect(testo.includes('Evento di prova'), 'i titoli non devono essere nella risposta').toBe(false);
      });

      test('rilanciare il cron dà lo stesso risultato', async ({ page, request }) => {
        await impostaIndirizzo(page, indirizzoFeedFinto());
        await lanciaCronNotturno(request);
        const { json } = await lanciaCronNotturno(request);

        expect(json.calendario).toEqual({ stato: 'ok', inseriti: 0, aggiornati: 0, rimossi: 0, totale: 9 });
      });

      test('un evento cancellato, annullato o spostato in Google si riflette alla sincronizzazione successiva', async ({
        page,
        request,
      }) => {
        await impostaIndirizzo(page, indirizzoFeedFinto());
        await lanciaCronNotturno(request);

        feed.imposta({ stato: 200, corpo: feedAggiornato() });
        const { json } = await lanciaCronNotturno(request);
        // L'annullato sparisce (9 -> 8) e lo spostato non si duplica.
        expect(json.calendario).toMatchObject({ stato: 'ok', totale: 8 });

        const ancora = await lanciaCronNotturno(request);
        expect(ancora.json.calendario).toEqual({ stato: 'ok', inseriti: 0, aggiornati: 0, rimossi: 0, totale: 8 });
      });

      test('una regola di ripetizione ostile nel feed non blocca il report notturno', async ({ page, request }) => {
        await impostaIndirizzo(page, indirizzoFeedFinto());
        feed.imposta({ stato: 200, corpo: feedAggiornato() });
        await lanciaCronNotturno(request);

        feed.imposta({ stato: 200, corpo: feedConRegolaOstile() });
        const inizio = Date.now();
        const { json } = await lanciaCronNotturno(request);

        // La serie ostile è saltata, gli eventi normali restano e il report esce.
        expect(Date.now() - inizio).toBeLessThan(30_000);
        expect(json.calendario).toEqual({ stato: 'ok', inseriti: 0, aggiornati: 0, rimossi: 0, totale: 8 });
        expect(json.ok).toBe(true);
        expect(json.risultati).toBeDefined();
      });

      test('se Google non risponde o il feed non è valido, gli eventi restano e l\'errore è leggibile', async ({
        page,
        request,
      }) => {
        await impostaIndirizzo(page, indirizzoFeedFinto());
        feed.imposta({ stato: 200, corpo: feedAggiornato() });
        await lanciaCronNotturno(request);

        const guasti = [
          { risposta: { stato: 500, corpo: 'errore' }, motivo: 'risposta non valida' },
          { risposta: { stato: 200, corpo: 'questo non è un calendario' }, motivo: 'feed non valido' },
        ];
        for (const { risposta, motivo } of guasti) {
          feed.imposta(risposta);
          const { testo, json } = await lanciaCronNotturno(request);

          expect(json.calendario.stato).toBe('errore');
          expect(json.ok).toBe(true);
          expect(testo.includes(indirizzoFeedFinto()), "l'indirizzo non deve essere nella risposta").toBe(false);

          await page.goto(PERCORSO_CRON_JOB);
          const lancio = lanciCron(bloccoCron(page, 'Report notturno')).filter({
            hasText: `Calendario non sincronizzato: ${motivo}.`,
          });
          await expect(lancio.first()).toBeVisible();
          await expect(lancio.first().getByTestId('stato-lancio')).toHaveText('KO');
          expect((await page.content()).includes(indirizzoFeedFinto()), "l'indirizzo non deve essere nella pagina").toBe(false);
        }

        // Gli ultimi eventi salvati sono rimasti: con il feed di nuovo buono non c'è nulla da cambiare.
        feed.imposta({ stato: 200, corpo: feedAggiornato() });
        const { json } = await lanciaCronNotturno(request);
        expect(json.calendario).toEqual({ stato: 'ok', inseriti: 0, aggiornati: 0, rimossi: 0, totale: 8 });
      });
    });
  });

  test('maestra, assistente e genitore non vedono la sezione e vengono reindirizzati', async ({ browser }) => {
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);

      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      await page.goto(PERCORSO_PARAMETRI);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await expect(page.getByRole('heading', { name: 'Calendario Google' })).toHaveCount(0);
      await context.close();
    }
  });
});
