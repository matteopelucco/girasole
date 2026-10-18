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
// La parte "pagina Calendario" (issue #320) verifica `/dashboard/calendario`:
// gli eventi arrivano dal feed finto via cron, le chiusure si creano con date
// lontane e nota unica (come e2e/53). L'etichetta "In corso" di una chiusura
// non si prova qui (servirebbe una chiusura che copre oggi e bloccherebbe i
// test in parallelo): la copre il test unitario di chiusuraInCorso.
//
// Nessun indirizzo reale compare nei test; l'indirizzo finto (locale) non è
// stampato nei messaggi di fallimento: i confronti usano booleani.
import {
  test,
  expect,
  type APIRequest,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  dataFraGiorni,
  dataOggiRoma,
  dataProssimoGiornoFeriale,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  statoAutenticazione,
  type Ruolo,
} from './helpers';
import { percorsoGiornata } from '../lib/giornata';
import { NOME_PAGINA_GIORNATA } from './pagina-giornata';
import { SEGNAPOSTO_VALORE } from '../lib/parametriAmbiente';
import {
  PERCORSO_CRON_JOB,
  PERCORSO_SCHEDA_AZIONI,
  azioneSincronizza,
  bloccoCron,
  eRichiestaAzione,
  esitoSincronizzazione,
  lanciCron,
  pulsanteSincronizza,
  sincronizzaAMano,
  tagEstemporaneo,
} from './pagina-cron-job';
import {
  DESCRIZIONE_CON_LINK,
  DESCRIZIONE_PRIMA_RIGA,
  DESCRIZIONE_SECONDA_RIGA,
  FEED_VUOTO,
  GIORNI_CON_ORARIO,
  GIORNI_PIU_GIORNI,
  LUOGO_CON_ORARIO,
  GIORNI_DASH,
  TITOLO_CHIUSO,
  TITOLO_CON_ORARIO,
  TITOLO_DASH_HTML,
  TITOLO_DASH_IN_CORSO,
  TITOLO_DASH_PASSATO,
  TITOLO_DASH_QUARTO,
  TITOLO_DASH_QUINTO,
  TITOLO_DASH_SECONDO,
  TITOLO_DASH_TERZO,
  TITOLO_DASH_UNICO,
  TITOLO_HTML,
  TITOLO_IN_CORSO,
  TITOLO_PASSATO,
  TITOLO_PIU_GIORNI,
  TITOLO_TUTTO_IL_GIORNO,
  avviaFeedFinto,
  feedAggiornato,
  feedConRegolaOstile,
  feedIniziale,
  feedPerDashboardCompleto,
  feedPerDashboardPochi,
  feedPerPagina,
  indirizzoFeedFinto,
  origineFeedFinto,
  type FeedFinto,
} from './feed-ical-finto';
import {
  CLASSE_EVENTO_PASSATO,
  PERCORSO_CALENDARIO,
  PERCORSO_CHIUSURE_ADMIN,
  PERCORSO_CHIUSURE_SCHEDA,
  TESTO_NESSUN_PROSSIMO_EVENTO,
  apriCalendario,
  apriChiusure,
  apriDashboardConEventi,
  bloccoGiorno,
  creaChiusura,
  eliminaChiusura,
  eventiPassati,
  eventiProssimi,
  giornoBreveItaliano,
  linkVediTutto,
  prossimiEventiDashboard,
  riquadroProssimiEventi,
  schedaCalendario,
  schedaEvento,
  schedeCalendario,
  sezioneChiusure,
  sezioneEventi,
  gruppoMenuCalendario,
  voceMenuCalendario,
  voceMenuGiorniChiusura,
} from './pagina-calendario-eventi';
import {
  PERCORSO_PARAMETRI,
  STATO_ATTIVA,
  STATO_DISATTIVATA,
  campoIndirizzo,
  impostaIndirizzo,
  indirizzoCalendario,
  lanciaCronNotturno,
  lanciaCronPerSincronizzare,
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

// Vero dopo che i test della pagina hanno messo eventi di prova nel database:
// serve a ripulirli alla fine anche dove il cron completo non è eseguibile.
let eventiDiProvaSalvati = false;

// Imposta il feed finto, salva il suo indirizzo (come admin) e lancia il cron:
// gli eventi nel database diventano quelli del feed. Alla fine l'indirizzo è
// quello richiesto ('' = sincronizzazione disattivata).
async function sincronizzaFeed(
  browser: Browser,
  apiRequest: APIRequest,
  feed: FeedFinto,
  corpo: string,
  indirizzoFinale: string
): Promise<void> {
  eventiDiProvaSalvati = true;
  const contesto = await browser.newContext({ storageState: statoAutenticazione('admin') });
  const pagina = await contesto.newPage();
  const api = await apiRequest.newContext({ baseURL: 'http://localhost:3000' });
  try {
    feed.imposta({ stato: 200, corpo });
    await impostaIndirizzo(pagina, indirizzoFeedFinto());
    await lanciaCronPerSincronizzare(api);
    if (indirizzoFinale !== indirizzoFeedFinto()) await impostaIndirizzo(pagina, indirizzoFinale);
  } finally {
    await api.dispose();
    await contesto.close();
  }
}

// Una pagina già autenticata come il ruolo richiesto (si salta il test se
// mancano le credenziali o la sessione).
async function paginaCome(browser: Browser, ruolo: Ruolo): Promise<{ page: Page; chiudi: () => Promise<void> }> {
  test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
  const stato = statoAutenticazione(ruolo);
  test.skip(!stato, `sessione non disponibile per ${ruolo}`);
  const context = await browser.newContext({ storageState: stato });
  return { page: await context.newPage(), chiudi: () => context.close() };
}

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
    if ((!RICHIEDE_CRON || eventiDiProvaSalvati) && hasCredenziali('admin')) {
      await sincronizzaFeed(browser, playwright.request, feed, FEED_VUOTO, '');
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

  // ---------------------------------------------------------------------
  // Sincronizzazione a mano dalla scheda "Azioni" (issue #326). Non richiede
  // CRON_SECRET né RESEND_API_KEY: è una Server Action dell'admin, non la route
  // del cron. Il feed è quello finto; l'indirizzo finto non è mai stampato.
  // ---------------------------------------------------------------------
  test.describe('sincronizzazione a mano', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
      feed.imposta({ stato: 200, corpo: feedIniziale() });
      eventiDiProvaSalvati = true;
    });

    const FRASE_NUMERI = /Eventi aggiunti: \d+, aggiornati: \d+, tolti: \d+\./;

    test('sincronizzazione a mano riuscita: "Esecuzione in corso", poi "OK"', async ({ page }) => {
      await impostaIndirizzo(page, indirizzoFeedFinto());

      // Lanci "estemporanei" del report notturno prima: la sincronizzazione a mano non ne aggiunge.
      await page.goto(PERCORSO_CRON_JOB);
      const estemporaneiPrima = await tagEstemporaneo(bloccoCron(page, 'Report notturno')).count();

      await page.goto(PERCORSO_SCHEDA_AZIONI);
      await expect(esitoSincronizzazione(page)).toHaveCount(0);
      await sincronizzaAMano(page);

      const esito = esitoSincronizzazione(page);
      await expect(esito).toContainText('OK');
      await expect(esito).toContainText(FRASE_NUMERI);
      await expect(esito).not.toContainText('ERRORE');
      const testo = await azioneSincronizza(page).innerText();
      expect(testo.includes(indirizzoFeedFinto()), "l'indirizzo non deve essere nell'esito").toBe(false);
      await nessunaViolazioneA11yGrave(page);

      // Gli eventi del feed sono nel database: si vedono nella pagina "Calendario".
      await apriCalendario(page);
      await expect(schedaEvento(eventiProssimi(page), 'Evento di prova con orario')).toBeVisible();

      // Nessun lancio a mano nel registro "Cron Job".
      await page.goto(PERCORSO_CRON_JOB);
      await expect(tagEstemporaneo(bloccoCron(page, 'Report notturno'))).toHaveCount(estemporaneiPrima);
    });

    test('sincronizzazione a mano non riuscita: "ERRORE" con il motivo, e si può rilanciare', async ({ page }) => {
      await impostaIndirizzo(page, indirizzoFeedFinto());
      await page.goto(PERCORSO_SCHEDA_AZIONI);
      // Prima una sincronizzazione buona: gli eventi di prova sono nel database.
      await sincronizzaAMano(page);
      await expect(esitoSincronizzazione(page)).toContainText('OK');

      const guasti = [
        { risposta: { stato: 500, corpo: 'errore' }, motivo: 'risposta non valida' },
        { risposta: { stato: 200, corpo: 'questo non è un calendario' }, motivo: 'feed non valido' },
      ];
      for (const { risposta, motivo } of guasti) {
        feed.imposta(risposta);
        await sincronizzaAMano(page);

        const esito = esitoSincronizzazione(page);
        await expect(esito).toContainText('ERRORE');
        await expect(esito).toContainText(`Calendario non sincronizzato: ${motivo}.`);
        await expect(esito).toHaveAttribute('role', 'alert');
        await expect(esito).not.toContainText('OK');
        expect((await page.content()).includes(indirizzoFeedFinto()), "l'indirizzo non deve essere nella pagina").toBe(false);
        await nessunaViolazioneA11yGrave(page);
      }

      // Rilancio con il servizio tornato a funzionare: di nuovo "in corso", poi "OK".
      // Gli eventi di prima erano rimasti: non c'è nulla da aggiungere né da togliere.
      feed.imposta({ stato: 200, corpo: feedIniziale() });
      await sincronizzaAMano(page);
      const esito = esitoSincronizzazione(page);
      await expect(esito).toContainText('OK');
      await expect(esito).toContainText('Eventi aggiunti: 0, aggiornati: 0, tolti: 0.');
    });

    test('senza indirizzo impostato la sincronizzazione a mano finisce "OK" come disattivata', async ({ page }) => {
      await impostaIndirizzo(page, '');
      await page.goto(PERCORSO_SCHEDA_AZIONI);
      await sincronizzaAMano(page);

      const esito = esitoSincronizzazione(page);
      await expect(esito).toContainText('OK');
      await expect(esito).toContainText('Sincronizzazione disattivata: nessun indirizzo impostato.');
      await expect(esito).not.toContainText('ERRORE');
      await nessunaViolazioneA11yGrave(page);
    });
  });

  // ---------------------------------------------------------------------
  // Pagina "Calendario" (`/dashboard/calendario`, issue #320)
  // ---------------------------------------------------------------------
  test.describe('pagina Calendario', () => {
    test.describe('menu e accesso', () => {
      test('l\'admin vede il gruppo "Calendario" con "Giorni di chiusura" e "Calendario attività"', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'admin');
        try {
          await page.goto('/dashboard');
          const gruppo = gruppoMenuCalendario(page);
          await expect(gruppo).toBeVisible();
          await expect(gruppo.getByRole('link')).toHaveText([/Giorni di chiusura/, /Calendario attività/]);
          await expect(voceMenuGiorniChiusura(page)).toHaveAttribute('href', PERCORSO_CHIUSURE_ADMIN);
          await expect(voceMenuCalendario(page)).toHaveAttribute('href', PERCORSO_CALENDARIO);

          // Il gruppo sta subito dopo "Dashboard".
          const dashboard = page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true });
          const y = async (l: typeof dashboard) => (await l.boundingBox())!.y;
          expect(await y(dashboard)).toBeLessThan(await y(gruppo));

          await voceMenuCalendario(page).click();
          await page.waitForURL(PERCORSO_CALENDARIO);
          await expect(voceMenuCalendario(page)).toHaveAttribute('aria-current', 'page');
          await expect(dashboard).not.toHaveAttribute('aria-current', 'page');

          await voceMenuGiorniChiusura(page).click();
          await page.waitForURL(PERCORSO_CHIUSURE_ADMIN);
          await expect(voceMenuGiorniChiusura(page)).toHaveAttribute('aria-current', 'page');
          await expect(page.getByRole('heading', { name: 'Giorni di chiusura', level: 1 })).toBeVisible();
          await nessunaViolazioneA11yGrave(page);
        } finally {
          await chiudi();
        }
      });

      test('maestra e assistente vedono nel gruppo "Calendario" solo "Calendario attività"', async ({ browser }) => {
        for (const ruolo of ['maestra', 'assistente'] as const) {
          const { page, chiudi } = await paginaCome(browser, ruolo);
          try {
            await page.goto('/dashboard');
            await expect(gruppoMenuCalendario(page).getByRole('link')).toHaveText([/Calendario attività/]);
            await expect(voceMenuGiorniChiusura(page)).toHaveCount(0);

            await voceMenuCalendario(page).click();
            await page.waitForURL(PERCORSO_CALENDARIO);
            await expect(voceMenuCalendario(page)).toHaveAttribute('aria-current', 'page');
            await expect(
              page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true })
            ).not.toHaveAttribute('aria-current', 'page');
          } finally {
            await chiudi();
          }
        }
      });

      test('il genitore non vede il gruppo "Calendario"', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'genitore');
        try {
          await page.goto('/dashboard');
          await expect(page.getByRole('navigation')).toBeVisible();
          await expect(gruppoMenuCalendario(page)).toHaveCount(0);
          await expect(voceMenuCalendario(page)).toHaveCount(0);
          await expect(voceMenuGiorniChiusura(page)).toHaveCount(0);
        } finally {
          await chiudi();
        }
      });

      test('la pagina si chiama "Calendario attività" e ha due schede, con gli eventi in primo piano', async ({
        browser,
      }) => {
        for (const ruolo of ['admin', 'maestra', 'assistente'] as const) {
          const { page, chiudi } = await paginaCome(browser, ruolo);
          try {
            await page.goto(PERCORSO_CALENDARIO);
            await expect(page.getByRole('heading', { name: 'Calendario attività', level: 1 })).toBeVisible();
            await expect(schedeCalendario(page).getByRole('tab')).toHaveText(['Calendario attività', 'Giorni di chiusura']);
            await expect(schedaCalendario(page, 'Calendario attività')).toHaveAttribute('aria-selected', 'true');
            await expect(schedaCalendario(page, 'Giorni di chiusura')).toHaveAttribute('aria-selected', 'false');
            await expect(sezioneEventi(page)).toBeVisible();
            await expect(sezioneChiusure(page)).toHaveCount(0);
          } finally {
            await chiudi();
          }
        }
      });

      test('la scheda "Giorni di chiusura" resta nell\'indirizzo', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriCalendario(page);
          await schedaCalendario(page, 'Giorni di chiusura').click();
          await page.waitForURL(/scheda=chiusure/);
          await expect(schedaCalendario(page, 'Giorni di chiusura')).toHaveAttribute('aria-selected', 'true');
          await expect(sezioneChiusure(page)).toBeVisible();
          await expect(sezioneEventi(page)).toHaveCount(0);

          // Vale anche dopo "ricarica" e con il link diretto.
          await page.reload();
          await expect(schedaCalendario(page, 'Giorni di chiusura')).toHaveAttribute('aria-selected', 'true');
          await expect(sezioneChiusure(page)).toBeVisible();
          await apriChiusure(page);
          await expect(schedaCalendario(page, 'Giorni di chiusura')).toHaveAttribute('aria-selected', 'true');
          expect(page.url().endsWith(PERCORSO_CHIUSURE_SCHEDA)).toBe(true);

          // Si torna agli eventi, all'indirizzo senza parametri.
          await schedaCalendario(page, 'Calendario attività').click();
          await expect(schedaCalendario(page, 'Calendario attività')).toHaveAttribute('aria-selected', 'true');
          await expect(sezioneEventi(page)).toBeVisible();
          expect(new URL(page.url()).search).toBe('');
        } finally {
          await chiudi();
        }
      });

      test('un valore sconosciuto della scheda apre "Calendario attività"', async ({ browser }) => {
        for (const ruolo of ['admin', 'maestra', 'assistente'] as const) {
          const { page, chiudi } = await paginaCome(browser, ruolo);
          try {
            await page.goto(`${PERCORSO_CALENDARIO}?scheda=boh`);
            await expect(schedaCalendario(page, 'Calendario attività')).toHaveAttribute('aria-selected', 'true');
            await expect(sezioneEventi(page)).toBeVisible();
            await expect(sezioneChiusure(page)).toHaveCount(0);
          } finally {
            await chiudi();
          }
        }
      });

      test("le schede si usano con la tastiera, il focus si vede e a 375 px non c'è scorrimento orizzontale", async ({
        browser,
      }) => {
        const { page, chiudi } = await paginaCome(browser, 'admin');
        try {
          await page.setViewportSize({ width: 375, height: 800 });
          await apriCalendario(page);
          const attivita = schedaCalendario(page, 'Calendario attività');
          const chiusure = schedaCalendario(page, 'Giorni di chiusura');
          await attivita.focus();
          await expect(attivita).toBeFocused();
          // Focus visibile: l'indicatore del focus non è "nessuno".
          const contorno = await attivita.evaluate((e) => getComputedStyle(e).outlineStyle);
          expect(contorno).not.toBe('none');

          await page.keyboard.press('ArrowRight');
          await page.waitForURL(/scheda=chiusure/);
          await expect(chiusure).toHaveAttribute('aria-selected', 'true');
          await expect(chiusure).toBeFocused();
          await expect(sezioneChiusure(page)).toBeVisible();

          await page.keyboard.press('Home');
          await expect(attivita).toHaveAttribute('aria-selected', 'true');
          await expect(attivita).toBeFocused();

          await page.keyboard.press('End');
          await expect(chiusure).toHaveAttribute('aria-selected', 'true');
          await expect(chiusure).toBeFocused();

          await page.keyboard.press('ArrowLeft');
          await expect(attivita).toHaveAttribute('aria-selected', 'true');
          await expect(attivita).toBeFocused();

          for (const t of [attivita, chiusure]) {
            const box = await t.boundingBox();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(375);
            expect(box!.height).toBeGreaterThanOrEqual(44);
          }
          const eccesso = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(eccesso).toBeLessThanOrEqual(0);
          await nessunaViolazioneA11yGrave(page);
        } finally {
          await chiudi();
        }
      });

      test('il genitore non accede alla pagina', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'genitore');
        try {
          await page.goto(PERCORSO_CALENDARIO);
          await page.waitForURL('/dashboard', { timeout: 20_000 });
          await expect(sezioneChiusure(page)).toHaveCount(0);
          await expect(sezioneEventi(page)).toHaveCount(0);
        } finally {
          await chiudi();
        }
      });
    });

    test.describe('giorni di chiusura', () => {
      test('senza giorni di chiusura in programma lo stato vuoto è gentile', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriChiusure(page);
          // Le chiusure sono dati condivisi (e2e/53 ne crea per pochi istanti): se ce n'è una, lo stato vuoto non si vede.
          const presenti = await sezioneChiusure(page).getByTestId('chiusura').count();
          test.skip(presenti > 0, 'ci sono giorni di chiusura in programma');
          await expect(sezioneChiusure(page)).toContainText('Nessun giorno di chiusura in programma.');
        } finally {
          await chiudi();
        }
      });

      test('i giorni di chiusura in corso e futuri stanno nella scheda "Giorni di chiusura", in sola lettura', async ({
        browser,
      }) => {
        const admin = await paginaCome(browser, 'admin');
        const maestra = await paginaCome(browser, 'maestra');
        const futura = `Chiusura E2E calendario ${Date.now()}`;
        const conclusa = `Chiusura E2E conclusa ${Date.now()}`;
        try {
          await creaChiusura(admin.page, dataFraGiorni(330), dataFraGiorni(332), futura);
          await creaChiusura(admin.page, dataFraGiorni(-400), dataFraGiorni(-399), conclusa);

          await apriChiusure(maestra.page);
          const sezione = sezioneChiusure(maestra.page);
          await expect(sezione.getByTestId('chiusura').filter({ hasText: futura })).toHaveCount(1);
          await expect(sezione.getByText(conclusa)).toHaveCount(0);
          await expect(sezione).toContainText('Sabato e domenica sono chiusi sempre');
          // Sola lettura: nessun pulsante, campo o link verso la modifica.
          await expect(sezione.getByRole('button')).toHaveCount(0);
          await expect(sezione.getByRole('textbox')).toHaveCount(0);
          await expect(sezione.getByRole('link')).toHaveCount(0);
          await expect(sezione.getByText('Modifica')).toHaveCount(0);
          // Gli eventi stanno nell'altra scheda.
          await expect(sezioneEventi(maestra.page)).toHaveCount(0);
        } finally {
          await maestra.chiudi();
          await eliminaChiusura(admin.page, futura);
          await eliminaChiusura(admin.page, conclusa);
          await admin.chiudi();
        }
      });

      test("l'admin trova il rimando per gestire i giorni di chiusura", async ({ browser }) => {
        const admin = await paginaCome(browser, 'admin');
        const maestra = await paginaCome(browser, 'maestra');
        const assistente = await paginaCome(browser, 'assistente');
        try {
          await apriChiusure(admin.page);
          const link = sezioneChiusure(admin.page).getByRole('link', { name: 'Gestisci i giorni di chiusura' });
          await expect(link).toHaveAttribute('href', PERCORSO_CHIUSURE_ADMIN);

          for (const { page } of [maestra, assistente]) {
            await apriChiusure(page);
            await expect(page.getByRole('link', { name: 'Gestisci i giorni di chiusura' })).toHaveCount(0);
          }
        } finally {
          await admin.chiudi();
          await maestra.chiudi();
          await assistente.chiudi();
        }
      });
    });

    test.describe('lista dei giorni di chiusura condivisa', () => {
      // Come si presenta una voce della lista: periodo, nota e classi della scheda
      // (senza il solo effetto "al passaggio del mouse" del modo gestione).
      async function descriviVoce(voce: Locator) {
        const scheda = voce.locator('.border-l-rose-400');
        return {
          periodo: (await scheda.locator('p').nth(0).textContent())?.trim(),
          nota: (await scheda.locator('p').nth(1).textContent())?.trim(),
          classi: ((await scheda.getAttribute('class')) ?? '').replace('hover:bg-stone-50', '').split(/\s+/).filter(Boolean).sort(),
        };
      }

      test('la pagina "Giorni di chiusura" dell\'admin usa la stessa lista, con "Modifica"', async ({ browser }) => {
        const admin = await paginaCome(browser, 'admin');
        const futura = `Chiusura E2E lista ${Date.now()}`;
        const conclusa = `Chiusura E2E lista conclusa ${Date.now()}`;
        try {
          await creaChiusura(admin.page, dataFraGiorni(360), dataFraGiorni(362), futura);
          await creaChiusura(admin.page, dataFraGiorni(-410), dataFraGiorni(-409), conclusa);

          // Pagina admin (modo gestione): ogni giorno ha "Modifica" ed è un link alla sua pagina.
          await admin.page.goto(PERCORSO_CHIUSURE_ADMIN);
          const inGestione = admin.page.getByTestId('chiusura').filter({ hasText: futura });
          await expect(inGestione).toHaveCount(1);
          await expect(inGestione.getByText('Modifica', { exact: true })).toBeVisible();
          await expect(inGestione.getByRole('link')).toHaveAttribute('href', /^\/admin\/calendario\/.+/);
          // Tutte le chiusure, anche quelle già concluse.
          await expect(admin.page.getByTestId('chiusura').filter({ hasText: conclusa })).toHaveCount(1);
          const gestione = await descriviVoce(inGestione);

          // Scheda di sola lettura: stessa scheda (bordo colorato, date, nota), senza "Modifica".
          await apriChiusure(admin.page);
          const inLettura = sezioneChiusure(admin.page).getByTestId('chiusura').filter({ hasText: futura });
          await expect(inLettura).toHaveCount(1);
          await expect(inLettura.getByText('Modifica')).toHaveCount(0);
          await expect(inLettura.getByRole('link')).toHaveCount(0);
          expect(await descriviVoce(inLettura)).toEqual(gestione);
          expect(gestione.nota).toBe(futura);
        } finally {
          await eliminaChiusura(admin.page, futura);
          await eliminaChiusura(admin.page, conclusa);
          await admin.chiudi();
        }
      });
    });

    test.describe('senza eventi', () => {
      test.beforeAll(async ({ browser, playwright }) => {
        test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
        // Eventi svuotati (feed vuoto + cron); l'indirizzo resta salvato.
        await sincronizzaFeed(browser, playwright.request, feed, FEED_VUOTO, indirizzoFeedFinto());
      });

      test("l'admin senza indirizzo vede come collegare il calendario", async ({ browser }) => {
        const admin = await paginaCome(browser, 'admin');
        try {
          await impostaIndirizzo(admin.page, '');
          await apriCalendario(admin.page);
          const sezione = sezioneEventi(admin.page);
          await expect(sezione).toContainText('non è ancora collegato');
          await expect(sezione.getByRole('link', { name: 'Parametri di funzionamento' })).toHaveAttribute(
            'href',
            PERCORSO_PARAMETRI
          );
        } finally {
          await admin.chiudi();
        }
      });

      test("l'admin con indirizzo ma senza eventi legge che non ce ne sono", async ({ browser }) => {
        const admin = await paginaCome(browser, 'admin');
        try {
          await impostaIndirizzo(admin.page, indirizzoFeedFinto());
          await apriCalendario(admin.page);
          const sezione = sezioneEventi(admin.page);
          await expect(sezione).toContainText('Non ci sono eventi a calendario');
          await expect(sezione).toContainText('ogni notte');
          await expect(sezione.getByRole('link')).toHaveCount(0);
        } finally {
          await admin.chiudi();
        }
      });

      test('maestra e assistente senza eventi leggono un messaggio neutro', async ({ browser }) => {
        for (const ruolo of ['maestra', 'assistente'] as const) {
          const { page, chiudi } = await paginaCome(browser, ruolo);
          try {
            await apriCalendario(page);
            const sezione = sezioneEventi(page);
            await expect(sezione.getByTestId('nessun-evento')).toHaveText('Non ci sono eventi a calendario.');
            await expect(sezione.getByRole('link')).toHaveCount(0);
            await expect(sezione).not.toContainText(/indirizzo|collegat|configur|Parametri/i);
          } finally {
            await chiudi();
          }
        }
      });
    });

    test.describe('con eventi', () => {
      test.beforeAll(async ({ browser, playwright }) => {
        test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
        await sincronizzaFeed(browser, playwright.request, feed, feedPerPagina(), indirizzoFeedFinto());
      });

      test('gli eventi sono raggruppati per mese e per giorno, con la data in evidenza', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriCalendario(page);
          await expect(eventiProssimi(page).getByRole('heading', { level: 4 }).first()).toBeVisible();

          const data = dataFraGiorni(GIORNI_CON_ORARIO);
          const giorno = bloccoGiorno(page, data);
          await expect(giorno).toHaveCount(1);
          await expect(giorno.locator('time')).toHaveAttribute('datetime', data);
          await expect(giorno.getByTestId('numero-giorno')).toHaveText(String(Number(data.slice(8))));
          await expect(schedaEvento(giorno, TITOLO_CON_ORARIO)).toHaveCount(1);

          // In ordine di data.
          const date = await eventiProssimi(page)
            .locator('[data-testid^="giorno-"]')
            .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice('giorno-'.length)));
          expect(date).toEqual([...date].sort());
          await nessunaViolazioneA11yGrave(page);
        } finally {
          await chiudi();
        }
      });

      test('un evento con orario mostra ora di inizio e di fine in fuso Europe/Rome', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriCalendario(page);
          const scheda = schedaEvento(eventiProssimi(page), TITOLO_CON_ORARIO);
          await expect(scheda.getByTestId('orario-evento')).toHaveText('10:00 – 11:00');
          await expect(scheda.getByTestId('luogo-evento')).toContainText(LUOGO_CON_ORARIO);
        } finally {
          await chiudi();
        }
      });

      test('luogo e descrizione compaiono solo se presenti', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriCalendario(page);
          const con = schedaEvento(eventiProssimi(page), TITOLO_CON_ORARIO);
          const descrizione = con.getByTestId('descrizione-evento');
          await expect(descrizione).toContainText(DESCRIZIONE_PRIMA_RIGA);
          await expect(descrizione).toContainText(DESCRIZIONE_SECONDA_RIGA);
          // Gli a capo si conservano.
          await expect(descrizione).toHaveCSS('white-space', 'pre-line');

          const senza = schedaEvento(eventiProssimi(page), TITOLO_TUTTO_IL_GIORNO);
          await expect(senza).toHaveCount(1);
          await expect(senza.getByTestId('luogo-evento')).toHaveCount(0);
          await expect(senza.getByTestId('descrizione-evento')).toHaveCount(0);
        } finally {
          await chiudi();
        }
      });

      test('un evento di tutto il giorno si distingue da uno con orario', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriCalendario(page);
          const orario = schedaEvento(eventiProssimi(page), TITOLO_TUTTO_IL_GIORNO).getByTestId('orario-evento');
          await expect(orario).toHaveText('Tutto il giorno');
          await expect(orario).not.toHaveText(/\d{2}:\d{2}/);
        } finally {
          await chiudi();
        }
      });

      test('un evento su più giorni è chiaro', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriCalendario(page);
          // Una volta sola, nel giorno in cui comincia, con l'intervallo.
          await expect(schedaEvento(sezioneEventi(page), TITOLO_PIU_GIORNI)).toHaveCount(1);
          const primo = dataFraGiorni(GIORNI_PIU_GIORNI.primo);
          const ultimo = dataFraGiorni(GIORNI_PIU_GIORNI.ultimo);
          const scheda = schedaEvento(bloccoGiorno(page, primo), TITOLO_PIU_GIORNI);
          await expect(scheda.getByTestId('intervallo-evento')).toHaveText(
            `${giornoBreveItaliano(primo)} – ${giornoBreveItaliano(ultimo)}`
          );

          // Già cominciato: sotto oggi, "In corso".
          const inCorso = schedaEvento(bloccoGiorno(page, dataOggiRoma()), TITOLO_IN_CORSO);
          await expect(inCorso).toHaveCount(1);
          await expect(inCorso.getByTestId('in-corso')).toHaveText('In corso');
        } finally {
          await chiudi();
        }
      });

      test('gli eventi passati sono separati e attenuati', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriCalendario(page);
          const passato = schedaEvento(eventiPassati(page), TITOLO_PASSATO);
          await expect(passato).toHaveCount(1);
          await expect(passato).toHaveClass(CLASSE_EVENTO_PASSATO);
          await expect(schedaEvento(eventiProssimi(page), TITOLO_PASSATO)).toHaveCount(0);

          const futuro = schedaEvento(eventiProssimi(page), TITOLO_CON_ORARIO);
          await expect(futuro).toHaveCount(1);
          await expect(futuro).not.toHaveClass(CLASSE_EVENTO_PASSATO);
          await expect(schedaEvento(eventiPassati(page), TITOLO_CON_ORARIO)).toHaveCount(0);

          // La parte "Passati" sta sotto "Prossimi".
          const yProssimi = (await eventiProssimi(page).boundingBox())?.y ?? Infinity;
          const yPassati = (await eventiPassati(page).boundingBox())?.y ?? -1;
          expect(yPassati).toBeGreaterThan(yProssimi);
        } finally {
          await chiudi();
        }
      });

      test('titolo, descrizione e luogo sono sempre testo semplice', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        const dialoghi: string[] = [];
        page.on('dialog', (dialogo) => {
          dialoghi.push(dialogo.message());
          void dialogo.dismiss();
        });
        try {
          await apriCalendario(page);
          const scheda = schedaEvento(eventiProssimi(page), 'titolo con HTML');
          await expect(scheda.getByTestId('titolo-evento')).toHaveText(TITOLO_HTML);
          await expect(scheda.getByTestId('descrizione-evento')).toHaveText(DESCRIZIONE_CON_LINK);
          // Nessun elemento costruito dal feed: né immagini né link.
          await expect(sezioneEventi(page).locator('img, a, [onerror]')).toHaveCount(0);
          expect(dialoghi, 'il codice del feed non deve essere eseguito').toEqual([]);
        } finally {
          await chiudi();
        }
      });

      test('un evento "chiuso" di Google resta un evento', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'admin');
        try {
          const data = dataProssimoGiornoFeriale();
          await apriCalendario(page);
          await expect(schedaEvento(sezioneEventi(page), TITOLO_CHIUSO)).toHaveCount(1);
          // Nella scheda dei giorni di chiusura non c'è.
          await apriChiusure(page);
          await expect(sezioneChiusure(page).getByText('Prova calendario')).toHaveCount(0);

          // "Presenze e pasti" di quel giorno non è bloccata né segnala una chiusura.
          await page.goto(percorsoGiornata(data));
          await expect(page.getByRole('heading', { name: NOME_PAGINA_GIORNATA })).toBeVisible();
          await expect(page.getByText('Giorno di chiusura scolastica')).toHaveCount(0);
        } finally {
          await chiudi();
        }
      });

      test("la pagina non rivela l'indirizzo iCal", async ({ browser }) => {
        for (const ruolo of ['admin', 'maestra', 'assistente'] as const) {
          const { page, chiudi } = await paginaCome(browser, ruolo);
          try {
            await apriCalendario(page);
            expect((await page.content()).includes(indirizzoFeedFinto()), "l'indirizzo non deve essere nella pagina").toBe(false);
          } finally {
            await chiudi();
          }
        }
      });

      test('la pagina è usabile da telefono e accessibile', async ({ browser }) => {
        for (const ruolo of ['admin', 'maestra'] as const) {
          const { page, chiudi } = await paginaCome(browser, ruolo);
          try {
            await page.setViewportSize({ width: 375, height: 812 });
            await apriCalendario(page);
            await expect(schedaEvento(eventiProssimi(page), TITOLO_CON_ORARIO)).toBeVisible();
            const eccesso = await page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            );
            expect(eccesso, 'nessuno scorrimento orizzontale a 375 px').toBeLessThanOrEqual(0);
            await nessunaViolazioneA11yGrave(page);

            // Lo stesso vale per la scheda dei giorni di chiusura.
            await apriChiusure(page);
            const eccessoChiusure = await page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            );
            expect(eccessoChiusure, 'nessuno scorrimento orizzontale a 375 px (giorni di chiusura)').toBeLessThanOrEqual(0);
            await nessunaViolazioneA11yGrave(page);
          } finally {
            await chiudi();
          }
        }
      });
    });
  });

  // ---------------------------------------------------------------------
  // Riquadro "Prossimi eventi" nella dashboard (issue #321)
  // ---------------------------------------------------------------------
  test.describe('riquadro Prossimi eventi in dashboard', () => {
    // Il riquadro sta in /dashboard, aperta anche dagli altri file e2e: qui si
    // guarda solo dentro il riquadro, mai il resto della pagina.
    test.describe('senza eventi', () => {
      test.beforeAll(async ({ browser, playwright }) => {
        test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
        await sincronizzaFeed(browser, playwright.request, feed, FEED_VUOTO, indirizzoFeedFinto());
      });

      test('senza eventi futuri il riquadro dà un messaggio gentile e neutro', async ({ browser }) => {
        const admin = await paginaCome(browser, 'admin');
        try {
          // Admin senza indirizzo salvato e con indirizzo salvato: stesso messaggio.
          for (const indirizzo of ['', indirizzoFeedFinto()]) {
            await impostaIndirizzo(admin.page, indirizzo);
            await apriDashboardConEventi(admin.page);
            await expect(prossimiEventiDashboard(admin.page)).toHaveCount(0);
            await expect(riquadroProssimiEventi(admin.page).getByTestId('nessun-prossimo-evento')).toHaveText(
              TESTO_NESSUN_PROSSIMO_EVENTO
            );
            await expect(riquadroProssimiEventi(admin.page)).not.toContainText(
              /indirizzo|collegat|configur|Parametri|errore|riprova/i
            );
            await expect(riquadroProssimiEventi(admin.page).getByRole('link')).toHaveCount(1);
            // Il resto della dashboard compare come sempre.
            await expect(admin.page.getByRole('heading', { name: 'Avvisi' })).toBeVisible();
          }
        } finally {
          await admin.chiudi();
        }
        for (const ruolo of ['maestra', 'assistente'] as const) {
          const { page, chiudi } = await paginaCome(browser, ruolo);
          try {
            await apriDashboardConEventi(page);
            await expect(riquadroProssimiEventi(page).getByTestId('nessun-prossimo-evento')).toHaveText(
              TESTO_NESSUN_PROSSIMO_EVENTO
            );
            await expect(riquadroProssimiEventi(page)).not.toContainText(/indirizzo|collegat|configur|Parametri|errore/i);
            await expect(page.getByRole('heading', { name: 'Avvisi' })).toBeVisible();
          } finally {
            await chiudi();
          }
        }
      });

      test('il riquadro rimanda alla pagina Calendario, anche senza eventi', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriDashboardConEventi(page);
          await expect(linkVediTutto(page)).toHaveAttribute('href', PERCORSO_CALENDARIO);
          await linkVediTutto(page).click();
          await page.waitForURL(PERCORSO_CALENDARIO);
          await expect(page.getByRole('heading', { name: 'Calendario attività', level: 1 })).toBeVisible();
        } finally {
          await chiudi();
        }
      });
    });

    test.describe('con pochi eventi', () => {
      test.beforeAll(async ({ browser, playwright }) => {
        test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
        await sincronizzaFeed(browser, playwright.request, feed, feedPerDashboardPochi(), indirizzoFeedFinto());
      });

      test('con meno di 3 eventi il riquadro mostra solo quelli che ci sono', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriDashboardConEventi(page);
          const voci = prossimiEventiDashboard(page);
          await expect(voci).toHaveCount(2);
          await expect(voci.nth(1).getByTestId('titolo-evento')).toHaveText(TITOLO_DASH_UNICO);
          await expect(riquadroProssimiEventi(page).getByTestId('nessun-prossimo-evento')).toHaveCount(0);
          await expect(riquadroProssimiEventi(page)).not.toContainText(/errore|riprova/i);
        } finally {
          await chiudi();
        }
      });

      test('il riquadro mostra sempre testo semplice', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        const dialoghi: string[] = [];
        page.on('dialog', (dialogo) => {
          dialoghi.push(dialogo.message());
          void dialogo.dismiss();
        });
        try {
          await apriDashboardConEventi(page);
          await expect(prossimiEventiDashboard(page).first().getByTestId('titolo-evento')).toHaveText(TITOLO_DASH_HTML);
          // Nessun elemento costruito dal feed: né immagini né link negli eventi.
          await expect(prossimiEventiDashboard(page).locator('img, a, [onerror]')).toHaveCount(0);
          // Né la descrizione né il luogo sono nel riquadro.
          await expect(riquadroProssimiEventi(page)).not.toContainText('javascript:');
          expect(dialoghi, 'il codice del feed non deve essere eseguito').toEqual([]);
        } finally {
          await chiudi();
        }
      });
    });

    test.describe('con molti eventi', () => {
      test.beforeAll(async ({ browser, playwright }) => {
        test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
        await sincronizzaFeed(browser, playwright.request, feed, feedPerDashboardCompleto(), indirizzoFeedFinto());
      });

      test('il riquadro mostra i 3 prossimi eventi, con data, orario e titolo', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriDashboardConEventi(page);
          const voci = prossimiEventiDashboard(page);
          await expect(voci).toHaveCount(3);

          await expect(voci.nth(0).getByTestId('titolo-evento')).toHaveText(TITOLO_DASH_IN_CORSO);
          await expect(voci.nth(1).getByTestId('titolo-evento')).toHaveText(TITOLO_DASH_SECONDO);
          await expect(voci.nth(2).getByTestId('titolo-evento')).toHaveText(TITOLO_DASH_TERZO);

          // Data (giorno, numero e mese) e orario in fuso Europe/Rome.
          await expect(voci.nth(0).locator('time')).toHaveAttribute('datetime', dataOggiRoma());
          await expect(voci.nth(1).locator('time')).toHaveAttribute('datetime', dataFraGiorni(GIORNI_DASH.secondo));
          await expect(voci.nth(1).getByTestId('orario-evento')).toHaveText('10:00 – 11:00');
          await expect(voci.nth(2).locator('time')).toHaveAttribute('datetime', dataFraGiorni(GIORNI_DASH.terzo));
          await expect(voci.nth(2).getByTestId('orario-evento')).toHaveText('Tutto il giorno');
          const data = dataFraGiorni(GIORNI_DASH.secondo);
          await expect(voci.nth(1).locator('time')).toContainText(String(Number(data.slice(8))));
          await expect(voci.nth(1).locator('time')).toContainText(giornoBreveItaliano(data).split(' ')[1]);

          // Il quarto, il quinto e quello concluso non ci sono.
          for (const titolo of [TITOLO_DASH_QUARTO, TITOLO_DASH_QUINTO, TITOLO_DASH_PASSATO]) {
            await expect(riquadroProssimiEventi(page)).not.toContainText(titolo);
          }
        } finally {
          await chiudi();
        }
      });

      test('un evento già cominciato e non ancora finito conta', async ({ browser }) => {
        const { page, chiudi } = await paginaCome(browser, 'maestra');
        try {
          await apriDashboardConEventi(page);
          const primo = prossimiEventiDashboard(page).first();
          await expect(primo.getByTestId('titolo-evento')).toHaveText(TITOLO_DASH_IN_CORSO);
          await expect(primo.getByTestId('in-corso')).toHaveText('In corso');
          await expect(prossimiEventiDashboard(page).nth(1).getByTestId('in-corso')).toHaveCount(0);
        } finally {
          await chiudi();
        }
      });

      test('il riquadro è visibile a ogni ruolo con accesso alla dashboard', async ({ browser }) => {
        for (const ruolo of ['admin', 'maestra', 'assistente'] as const) {
          const { page, chiudi } = await paginaCome(browser, ruolo);
          try {
            await apriDashboardConEventi(page);
            await expect(prossimiEventiDashboard(page)).toHaveCount(3);
            await expect(prossimiEventiDashboard(page).first().getByTestId('titolo-evento')).toHaveText(
              TITOLO_DASH_IN_CORSO
            );
          } finally {
            await chiudi();
          }
        }

        const { page, chiudi } = await paginaCome(browser, 'genitore');
        try {
          await page.goto('/dashboard');
          await expect(page.getByText('Il portale genitori è in arrivo')).toBeVisible();
          await expect(riquadroProssimiEventi(page)).toHaveCount(0);
          await expect(page.getByText(TITOLO_DASH_IN_CORSO)).toHaveCount(0);
        } finally {
          await chiudi();
        }
      });

      test('il riquadro è usabile da telefono e accessibile', async ({ browser }) => {
        for (const ruolo of ['admin', 'maestra'] as const) {
          const { page, chiudi } = await paginaCome(browser, ruolo);
          try {
            await page.setViewportSize({ width: 375, height: 812 });
            await apriDashboardConEventi(page);
            await expect(prossimiEventiDashboard(page)).toHaveCount(3);
            await expect(prossimiEventiDashboard(page).first()).toBeVisible();
            const eccesso = await page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            );
            expect(eccesso, 'nessuno scorrimento orizzontale a 375 px').toBeLessThanOrEqual(0);
            await nessunaViolazioneA11yGrave(page);
          } finally {
            await chiudi();
          }
        }
      });
    });
  });

  test('il pulsante "Sincronizza calendario ora" c\'è solo per l\'admin', async ({ browser }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    const admin = await browser.newContext({ storageState: statoAutenticazione('admin') });
    const paginaAdmin = await admin.newPage();
    await paginaAdmin.goto(PERCORSO_SCHEDA_AZIONI);
    await expect(pulsanteSincronizza(paginaAdmin)).toBeVisible();
    await admin.close();

    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);
      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      await page.goto(PERCORSO_SCHEDA_AZIONI);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await expect(pulsanteSincronizza(page)).toHaveCount(0);
      await context.close();
    }
  });

  test('chi non è admin non può lanciare la sincronizzazione a mano', async ({ browser }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    // Si cattura la richiesta vera che il browser dell'admin manda alla Server
    // Action e la si rifà con la sessione degli altri ruoli (un utente malevolo
    // può farlo: l'identificativo dell'azione non è un segreto).
    const admin = await browser.newContext({ storageState: statoAutenticazione('admin') });
    const paginaAdmin = await admin.newPage();
    await paginaAdmin.goto(PERCORSO_SCHEDA_AZIONI);
    const richiestaAzione = paginaAdmin.waitForRequest(eRichiestaAzione);
    await pulsanteSincronizza(paginaAdmin).click();
    const richiesta = await richiestaAzione;
    const intestazioni = {
      'next-action': richiesta.headers()['next-action'],
      'content-type': richiesta.headers()['content-type'] ?? 'text/plain;charset=UTF-8',
      accept: 'text/x-component',
      origin: new URL(richiesta.url()).origin,
    };
    const corpo = richiesta.postData() ?? '[null]';
    const indirizzoAzione = `${new URL(richiesta.url()).origin}${PERCORSO_SCHEDA_AZIONI}`;
    const rifai = (contesto: BrowserContext) =>
      contesto.request.post(indirizzoAzione, { headers: intestazioni, data: corpo, maxRedirects: 0 });

    // Controllo positivo: per l'admin la risposta porta l'esito della sincronizzazione.
    const rispostaAdmin = await rifai(admin);
    expect(rispostaAdmin.status()).toBe(200);
    expect(await rispostaAdmin.text()).toMatch(/"stato":"(OK|ERRORE)"/);
    await admin.close();

    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);
      const context = await browser.newContext({ storageState: stato });
      const risposta = await rifai(context);
      const testo = await risposta.text();
      // Rimandato alla dashboard, nessun esito di sincronizzazione.
      expect(testo, `${ruolo}: nessun esito nella risposta`).not.toMatch(/"stato":"(OK|ERRORE)"/);
      expect(testo.includes('Eventi aggiunti'), `${ruolo}: nessun conteggio`).toBe(false);
      expect(testo.includes('Sincronizzazione disattivata'), `${ruolo}: nessun esito`).toBe(false);
      const destinazione = risposta.headers()['x-action-redirect'] ?? risposta.headers()['location'] ?? '';
      expect(destinazione, `${ruolo}: rimandato alla dashboard`).toContain('/dashboard');
      await context.close();
    }
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
