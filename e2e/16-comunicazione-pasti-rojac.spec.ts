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
// nulla; più il blocco quando manca la presenza di qualche bambino (non
// registra nulla, si limita a verificare l'assenza del pulsante). Gli
// scenari che presuppongono una comunicazione già avvenuta
// (blocco per la maestra, override admin, sezione nel report) si
// attivano solo se qualcuno l'ha già confermata manualmente in
// precedenza nello stesso giorno (test.skip altrimenti) — copertura
// completa richiede quindi ANCHE una verifica manuale una tantum del
// click "Conferma", vedi docs/tasks-archivio.md.
//
// Lo stesso vale per i nuovi scenari sul blocco di Assente/Malattia dopo
// la comunicazione (issue #100): si verificano solo se oggi i pasti sono
// già stati comunicati, altrimenti si saltano. Il box di comunicazione
// sta in cima alla schermata unica "Presenze e pasti" (specs/10).
import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  apriGiornata,
  cardBambini,
  clickEAttendiAzione,
  colonnaPasto,
  colonnaPresenza,
  dataOggiRoma,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  nomeBambinoCard,
  primaCardConPulsante,
  segnaAssenteOMalattia,
  statoAutenticazione,
  sezioneNota,
} from './helpers';

const SPIEGAZIONE_BLOCCO = 'Pasto già comunicato a Rojac';

// Card dei bambini con pasto (in sola lettura, dopo la comunicazione)
// uguale a `testoPasto` ("Sì", "No" o "Non ancora segnato") e presenza
// non ancora "assente"/"malattia" (nessuna etichetta nella sezione Pasto).
function cardConPasto(page: Page, testoPasto: string): Locator {
  return cardBambini(page)
    .filter({ has: page.getByRole('group', { name: 'Pasto', exact: true }).getByText(testoPasto, { exact: true }) })
    .filter({ hasNot: page.getByRole('group', { name: 'Pasto', exact: true }).getByText('🚫 Assente') })
    .filter({ hasNot: page.getByRole('group', { name: 'Pasto', exact: true }).getByText('🤒 Malattia') });
}

async function saltaSeNonComunicato(page: Page) {
  const banner = page.getByText('Pasti comunicati a Rojac il', { exact: false });
  test.skip((await banner.count()) === 0, 'pasti non ancora comunicati oggi (nessuna comunicazione da verificare)');
}

const TELEFONO_ROJAC = '0331 955630';

