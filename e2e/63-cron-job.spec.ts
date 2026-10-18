// Requisito: specs/63 - cron-job.md
//
// Dati: i lanci di prova vengono da `supabase/seed.sql` (25 lanci del report
// notturno nel gennaio 2019, 3 del riepilogo allarmi nel febbraio 2019, tra
// cui un KO con messaggio e uno senza esito, più un lancio a mano), ricaricati
// dal reset del DB di test a ogni CI. Due test scrivono nel registro: il
// lancio a mano del riepilogo allarmi (Server Action dell'admin, nessun
// secret necessario: in CI manca RESEND_API_KEY, quindi nessuna email parte e
// il lancio può finire KO, che va bene) e quello che chiama davvero la route
// del cron degli allarmi (solo con CRON_SECRET e RESEND_API_KEY, come e2e/07
// ed e2e/52). Un lancio reale, più recente, compare in cima al suo blocco,
// quindi i controlli non contano le righe "esatte" ma i limiti. I test
// dell'admin girano in ordine, uno alla volta (`mode: 'default'`): un lancio
// in corso farebbe rifiutare il lancio a mano di un altro test.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';
import {
  MESSAGGIO_AZIONI_VUOTE,
  PERCORSO_CRON_JOB,
  PERCORSO_SCHEDA_AZIONI,
  avvisoInCorso,
  azioneSincronizza,
  bloccoCron,
  caricaAltri,
  confermaLancio,
  eRichiestaAzione,
  esitoLancio,
  esitoSincronizzazione,
  iniziLanci,
  lanciCron,
  pannelloScheda,
  pulsanteLanciaOra,
  pulsanteSincronizza,
  scheda,
  schede,
  tagEstemporaneo,
} from './pagina-cron-job';

