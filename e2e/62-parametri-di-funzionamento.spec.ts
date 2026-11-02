// Requisito: specs/62 - parametri-di-funzionamento.md
//
// Le sezioni "Variabili d'ambiente" e "Parametri delle funzionalità" sono solo
// navigazione e lettura: nessun dato scritto sul progetto di test. La sezione
// "Variabili d'ambiente" verifica la password dell'admin di test con un login
// usa-e-getta (la sessione di verifica viene chiusa subito con scope 'local'):
// la sessione salvata da auth.setup.ts resta valida.
//
// La sezione "Prezzi" (issue #396, PRZ-01..10, in fondo al file) scrive
// nell'unica riga di `prezzi_predefiniti`: quel blocco gira in sequenza e
// rimette i prezzi com'erano alla fine (e2e/fixture-prezzi.ts). Un solo
// worker per quel blocco; altri file che dipendono dai prezzi (50, 55) li
// rileggono dal database prima di creare un bambino.
//
// Nessun valore di variabile viene stampato: i confronti sui valori usano
// booleani (`includes`, `===`), così un fallimento non li scrive nel report.
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  clickEAttendiAzione,
  credenziali,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  statoAutenticazione,
  type Ruolo,
} from './helpers';
import { accediComeAdminDb, creaBambinoFixture, eliminaBambinoFixture } from './fixture-bambino';
import {
  PREZZI_INIZIALI,
  creaSezioneConTipo,
  formatta,
  idBambinoPerCognome,
  impostaTipoSezione,
  leggiCosti,
  leggiPrezzi,
  pulisciSezioneEBambini,
  ripristinaPrezzi,
  salvaPrezziOriginali,
  scriviCostiInModoEsplicito,
  scriviPrezzi,
  type Prezzi,
} from './fixture-prezzi';
import {
  ETICHETTE_COSTI,
  ETICHETTE_PREZZI,
  MESSAGGIO_CONCORRENZA,
  MESSAGGIO_IMPORTO_NON_VALIDO,
  campoPrezzo,
  compilaPrezzi,
  creaBambinoDaForm,
  erroriPrezzi,
  formCosti,
  pulsanteSalvaPrezzi,
  salvaPrezzi,
  sezionePrezzi,
} from './pagina-prezzi';
import { SEGNAPOSTO_VALORE, valoriParametriPresenti } from '../lib/parametriAmbiente';
import { PARAMETRI_VISIBILI } from '../lib/parametriVisibili';

const PERCORSO = '/admin/parametri-funzionamento';

// Valori attesi, letti dallo stesso ambiente del server (in CI il server è
// avviato da Playwright con le stesse variabili; in locale entrambi leggono
// .env.local).
function parametriAttesi() {
  return valoriParametriPresenti(PARAMETRI_VISIBILI, process.env);
}

// Valori abbastanza lunghi da non comparire per caso nella pagina.
function valoriSignificativi() {
  return parametriAttesi().filter((p) => p.valore.length >= 8);
}