test.describe('16 — Comunicazione pasti a Rojac', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await apriGiornata(page, dataOggiRoma());
    });

    test('se manca la presenza di qualche bambino, il pulsante "Conferma pasti" non compare e viene mostrato un messaggio con l\'elenco dei bambini, con scorciatoie alle loro card', async ({
      page,
    }) => {
      const messaggioBloccato = page.getByText('Non puoi ancora comunicare i pasti', { exact: false });
      test.skip(
        (await messaggioBloccato.count()) === 0,
        'tutte le presenze di oggi sono già segnate (o i pasti sono già stati comunicati): nessun blocco da verificare'
      );

      await expect(messaggioBloccato).toBeVisible();
      await expect(page.getByRole('button', { name: 'Conferma pasti' })).toHaveCount(0);

      // Il numero citato nel messaggio deve corrispondere al numero di
      // nomi elencati subito sotto (specs/16, "vedo l'elenco con nome e
      // cognome di ciascun bambino a cui manca la presenza").
      const testoMessaggio = (await messaggioBloccato.textContent()) ?? '';
      const numeroAtteso = Number(testoMessaggio.match(/(\d+)/)?.[1] ?? 0);
      const elencoBambini = page.getByRole('list', { name: 'Bambini senza presenza' }).getByRole('listitem');
      await expect(elencoBambini).toHaveCount(numeroAtteso);

      // Niente più "Vai alle presenze" (la schermata è la stessa): i nomi
      // dei bambini con la card in questa pagina sono ancore alla card.
      await expect(page.getByRole('link', { name: 'Vai alle presenze' })).toHaveCount(0);
      const ancora = page.getByRole('list', { name: 'Bambini senza presenza' }).getByRole('link').first();
      if ((await ancora.count()) > 0) {
        const href = (await ancora.getAttribute('href')) ?? '';
        expect(href).toMatch(/^#bambino-/);
        await expect(page.locator(`li${href}`)).toHaveCount(1);
      }

      await nessunaViolazioneA11yGrave(page);
    });

    // Issue #186: pasto "sì" su un bambino assente (pasti > presenti). Da
    // maestra non si crea più (l'app avvisa e azzera il pasto, specs/13):
    // lo crea l'assistente, che non vede i pasti, in un contesto di
    // browser a parte. Il test ripristina il bambino a "presente".
    test('se un bambino ha il pasto "sì" ma è assente, "Conferma pasti" non compare e il messaggio elenca il bambino con il motivo', async ({
      page,
      browser,
    }) => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
      const card = primaCardConPulsante(page, 'Pasto', 'Sì');
      test.skip((await card.count()) === 0, 'nessun bambino con Sì/No disponibili (es. pasti già comunicati)');
      const nome = (await nomeBambinoCard(card).textContent())?.trim();
      const presenza = colonnaPresenza(card);

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await clickEAttendiAzione(page, colonnaPasto(card).getByRole('button', { name: 'Sì' }));
      await expect(colonnaPasto(card).getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);

      const contestoAssistente = await browser.newContext({ storageState: statoAutenticazione('assistente') });
      try {
        const paginaAssistente = await contestoAssistente.newPage();
        await apriGiornata(paginaAssistente, dataOggiRoma());
        const cardAssistente = cardBambini(paginaAssistente).filter({ hasText: nome! }).first();
        test.skip((await cardAssistente.count()) === 0, "bambino non visibile all'assistente");
        await segnaAssenteOMalattia(paginaAssistente, colonnaPresenza(cardAssistente), 'Assente');

        await apriGiornata(page, dataOggiRoma());
        await expect(page.getByText(/bambin\w+ ha(nno)? dati incoerenti/)).toBeVisible();
        const elenco = page.getByRole('list', { name: 'Bambini con dati incoerenti' });
        const voce = elenco.getByRole('listitem').filter({ hasText: nome! });
        await expect(voce).toContainText('Pasto segnato "sì" ma il bambino risulta assente.');
        // La card è in questa pagina: il nome è un link alla sua card.
        await expect(voce.getByRole('link', { name: nome! })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Conferma pasti' })).toHaveCount(0);
        await nessunaViolazioneA11yGrave(page);
      } finally {
        await contestoAssistente.close();
        // Ripristino: Presente è sempre consentito (anche se il test è fallito a metà).
        await apriGiornata(page, dataOggiRoma());
        const cardMaestra = cardBambini(page).filter({ hasText: nome! }).first();
        await clickEAttendiAzione(page, colonnaPresenza(cardMaestra).getByRole('button', { name: 'Presente' }));
      }

      await expect(page.getByRole('list', { name: 'Bambini con dati incoerenti' })).toHaveCount(0);
    });

    test('il riquadro di conferma mostra numero pasti, telefono Rojac e data; "Annulla" non registra nulla', async ({
      page,
    }) => {
      const bottoneConferma = page.getByRole('button', { name: 'Conferma pasti' });
      test.skip(
        (await bottoneConferma.count()) === 0,
        'pasti già comunicati oggi (da un run precedente), presenze non ancora tutte segnate, oppure nessuna sezione/bambino per questo account'
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

      // Navigazione a 2 livelli (specs/12): tutte le classi della maestra
      // sono nella stessa pagina, quindi il blocco si verifica una volta
      // sola su tutti i bambini visibili.
      test.skip((await cardBambini(page).count()) === 0, 'nessun bambino per questo account');
      await expect(page.getByRole('button', { name: 'Sì', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'No', exact: true })).toHaveCount(0);
      // Il "Salva nota" della presenza resta; la sezione Pasto non ne ha
      // (issue #109).
      await expect(colonnaPasto(page).getByRole('button', { name: 'Salva nota' })).toHaveCount(0);

      await nessunaViolazioneA11yGrave(page);
    });

    test('dopo la comunicazione la maestra non può segnare Assente o Malattia un bambino con pasto "sì"', async ({
      page,
    }) => {
      await saltaSeNonComunicato(page);
      const card = cardConPasto(page, 'Sì').first();
      test.skip((await card.count()) === 0, 'nessun bambino visibile con pasto "sì" e presenza non assente/malattia');

      const presenza = colonnaPresenza(card);
      await expect(presenza.getByRole('button', { name: 'Assente' })).toBeDisabled();
      await expect(presenza.getByRole('button', { name: 'Malattia' })).toBeDisabled();
      await expect(presenza.getByText(SPIEGAZIONE_BLOCCO)).toBeVisible();
      // Presente, Pre-asilo, Post-asilo e la nota restano disponibili.
      await expect(presenza.getByRole('button', { name: 'Presente' })).toBeEnabled();
      await expect(presenza.getByRole('button', { name: 'Pre-asilo' })).toBeEnabled();
      await expect(presenza.getByRole('button', { name: 'Post-asilo' })).toBeEnabled();
      await expect(sezioneNota(card).getByLabel('Nota (opzionale)')).toBeEditable();

      await nessunaViolazioneA11yGrave(page);
    });

    test('dopo la comunicazione un bambino senza pasto "sì" può ancora essere segnato Assente o Malattia', async ({
      page,
    }) => {
      await saltaSeNonComunicato(page);
      let card = cardConPasto(page, 'No').first();
      if ((await card.count()) === 0) card = cardConPasto(page, 'Non ancora segnato').first();
      test.skip((await card.count()) === 0, 'nessun bambino visibile con pasto "no" o non segnato');

      const presenza = colonnaPresenza(card);
      await expect(presenza.getByRole('button', { name: 'Assente' })).toBeEnabled();
      await expect(presenza.getByRole('button', { name: 'Malattia' })).toBeEnabled();
      await expect(presenza.getByText(SPIEGAZIONE_BLOCCO)).toHaveCount(0);
    });
  });

  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('l\'admin vede comunque il messaggio, e può sempre modificare i pasti', async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      await apriGiornata(page, dataOggiRoma());
      const banner = page.getByText('Pasti comunicati a Rojac il', { exact: false });
      test.skip((await banner.count()) === 0, 'pasti non ancora comunicati oggi (nessuna comunicazione da verificare)');
      await expect(banner).toBeVisible();

      const primoSi = page.getByRole('button', { name: 'Sì', exact: true }).first();
      test.skip((await primoSi.count()) === 0, 'nessun bambino in questa classe');
      await expect(primoSi).toBeEnabled();

      await nessunaViolazioneA11yGrave(page);
    });

    test("l'admin può segnare Assente o Malattia anche dopo la comunicazione", async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      await apriGiornata(page, dataOggiRoma());
      await saltaSeNonComunicato(page);
      // Per l'admin la sezione Pasto resta modificabile: il pasto "sì" è
      // il pulsante "Sì" evidenziato, non un testo in sola lettura.
      const card = cardBambini(page)
        .filter({ has: page.getByRole('group', { name: 'Pasto', exact: true }).locator('button.bg-emerald-700') })
        .first();
      test.skip((await card.count()) === 0, 'nessun bambino con pasto "sì" oggi');

      const presenza = colonnaPresenza(card);
      await expect(presenza.getByRole('button', { name: 'Assente' })).toBeEnabled();
      await expect(presenza.getByRole('button', { name: 'Malattia' })).toBeEnabled();
      await expect(presenza.getByText(SPIEGAZIONE_BLOCCO)).toHaveCount(0);
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