test.describe('63 — Azioni (e Cron Job)', () => {
  test.describe('admin', () => {
    test.describe.configure({ mode: 'default' });
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('"Azioni" è nel menu sotto "Impostazioni", rientrata, dopo "Parametri di funzionamento" e prima di "Utenti"', async ({
      page,
    }) => {
      await page.goto('/admin');
      const menu = page.getByRole('navigation');
      const impostazioni = menu.getByRole('link', { name: 'Impostazioni', exact: true });
      const parametri = menu.getByRole('link', { name: 'Parametri di funzionamento', exact: true });
      const cron = menu.getByRole('link', { name: 'Azioni', exact: true });
      const utenti = menu.getByRole('link', { name: 'Utenti', exact: true });

      await expect(cron).toHaveAttribute('href', PERCORSO_CRON_JOB);
      const y = async (l: typeof cron) => (await l.boundingBox())!.y;
      const x = async (l: typeof cron) => (await l.locator('span').first().boundingBox())!.x;
      expect(await y(impostazioni)).toBeLessThan(await y(parametri));
      expect(await y(parametri)).toBeLessThan(await y(cron));
      expect(await y(cron)).toBeLessThan(await y(utenti));
      expect(await x(cron)).toBeGreaterThan(await x(impostazioni));
      // "Cron Job" non è più una voce di menu: è il nome di una scheda.
      await expect(menu.getByRole('link', { name: 'Cron Job' })).toHaveCount(0);
    });

    test('la pagina "Azioni" ha due schede, "Cron Job" è quella iniziale', async ({ page }) => {
      await page.goto('/admin');
      await page.getByRole('navigation').getByRole('link', { name: 'Azioni', exact: true }).click();
      await page.waitForURL(PERCORSO_CRON_JOB);

      await expect(page.getByRole('heading', { name: 'Azioni', level: 1 })).toBeVisible();
      await expect(page.getByRole('navigation').getByRole('link', { name: 'Azioni', exact: true })).toHaveAttribute(
        'aria-current',
        'page'
      );
      await expect(schede(page).getByRole('tab')).toHaveText(['Cron Job', 'Azioni']);
      await expect(scheda(page, 'Cron Job')).toHaveAttribute('aria-selected', 'true');
      await expect(scheda(page, 'Azioni')).toHaveAttribute('aria-selected', 'false');
      await expect(pannelloScheda(page)).toContainText('I lanci dei job pianificati');
      await expect(bloccoCron(page, 'Report notturno')).toBeVisible();

      // Scheda "Azioni": l'indirizzo cambia e vale anche dopo un ricarica pagina.
      await scheda(page, 'Azioni').click();
      await page.waitForURL(/scheda=azioni/);
      await expect(scheda(page, 'Azioni')).toHaveAttribute('aria-selected', 'true');
      await page.reload();
      await expect(scheda(page, 'Azioni')).toHaveAttribute('aria-selected', 'true');
      await page.goto(PERCORSO_SCHEDA_AZIONI);
      await expect(scheda(page, 'Azioni')).toHaveAttribute('aria-selected', 'true');

      // Si torna alla scheda iniziale.
      await scheda(page, 'Cron Job').click();
      await expect(scheda(page, 'Cron Job')).toHaveAttribute('aria-selected', 'true');
      await expect(bloccoCron(page, 'Report notturno')).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });

    test("le schede si usano con le frecce della tastiera, il focus si vede e a 375 px non c'è scorrimento orizzontale", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto(PERCORSO_CRON_JOB);

      const cron = scheda(page, 'Cron Job');
      const azioni = scheda(page, 'Azioni');
      await cron.focus();
      await expect(cron).toBeFocused();
      // Focus visibile: l'indicatore del focus non è "nessuno".
      const contorno = await cron.evaluate((e) => getComputedStyle(e).outlineStyle);
      expect(contorno).not.toBe('none');

      await page.keyboard.press('ArrowRight');
      await page.waitForURL(/scheda=azioni/);
      await expect(azioni).toHaveAttribute('aria-selected', 'true');
      await expect(azioni).toBeFocused();

      await page.keyboard.press('ArrowLeft');
      await expect(cron).toHaveAttribute('aria-selected', 'true');
      await expect(cron).toBeFocused();

      // Le due schede stanno nella larghezza dello schermo, senza scorrimento orizzontale.
      for (const t of [cron, azioni]) {
        const box = await t.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(375);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      const eccesso = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(eccesso).toBeLessThanOrEqual(0);
      await nessunaViolazioneA11yGrave(page);
    });

    test("la scheda \"Azioni\" ha l'azione \"Sincronizza calendario\" con il suo pulsante", async ({ page }) => {
      await page.goto(PERCORSO_SCHEDA_AZIONI);
      const azione = azioneSincronizza(page);
      await expect(azione.getByRole('heading', { name: 'Sincronizza calendario', level: 2 })).toBeVisible();
      await expect(pulsanteSincronizza(page)).toBeEnabled();
      // Una sola azione: nessun altro pulsante, nessun blocco dei job, niente vecchio messaggio.
      await expect(pannelloScheda(page).getByRole('button')).toHaveCount(1);
      await expect(pannelloScheda(page)).not.toContainText(MESSAGGIO_AZIONI_VUOTE);
      await expect(page.getByRole('button', { name: 'Lancia ora' })).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Report notturno' })).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Riepilogo allarmi' })).toHaveCount(0);
      // Nessun esito finché non si preme il pulsante.
      await expect(esitoSincronizzazione(page)).toHaveCount(0);
      await nessunaViolazioneA11yGrave(page);

      // A 375 px il pulsante resta leggibile e la pagina non scorre in orizzontale.
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto(PERCORSO_SCHEDA_AZIONI);
      const box = await pulsanteSincronizza(page).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      const eccesso = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(eccesso).toBeLessThanOrEqual(0);
      await nessunaViolazioneA11yGrave(page);
    });

    test('i lanci sono raggruppati per job, con nome, data e ora, stato', async ({ page }) => {
      await page.goto('/admin');
      await page.getByRole('navigation').getByRole('link', { name: 'Azioni', exact: true }).click();
      await page.waitForURL(PERCORSO_CRON_JOB);

      await expect(scheda(page, 'Cron Job')).toHaveAttribute('aria-selected', 'true');

      for (const titolo of ['Report notturno', 'Riepilogo allarmi'] as const) {
        const blocco = bloccoCron(page, titolo);
        await expect(blocco.getByRole('heading', { name: titolo, level: 2 })).toBeVisible();
        const lanci = lanciCron(blocco);
        await expect(lanci.first()).toBeVisible();
        // Ogni lancio: nome del job, data e ora, stato.
        for (const lancio of await lanci.all()) {
          await expect(lancio).toContainText(titolo);
          await expect(lancio).toContainText(/\d{2}\/\d{2}\/\d{4} alle \d{2}:\d{2}/);
          await expect(lancio.getByTestId('stato-lancio')).toHaveText(/^(OK|KO|In corso)$/);
        }
        // Dal più recente al più vecchio.
        const inizi = await iniziLanci(blocco);
        expect(inizi).toEqual([...inizi].sort().reverse());
      }

      await nessunaViolazioneA11yGrave(page);
    });

    test('ultimi 20 lanci e "Carica altri"', async ({ page }) => {
      await page.goto(PERCORSO_CRON_JOB);
      const report = bloccoCron(page, 'Report notturno');
      const allarmi = bloccoCron(page, 'Riepilogo allarmi');

      // Il seed ha 25 lanci del report notturno: se ne vedono 20.
      await expect(lanciCron(report)).toHaveCount(20);
      await expect(caricaAltri(report)).toBeVisible();
      const lanciAllarmiPrima = await iniziLanci(allarmi);

      await caricaAltri(report).click();
      await page.waitForURL(/report-presenze=40/);

      await expect.poll(() => lanciCron(report).count()).toBeGreaterThan(20);
      const quanti = await lanciCron(report).count();
      expect(quanti).toBeLessThanOrEqual(40);
      // Meno di 40 vuol dire che non ce ne sono altri: niente più pulsante.
      if (quanti < 40) await expect(caricaAltri(report)).toHaveCount(0);
      // L'altro blocco resta com'era.
      expect(await iniziLanci(allarmi)).toEqual(lanciAllarmiPrima);
    });

    test('un lancio KO mostra il messaggio di errore, se ricavabile', async ({ page }) => {
      await page.goto(PERCORSO_CRON_JOB);
      const allarmi = bloccoCron(page, 'Riepilogo allarmi');

      const fallito = lanciCron(allarmi).filter({ hasText: 'Invio email fallito (500)' });
      await expect(fallito).toHaveCount(1);
      await expect(fallito.getByTestId('stato-lancio')).toHaveText('KO');
      await expect(fallito).not.toContainText('@');

      const interrotto = lanciCron(allarmi).filter({ hasText: 'Esecuzione interrotta: nessun esito registrato.' });
      await expect(interrotto).toHaveCount(1);
      await expect(interrotto.getByTestId('stato-lancio')).toHaveText('KO');
    });

    test('ogni job ha il pulsante "Lancia ora", che chiede conferma prima di partire', async ({ page }) => {
      let azioni = 0;
      page.on('request', (richiesta) => {
        if (eRichiestaAzione(richiesta)) azioni++;
      });
      await page.goto(PERCORSO_CRON_JOB);

      for (const titolo of ['Report notturno', 'Riepilogo allarmi'] as const) {
        await expect(pulsanteLanciaOra(bloccoCron(page, titolo))).toBeVisible();
      }

      const allarmi = bloccoCron(page, 'Riepilogo allarmi');
      const lanciPrima = await iniziLanci(allarmi);
      await pulsanteLanciaOra(allarmi).click();
      const conferma = confermaLancio(allarmi);
      await expect(conferma).toContainText('Questo lancio invia davvero le email. Procedere?');
      await expect(conferma.getByRole('button', { name: 'Sì, lancia ora' })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);

      await conferma.getByRole('button', { name: 'Annulla' }).click();
      await expect(conferma).toHaveCount(0);
      await expect(pulsanteLanciaOra(allarmi)).toBeVisible();
      // Nessuna Server Action partita, quindi nessun lancio nuovo (il registro
      // non si rilegge dopo un reload: e2e/07 può lanciare il cron in parallelo).
      expect(azioni).toBe(0);
      expect(await iniziLanci(allarmi)).toEqual(lanciPrima);
    });

    test('lancio a mano: avviso di esecuzione in corso, esito e tag "estemporaneo"', async ({ page }) => {
      // La Server Action viene trattenuta finché il test non ha visto l'avviso
      // "in corso" (niente attese a tempo: il job può durare un attimo).
      let rilascia: () => void = () => {};
      const trattenuta = new Promise<void>((risolvi) => (rilascia = risolvi));
      await page.route(
        (url) => url.pathname === PERCORSO_CRON_JOB,
        async (route) => {
          if (eRichiestaAzione(route.request())) await trattenuta;
          await route.fallback();
        }
      );

      await page.goto(PERCORSO_CRON_JOB);
      const allarmi = bloccoCron(page, 'Riepilogo allarmi');
      const prima = new Date(Date.now() - 1000).toISOString();

      await pulsanteLanciaOra(allarmi).click();
      const conferma = confermaLancio(allarmi);
      const risposta = page.waitForResponse((r) => eRichiestaAzione(r.request()));
      await conferma.getByRole('button', { name: 'Sì, lancia ora' }).click();

      await expect(avvisoInCorso(allarmi)).toBeVisible();
      // Durante il lancio non se ne può avviare un altro.
      await expect(pulsanteLanciaOra(allarmi)).toHaveCount(0);
      await expect(conferma.getByRole('button')).toHaveCount(2);
      for (const bottone of await conferma.getByRole('button').all()) {
        await expect(bottone).toBeDisabled();
      }

      rilascia();
      await risposta;

      const esito = esitoLancio(allarmi);
      await expect(esito).toContainText(/Lancio a mano completato: (OK|KO)/);
      await expect(avvisoInCorso(allarmi)).toHaveCount(0);
      const stato = (await esito.textContent())?.includes('completato: OK') ? 'OK' : 'KO';
      if (stato === 'KO') await expect(esito).not.toContainText('@');

      // In cima al blocco il nuovo lancio, con lo stesso stato e il tag.
      await expect.poll(async () => (await iniziLanci(allarmi))[0] >= prima).toBe(true);
      const nuovo = lanciCron(allarmi).first();
      await expect(tagEstemporaneo(nuovo)).toHaveText('estemporaneo');
      await expect(nuovo.getByTestId('stato-lancio')).toHaveText(stato);

      // I lanci pianificati (dal seed) non hanno il tag.
      const pianificato = lanciCron(allarmi).filter({ hasText: 'Invio email fallito (500)' });
      await expect(pianificato).toHaveCount(1);
      await expect(tagEstemporaneo(pianificato)).toHaveCount(0);

      await nessunaViolazioneA11yGrave(page);
    });

    test('ogni lancio di un job viene registrato senza toccare il lavoro del job', async ({ page, request }) => {
      test.skip(
        !process.env.CRON_SECRET || !process.env.RESEND_API_KEY,
        'richiede CRON_SECRET e RESEND_API_KEY configurate per invocare davvero la route del cron'
      );

      // Senza il secret corretto la route rifiuta la chiamata prima di registrarla.
      const rifiutata = await request.get('/api/cron/allarmi', {
        headers: { Authorization: 'Bearer secret-sbagliato' },
      });
      expect(rifiutata.status()).toBe(401);

      const prima = new Date(Date.now() - 1000).toISOString();
      const risposta = await request.get('/api/cron/allarmi', {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      expect(risposta.ok()).toBe(true);

      await page.goto(PERCORSO_CRON_JOB);
      const allarmi = bloccoCron(page, 'Riepilogo allarmi');
      const [ultimo] = await iniziLanci(allarmi);
      expect(new Date(ultimo).getTime()).toBeGreaterThanOrEqual(new Date(prima).getTime());
      await expect(lanciCron(allarmi).first().getByTestId('stato-lancio')).toHaveText(/^(OK|KO)$/);
    });
  });

  test('maestra, assistente e genitore non vedono la voce e vengono reindirizzati', async ({ browser }) => {
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);

      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Azioni', exact: true })).toHaveCount(0);

      await page.goto(PERCORSO_CRON_JOB);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await page.goto(PERCORSO_SCHEDA_AZIONI);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      // Nessun modo di lanciare un job a mano né di sincronizzare il calendario
      // (le azioni rifanno comunque requireAdmin: prova in e2e/64).
      await expect(page.getByRole('button', { name: 'Lancia ora' })).toHaveCount(0);
      await expect(pulsanteSincronizza(page)).toHaveCount(0);
      await context.close();
    }
  });
});
