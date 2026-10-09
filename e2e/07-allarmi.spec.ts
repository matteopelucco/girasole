// Requisito: specs/07 - allarmi.md
//
// ATTENZIONE: alcuni scenari dipendono dall'ora reale (Europe/Rome) e
// dallo stato reale di presenze/pasti/settimane ore sul progetto
// Supabase di test, che questa suite non può forzare senza rischiare di
// interferire con altri file e2e che scrivono su "oggi" (stessa cautela
// di 53-calendario-scolastico.spec.ts). Dove non è possibile controllare
// la condizione, il test si salta da solo con `test.skip` invece di
// fallire o di dare un falso positivo — coerente con la suite esistente.
//
// I test dell'allarme "settimana ore non confermata" lavorano su un utente
// di staff creato apposta, abilitato alle ore di lavoro ed eliminato a fine
// test (e2e/fixture-utente.ts, issue #177 e #230): un utente nuovo non ha mai
// confermato nessuna settimana, quindi l'allarme c'è sempre, senza dipendere
// da cosa è stato confermato sull'account condiviso né da altri test che lo
// abilitano o disabilitano in parallelo. L'account admin condiviso non viene
// più toccato e "senza abilitazione..." lo usa così com'è.
import { test, expect } from './fixture-utente';
import { alertApp, dataOggiRoma, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

function oraRomaAdesso(): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(new Date())
  );
}

function giornoSettimanaRoma(): number {
  // 1 = lunedì ... 7 = domenica.
  const [anno, mese, giorno] = dataOggiRoma().split('-').map(Number);
  const iso = new Date(Date.UTC(anno, mese - 1, giorno, 12)).getUTCDay();
  return iso === 0 ? 7 : iso;
}

function oggiEGiornoFeriale(): boolean {
  const g = giornoSettimanaRoma();
  return g !== 6 && g !== 7;
}

function oggiDopoSogliaVenerdiSera(): boolean {
  const g = giornoSettimanaRoma();
  if (g === 6 || g === 7) return true;
  if (g === 5) return oraRomaAdesso() >= 18;
  return false;
}

function lunediSettimanaRoma(): string {
  const oggiRoma = dataOggiRoma();
  const [anno, mese, giorno] = oggiRoma.split('-').map(Number);
  const lunedi = new Date(Date.UTC(anno, mese - 1, giorno, 12));
  lunedi.setUTCDate(lunedi.getUTCDate() - (giornoSettimanaRoma() - 1));
  return lunedi.toISOString().slice(0, 10);
}

function lunediSettimanaPrecedenteRoma(): string {
  const lunedi = new Date(`${lunediSettimanaRoma()}T12:00:00Z`);
  lunedi.setUTCDate(lunedi.getUTCDate() - 7);
  return lunedi.toISOString().slice(0, 10);
}

const TITOLO_ALLARME_PRESENZE_PASTI = 'Presenze e pasti di oggi da completare';
const TITOLO_ALLARME_SETTIMANA_ORE = 'Ore di lavoro della settimana non confermate';
const TESTO_RIEPILOGO_STAFF = 'Situazione del personale';
const LINK_CONFERMA_ORE = /vai su Ore di lavoro per confermarla/;
// Un allarme dell'elenco della pagina Allarmi.
const ELENCO_ALLARMI = 'main section ul > li:has(h3)';

