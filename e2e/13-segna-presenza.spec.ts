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
import { test, expect } from './fixture-bambino';
import {
  clickEAttendiAzione,
  dataUltimoGiornoApertoPrimaDiOggi,
  dataOggiRoma,
  hasCredenziali,
  statoAutenticazione,
} from './helpers';
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
      // lib/classiStato.ts non era incluso nel content di Tailwind
      // (tailwind.config.ts). Verifico il colore di sfondo REALE, non
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
});
