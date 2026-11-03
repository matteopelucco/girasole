// Requisito: specs/13 - segna-presenza.md
//
// ATTENZIONE: questi test scrivono davvero in `presenze` sul progetto
// Supabase puntato da NEXT_PUBLIC_SUPABASE_URL (di test in locale, quello
// configurato nei secret in CI) — mai contro un progetto di produzione.
//
// Ogni test lavora su un bambino creato apposta (fixture `bambino`,
// e2e/fixture-bambino.ts, issue #228) e poi eliminato: niente dipendenza
// dai bambini del seed né dallo stato lasciato da altri test, quindi nessun
// "ripristino a presente" a fine test.
//
// La presenza si segna dalla sezione "Presenza" della card di ogni
// bambino nella schermata unica "Presenze e pasti" (specs/10): ogni
// interazione è ristretta a quella sezione (e alla sezione "Nota" in
// fondo alla card, issue #110), per non confondersi con i pulsanti della
// sezione "Pasto".
import { createClient } from '@supabase/supabase-js';
import { test, expect, creaBambinoFixture } from './fixture-bambino';
import {
  clickEAttendiAzione,
  credenziali,
  dataProssimoSabato,
  dataUltimoGiornoApertoPrimaDiOggi,
  dataOggiRoma,
  hasCredenziali,
  meseSuccessivoRoma,
  nessunaViolazioneA11yGrave,
  statoAutenticazione,
} from './helpers';
import { creaSezioneConTipo, pulisciSezioneEBambini } from './fixture-prezzi';
import {
  TESTO_AVVISO_FUORI_RETTA,
  TESTO_COPERTO,
  TESTO_DA_ADDEBITARE,
  avviiGettone,
  avvisoGettoneFuoriRetta,
  contaAvviiGettoni,
  gettone,
  impostaAbbonamenti,
  inserisciPresenzaConAsilo,
  inserisciRettaInviata,
  nessunImporto,
  nomeAnimazione,
  scrittaCopertura,
} from './pagina-gettone';
import {
  CLASSE_ATTIVO,
  apriGiornata,
  avvisoConfermaAzzeramento,
  avvisoSolaLettura,
  bottonePasto,
  bottonePresenza,
  bottoneSalvaNota,
  campoNota,
  cardBambino,
  cardConPulsante,
  colonnaPasto,
  colonnaPresenza,
  conteggioRiepilogo,
  etichettaPastoAssente,
  giornoDiChiusura,
  saltaSeStatoBloccato,
  segnaAssenteOMalattia,
  segnaStato,
  titoloSezione,
  warningInconsistenza,
} from './pagina-giornata';