// Segreti critici esclusi dalla lista: né i nomi né i valori devono uscire.
const SEGRETI_ESCLUSI = ['SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'RESEND_API_KEY', 'TURNSTILE_SECRET_KEY'];

function celleValore(page: Page) {
  return page.getByTestId('valore-variabile');
}

async function attendiValoriNascosti(page: Page): Promise<void> {
  const n = parametriAttesi().length;
  await expect
    .poll(async () => (await celleValore(page).allTextContents()).map((t) => t.includes(SEGNAPOSTO_VALORE)))
    .toEqual(Array(n).fill(true));
  const testo = (await page.locator('main').textContent()) ?? '';
  for (const p of valoriSignificativi()) {
    expect(testo.includes(p.valore), `il valore di ${p.nome} non deve essere in pagina`).toBe(false);
  }
}

async function verificaPassword(page: Page, password: string): Promise<void> {
  await page.getByRole('button', { name: 'Mostra valori', exact: true }).click();
  await page.getByLabel('La tua password', { exact: true }).fill(password);
  await clickEAttendiAzione(page, page.getByRole('button', { name: 'Verifica e mostra' }));
}

async function rivelaValori(page: Page): Promise<void> {
  await verificaPassword(page, credenziali('admin')!.password);
  await expect(page.getByRole('button', { name: 'Nascondi valori', exact: true })).toBeVisible();
  const attesi = parametriAttesi();
  await expect
    .poll(async () => (await celleValore(page).allTextContents()).map((t, i) => t === attesi[i]?.valore))
    .toEqual(attesi.map(() => true));
}

test.describe('62 — Parametri di funzionamento', () => {
  test.describe('admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('la voce è nel menu sotto "Impostazioni", rientrata, dopo "Reset giornata" e prima di "Utenti"', async ({ page }) => {
      await page.goto('/admin');
      const menu = page.getByRole('navigation');
      const impostazioni = menu.getByRole('link', { name: 'Impostazioni', exact: true });
      const reset = menu.getByRole('link', { name: 'Reset giornata', exact: true });
      const parametri = menu.getByRole('link', { name: 'Parametri di funzionamento', exact: true });
      const utenti = menu.getByRole('link', { name: 'Utenti', exact: true });

      await expect(parametri).toHaveAttribute('href', PERCORSO);
      const y = async (l: typeof parametri) => (await l.boundingBox())!.y;
      const x = async (l: typeof parametri) => (await l.locator('span').first().boundingBox())!.x;
      expect(await y(impostazioni)).toBeLessThan(await y(reset));
      expect(await y(reset)).toBeLessThan(await y(parametri));
      expect(await y(parametri)).toBeLessThan(await y(utenti));
      expect(await x(parametri)).toBeGreaterThan(await x(impostazioni));
    });

    test('la pagina si apre dal menu e mostra titolo e breve descrizione', async ({ page }) => {
      await page.goto('/admin');
      await page.getByRole('navigation').getByRole('link', { name: 'Parametri di funzionamento', exact: true }).click();
      await page.waitForURL(PERCORSO);

      await expect(page.getByRole('heading', { name: 'Parametri di funzionamento', level: 1 })).toBeVisible();
      await expect(page.getByTestId('descrizione-pagina')).not.toBeEmpty();
      await expect(
        page.getByRole('navigation').getByRole('link', { name: 'Parametri di funzionamento', exact: true })
      ).toHaveAttribute('aria-current', 'page');
      await nessunaViolazioneA11yGrave(page);
    });

    test.describe('variabili d\'ambiente', () => {
      test.beforeEach(async () => {
        test.skip(parametriAttesi().length === 0, 'nessuna variabile della lista configurata in questo ambiente');
      });

      test('la sezione elenca i parametri con i valori nascosti', async ({ page }) => {
        const risposta = await page.goto(PERCORSO);
        expect(risposta?.headers()['cache-control'] ?? '').toContain('no-store');
        // HTML della risposta iniziale, compresi i dati RSC inviati al browser.
        const html = (await risposta?.text()) ?? '';

        await expect(page.getByRole('heading', { name: "Variabili d'ambiente", level: 2 })).toBeVisible();
        await expect(page.getByTestId('descrizione-variabili-ambiente')).not.toBeEmpty();
        await expect(page.getByTestId('nessuna-variabile')).toHaveCount(0);

        const nomi = parametriAttesi().map((p) => p.nome);
        await expect(page.getByTestId('nome-variabile')).toHaveText(nomi);
        expect(nomi).toEqual([...nomi].sort());
        await attendiValoriNascosti(page);
        await expect(page.getByRole('button', { name: 'Mostra valori', exact: true })).toBeVisible();

        for (const p of valoriSignificativi()) {
          expect(html.includes(p.valore), `il valore di ${p.nome} non deve essere nella risposta iniziale`).toBe(false);
        }
        for (const nome of SEGRETI_ESCLUSI) {
          expect(html.includes(nome), `${nome} non deve comparire`).toBe(false);
          const segreto = process.env[nome];
          if (segreto) expect(html.includes(segreto), `il valore di ${nome} non deve comparire`).toBe(false);
        }
        await nessunaViolazioneA11yGrave(page);
      });

      test('con la password sbagliata i valori restano nascosti', async ({ page }) => {
        await page.goto(PERCORSO);
        await verificaPassword(page, `password-sbagliata-${Date.now()}`);

        await expect(page.locator('#verifica-password-parametri').getByRole('alert')).toHaveText('Password non corretta.');
        await expect(page.getByRole('button', { name: 'Mostra valori', exact: true })).toBeVisible();
        await attendiValoriNascosti(page);
      });

      test('con la propria password i valori compaiono in chiaro', async ({ page }) => {
        await page.goto(PERCORSO);
        await rivelaValori(page);
        await nessunaViolazioneA11yGrave(page);

        for (const nome of SEGRETI_ESCLUSI) {
          const segreto = process.env[nome];
          const testo = (await page.locator('main').textContent()) ?? '';
          if (segreto) expect(testo.includes(segreto), `il valore di ${nome} non deve comparire`).toBe(false);
        }

        // La verifica non tocca la sessione con cui l'admin sta navigando.
        const dopo = await page.request.get(PERCORSO);
        expect(dopo.ok()).toBe(true);
        expect(new URL(dopo.url()).pathname).toBe(PERCORSO);
      });

      test('ricaricando la pagina i valori tornano nascosti', async ({ page }) => {
        await page.goto(PERCORSO);
        await rivelaValori(page);

        await page.reload();
        await expect(page.getByRole('button', { name: 'Mostra valori', exact: true })).toBeVisible();
        await expect(page.getByLabel('La tua password', { exact: true })).toHaveCount(0);
        await attendiValoriNascosti(page);
      });

      test('ricliccando il pulsante i valori si nascondono di nuovo', async ({ page }) => {
        await page.goto(PERCORSO);
        await rivelaValori(page);

        await page.getByRole('button', { name: 'Nascondi valori', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Mostra valori', exact: true })).toBeVisible();
        await attendiValoriNascosti(page);
      });
    });

    test('la sezione "Parametri delle funzionalità" dice che è in costruzione', async ({ page }) => {
      await page.goto(PERCORSO);

      const sezione = page.getByRole('region', { name: 'Parametri delle funzionalità' });
      await expect(sezione.getByRole('heading', { name: 'Parametri delle funzionalità', level: 2 })).toBeVisible();
      await expect(sezione.getByTestId('descrizione-funzionalita')).not.toBeEmpty();
      await expect(sezione.getByTestId('funzionalita-in-costruzione')).toContainText('in corso di costruzione');
      await expect(sezione.getByRole('table')).toHaveCount(0);
      await expect(sezione.getByRole('textbox')).toHaveCount(0);
      await nessunaViolazioneA11yGrave(page);
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
      await expect(page.getByRole('link', { name: 'Parametri di funzionamento' })).toHaveCount(0);

      await page.goto(PERCORSO);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await expect(page.getByRole('heading', { name: "Variabili d'ambiente" })).toHaveCount(0);
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Sezione "Prezzi" (issue #396, PRZ-01..PRZ-10)
// ---------------------------------------------------------------------------
test.describe('62 — Prezzi', () => {
  test.describe.configure({ mode: 'serial' });

  let db: Awaited<ReturnType<typeof accediComeAdminDb>> = null;
  let originali: Prezzi | null = null;

  test.beforeAll(async () => {
    db = await accediComeAdminDb();
    if (db) originali = await salvaPrezziOriginali(db);
  });

  test.afterAll(async () => {
    if (db && originali) await ripristinaPrezzi(db, originali);
  });

  test.describe('admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin') || !db, 'richiede E2E_ADMIN_EMAIL/PASSWORD e le variabili Supabase');
      // Punto di partenza noto: i valori iniziali della migration.
      await scriviPrezzi(db!, PREZZI_INIZIALI);
    });

    test('PRZ-01: l\'admin vede la sezione "Prezzi" con gli otto campi', async ({ page }) => {
      await page.goto(PERCORSO);

      const sezione = sezionePrezzi(page);
      await expect(sezione.getByRole('heading', { name: 'Prezzi', level: 2 })).toBeVisible();
      await expect(sezione.getByTestId('descrizione-prezzi')).toContainText('bambini nuovi');
      await expect(sezione.getByTestId('descrizione-prezzi')).toContainText('non cambiano');

      const attesi: Record<keyof Prezzi, string> = {
        retta_materna: '160,00',
        retta_primavera: '200,00',
        buono_pasto: '6,00',
        marca_da_bollo: '2,00',
        abbonamento_pre_asilo: '70,00',
        abbonamento_post_asilo: '70,00',
        gettone_pre_asilo: '7,00',
        gettone_post_asilo: '7,00',
      };
      for (const campo of Object.keys(attesi) as (keyof Prezzi)[]) {
        await expect(campoPrezzo(page, campo), ETICHETTE_PREZZI[campo]).toHaveValue(attesi[campo]);
      }
      await expect(sezione.getByRole('textbox')).toHaveCount(8);
      await expect(pulsanteSalvaPrezzi(page)).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('PRZ-03: salvare i prezzi e ritrovarli dopo il ricaricamento (virgola o punto)', async ({ page }) => {
      await page.goto(PERCORSO);
      await compilaPrezzi(page, { retta_materna: '165,50', gettone_pre_asilo: '7', retta_primavera: '210.25' });
      await salvaPrezzi(page);

      await expect(sezionePrezzi(page).getByText('Prezzi salvati', { exact: true })).toBeVisible();
      await expect(erroriPrezzi(page)).toHaveCount(0);

      await page.reload();
      await expect(campoPrezzo(page, 'retta_materna')).toHaveValue('165,50');
      await expect(campoPrezzo(page, 'gettone_pre_asilo')).toHaveValue('7,00');
      await expect(campoPrezzo(page, 'retta_primavera')).toHaveValue('210,25');
      // Gli altri prezzi non sono cambiati.
      await expect(campoPrezzo(page, 'buono_pasto')).toHaveValue('6,00');
      await expect(campoPrezzo(page, 'gettone_post_asilo')).toHaveValue('7,00');

      await expect
        .poll(async () => {
          const p = await leggiPrezzi(db!);
          return [p.retta_materna, p.retta_primavera, p.gettone_pre_asilo, p.buono_pasto];
        })
        .toEqual([165.5, 210.25, 7, 6]);
    });

    test('PRZ-04: un valore non valido è rifiutato con un messaggio chiaro, senza arrotondare', async ({ page }) => {
      test.slow();
      const nonValidi = ['', 'abc', '-1', '6,555', '1e2', '1.234,50', '10000'];
      for (const valore of nonValidi) {
        await page.goto(PERCORSO);
        await campoPrezzo(page, 'buono_pasto').fill(valore);
        await salvaPrezzi(page);

        await expect(erroriPrezzi(page), `valore "${valore}"`).toContainText(MESSAGGIO_IMPORTO_NON_VALIDO);
        await expect(campoPrezzo(page, 'buono_pasto'), `valore "${valore}"`).toHaveAttribute('aria-invalid', 'true');
        await expect(sezionePrezzi(page).getByText('Prezzi salvati', { exact: true })).toHaveCount(0);

        // Niente è stato scritto: né 0 né un valore arrotondato.
        expect((await leggiPrezzi(db!)).buono_pasto, `valore "${valore}"`).toBe(6);
        await page.reload();
        await expect(campoPrezzo(page, 'buono_pasto')).toHaveValue('6,00');
      }

      // "0" e "9999,99" sono invece accettati, al centesimo.
      await page.goto(PERCORSO);
      await compilaPrezzi(page, { buono_pasto: '0', retta_materna: '9999,99' });
      await salvaPrezzi(page);
      await expect(sezionePrezzi(page).getByText('Prezzi salvati', { exact: true })).toBeVisible();
      await expect
        .poll(async () => {
          const p = await leggiPrezzi(db!);
          return [p.buono_pasto, p.retta_materna];
        })
        .toEqual([0, 9999.99]);
    });

    test('PRZ-05: il salvataggio è tutto o niente', async ({ page }) => {
      await page.goto(PERCORSO);
      await compilaPrezzi(page, { retta_materna: '170', gettone_pre_asilo: '8', buono_pasto: 'abc' });
      await salvaPrezzi(page);

      await expect(erroriPrezzi(page)).toContainText(MESSAGGIO_IMPORTO_NON_VALIDO);
      await expect(campoPrezzo(page, 'buono_pasto')).toHaveAttribute('aria-invalid', 'true');
      // I campi mantengono quanto scritto, anche i due validi.
      await expect(campoPrezzo(page, 'buono_pasto')).toHaveValue('abc');
      await expect(campoPrezzo(page, 'retta_materna')).toHaveValue('170');
      await expect(campoPrezzo(page, 'gettone_pre_asilo')).toHaveValue('8');

      // Nessuno degli otto prezzi è stato salvato, neanche i due validi.
      const dopo = await leggiPrezzi(db!);
      expect({ ...dopo, updated_at: undefined }).toEqual({ ...PREZZI_INIZIALI, updated_at: undefined });

      // Corretto l'errore, tutto si salva insieme.
      await campoPrezzo(page, 'buono_pasto').fill('5,5');
      await salvaPrezzi(page);
      await expect(sezionePrezzi(page).getByText('Prezzi salvati', { exact: true })).toBeVisible();
      await expect
        .poll(async () => {
          const p = await leggiPrezzi(db!);
          return [p.retta_materna, p.gettone_pre_asilo, p.buono_pasto];
        })
        .toEqual([170, 8, 5.5]);
    });

    test('PRZ-06: cambiare un prezzo non tocca i bambini già esistenti', async ({ page }) => {
      const bambino = await creaBambinoFixture(db!);
      const sezione = await creaSezioneConTipo(db!, 'materna');
      try {
        const costi = {
          prezzo_mensile: 123.45,
          prezzo_buono_pasto: 5.55,
          prezzo_marca_da_bollo: 1.99,
          pre_asilo_richiesto: true,
          prezzo_pre_asilo: 33.33,
          post_asilo_richiesto: false,
          prezzo_post_asilo: 44.44,
          email_promemoria: 'genitore.prezzi@example.test',
        };
        await scriviCostiInModoEsplicito(db!, bambino.id, costi);

        await page.goto(PERCORSO);
        await compilaPrezzi(page, {
          retta_materna: '300',
          retta_primavera: '310',
          buono_pasto: '9',
          marca_da_bollo: '3',
          abbonamento_pre_asilo: '80',
          abbonamento_post_asilo: '81',
        });
        await salvaPrezzi(page);
        await expect(sezionePrezzi(page).getByText('Prezzi salvati', { exact: true })).toBeVisible();
        await expect.poll(async () => (await leggiPrezzi(db!)).retta_materna).toBe(300);

        // Anche il tipo di una sezione può cambiare senza toccare i costi.
        await impostaTipoSezione(db!, sezione.id, 'primavera');

        expect(await leggiCosti(db!, bambino.id)).toEqual(costi);
      } finally {
        await pulisciSezioneEBambini(db!, sezione.id, []);
        await eliminaBambinoFixture(db!, bambino.id);
      }
    });

    test('PRZ-07: un bambino creato in una sezione con tipo parte con i prezzi di "Prezzi"', async ({ page }) => {
      const primavera = await creaSezioneConTipo(db!, 'primavera');
      const materna = await creaSezioneConTipo(db!, 'materna');
      const cognomi = [`E2ePrz07a${Date.now()}`, `E2ePrz07b${Date.now()}`];
      try {
        // Valori tutti diversi tra loro: ogni copia sbagliata si vede.
        await scriviPrezzi(db!, {
          retta_materna: 161.11,
          retta_primavera: 201.22,
          buono_pasto: 6.33,
          marca_da_bollo: 2.44,
          abbonamento_pre_asilo: 71.55,
          abbonamento_post_asilo: 72.66,
          gettone_pre_asilo: 7.77,
          gettone_post_asilo: 7.88,
        });

        await creaBambinoDaForm(page, cognomi[0], primavera.nome);
        const idPrimavera = await idBambinoPerCognome(db!, cognomi[0]);
        await expect
          .poll(async () => {
            const c = await leggiCosti(db!, idPrimavera);
            return c && { ...c, email_promemoria: c.email_promemoria ?? '' };
          })
          .toEqual({
            prezzo_mensile: 201.22,
            prezzo_buono_pasto: 6.33,
            prezzo_marca_da_bollo: 2.44,
            pre_asilo_richiesto: false,
            prezzo_pre_asilo: 71.55,
            post_asilo_richiesto: false,
            prezzo_post_asilo: 72.66,
            email_promemoria: '',
          });

        await creaBambinoDaForm(page, cognomi[1], materna.nome);
        const idMaterna = await idBambinoPerCognome(db!, cognomi[1]);
        await expect.poll(async () => (await leggiCosti(db!, idMaterna))?.prezzo_mensile).toBe(161.11);
        // I gettoni non entrano nei costi del bambino: la scheda non li mostra.
        await page.goto(`/admin/bambini/${idMaterna}`);
        await expect(page.getByLabel(/gettone/i)).toHaveCount(0);
      } finally {
        await pulisciSezioneEBambini(db!, primavera.id, cognomi);
        await pulisciSezioneEBambini(db!, materna.id, []);
      }
    });

    test('PRZ-08: bambino creato senza sezione, o in una sezione senza tipo, non ha riga di costi', async ({ page }) => {
      const senzaTipo = await creaSezioneConTipo(db!, null);
      const cognomi = [`E2ePrz08a${Date.now()}`, `E2ePrz08b${Date.now()}`];
      try {
        await creaBambinoDaForm(page, cognomi[0], null);
        await creaBambinoDaForm(page, cognomi[1], senzaTipo.nome);
        for (const cognome of cognomi) {
          const id = await idBambinoPerCognome(db!, cognome);
          expect(await leggiCosti(db!, id), cognome).toBeNull();
        }

        // La scheda propone i costi (retta vuota senza tipo) ma non li salva.
        const prezzi = await leggiPrezzi(db!);
        const id = await idBambinoPerCognome(db!, cognomi[1]);
        await page.goto(`/admin/bambini/${id}`);
        await expect(page.getByLabel(ETICHETTE_COSTI.retta, { exact: true })).toHaveValue('');
        await expect(page.getByLabel(ETICHETTE_COSTI.buonoPasto, { exact: true })).toHaveValue(formatta(prezzi.buono_pasto));
        await expect(formCosti(page)).toBeVisible();
        expect(await leggiCosti(db!, id)).toBeNull();
      } finally {
        await pulisciSezioneEBambini(db!, senzaTipo.id, cognomi);
      }
    });

    test('PRZ-09: due admin salvano i prezzi insieme, il secondo con dati vecchi è rifiutato', async ({ page, browser }) => {
      const secondo = await browser.newContext({ storageState: statoAutenticazione('admin') });
      const paginaSecondo = await secondo.newPage();
      try {
        await page.goto(PERCORSO);
        await paginaSecondo.goto(PERCORSO);
        await expect(campoPrezzo(paginaSecondo, 'retta_materna')).toHaveValue('160,00');

        // Il primo salva una modifica...
        await campoPrezzo(page, 'retta_materna').fill('170');
        await salvaPrezzi(page);
        await expect(sezionePrezzi(page).getByText('Prezzi salvati', { exact: true })).toBeVisible();
        await expect.poll(async () => (await leggiPrezzi(db!)).retta_materna).toBe(170);

        // ...poi il secondo, con i dati vecchi, prova a salvare.
        await campoPrezzo(paginaSecondo, 'gettone_pre_asilo').fill('9');
        await salvaPrezzi(paginaSecondo);
        await expect(erroriPrezzi(paginaSecondo)).toContainText(MESSAGGIO_CONCORRENZA);

        const p = await leggiPrezzi(db!);
        expect([p.retta_materna, p.gettone_pre_asilo]).toEqual([170, 7]);

        await paginaSecondo.reload();
        await expect(campoPrezzo(paginaSecondo, 'retta_materna')).toHaveValue('170,00');
        await expect(campoPrezzo(paginaSecondo, 'gettone_pre_asilo')).toHaveValue('7,00');
      } finally {
        await secondo.close();
      }
    });

    test('PRZ-10: a livello di database la riga è una sola e solo l\'admin la usa', async () => {
      // Come admin: non si creano altre righe né si cancella quella esistente.
      const inserimento = await db!.from('prezzi_predefiniti').insert({ id: false });
      expect(inserimento.error).not.toBeNull();
      const cancellazione = await db!.from('prezzi_predefiniti').delete().eq('id', true).select('id');
      expect(cancellazione.error !== null || (cancellazione.data ?? []).length === 0).toBe(true);
      const { data: righe } = await db!.from('prezzi_predefiniti').select('id');
      expect(righe).toHaveLength(1);
    });
  });

  // PRZ-10, chi non è admin: nessun valore letto, nessuna modifica riuscita.
  test('PRZ-10: maestra, assistente, genitore e anonimo non leggono né modificano i prezzi', async () => {
    test.skip(!db, 'richiede E2E_ADMIN_EMAIL/PASSWORD e le variabili Supabase');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const chiaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    await scriviPrezzi(db!, PREZZI_INIZIALI);

    const nuovoCliente = () => createClient(url, chiaveAnon, { auth: { persistSession: false, autoRefreshToken: false } });
    const clienti = [{ nome: 'anonimo', cliente: nuovoCliente() }];
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as Ruolo[]) {
      const cred = credenziali(ruolo);
      if (!cred) continue;
      const cliente = nuovoCliente();
      const { error } = await cliente.auth.signInWithPassword(cred);
      expect(error, `login ${ruolo}`).toBeNull();
      clienti.push({ nome: ruolo, cliente });
    }

    for (const { nome, cliente } of clienti) {
      const lettura = await cliente.from('prezzi_predefiniti').select('*');
      expect((lettura.data ?? []).length, `${nome}: nessun valore letto`).toBe(0);
      const modifica = await cliente.from('prezzi_predefiniti').update({ retta_materna: 1 }).eq('id', true).select('id');
      expect((modifica.data ?? []).length, `${nome}: nessuna riga modificata`).toBe(0);
      const inserimento = await cliente.from('prezzi_predefiniti').insert({ id: false });
      expect(inserimento.error, `${nome}: inserimento negato`).not.toBeNull();
      const cancellazione = await cliente.from('prezzi_predefiniti').delete().eq('id', true).select('id');
      expect((cancellazione.data ?? []).length, `${nome}: nessuna riga cancellata`).toBe(0);
    }

    expect((await leggiPrezzi(db!)).retta_materna).toBe(160);
  });

  test('PRZ-02: gli altri ruoli non vedono i prezzi', async ({ browser }) => {
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);

      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      await page.goto(PERCORSO);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await expect(page.getByRole('region', { name: 'Prezzi', exact: true })).toHaveCount(0);
      await expect(page.getByLabel(ETICHETTE_PREZZI.retta_materna, { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Salva prezzi' })).toHaveCount(0);
      await context.close();
    }
  });
});