test.describe('07 — Allarmi', () => {
  test.describe('presenze/pasti non ancora segnati dopo le 10:00 — allarme personale', () => {
    test.describe('come maestra', () => {
      test.use({ storageState: statoAutenticazione('maestra') });

      test.beforeEach(async () => {
        test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      });

      test("prima delle 10:00 l'allarme non compare", async ({ page }) => {
        test.skip(
          oraRomaAdesso() >= 10,
          'la suite gira dopo le 10:00: lo scenario "prima delle 10:00" non è verificabile ora'
        );

        await page.goto('/dashboard/allarmi');
        await expect(page.getByRole('heading', { name: TITOLO_ALLARME_PRESENZE_PASTI })).toHaveCount(0);
      });

      test("in un giorno di chiusura (weekend) l'allarme non compare, anche dopo le 10:00", async ({ page }) => {
        test.skip(
          oggiEGiornoFeriale(),
          'oggi non è un weekend: lo scenario "giorno di chiusura" non è verificabile ora'
        );

        await page.goto('/dashboard/allarmi');
        await expect(page.getByRole('heading', { name: TITOLO_ALLARME_PRESENZE_PASTI })).toHaveCount(0);
      });

      test("dopo le 10:00 in un giorno feriale, se compare l'allarme elenca solo le mie sezioni con un link diretto", async ({
        page,
      }) => {
        test.skip(oraRomaAdesso() < 10 || !oggiEGiornoFeriale(), 'verificabile solo dopo le 10:00 in un giorno feriale');

        await page.goto('/dashboard/allarmi');
        const allarme = page.locator(ELENCO_ALLARMI).filter({ hasText: TITOLO_ALLARME_PRESENZE_PASTI });
        const presente = (await allarme.count()) > 0;
        test.skip(!presente, 'oggi presenze e pasti risultano già completati per le mie sezioni: nessuna anomalia da verificare ora');

        // Ogni link porta direttamente alla schermata unica "Presenze e
        // pasti" di oggi (specs/10), eventualmente sul box di comunicazione
        // a Rojac — mai a una pagina generica.
        const link = allarme.getByRole('link').first();
        await expect(link).toHaveAttribute(
          'href',
          /^\/dashboard\/giornata\?data=\d{4}-\d{2}-\d{2}(#comunicazione-rojac)?$/
        );
        await nessunaViolazioneA11yGrave(page);
      });
    });

    test.describe('come assistente', () => {
      test.use({ storageState: statoAutenticazione('assistente') });

      test("anche se l'allarme compare, non menziona mai i pasti (nessun accesso al registro pasti)", async ({
        page,
      }) => {
        test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
        test.skip(oraRomaAdesso() < 10 || !oggiEGiornoFeriale(), 'verificabile solo dopo le 10:00 in un giorno feriale');

        await page.goto('/dashboard/allarmi');
        const allarme = page.locator(ELENCO_ALLARMI).filter({ hasText: TITOLO_ALLARME_PRESENZE_PASTI });
        const presente = (await allarme.count()) > 0;
        test.skip(!presente, 'oggi le presenze delle mie sezioni risultano già complete: nessuna anomalia da verificare ora');

        await expect(allarme.getByRole('link', { name: /pasti/i })).toHaveCount(0);
      });
    });
  });

  test.describe('settimana di ore di lavoro non confermata — allarme personale', () => {
    test.describe('come admin', () => {
      test.use({ storageState: statoAutenticazione('admin') });

      test.beforeEach(async () => {
        test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
      });

      test('senza abilitazione al report ore, nessun allarme personale', async ({ page }) => {
        await page.goto('/dashboard/allarmi');
        await expect(page.getByRole('heading', { name: TITOLO_ALLARME_SETTIMANA_ORE })).toHaveCount(0);
      });

      // Utente di staff nuovo, abilitato alle ore: non ha mai confermato
      // una settimana, quindi l'allarme c'è sempre. Il caso "non abilitato"
      // è quello del test precedente (admin condiviso, mai abilitato).
      test("abilitata senza aver mai confermato la settimana di riferimento, l'allarme compare con il link alla settimana", async ({
        creaUtente,
        apriComeUtente,
      }) => {
        const utente = await creaUtente({ ruolo: 'maestra', abilitato: true });
        const page = await apriComeUtente(utente);

        await page.goto('/dashboard/allarmi');
        await expect(page.getByRole('heading', { name: TITOLO_ALLARME_SETTIMANA_ORE })).toBeVisible();
        // L'allarme porta direttamente alla settimana da confermare
        // (specs/07, specs/18 — navigazione tra settimane).
        await expect(page.getByRole('link', { name: LINK_CONFERMA_ORE })).toHaveAttribute(
          'href',
          /\/dashboard\/ore-lavoro\?settimana=\d{4}-\d{2}-\d{2}/
        );
        await nessunaViolazioneA11yGrave(page);
      });

      test('dal venerdì alle 18:00 la settimana di riferimento è quella corrente, non la precedente', async ({
        creaUtente,
        apriComeUtente,
      }) => {
        test.skip(!oggiDopoSogliaVenerdiSera(), 'verificabile solo da venerdì 18:00 in poi (fuso Europe/Rome)');

        const utente = await creaUtente({ ruolo: 'maestra', abilitato: true });
        const page = await apriComeUtente(utente);

        await page.goto('/dashboard/allarmi');
        const link = page.getByRole('link', { name: LINK_CONFERMA_ORE });
        await expect(link).toBeVisible();
        const href = await link.getAttribute('href');
        const settimana = new URL(href!, 'http://localhost').searchParams.get('settimana')!;
        expect(settimana).toBe(lunediSettimanaRoma());
      });

      test('prima di venerdì 18:00 la settimana di riferimento è quella precedente', async ({
        creaUtente,
        apriComeUtente,
      }) => {
        test.skip(oggiDopoSogliaVenerdiSera(), 'verificabile solo da lunedì a venerdì prima delle 18:00 (fuso Europe/Rome)');

        const utente = await creaUtente({ ruolo: 'maestra', abilitato: true });
        const page = await apriComeUtente(utente);

        await page.goto('/dashboard/allarmi');
        const link = page.getByRole('link', { name: LINK_CONFERMA_ORE });
        await expect(link).toBeVisible();
        const href = await link.getAttribute('href');
        const settimana = new URL(href!, 'http://localhost').searchParams.get('settimana')!;
        expect(settimana).toBe(lunediSettimanaPrecedenteRoma());
      });
    });
  });

  test.describe("riepilogo del personale per l'admin", () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('nessun riepilogo se nessuno del personale è in allarme', async ({ page }) => {
      await page.goto('/dashboard/allarmi');
      const riepilogo = page.getByRole('heading', { name: TESTO_RIEPILOGO_STAFF });
      const assente = (await riepilogo.count()) === 0;
      test.skip(
        !assente,
        'almeno un membro del personale ha in questo momento un allarme attivo: lo scenario "nessuno in allarme" non è verificabile ora'
      );
      await expect(riepilogo).toHaveCount(0);
      await expect(page.getByRole('list', { name: 'Allarmi del personale' })).toHaveCount(0);
    });
  });

  test.describe('la dashboard non mostra più allarmi né riepilogo', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('con allarmi attivi la dashboard (maestra e admin) non ha banner né riepilogo, ma la campanella li conta', async ({
      page,
      creaUtente,
      apriComeUtente,
    }) => {
      // Un collega abilitato alle ore che non ha mai confermato la settimana
      // ha sempre un allarme; l'admin lo vede anche come riga del personale.
      const utente = await creaUtente({ ruolo: 'maestra', abilitato: true });
      const paginaMaestra = await apriComeUtente(utente);

      await paginaMaestra.goto('/dashboard');
      await expect(paginaMaestra.getByRole('heading', { name: 'Avvisi' })).toBeVisible();
      await expect(alertApp(paginaMaestra)).toHaveCount(0);
      await expect(paginaMaestra.getByText('Non hai confermato le ore della settimana')).toHaveCount(0);
      await expect(paginaMaestra.getByText('non risultano completati')).toHaveCount(0);
      await expect(paginaMaestra.getByTestId('numero-allarmi')).toHaveText('1');
      await nessunaViolazioneA11yGrave(paginaMaestra);

      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Avvisi' })).toBeVisible();
      await expect(page.getByText(TESTO_RIEPILOGO_STAFF)).toHaveCount(0);
      await expect(page.getByText('Non hai confermato le ore della settimana')).toHaveCount(0);
      await expect(page.getByText('non risultano completati')).toHaveCount(0);
      await expect(page.getByTestId('numero-allarmi')).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });
  });

  // Campanella e pagina "Allarmi" (specs/07, issue #270). Gli utenti di staff
  // creati apposta (e2e/fixture-utente.ts) non hanno sezioni: una maestra
  // abilitata alle ore ha esattamente 1 allarme (la settimana non confermata,
  // mai confermata), una non abilitata ne ha 0, in qualsiasi giorno e ora.
  // La campanella è nello stesso HTML della pagina (streaming): dopo goto()
  // il numero, se c'è, è già presente.
  test.describe('campanella e pagina Allarmi', () => {
    test("la campanella mostra il numero degli allarmi e porta alla pagina, dove l'elenco ha lo stesso numero", async ({
      creaUtente,
      apriComeUtente,
    }) => {
      const utente = await creaUtente({ ruolo: 'maestra', abilitato: true });
      const page = await apriComeUtente(utente);

      // Su più pagine, non solo in dashboard.
      for (const percorso of ['/dashboard', '/dashboard/profilo-orario']) {
        await page.goto(percorso);
        const campanella = page.getByRole('link', { name: '1 allarme' });
        await expect(campanella).toBeVisible();
        await expect(campanella.getByTestId('numero-allarmi')).toHaveText('1');
      }

      await page.getByRole('link', { name: '1 allarme' }).click();
      await expect(page).toHaveURL(/\/dashboard\/allarmi$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Allarmi' })).toBeVisible();
      await expect(page.locator(ELENCO_ALLARMI)).toHaveCount(1);
      await nessunaViolazioneA11yGrave(page);
    });

    test('senza allarmi la campanella non mostra nessun numero', async ({ creaUtente, apriComeUtente }) => {
      const utente = await creaUtente({ ruolo: 'maestra', abilitato: false });
      const page = await apriComeUtente(utente);

      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Allarmi', exact: true })).toBeVisible();
      await expect(page.getByTestId('numero-allarmi')).toHaveCount(0);
      await nessunaViolazioneA11yGrave(page);
    });

    test.describe('come genitore', () => {
      test.use({ storageState: statoAutenticazione('genitore') });

      test('il genitore non ha la campanella', async ({ page }) => {
        test.skip(!hasCredenziali('genitore'), 'richiede E2E_GENITORE_EMAIL/PASSWORD');

        await page.goto('/dashboard');
        await expect(page.getByText('Il portale genitori è in arrivo')).toBeVisible();
        await expect(page.getByRole('link', { name: /allarm/i })).toHaveCount(0);
        await nessunaViolazioneA11yGrave(page);
      });
    });

    test('la pagina Allarmi spiega cosa non va e dà un link per sistemarlo', async ({ creaUtente, apriComeUtente }) => {
      const utente = await creaUtente({ ruolo: 'maestra', abilitato: true });
      const page = await apriComeUtente(utente);

      await page.goto('/dashboard/allarmi');
      const allarme = page.locator(ELENCO_ALLARMI);
      await expect(allarme).toHaveCount(1);
      await expect(allarme).toContainText('Ore di lavoro della settimana non confermate');
      await expect(allarme.getByRole('link')).toHaveAttribute(
        'href',
        /^\/dashboard\/ore-lavoro\?settimana=\d{4}-\d{2}-\d{2}$/
      );
      await nessunaViolazioneA11yGrave(page);
    });

    test('la pagina Allarmi senza allarmi lo dice chiaramente', async ({ creaUtente, apriComeUtente }) => {
      const utente = await creaUtente({ ruolo: 'assistente', abilitato: false });
      const page = await apriComeUtente(utente);

      await page.goto('/dashboard/allarmi');
      await expect(page.getByText('Non ci sono allarmi attivi.')).toBeVisible();
      await expect(page.locator(ELENCO_ALLARMI)).toHaveCount(0);
      await nessunaViolazioneA11yGrave(page);
    });

    test.describe('come maestra', () => {
      test.use({ storageState: statoAutenticazione('maestra') });

      test('la maestra vede solo i propri allarmi, mai il riepilogo del personale', async ({ page }) => {
        test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');

        await page.goto('/dashboard/allarmi');
        await expect(page.getByRole('heading', { level: 1, name: 'Allarmi' })).toBeVisible();
        await expect(page.getByRole('heading', { name: TESTO_RIEPILOGO_STAFF })).toHaveCount(0);
        await expect(page.getByRole('list', { name: 'Allarmi del personale' })).toHaveCount(0);

        // Il numero della campanella coincide con l'elenco (qualunque sia
        // lo stato di presenze e ore in questo momento).
        const elenco = await page.locator(ELENCO_ALLARMI).count();
        if (elenco === 0) {
          await expect(page.getByTestId('numero-allarmi')).toHaveCount(0);
        } else {
          await expect(page.getByTestId('numero-allarmi')).toHaveText(String(elenco));
        }
        await nessunaViolazioneA11yGrave(page);
      });
    });

    test.describe('come admin', () => {
      test.use({ storageState: statoAutenticazione('admin') });

      test("l'admin vede gli allarmi di tutto il personale, senza link, e il numero li conta", async ({
        page,
        creaUtente,
      }) => {
        test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
        // Un collega abilitato alle ore che non ha mai confermato la settimana è sempre in allarme.
        await creaUtente({ ruolo: 'maestra', abilitato: true });

        await page.goto('/dashboard/allarmi');
        await expect(page.getByRole('heading', { name: TESTO_RIEPILOGO_STAFF })).toBeVisible();
        const righePersonale = page.getByRole('list', { name: 'Allarmi del personale' }).locator('> li');
        const riga = righePersonale.filter({ hasText: 'Fixture Utente' }).first();
        await expect(riga).toContainText('non confermata');
        await expect(riga.getByRole('link')).toHaveCount(0);

        const totale = await page.locator(ELENCO_ALLARMI).count();
        await expect(page.getByTestId('numero-allarmi')).toHaveText(String(totale));
        await nessunaViolazioneA11yGrave(page);
      });
    });
  });

  test.describe('cron /api/cron/allarmi', () => {
    test('senza il secret corretto la route rifiuta la richiesta', async ({ request }) => {
      test.skip(!process.env.CRON_SECRET, 'richiede CRON_SECRET configurato per avere qualcosa da verificare');

      const risposta = await request.get('/api/cron/allarmi', {
        headers: { Authorization: 'Bearer secret-sbagliato' },
      });
      expect(risposta.status()).toBe(401);
    });

    test('il job invocato due volte non invia due volte la stessa email (idempotenza)', async ({ request }) => {
      test.skip(
        !process.env.CRON_SECRET || !process.env.RESEND_API_KEY,
        'richiede CRON_SECRET e RESEND_API_KEY configurate per invocare davvero la route del cron'
      );

      const intestazioni = { Authorization: `Bearer ${process.env.CRON_SECRET}` };

      const prima = await request.get('/api/cron/allarmi', { headers: intestazioni });
      expect(prima.ok()).toBe(true);
      const corpo1 = await prima.json();

      const seconda = await request.get('/api/cron/allarmi', { headers: intestazioni });
      expect(seconda.ok()).toBe(true);
      const corpo2 = await seconda.json();

      if (corpo1.risultati.mezzogiorno === 'inviato' || corpo1.risultati.mezzogiorno === 'gia_inviato') {
        expect(corpo2.risultati.mezzogiorno).toBe('gia_inviato');
      }
      // Ogni email inviata dalla prima chiamata non deve ricomparire
      // nella seconda: è già tracciata in allarmi_inviati.
      for (const email of corpo1.risultati.settimanaOre) {
        expect(corpo2.risultati.settimanaOre).not.toContain(email);
      }
    });
  });
});