test.describe('13 — Segna presenza', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    // `bambino` è nei parametri anche quando il test non lo usa: così la
    // fixture è creata prima di aprire la pagina, che deve già mostrarlo.
    test.beforeEach(async ({ page, bambino }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();
    });

    test('riepilogo presenze della classe', async ({ page }) => {
      // Il riepilogo aggregato (in cima) e quello per sezione condividono
      // lo stesso formato di testo: .first() basta a verificare che compaia.
      await expect(conteggioRiepilogo(page, 'Presenti').first()).toBeVisible();
      await expect(titoloSezione(page).first()).toBeVisible();
    });

    test('segnare un bambino presente evidenzia il pulsante corretto', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Presente');

      const bottonePresente = bottonePresenza(card, 'Presente');
      await segnaStato(page, bottonePresente);

      await expect(bottonePresente).toHaveClass(CLASSE_ATTIVO.presente);
    });

    test("segnare un'assenza con nota", async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Assente');
      const presenza = colonnaPresenza(card);
      await saltaSeStatoBloccato(card, 'Assente');

      await campoNota(card).fill('influenza, rientra lunedì');
      const bottoneAssente = bottonePresenza(card, 'Assente');
      await segnaAssenteOMalattia(page, presenza, 'Assente');

      await expect(bottoneAssente).toHaveClass(CLASSE_ATTIVO.assente);
      // Bug reale trovato durante un test con un'insegnante: il
      // pulsante selezionato appariva come uno spazio bianco perché
      // il file con le classi dei pulsanti non era incluso nel content di Tailwind
      // (vedi il commento in app/globals.css). Verifico il colore di sfondo REALE, non
      // solo il nome classe.
      await expect(bottoneAssente).toHaveCSS('background-color', 'rgb(87, 83, 78)');
      await expect(campoNota(card)).toHaveValue('influenza, rientra lunedì');

      // La nota deve restare salvata anche dopo un ricaricamento.
      await page.reload();
      await expect(campoNota(card)).toHaveValue('influenza, rientra lunedì');
    });

    test('salvare una nota senza cambiare lo stato', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Presente');

      // Serve uno stato già segnato: "Salva nota" richiede un record di
      // presenza esistente. Aspetto la fine di ciascun salvataggio: il
      // reload annullerebbe il salvataggio della nota (issue #70).
      await segnaStato(page, bottonePresenza(card, 'Presente'));
      await expect(bottonePresenza(card, 'Presente')).toHaveClass(CLASSE_ATTIVO.presente);

      await campoNota(card).fill('entra alle 9:03');
      await clickEAttendiAzione(page, bottoneSalvaNota(card));

      // Lo stato non cambia: resta "presente".
      await expect(bottonePresenza(card, 'Presente')).toHaveClass(CLASSE_ATTIVO.presente);

      await page.reload();
      await expect(campoNota(card)).toHaveValue('entra alle 9:03');
      await expect(bottonePresenza(card, 'Presente')).toHaveClass(CLASSE_ATTIVO.presente);
    });

    test('correggere uno stato in malattia: upsert, nota e tag nella card', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Presente');
      const presenza = colonnaPresenza(card);
      await saltaSeStatoBloccato(card, 'Malattia');

      await segnaStato(page, bottonePresenza(card, 'Presente'));
      await expect(bottonePresenza(card, 'Presente')).toHaveClass(CLASSE_ATTIVO.presente);

      // Ricarico e correggo in malattia: se l'upsert funziona resta un
      // solo record (nessun duplicato, nessuno stato "fantasma").
      await page.reload();
      await campoNota(card).fill('febbre alta');
      const bottoneMalattia = bottonePresenza(card, 'Malattia');
      await segnaAssenteOMalattia(page, presenza, 'Malattia');

      await expect(bottoneMalattia).toHaveClass(CLASSE_ATTIVO.malattia);
      await expect(bottonePresenza(card, 'Presente')).not.toHaveClass(CLASSE_ATTIVO.presente);
      // Il tag compare nell'intestazione della card (una sola card per
      // bambino, specs/10) e la sezione Pasto della stessa card mostra
      // l'etichetta al posto dei pulsanti Sì/No.
      await expect(card.getByText('🤒 Malattia').first()).toBeVisible();
      if ((await colonnaPasto(card).count()) > 0) {
        await expect(bottonePasto(card, 'Sì')).toHaveCount(0);
      }
    });

    // Segnare Assente/Malattia con un pasto "sì" o un pre/post-asilo già
    // segnati: avviso, conferma, azzeramento (specs/13, issue #186).
    test('Assente con pre-asilo attivo chiede conferma: Annulla non cambia nulla', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Pre-asilo');
      await saltaSeStatoBloccato(card, 'Assente');

      await segnaStato(page, bottonePresenza(card, 'Presente'));
      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await expect(bottonePresenza(card, 'Pre-asilo')).toHaveClass(CLASSE_ATTIVO.preAsilo);

      await bottonePresenza(card, 'Assente').click();
      const avviso = avvisoConfermaAzzeramento(card);
      await expect(avviso).toContainText('il pre-asilo');
      await expect(avviso.getByRole('button', { name: 'Conferma e azzera' })).toBeVisible();

      await avviso.getByRole('button', { name: 'Annulla' }).click();
      await expect(avviso).toHaveCount(0);
      await expect(bottonePresenza(card, 'Pre-asilo')).toHaveClass(CLASSE_ATTIVO.preAsilo);
      await page.reload();
      await expect(bottonePresenza(card, 'Pre-asilo')).toHaveClass(CLASSE_ATTIVO.preAsilo);
      await expect(bottonePresenza(card, 'Presente')).toHaveClass(CLASSE_ATTIVO.presente);
    });

    test('Assente con pasto "sì" chiede conferma e, confermando, azzera il pasto a "no"', async ({
      page,
      bambino,
    }) => {
      const card = await cardConPulsante(page, bambino, 'Pasto', 'Sì');
      await saltaSeStatoBloccato(card, 'Assente');

      await segnaStato(page, bottonePresenza(card, 'Presente'));
      await segnaStato(page, bottonePasto(card, 'Sì'));
      await expect(bottonePasto(card, 'Sì')).toHaveClass(CLASSE_ATTIVO.pastoSi);

      await bottonePresenza(card, 'Assente').click();
      const avviso = avvisoConfermaAzzeramento(card);
      await expect(avviso).toContainText('il pasto');
      // Finché non si conferma non cambia nulla.
      await expect(bottonePasto(card, 'Sì')).toHaveClass(CLASSE_ATTIVO.pastoSi);

      await campoNota(card).fill('influenza');
      await clickEAttendiAzione(page, avviso.getByRole('button', { name: 'Conferma e azzera' }));

      await expect(bottonePresenza(card, 'Assente')).toHaveClass(CLASSE_ATTIVO.assente);
      await expect(etichettaPastoAssente(card)).toBeVisible();
      // Il bambino non è più in incoerenza (pasto azzerato) e la nota è salvata.
      await expect(warningInconsistenza(card)).toHaveCount(0);
      await expect(campoNota(card)).toHaveValue('influenza');

      // Tornato presente, il pasto è "no" (azzerato), non più "sì".
      await segnaStato(page, bottonePresenza(card, 'Presente'));
      await expect(bottonePasto(card, 'No')).toHaveClass(CLASSE_ATTIVO.pastoNo);
      await expect(bottonePasto(card, 'Sì')).not.toHaveClass(CLASSE_ATTIVO.pastoSi);
    });

    test('Malattia con pasto "no" e nessun pre/post-asilo non chiede conferma', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Pasto', 'No');
      await saltaSeStatoBloccato(card, 'Malattia');

      await segnaStato(page, bottonePresenza(card, 'Presente'));
      await segnaStato(page, bottonePasto(card, 'No'));
      await expect(bottonePasto(card, 'No')).toHaveClass(CLASSE_ATTIVO.pastoNo);

      const bottoneMalattia = bottonePresenza(card, 'Malattia');
      await expect(bottoneMalattia).not.toHaveAttribute('aria-expanded');
      await segnaStato(page, bottoneMalattia);
      await expect(bottoneMalattia).toHaveClass(CLASSE_ATTIVO.malattia);
      await expect(avvisoConfermaAzzeramento(card)).toHaveCount(0);
    });

    test('non posso modificare una data diversa da oggi: sola lettura', async ({ page, bambino }) => {
      await apriGiornata(page, dataUltimoGiornoApertoPrimaDiOggi());
      await expect(cardBambino(page, bambino)).toBeVisible();

      await expect(avvisoSolaLettura(page)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Presente' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Assente' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Malattia' })).toHaveCount(0);
    });

    test('riepilogo mostra i conteggi pre-asilo/post-asilo', async ({ page }) => {
      await expect(conteggioRiepilogo(page, 'Pre-asilo').first()).toBeVisible();
      await expect(conteggioRiepilogo(page, 'Post-asilo').first()).toBeVisible();
    });

    test("segnare pre-asilo forza presente e attiva l'indicatore", async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Pre-asilo');

      // Base nota: "Presente" azzera pre/post-asilo, così il click sotto
      // attiva (e non disattiva) il toggle.
      await segnaStato(page, bottonePresenza(card, 'Presente'));
      const bottonePreAsilo = bottonePresenza(card, 'Pre-asilo');
      await segnaStato(page, bottonePreAsilo);

      await expect(bottonePreAsilo).toHaveClass(CLASSE_ATTIVO.preAsilo);
      await expect(bottonePresenza(card, 'Presente')).toHaveClass(CLASSE_ATTIVO.presente);
    });

    test('pre-asilo e post-asilo sono indipendenti e cumulabili', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Post-asilo');

      // Riparte da una base nota (nessun pre/post-asilo attivo): un
      // secondo click su un toggle già attivo lo disattiverebbe.
      await segnaStato(page, bottonePresenza(card, 'Presente'));
      await expect(bottonePresenza(card, 'Presente')).toHaveClass(CLASSE_ATTIVO.presente);

      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      const bottonePostAsilo = bottonePresenza(card, 'Post-asilo');
      await segnaStato(page, bottonePostAsilo);

      await expect(bottonePresenza(card, 'Pre-asilo')).toHaveClass(CLASSE_ATTIVO.preAsilo);
      await expect(bottonePostAsilo).toHaveClass(CLASSE_ATTIVO.postAsilo);
    });

    test('ripremere pre-asilo lo disattiva, restando presente', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Pre-asilo');

      await segnaStato(page, bottonePresenza(card, 'Presente'));
      const bottonePreAsilo = bottonePresenza(card, 'Pre-asilo');
      await segnaStato(page, bottonePreAsilo);
      await expect(bottonePreAsilo).toHaveClass(CLASSE_ATTIVO.preAsilo);

      await clickEAttendiAzione(page, bottonePreAsilo);
      await expect(bottonePreAsilo).not.toHaveClass(CLASSE_ATTIVO.preAsilo);
      await expect(bottonePresenza(card, 'Presente')).toHaveClass(CLASSE_ATTIVO.presente);
    });

    test('segnare assente resetta pre-asilo e post-asilo', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Pre-asilo');
      const presenza = colonnaPresenza(card);
      await saltaSeStatoBloccato(card, 'Assente');

      await segnaStato(page, bottonePresenza(card, 'Presente'));
      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await expect(bottonePresenza(card, 'Pre-asilo')).toHaveClass(CLASSE_ATTIVO.preAsilo);

      // Con pre-asilo attivo, Assente chiede prima conferma (specs/13,
      // issue #186) e alla conferma azzera il pre/post-asilo.
      await segnaAssenteOMalattia(page, presenza, 'Assente');
      await expect(bottonePresenza(card, 'Pre-asilo')).not.toHaveClass(CLASSE_ATTIVO.preAsilo);
      await expect(bottonePresenza(card, 'Post-asilo')).not.toHaveClass(CLASSE_ATTIVO.postAsilo);
    });

    test('i dati di presenza manomessi dal client non vengono usati', async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Pre-asilo');

      // Base nota: presente, senza pre-asilo né post-asilo.
      await segnaStato(page, bottonePresenza(card, 'Presente'));
      await expect(bottonePresenza(card, 'Presente')).toHaveClass(CLASSE_ATTIVO.presente);
      await page.reload();

      // Falsifico la riga attuale inviata dal browser (argomento legato con
      // .bind() alla Server Action): post-asilo già attivo. Senza la
      // rilettura dal database l'azione scriverebbe pre-asilo E post-asilo.
      // Il corpo multipart contiene anche i campi nascosti `$ACTION_n:1` di
      // OGNI pulsante del form (fallback senza JavaScript): gli argomenti
      // realmente usati dalla chiamata sono solo nella parte `name="0"`, in
      // fondo, ed è lì (e solo lì) che si manomette.
      let manomessa = false;
      await page.route('**/*', async (route) => {
        const richiesta = route.request();
        const corpo = richiesta.postData();
        const vero = '"postAsilo":false';
        // Stessa lunghezza dell'originale (spazio finale, JSON valido): il
        // Content-Length della richiesta resta corretto.
        const falso = '"postAsilo":true ';
        const inizioArgomenti = corpo === null ? -1 : corpo.indexOf('name="0"');
        if (
          richiesta.method() === 'POST' &&
          richiesta.headers()['next-action'] !== undefined &&
          corpo !== null &&
          inizioArgomenti >= 0 &&
          corpo.indexOf(vero, inizioArgomenti) >= 0
        ) {
          manomessa = true;
          const prima = corpo.slice(0, inizioArgomenti);
          const argomenti = corpo.slice(inizioArgomenti).replace(vero, falso);
          await route.continue({ postData: prima + argomenti });
          return;
        }
        await route.continue();
      });

      await clickEAttendiAzione(page, bottonePresenza(card, 'Pre-asilo'));
      expect(manomessa, 'la richiesta della Server Action doveva essere manomessa').toBe(true);
      await page.unroute('**/*');

      // L'azione è stata rifiutata: compare la schermata di errore (app/error.tsx).
      // In produzione Next.js omette il messaggio reale e lascia il codice
      // errore (digest); in sviluppo si vede il messaggio italiano
      // (MESSAGGIO_DATI_CAMBIATI di lib/presenza.ts).
      await expect(page.getByRole('heading', { name: 'Qualcosa è andato storto' })).toBeVisible();
      await expect(page.getByText(/I dati di questo bambino sono cambiati|Codice errore:/).first()).toBeVisible();

      // Nulla è stato scritto: il bambino resta presente, senza pre/post-asilo.
      await page.reload();
      await expect(bottonePresenza(card, 'Presente')).toHaveClass(CLASSE_ATTIVO.presente);
      await expect(bottonePresenza(card, 'Pre-asilo')).not.toHaveClass(CLASSE_ATTIVO.preAsilo);
      await expect(bottonePresenza(card, 'Post-asilo')).not.toHaveClass(CLASSE_ATTIVO.postAsilo);
    });
  });

  test.describe('come assistente, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test.beforeEach(async ({ page, bambino }) => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();
    });

    test("l'assistente può segnare una presenza, come una maestra", async ({ page, bambino }) => {
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Presente');

      const bottonePresente = bottonePresenza(card, 'Presente');
      await segnaStato(page, bottonePresente);

      await expect(bottonePresente).toHaveClass(CLASSE_ATTIVO.presente);
    });
  });

  test.describe("come admin, l'admin può modificare qualunque data", () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('i pulsanti restano attivi anche su una data diversa da oggi', async ({ page, bambino }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      await apriGiornata(page, dataUltimoGiornoApertoPrimaDiOggi());
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Presente');

      await expect(avvisoSolaLettura(page)).toHaveCount(0);
      const bottonePresente = bottonePresenza(card, 'Presente');
      await segnaStato(page, bottonePresente);
      await expect(bottonePresente).toHaveClass(CLASSE_ATTIVO.presente);
    });
  });

  // --- Gettone e copertura dell'abbonamento (issue #399, GET-01..GET-15) ----
  // Ogni test crea il suo bambino con abbonamento pre/post sì/no
  // (impostaAbbonamenti) e, dove serve, una retta già inviata. Nessun importo
  // compare mai nella schermata (GET-07): si verificano solo le due scritte.
  test.describe('gettone: come maestra, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    // Prepara i costi, apre la giornata di oggi e ritorna la card (salta se
    // l'asilo è chiuso: nessun pulsante, specs/53).
    async function apri(
      page: import('@playwright/test').Page,
      adminDb: import('@supabase/supabase-js').SupabaseClient | null,
      bambino: import('./fixture-bambino').BambinoFixture,
      abbonamenti: { pre: boolean; post: boolean }
    ) {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await impostaAbbonamenti(adminDb!, bambino, abbonamenti);
      await apriGiornata(page, dataOggiRoma());
      return cardConPulsante(page, bambino, 'Presenza', 'Pre-asilo');
    }

    test('GET-01: pre/post-asilo coperto dall\'abbonamento mostra "Già pagato con l\'abbonamento"', async ({
      page,
      bambino,
      adminDb,
    }) => {
      const card = await apri(page, adminDb, bambino, { pre: true, post: true });

      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await expect(bottonePresenza(card, 'Pre-asilo')).toHaveClass(CLASSE_ATTIVO.preAsilo);
      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_COPERTO);
      await expect(gettone(card, 'pre')).toHaveCount(0);

      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));
      await expect(scrittaCopertura(card, 'post')).toHaveText(TESTO_COPERTO);
      await expect(gettone(card, 'post')).toHaveCount(0);
    });

    test('GET-02: non coperto mostra il gettone, animato una sola volta, e "Da addebitare nella prossima retta"', async ({
      page,
      bambino,
      adminDb,
    }) => {
      const card = await apri(page, adminDb, bambino, { pre: false, post: false });
      await contaAvviiGettoni(page);

      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_DA_ADDEBITARE);
      await expect(gettone(card, 'pre')).toBeVisible();
      // Animazione solo CSS, un solo ciclo, poi il gettone resta fermo.
      await expect(gettone(card, 'pre')).toHaveCSS('animation-iteration-count', '1');
      await expect.poll(() => avviiGettone(page, 'pre')).toBe(1);

      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));
      await expect(scrittaCopertura(card, 'post')).toHaveText(TESTO_DA_ADDEBITARE);
      await expect(gettone(card, 'post')).toBeVisible();
    });

    test('GET-03: pre e post-asilo sono valutati separatamente', async ({ page, bambino, adminDb }) => {
      const card = await apri(page, adminDb, bambino, { pre: true, post: false });

      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));

      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_COPERTO);
      await expect(gettone(card, 'pre')).toHaveCount(0);
      await expect(scrittaCopertura(card, 'post')).toHaveText(TESTO_DA_ADDEBITARE);
      await expect(gettone(card, 'post')).toBeVisible();
    });

    test('GET-04: togliere il pre/post-asilo fa sparire scritta e gettone, l\'altra voce non cambia', async ({
      page,
      bambino,
      adminDb,
    }) => {
      const card = await apri(page, adminDb, bambino, { pre: false, post: false });
      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));
      await expect(gettone(card, 'pre')).toBeVisible();
      await expect(gettone(card, 'post')).toBeVisible();

      await clickEAttendiAzione(page, bottonePresenza(card, 'Pre-asilo'));
      await expect(bottonePresenza(card, 'Pre-asilo')).toHaveAttribute('aria-pressed', 'false');
      await expect(scrittaCopertura(card, 'pre')).toHaveCount(0);
      await expect(gettone(card, 'pre')).toHaveCount(0);
      await expect(scrittaCopertura(card, 'post')).toHaveText(TESTO_DA_ADDEBITARE);
      await expect(gettone(card, 'post')).toBeVisible();
    });

    test('GET-05: dopo il ricaricamento le scritte restano e l\'animazione non riparte', async ({
      page,
      bambino,
      adminDb,
    }) => {
      const card = await apri(page, adminDb, bambino, { pre: false, post: false });
      await contaAvviiGettoni(page);
      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await expect.poll(() => avviiGettone(page, 'pre')).toBe(1);

      // Un'altra voce dello stesso bambino: il gettone del pre non riparte.
      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));
      await expect.poll(() => avviiGettone(page, 'post')).toBe(1);
      expect(await avviiGettone(page, 'pre')).toBe(1);

      await page.reload();
      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_DA_ADDEBITARE);
      await expect(scrittaCopertura(card, 'post')).toHaveText(TESTO_DA_ADDEBITARE);
      for (const voce of ['pre', 'post'] as const) {
        await expect(gettone(card, voce)).toBeVisible();
        await expect(gettone(card, voce)).toHaveAttribute('data-animato', 'false');
        expect(await nomeAnimazione(gettone(card, voce))).toBe('none');
      }
    });

    test('GET-06: con "riduci movimento" il gettone compare fermo, con la scritta', async ({
      page,
      bambino,
      adminDb,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const card = await apri(page, adminDb, bambino, { pre: false, post: false });
      await contaAvviiGettoni(page);

      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await expect(gettone(card, 'pre')).toBeVisible();
      await expect(gettone(card, 'pre')).toHaveCSS('animation-name', 'none');
      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_DA_ADDEBITARE);
      expect(await avviiGettone(page, 'pre')).toBe(0);
    });

    test('GET-07: nessun importo nella schermata, con voci coperte e non coperte', async ({
      page,
      bambino,
      adminDb,
    }) => {
      const card = await apri(page, adminDb, bambino, { pre: true, post: false });
      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));
      await expect(scrittaCopertura(card, 'post')).toBeVisible();

      await nessunImporto(card);
      await expect(page.getByText(/€|\b(?:70|7),00\b/)).toHaveCount(0);
    });

    test('GET-11: se la retta del mese è già inviata conta cosa fu addebitato, non il flag attuale', async ({
      page,
      bambino,
      adminDb,
    }) => {
      // Flag attuale: pre sì, post no. Retta inviata: pre a zero, post addebitato.
      await inserisciRettaInviata(adminDb!, bambino, dataOggiRoma().slice(0, 7), {
        costoPreAsilo: 0,
        costoPostAsilo: 70,
      });
      const card = await apri(page, adminDb, bambino, { pre: true, post: false });

      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));

      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_DA_ADDEBITARE);
      await expect(gettone(card, 'pre')).toBeVisible();
      await expect(scrittaCopertura(card, 'post')).toHaveText(TESTO_COPERTO);
      await expect(gettone(card, 'post')).toHaveCount(0);
    });

    test('GET-12: avviso al salvataggio se la retta successiva è già inviata e il gettone non è coperto', async ({
      page,
      bambino,
      adminDb,
    }) => {
      await inserisciRettaInviata(adminDb!, bambino, meseSuccessivoRoma());
      const card = await apri(page, adminDb, bambino, { pre: false, post: true });

      // Non coperto: la presenza si salva comunque e compare l'avviso, senza importi.
      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await expect(bottonePresenza(card, 'Pre-asilo')).toHaveClass(CLASSE_ATTIVO.preAsilo);
      await expect(avvisoGettoneFuoriRetta(card)).toHaveText(TESTO_AVVISO_FUORI_RETTA);
      await nessunImporto(avvisoGettoneFuoriRetta(card));

      // Si rivede ricaricando finché la condizione dura.
      await page.reload();
      await expect(avvisoGettoneFuoriRetta(card)).toHaveText(TESTO_AVVISO_FUORI_RETTA);

      // Coperto (post con abbonamento): nessun avviso aggiuntivo per quella voce.
      // Tolgo il pre: l'avviso sparisce.
      await clickEAttendiAzione(page, bottonePresenza(card, 'Pre-asilo'));
      await expect(bottonePresenza(card, 'Pre-asilo')).toHaveAttribute('aria-pressed', 'false');
      await expect(avvisoGettoneFuoriRetta(card)).toHaveCount(0);

      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));
      await expect(scrittaCopertura(card, 'post')).toHaveText(TESTO_COPERTO);
      await expect(avvisoGettoneFuoriRetta(card)).toHaveCount(0);
    });

    test('GET-12: nessun avviso se la retta successiva non è ancora inviata', async ({ page, bambino, adminDb }) => {
      const card = await apri(page, adminDb, bambino, { pre: false, post: false });

      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_DA_ADDEBITARE);
      await expect(avvisoGettoneFuoriRetta(card)).toHaveCount(0);
    });

    test('GET-15: la schermata con scritte e gettoni è accessibile; il gettone è decorativo', async ({
      page,
      bambino,
      adminDb,
    }) => {
      const card = await apri(page, adminDb, bambino, { pre: true, post: false });
      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));
      await expect(gettone(card, 'post')).toBeVisible();

      await expect(gettone(card, 'post')).toHaveAttribute('aria-hidden', 'true');
      await nessunaViolazioneA11yGrave(page);
    });

    test('GET-14: data in sola lettura mostra le scritte con il gettone già fermo', async ({
      page,
      bambino,
      adminDb,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      const passata = dataUltimoGiornoApertoPrimaDiOggi();
      await impostaAbbonamenti(adminDb!, bambino, { pre: true, post: false });
      await inserisciPresenzaConAsilo(adminDb!, bambino, passata, { pre: true, post: true });

      await apriGiornata(page, passata);
      const card = cardBambino(page, bambino);
      await expect(card).toBeVisible();
      await expect(avvisoSolaLettura(page)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pre-asilo' })).toHaveCount(0);

      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_COPERTO);
      await expect(scrittaCopertura(card, 'post')).toHaveText(TESTO_DA_ADDEBITARE);
      await expect(gettone(card, 'post')).toBeVisible();
      await expect(gettone(card, 'post')).toHaveAttribute('data-animato', 'false');
      expect(await nomeAnimazione(gettone(card, 'post'))).toBe('none');
    });

    test('GET-08: maestra e assistente ricevono solo il sì/no per i bambini delle loro sezioni', async ({
      bambino,
      adminDb,
    }) => {
      test.skip(!hasCredenziali('maestra') || !hasCredenziali('assistente'), 'richiede maestra e assistente');
      await impostaAbbonamenti(adminDb!, bambino, { pre: true, post: false });
      // Un bambino di un'altra sezione (non assegnata a maestra e assistente).
      const altra = await creaSezioneConTipo(adminDb!, null);
      const estraneo = await creaBambinoFixture(adminDb!);
      try {
        const { error } = await adminDb!.from('bambini').update({ sezione_id: altra.id }).eq('id', estraneo.id);
        expect(error?.message ?? null).toBeNull();
        await impostaAbbonamenti(adminDb!, estraneo, { pre: true, post: true });

        for (const ruolo of ['maestra', 'assistente'] as const) {
          const cred = credenziali(ruolo)!;
          const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const login = await db.auth.signInWithPassword(cred);
          expect(login.error?.message ?? null).toBeNull();

          const { data, error: errRpc } = await db.rpc('copertura_pre_post_asilo', { p_data: dataOggiRoma() });
          expect(errRpc?.message ?? null).toBeNull();
          const righe = (data ?? []) as Record<string, unknown>[];

          // Solo sì/no per bambino: nessun prezzo, flag o altra colonna di costi_bambini.
          const mio = righe.find((r) => r.bambino_id === bambino.id);
          expect(mio, `${ruolo}: riga del bambino della propria sezione`).toBeDefined();
          expect(Object.keys(mio!).sort()).toEqual([
            'bambino_id',
            'post_asilo_coperto',
            'pre_asilo_coperto',
            'retta_successiva_inviata',
          ]);
          expect(mio!.pre_asilo_coperto).toBe(true);
          expect(mio!.post_asilo_coperto).toBe(false);
          // Nessuna risposta per un bambino di un'altra sezione.
          expect(righe.some((r) => r.bambino_id === estraneo.id)).toBe(false);

          // Resta vietata la lettura diretta dei costi.
          const costi = await db.from('costi_bambini').select('*').eq('bambino_id', bambino.id);
          expect(costi.data ?? []).toEqual([]);
          await db.auth.signOut();
        }
      } finally {
        await pulisciSezioneEBambini(adminDb!, altra.id, [estraneo.cognome]);
      }
    });
  });

  test.describe('gettone: come assistente, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test('GET-08: l\'assistente vede la scritta giusta per ogni voce', async ({ page, bambino, adminDb }) => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
      await impostaAbbonamenti(adminDb!, bambino, { pre: true, post: false });
      await apriGiornata(page, dataOggiRoma());
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Pre-asilo');

      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));
      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_COPERTO);
      await expect(scrittaCopertura(card, 'post')).toHaveText(TESTO_DA_ADDEBITARE);
      await nessunImporto(card);
    });
  });

  test.describe('gettone: come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('GET-09: l\'admin vede le stesse scritte e lo stesso gettone, senza importi, su una data ammessa', async ({
      page,
      bambino,
      adminDb,
    }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
      await impostaAbbonamenti(adminDb!, bambino, { pre: true, post: false });
      await apriGiornata(page, dataUltimoGiornoApertoPrimaDiOggi());
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Pre-asilo');

      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await segnaStato(page, bottonePresenza(card, 'Post-asilo'));
      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_COPERTO);
      await expect(gettone(card, 'pre')).toHaveCount(0);
      await expect(scrittaCopertura(card, 'post')).toHaveText(TESTO_DA_ADDEBITARE);
      await expect(gettone(card, 'post')).toBeVisible();
      await nessunImporto(card);
    });

    test('GET-11: la copertura vale per tutto il mese solare, anche prima di quando è stato spuntato l\'abbonamento', async ({
      page,
      bambino,
      adminDb,
    }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
      const passata = dataUltimoGiornoApertoPrimaDiOggi();
      test.skip(passata.slice(0, 7) !== dataOggiRoma().slice(0, 7), 'il giorno aperto precedente è nel mese scorso');
      // L'abbonamento è stato scritto adesso (oggi): la data passata dello stesso mese è coperta.
      await impostaAbbonamenti(adminDb!, bambino, { pre: true, post: false });
      await apriGiornata(page, passata);
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Pre-asilo');

      await segnaStato(page, bottonePresenza(card, 'Pre-asilo'));
      await expect(scrittaCopertura(card, 'pre')).toHaveText(TESTO_COPERTO);
      await expect(gettone(card, 'pre')).toHaveCount(0);
    });

    test('GET-13: giorno di chiusura, nessun pulsante, nessuna scritta e nessun gettone', async ({
      page,
      bambino,
      adminDb,
    }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
      await impostaAbbonamenti(adminDb!, bambino, { pre: false, post: false });
      await apriGiornata(page, dataProssimoSabato());
      expect(await giornoDiChiusura(page)).toBe(true);
      const card = cardBambino(page, bambino);
      await expect(card).toBeVisible();

      await expect(card.getByRole('button', { name: 'Pre-asilo' })).toHaveCount(0);
      await expect(card.getByRole('button', { name: 'Post-asilo' })).toHaveCount(0);
      await expect(card.getByText(TESTO_COPERTO)).toHaveCount(0);
      await expect(card.getByText(TESTO_DA_ADDEBITARE)).toHaveCount(0);
      await expect(card.getByTestId(/^gettone-/)).toHaveCount(0);
    });
  });

  test.describe('gettone: come genitore', () => {
    test.use({ storageState: statoAutenticazione('genitore') });

    test('GET-10: il genitore non vede la schermata delle presenze, né scritte né gettone', async ({ page }) => {
      test.skip(!hasCredenziali('genitore'), 'richiede E2E_GENITORE_EMAIL/PASSWORD');
      await page.goto(`/dashboard/giornata?data=${dataOggiRoma()}`);

      await expect(page.getByRole('button', { name: 'Pre-asilo' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Post-asilo' })).toHaveCount(0);
      await expect(page.getByText(TESTO_COPERTO)).toHaveCount(0);
      await expect(page.getByText(TESTO_DA_ADDEBITARE)).toHaveCount(0);
      await expect(page.getByTestId(/^gettone-/)).toHaveCount(0);
    });
  });
});
