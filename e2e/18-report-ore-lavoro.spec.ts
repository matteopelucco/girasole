// Requisito: specs/18 - report-ore-lavoro.md
//
// Dati propri (issue #230): i test che hanno bisogno di un'abilitazione alle
// ore di lavoro (e di un profilo orario) lavorano su un utente di staff creato
// apposta ed eliminato a fine test (e2e/fixture-utente.ts), insieme a ore
// settimanali, conferme e movimenti. Nessun flag degli account condivisi
// (admin, maestra) viene toccato: i test "senza abilitazione" li usano così
// come sono e non possono essere disturbati da altri test in parallelo. Il
// test principale esegue l'intero percorso in sequenza su un solo utente
// (non test separati) perché le sue fasi dipendono dallo stato lasciato dalle
// precedenti.
//
// La suite NON preme "Sì" su "Conferma settimana" per la settimana corrente:
// i test di conferma/riapertura (issue #90, #189) usano settimane lontane nel
// passato di un utente proprio.
import type { Page } from '@playwright/test';
import { test, expect } from './fixture-utente';
import {
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  statoAutenticazione,
  alertApp,
  clickEAttendiAzione,
  dataOggiRoma,
  dataFraGiorni,
  popupErrore,
  chiudiPopupErrore,
} from './helpers';
import {
  PERCORSO_ELENCO_ORE_LAVORO,
  PERCORSO_ORE_LAVORO,
  PERCORSO_UTENTI,
  apriOreDipendente,
  avvisoSettimanaConfermata,
  bottoneConfermaSettimana,
  bottoneRiapriSettimana,
  bottoneSalvaModifiche,
  campoGiorno,
  creaProfiloOrario,
  eliminaProfiloOrarioSeEsiste,
  impostaOreLavoro,
  impostaProfiloOrario,
  linkSettimanaPrecedente,
  linkSettimanaSuccessiva,
  lunediDellaSettimana,
  oreInRiquadro,
  oreOrdinarieGiorno,
  rigaUtente,
  titoloOreLavoro,
  titoloOreLavoroDipendente,
  urlOreLavoro,
} from './pagina-personale';
import { testoSaldoMonteOre } from './pagina-monte-ore';

const totaleErogato = (page: Page, giorno: string) => page.getByRole('status', { name: `Totale ore erogate ${giorno}` });

// Il campo "Differenza ore" ha step 0.25: il browser bloccherebbe da sé
// l'invio di valori non validi. Per verificare la validazione LATO
// SERVER (fonte di verità, specs/18) disattivo quella nativa.
async function disattivaValidazioneNativa(page: Page) {
  await bottoneSalvaModifiche(page).evaluate((b) => {
    (b.closest('form') as HTMLFormElement).noValidate = true;
  });
}

test.describe('18 — Report ore di lavoro', () => {
  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('senza abilitazione, /dashboard/ore-lavoro reindirizza alla dashboard', async ({ page }) => {
      await page.goto(PERCORSO_ORE_LAVORO);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    test('form settimanale: precaricamento dal profilo orario, validazioni, giorni chiusi lavorabili, conferma (senza premere Sì)', async ({
      creaUtente,
      apriComeUtente,
    }) => {
      // Percorso lungo (creazione e login dell'utente, molti salvataggi con
      // ricarica): supera i 60s di default senza essere bloccato su nessun
      // passo (issue #70).
      test.slow();
      const nomeProfilo = `E2E ore lavoro ${Date.now()}`;
      // Utente admin proprio (non l'admin condiviso): si abilita da solo e si
      // assegna un profilo orario, come faceva l'admin condiviso.
      const utente = await creaUtente({ ruolo: 'admin' });
      const page = await apriComeUtente(utente);

      // Setup: abilito l'account SENZA profilo orario, per lo scenario
      // "senza profilo orario assegnato le ore ordinarie partono da zero".
      await page.goto(PERCORSO_UTENTI);
      await impostaOreLavoro(page, utente.email, true);

      try {
        await page.goto(PERCORSO_ORE_LAVORO);
        await expect(titoloOreLavoro(page)).toBeVisible();

        // Tutti i 7 giorni sono mostrati ed editabili, sabato/domenica
        // inclusi: il personale può lavorare anche nei giorni in cui
        // l'asilo è chiuso (specs/18, specs/53 — nessun blocco, a
        // differenza di presenze/pasti).
        await expect(campoGiorno(page, 'Stato', 'Sabato')).toBeVisible();
        await expect(campoGiorno(page, 'Stato', 'Domenica')).toBeVisible();
        // Scenario "un giorno di chiusura scolastica è Chiusura per
        // impostazione predefinita": sabato/domenica (chiusura implicita)
        // partono in stato Chiusura, senza campi da compilare.
        await expect(campoGiorno(page, 'Stato', 'Sabato')).toHaveValue('chiusura');
        await expect(campoGiorno(page, 'Stato', 'Domenica')).toHaveValue('chiusura');
        await expect(campoGiorno(page, 'Differenza ore', 'Sabato')).toHaveCount(0);
        await expect(page.getByText('Giorno di vacanza', { exact: false }).first()).toBeVisible();

        await expect(bottoneSalvaModifiche(page)).toBeVisible();
        await expect(bottoneConfermaSettimana(page)).toBeVisible();
        await nessunaViolazioneA11yGrave(page);

        // Senza profilo orario: ore ordinarie a 0 (testo, non un campo),
        // riferimento statico esplicito con il suggerimento di chiedere
        // all'admin (scenari "senza profilo orario assegnato" e "il
        // profilo orario resta sempre visibile come riferimento
        // statico"), nessun pulsante "Copia" (scenario "le ore ordinarie
        // non sono modificabili e non c'è il pulsante Copia").
        await expect(oreOrdinarieGiorno(page, 0)).toHaveText('0h');
        await expect(campoGiorno(page, 'Ore ordinarie', 'Lunedì')).toHaveCount(0);
        await expect(page.getByText('Nessun profilo orario assegnato', { exact: false }).first()).toBeVisible();
        await expect(page.getByText("chiedi all'admin", { exact: false }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Copia/ })).toHaveCount(0);

        // Assegno un profilo orario e ricarico: ore ordinarie precaricate.
        await creaProfiloOrario(page, nomeProfilo, [7, 7, 7, 7, 4]);

        await page.goto(PERCORSO_UTENTI);
        await impostaProfiloOrario(page, utente.email, nomeProfilo);

        await page.goto(PERCORSO_ORE_LAVORO);
        await expect(oreOrdinarieGiorno(page, 0)).toHaveText('7h');
        await expect(oreOrdinarieGiorno(page, 4)).toHaveText('4h');
        await expect(campoGiorno(page, 'Ore ordinarie', 'Lunedì')).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Copia/ })).toHaveCount(0);

        // Il valore previsto resta visibile come testo statico, mai
        // dentro un campo (scenario "il profilo orario resta sempre
        // visibile come riferimento statico").
        await expect(page.getByText('Previsto: 7h', { exact: false }).first()).toBeVisible();

        // Scenario "la differenza ore aggiorna il totale erogato e il
        // colore della card": con differenza 0 totale = ordinarie e
        // segnale testuale "come previsto" (card verde); con una
        // differenza il totale cambia e il testo dice quante ore in
        // più/meno (card rossa); l'intestazione non cambia.
        await expect(campoGiorno(page, 'Differenza ore', 'Lunedì')).toHaveValue('0');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('7h');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('Ore come previsto');
        await expect(campoGiorno(page, 'Motivo', 'Lunedì')).toHaveCount(0);
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('2');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('9h');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('2h in più del previsto');
        await expect(campoGiorno(page, 'Motivo', 'Lunedì')).toBeVisible();
        await page.getByRole('button', { name: "Un quarto d'ora in meno Lunedì" }).click();
        await expect(campoGiorno(page, 'Differenza ore', 'Lunedì')).toHaveValue('1.75');
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('-1');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('6h');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('1h in meno del previsto');
        await nessunaViolazioneA11yGrave(page);
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('0');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('Ore come previsto');
        await expect(campoGiorno(page, 'Motivo', 'Lunedì')).toHaveCount(0);
        await expect(campoGiorno(page, 'Stato', 'Lunedì')).toBeVisible();

        // La scheda mostra ore previste e differenza ore, in un riquadro
        // separato dai singoli giorni (scenario "la scheda della
        // settimana mostra ore previste e differenza ore") — valori
        // letti, non fissati: dipendono dallo storico della settimana
        // sull'account di test condiviso. Nessuna distinzione
        // ordinarie/straordinarie.
        await expect(oreInRiquadro(page, 'Ore previste')).toContainText(/[0-9]+([.][0-9]+)?h/);
        await expect(oreInRiquadro(page, 'Differenza ore')).toContainText(/[+-]?[0-9]+([.][0-9]+)?h/);
        await expect(page.getByText('Ore ordinarie erogate:', { exact: false })).toHaveCount(0);
        await expect(page.getByText('Ore straordinarie erogate:', { exact: false })).toHaveCount(0);

        // Scenario "il riepilogo si aggiorna con quanto digitato, prima
        // di salvare": la differenza della settimana segue la card.
        const differenzaSettimana = async () =>
          Number(
            ((await oreInRiquadro(page, 'Differenza ore').textContent()) ?? '').match(
              /Differenza ore: *([+-]?[0-9]+(?:[.][0-9]+)?)h/
            )![1]
          );
        const differenzaPrima = await differenzaSettimana();
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('1.5');
        await expect.poll(differenzaSettimana).toBe(differenzaPrima + 1.5);
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('0');
        await expect.poll(differenzaSettimana).toBe(differenzaPrima);

        // specs/19, "la conferma della settimana non tocca il monte ore":
        // il monte ore è gestito a mano dall'admin, quindi non compare
        // più alcuna anteprima del suo effetto.
        await expect(page.getByText('A settimana confermata:', { exact: false })).toHaveCount(0);
        await expect(page.getByText('sul monte ore', { exact: false })).toHaveCount(0);

        // Differenza senza motivo: rifiutata, nessuna scrittura
        // (scenario "una differenza diversa da zero richiede un motivo").
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('2');
        await bottoneSalvaModifiche(page).click();
        await expect(popupErrore(page, 'Settimana non salvata')).toContainText('motivo');
        await chiudiPopupErrore(popupErrore(page, 'Settimana non salvata'));

        // Scenari "un errore di validazione al salvataggio apre un popup
        // bloccante con l'elenco delle incongruenze" e "il popup di errore
        // si chiude con il pulsante o con Esc e riporta al form": due
        // giorni incompleti (lunedì senza motivo, martedì malattia senza
        // codice) => UNA finestra con titolo, avviso che nulla è stato
        // salvato e DUE voci; il form resta compilato.
        await campoGiorno(page, 'Stato', 'Martedì').selectOption('malattia');
        await bottoneSalvaModifiche(page).click();
        const popup = popupErrore(page, 'Settimana non salvata');
        await expect(popup).toBeVisible();
        await expect(popup).toContainText('nessuna modifica');
        const voci = popup.getByRole('listitem');
        await expect(voci).toHaveCount(2);
        await expect(voci.nth(0)).toContainText('motivo');
        await expect(voci.nth(1)).toContainText('codice malattia');
        expect((await popup.getByRole('button', { name: 'Chiudi e correggi' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await nessunaViolazioneA11yGrave(page);
        // Bloccante: un tocco fuori dalla finestra non la chiude...
        await page.mouse.click(2, 2);
        await expect(popup).toBeVisible();
        // ...Esc sì, e il focus torna al pulsante di salvataggio.
        await page.keyboard.press('Escape');
        await expect(popup).toBeHidden();
        await expect(bottoneSalvaModifiche(page)).toBeFocused();
        // I dati compilati non sono andati persi.
        await expect(campoGiorno(page, 'Differenza ore', 'Lunedì')).toHaveValue('2');
        await expect(campoGiorno(page, 'Stato', 'Martedì')).toHaveValue('malattia');
        // Riaprire il popup è solo questione di salvare di nuovo (stesso
        // elenco), e si chiude anche con il pulsante.
        await bottoneSalvaModifiche(page).click();
        await expect(popup).toBeVisible();
        await expect(voci).toHaveCount(2);
        await chiudiPopupErrore(popup);
        await campoGiorno(page, 'Stato', 'Martedì').selectOption('lavorativo');

        // Scenario "le ore ammettono solo multipli di un quarto d'ora e
        // il totale non è mai negativo": validazione lato server.
        await disattivaValidazioneNativa(page);
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('0.2');
        await campoGiorno(page, 'Motivo', 'Lunedì').fill('Prova E2E');
        await bottoneSalvaModifiche(page).click();
        await expect(popupErrore(page, 'Settimana non salvata')).toContainText("quarto d'ora");
        await chiudiPopupErrore(popupErrore(page, 'Settimana non salvata'));
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('-8');
        await bottoneSalvaModifiche(page).click();
        await expect(popupErrore(page, 'Settimana non salvata')).toContainText('negativo');
        await chiudiPopupErrore(popupErrore(page, 'Settimana non salvata'));

        // Scenario "i dati storici non a quarti d'ora sono mostrati
        // arrotondati e non vengono modificati finché non si salva": non
        // simulabile via UI (il server rifiuta i valori non a quarti
        // d'ora e l'e2e non ha accesso al DB con dati arbitrari); la
        // logica di arrotondamento è coperta da lib/oreLavoro.test.ts
        // (arrotondaAQuartiDora) e la pagina la applica in lettura.

        // Differenza negativa valida: salvata come ordinarie ridotte,
        // riletta come stessa differenza (scenario "la differenza è
        // salvata nei dati esistenti senza cambiare monte ore e report").
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('-0.5');
        await campoGiorno(page, 'Motivo', 'Lunedì').fill('Uscita anticipata E2E');
        await clickEAttendiAzione(page, bottoneSalvaModifiche(page));
        await expect(alertApp(page)).toHaveCount(0);
        // Scenario "se il salvataggio va a buon fine non compare alcun popup".
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(campoGiorno(page, 'Differenza ore', 'Lunedì')).toHaveValue('-0.5');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('6.5h');
        await expect(oreOrdinarieGiorno(page, 0)).toHaveText('7h');

        // Con il motivo: accettato, il totale della settimana si aggiorna.
        // Il form invia sempre tutti e 7 i giorni in un solo
        // salvataggio: se oggi non è domenica, questo submit include
        // anche giorni non ancora accaduti della stessa settimana, e
        // deve comunque andare a buon fine (scenario "salvare le ore
        // anche a metà settimana" — bug: un trigger sul database
        // rifiutava erroneamente qualunque giorno futuro anche dentro
        // la settimana corrente, impedendo di salvare a metà settimana;
        // vedi supabase/migrations/0029_fix_ore_lavoro_vincolo_futuro.sql).
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('2');
        await campoGiorno(page, 'Motivo', 'Lunedì').fill('Riunione E2E');
        await bottoneSalvaModifiche(page).click();
        await expect(alertApp(page)).toHaveCount(0);
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
        await expect(oreInRiquadro(page, 'Differenza ore')).toContainText('+2h', {
          timeout: 20_000,
        });

        // Malattia senza codice: rifiutata.
        await campoGiorno(page, 'Stato', 'Martedì').selectOption('malattia');
        await bottoneSalvaModifiche(page).click();
        await expect(popupErrore(page, 'Settimana non salvata')).toContainText('codice malattia');
        await chiudiPopupErrore(popupErrore(page, 'Settimana non salvata'));

        // Con il codice: accettata, e resta salvata dopo un ricaricamento.
        await campoGiorno(page, 'Stato', 'Martedì').selectOption('malattia');
        await campoGiorno(page, 'Codice malattia', 'Martedì').fill('COD-E2E');
        await clickEAttendiAzione(page, bottoneSalvaModifiche(page));
        await page.reload();
        await expect(campoGiorno(page, 'Stato', 'Martedì')).toHaveValue('malattia');
        await expect(campoGiorno(page, 'Codice malattia', 'Martedì')).toHaveValue('COD-E2E');

        // Assenza senza nota: rifiutata.
        await campoGiorno(page, 'Stato', 'Mercoledì').selectOption('assenza');
        await bottoneSalvaModifiche(page).click();
        await expect(popupErrore(page, 'Settimana non salvata')).toContainText('nota giustificativa');
        await chiudiPopupErrore(popupErrore(page, 'Settimana non salvata'));

        // Con la nota: accettata, e resta salvata dopo un ricaricamento.
        await campoGiorno(page, 'Stato', 'Mercoledì').selectOption('assenza');
        await campoGiorno(page, 'Nota assenza', 'Mercoledì').fill('Visita E2E');
        await clickEAttendiAzione(page, bottoneSalvaModifiche(page));
        await page.reload();
        await expect(campoGiorno(page, 'Stato', 'Mercoledì')).toHaveValue('assenza');
        await expect(campoGiorno(page, 'Nota assenza', 'Mercoledì')).toHaveValue('Visita E2E');

        // Il personale può lavorare anche in un giorno di chiusura
        // (qui sabato, chiusura implicita): cambia lo stato in
        // Lavorativo e l'inserimento è accettato, non bloccato
        // (specs/18, specs/53); lo stato scelto resta dopo il reload.
        await campoGiorno(page, 'Stato', 'Sabato').selectOption('lavorativo');
        await campoGiorno(page, 'Differenza ore', 'Sabato').fill('3');
        await campoGiorno(page, 'Motivo', 'Sabato').fill('Pulizie E2E');
        await clickEAttendiAzione(page, bottoneSalvaModifiche(page));
        await page.reload();
        await expect(campoGiorno(page, 'Stato', 'Sabato')).toHaveValue('lavorativo');
        await expect(campoGiorno(page, 'Differenza ore', 'Sabato')).toHaveValue('3');

        // Scenari "segnare un giorno di ferie" e "Chiusura e Ferie non
        // alterano il monte ore": giovedì (7h previste) in Ferie non ha
        // campi e toglie 7h dalle ore dovute della settimana.
        const oreDovuteLette = async () =>
          Number(((await oreInRiquadro(page, 'Ore previste').textContent()) ?? '').match(/(\d+(?:\.\d+)?)h/)![1]);
        const dovutePrima = await oreDovuteLette();
        await campoGiorno(page, 'Stato', 'Giovedì').selectOption('ferie');
        await expect(campoGiorno(page, 'Differenza ore', 'Giovedì')).toHaveCount(0);
        await expect(page.getByText('non conta nel calcolo del monte ore', { exact: false }).first()).toBeVisible();
        await clickEAttendiAzione(page, bottoneSalvaModifiche(page));
        await page.reload();
        await expect(campoGiorno(page, 'Stato', 'Giovedì')).toHaveValue('ferie');
        await expect(campoGiorno(page, 'Differenza ore', 'Giovedì')).toHaveCount(0);
        await expect.poll(oreDovuteLette).toBe(dovutePrima - 7);
        await nessunaViolazioneA11yGrave(page);

        // --- Navigazione tra settimane (specs/18) ---

        // Sulla settimana corrente non c'è alcun modo di andare oltre
        // (scenario "non è possibile navigare oltre la settimana corrente").
        await expect(linkSettimanaSuccessiva(page)).toHaveCount(0);

        // Un indirizzo diretto verso una settimana futura mostra comunque
        // quella corrente, senza errori (stesso scenario, clamp lato pagina).
        await page.goto('/dashboard/ore-lavoro?settimana=2099-01-05');
        await expect(linkSettimanaSuccessiva(page)).toHaveCount(0);
        await expect(oreOrdinarieGiorno(page, 0)).toHaveText('7h');

        // Scenario "il selettore di data non offre settimane future": la
        // data massima scelta è oggi (fuso Europe/Rome), e il campo con il
        // pulsante "Vai" ha bersagli di almeno 44px.
        const oggiRoma = dataOggiRoma();
        const campoSettimana = page.getByLabel('Vai alla settimana del');
        await expect(campoSettimana).toHaveAttribute('max', oggiRoma);
        const vai = page.getByRole('button', { name: 'Vai', exact: true });
        expect((await campoSettimana.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect((await vai.boundingBox())!.height).toBeGreaterThanOrEqual(44);

        // Scenario "saltare a una settimana qualunque con il selettore di
        // data": un mercoledì qualunque porta al lunedì della sua
        // settimana (2024-03-13 -> 2024-03-11), e il campo mostra quel lunedì.
        await campoSettimana.fill('2024-03-13');
        await vai.click();
        await page.waitForURL(/settimana=2024-03-11(&|$)/);
        await expect(campoSettimana).toHaveValue('2024-03-11');
        await expect(page.getByText(/11 mar\.? – 17 mar/).first()).toBeVisible();
        await nessunaViolazioneA11yGrave(page);

        // Una data passata non lunedì in query string porta alla sua
        // settimana; una data non valida mostra la settimana corrente.
        await page.goto('/dashboard/ore-lavoro?settimana=2024-03-13');
        await page.waitForURL(/settimana=2024-03-11(&|$)/);
        await page.goto('/dashboard/ore-lavoro?settimana=2024-02-31');
        await expect(linkSettimanaSuccessiva(page)).toHaveCount(0);

        // "←" porta alla settimana precedente, con gli stessi dati
        // (precaricati dal profilo orario dove non ho ancora salvato
        // nulla per quella settimana) — scenario "navigare a una
        // settimana passata".
        await page.goto(PERCORSO_ORE_LAVORO);
        await linkSettimanaPrecedente(page).click();
        await page.waitForURL(/settimana=\d{4}-\d{2}-\d{2}/);
        await expect(linkSettimanaSuccessiva(page)).toBeVisible();
        await nessunaViolazioneA11yGrave(page);

        // Scenario "modificare o confermare una settimana passata non
        // ancora confermata": stesso comportamento della settimana
        // corrente (l'utente è nuovo: nessuna settimana è già confermata).
        await expect(campoGiorno(page, 'Differenza ore', 'Lunedì')).toBeEditable();
        await campoGiorno(page, 'Differenza ore', 'Lunedì').fill('1');
        await campoGiorno(page, 'Motivo', 'Lunedì').fill('Prova E2E');
        await clickEAttendiAzione(page, bottoneSalvaModifiche(page));
        await page.reload();
        await expect(campoGiorno(page, 'Differenza ore', 'Lunedì')).toHaveValue('1');

        await bottoneConfermaSettimana(page).click();
        await expect(
          page.getByText('Da questo momento non potrai più modificarle', { exact: false })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Annulla' }).click();

        // "→" torna verso la settimana corrente (scenario "tornare
        // verso la settimana corrente"): il pulsante "→" scompare di
        // nuovo una volta tornati sulla settimana corrente.
        await linkSettimanaSuccessiva(page).click();
        await expect(linkSettimanaSuccessiva(page)).toHaveCount(0);

        // "Conferma settimana" chiede conferma esplicita: verifico solo
        // che il dialogo compaia e che "Annulla" non confermi nulla (non
        // premo mai "Sì", vedi nota in testa al file).
        await bottoneConfermaSettimana(page).click();
        await expect(
          page.getByText('Da questo momento non potrai più modificarle', { exact: false })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Annulla' }).click();
        await expect(bottoneSalvaModifiche(page)).toBeVisible();
      } finally {
        // Pulizia: elimino il profilo di test. L'utente e le sue ore settimanali
        // vengono eliminati dalla fixture (e2e/fixture-utente.ts).
        await eliminaProfiloOrarioSeEsiste(page, nomeProfilo);
      }
    });
  });

  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('senza abilitazione, /dashboard/ore-lavoro reindirizza alla dashboard', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await page.goto(PERCORSO_ORE_LAVORO);
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    // Scenario "il PDF mensile è riservato all'admin" (anche con `utente`).
    test('il PDF mensile del personale reindirizza alla dashboard', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await page.goto('/admin/ore-lavoro/pdf');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    test('il PDF di un singolo dipendente reindirizza alla dashboard', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await page.goto('/admin/ore-lavoro/pdf?utente=00000000-0000-0000-0000-000000000000');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    // Scenario "la vista mensile è riservata all'admin".
    test('la vista mensile reindirizza alla dashboard', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await page.goto('/dashboard/ore-lavoro/mese');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });
  });

  // Amministrazione (specs/18, sezione "Amministrazione"): l'admin può
  // rivedere/correggere le ore di chiunque sia abilitato, anche una
  // settimana già confermata. Ogni test crea un "dipendente" di prova
  // (maestra già abilitata, e2e/fixture-utente.ts) che la fixture elimina
  // a fine test. Sulla settimana corrente non preme mai "Sì" su "Conferma
  // settimana" né "Salva modifiche" sui dati del dipendente — verifica solo
  // che i controlli siano presenti/editabili.
  test.describe('amministrazione: rivedere/correggere le ore di un dipendente', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    // Scenario "l'admin genera e scarica il PDF mensile del personale":
    // il file viene scaricato direttamente (nessuna email) ed è un PDF vero.
    test('genera e scarica il PDF mensile del personale sotto l\'elenco', async ({ page }) => {
      await page.goto(PERCORSO_ELENCO_ORE_LAVORO);
      await expect(page.getByRole('button', { name: 'Genera PDF mensile' })).toBeVisible();
      await nessunaViolazioneA11yGrave(page);

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 60_000 }),
        page.getByRole('button', { name: 'Genera PDF mensile' }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^ore-lavoro-[0-9]{4}-[0-9]{2}[.]pdf$/);

      const flusso = await download.createReadStream();
      const pezzi: Buffer[] = [];
      for await (const pezzo of flusso) pezzi.push(pezzo as Buffer);
      const contenuto = Buffer.concat(pezzi);
      expect(contenuto.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(contenuto.length).toBeGreaterThan(500);
    });

    test('elenco, apertura, navigazione e correzione delle ore di un dipendente abilitato', async ({
      page,
      creaUtente,
    }) => {
      const dipendente = await creaUtente({ ruolo: 'maestra', abilitato: true });

      // Scenario: l'admin apre l'elenco del personale abilitato.
      await page.goto(PERCORSO_ELENCO_ORE_LAVORO);
      const rigaDipendente = rigaUtente(page, dipendente.email);
      await expect(rigaDipendente).toBeVisible();
      await expect(rigaDipendente).toContainText(/Settimana corrente (non )?confermata/);
      await nessunaViolazioneA11yGrave(page);

      // Scenario: l'admin apre un dipendente e vede per prima la vista
      // mensile — vale anche se il profilo admin non è personalmente
      // abilitato (nessun redirect alla dashboard).
      await rigaDipendente.getByRole('link').click();
      await page.waitForURL(/\/dashboard\/ore-lavoro\/mese\?utente=.+/);
      await expect(titoloOreLavoroDipendente(page)).toContainText('—');
      await expect(page.getByRole('link', { name: /Torna all.elenco del personale/ })).toBeVisible();
      const selettore = page.getByRole('navigation', { name: 'Vista ore di lavoro' });
      await expect(selettore.getByRole('link', { name: 'Mese' })).toHaveAttribute('aria-current', 'page');

      // Scenario: la vista mensile mostra i giorni del mese e i totali.
      const giorniMese = page.getByRole('list', { name: 'Giorni del mese' }).getByRole('listitem');
      expect(await giorniMese.count()).toBeGreaterThanOrEqual(28);
      await expect(oreInRiquadro(page, 'Ore previste')).toContainText(/[0-9]+([.][0-9]+)?h/);
      await expect(oreInRiquadro(page, 'Differenza ore')).toContainText(/[+-]?[0-9]+([.][0-9]+)?h/);
      await expect(testoSaldoMonteOre(page)).toBeVisible();
      await expect(page.getByText('Settimane del mese')).toBeVisible();
      await nessunaViolazioneA11yGrave(page);

      // Scenario: l'admin scarica il PDF del mese di un singolo dipendente
      // (pulsante "Scarica PDF" nella barra del mese, bersaglio >= 44px).
      const utenteInUrl = new URL(page.url()).searchParams.get('utente')!;
      const scarica = page.getByRole('link', { name: 'Scarica PDF' });
      await expect(scarica).toBeVisible();
      expect((await scarica.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const [downloadSingolo] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), scarica.click()]);
      expect(downloadSingolo.suggestedFilename()).toMatch(/^ore-lavoro-[0-9]{4}-[0-9]{2}-[a-z0-9-]+[.]pdf$/);
      const pezziSingolo: Buffer[] = [];
      for await (const pezzo of await downloadSingolo.createReadStream()) pezziSingolo.push(pezzo as Buffer);
      const pdfSingolo = Buffer.concat(pezziSingolo);
      expect(pdfSingolo.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(pdfSingolo.length).toBeGreaterThan(500);

      // Un 'utente' non valido, o non abilitato, non produce alcun PDF.
      const nonValido = await page.request.get('/admin/ore-lavoro/pdf?utente=non-un-uuid');
      expect(nonValido.status()).toBe(404);
      const inesistente = await page.request.get('/admin/ore-lavoro/pdf?utente=00000000-0000-0000-0000-000000000000');
      expect(inesistente.status()).toBe(404);

      // Scenario: navigare tra i mesi — l'utente resta nell'URL e sul
      // mese corrente non c'è "Mese successivo".
      await expect(page.getByRole('link', { name: 'Mese successivo' })).toHaveCount(0);
      await page.getByRole('link', { name: 'Mese precedente' }).click();
      await page.waitForURL(/mese=[0-9]{4}-[0-9]{2}&utente=.+/);
      await expect(page.getByRole('link', { name: 'Mese successivo' })).toBeVisible();
      await expect(titoloOreLavoroDipendente(page)).toContainText('—');

      // Un mese futuro in query string mostra il mese corrente.
      await page.goto(`/dashboard/ore-lavoro/mese?mese=2099-01&utente=${utenteInUrl}`);
      await expect(page.getByRole('link', { name: 'Mese successivo' })).toHaveCount(0);

      // Scenario: passare tra vista mensile e settimanale, e ritorno.
      await page.getByRole('navigation', { name: 'Vista ore di lavoro' }).getByRole('link', { name: 'Settimana' }).click();
      await page.waitForURL(/\/dashboard\/ore-lavoro\?settimana=[0-9]{4}-[0-9]{2}-[0-9]{2}&utente=.+/);
      await expect(titoloOreLavoroDipendente(page)).toContainText('—');
      await nessunaViolazioneA11yGrave(page);

      // Il riquadro ore previste/differenza è visibile anche da qui
      // (specs/18: "per ogni vista"), non solo dalla vista personale.
      await expect(oreInRiquadro(page, 'Ore previste')).toBeVisible();

      const url = new URL(page.url());
      const utenteId = url.searchParams.get('utente')!;

      const giaConfermata = (await avvisoSettimanaConfermata(page).count()) > 0;
      if (giaConfermata) {
        // Scenario: l'admin modifica le ore di un dipendente, anche
        // se la settimana è già confermata — a differenza della
        // vista del diretto interessato (sola lettura), l'admin vede
        // comunque i campi modificabili.
        await expect(bottoneSalvaModifiche(page)).toBeVisible();
        await expect(campoGiorno(page, 'Differenza ore', 'Lunedì')).toBeEditable();
        await expect(campoGiorno(page, 'Ore ordinarie', 'Lunedì')).toHaveCount(0);
        await expect(page.getByText('Puoi comunque correggerla qui sotto', { exact: false })).toBeVisible();
      } else {
        // Scenario: l'admin conferma per conto di un dipendente una
        // settimana non ancora confermata — verifico solo che il
        // dialogo compaia con il testo corretto, senza confermare
        // per davvero.
        await expect(bottoneSalvaModifiche(page)).toBeVisible();
        await bottoneConfermaSettimana(page).click();
        await expect(page.getByText('Confermi le ore di questa settimana per', { exact: false })).toBeVisible();
        await page.getByRole('button', { name: 'Annulla' }).click();
      }

      // Scenario "il riepilogo si aggiorna con quanto digitato" (anche
      // per una settimana confermata e corretta dall'admin, #151):
      // "Differenza ore" del riquadro è la somma delle differenze dei
      // giorni mostrati nelle card, mai un valore congelato alla
      // conferma.
      const campiDifferenza = page.getByLabel(/^Differenza ore (Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica)$/);
      const valoriDifferenza = await campiDifferenza.evaluateAll((els) => els.map((el) => Number((el as HTMLInputElement).value)));
      const sommaDifferenze = Math.round(valoriDifferenza.reduce((t, v) => t + v, 0) * 100) / 100;
      const testoDifferenza = (await oreInRiquadro(page, 'Differenza ore').textContent()) ?? '';
      const differenzaRiquadro = Number(testoDifferenza.match(/Differenza ore: *([+-]?[0-9]+(?:[.][0-9]+)?)h/)![1]);
      expect(differenzaRiquadro).toBe(sommaDifferenze);

      // Scenario: l'admin naviga tra le settimane di un dipendente —
      // resta sulle ore della stessa persona (il parametro `utente`
      // resta nell'URL).
      await linkSettimanaPrecedente(page).click();
      await page.waitForURL(new RegExp(`settimana=\\d{4}-\\d{2}-\\d{2}&utente=${utenteId}`));
      await expect(titoloOreLavoroDipendente(page)).toContainText('—');

      // Scenario: l'admin naviga con il selettore di data — `utente`
      // resta nell'indirizzo, stessa persona.
      await page.getByLabel('Vai alla settimana del').fill('2024-03-13');
      await page.getByRole('button', { name: 'Vai', exact: true }).click();
      await page.waitForURL(new RegExp(`settimana=2024-03-11&utente=${utenteId}`));
      await expect(titoloOreLavoroDipendente(page)).toContainText('—');
      await expect(page.getByLabel('Vai alla settimana del')).toHaveValue('2024-03-11');

      // Scenario: un parametro `utente` non valido viene ignorato —
      // torno a vedere le mie proprie ore (che, essendo io admin non
      // abilitato personalmente in questo test, mi reindirizzano alla
      // dashboard esattamente come senza alcun parametro).
      await page.goto('/dashboard/ore-lavoro?utente=00000000-0000-0000-0000-000000000000');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    // Regressione (0030_profili_orari_self_select.sql): la policy RLS
    // di profili_orari, scritta come "solo admin" quando la tabella non
    // era ancora usata da nessuna pagina (specs/54), bloccava
    // silenziosamente la lettura anche per il DIRETTO interessato una
    // volta che 0025_report_ore_lavoro.sql l'ha resa necessaria per il
    // precaricamento (specs/18) — nessun errore, solo "0 ore ordinarie"
    // sempre, per chiunque non fosse admin. L'unico altro test che
    // verifica il precaricamento ('form settimanale: precaricamento dal
    // profilo orario...' sopra) gira con l'account admin, a cui la
    // vecchia policy già permetteva la lettura, quindi non lo
    // intercettava.
    test('un profilo orario assegnato dall\'admin precarica le ore ordinarie anche per chi non è admin', async ({
      page,
      creaUtente,
      apriComeUtente,
    }) => {
      const nomeProfilo = `E2E ore lavoro maestra ${Date.now()}`;

      await creaProfiloOrario(page, nomeProfilo, [6, 6, 6, 6, 3]);

      const dipendente = await creaUtente({ ruolo: 'maestra', abilitato: true });
      await page.goto(PERCORSO_UTENTI);
      await impostaProfiloOrario(page, dipendente.email, nomeProfilo);

      try {
        const paginaMaestra = await apriComeUtente(dipendente);
        await paginaMaestra.goto(PERCORSO_ORE_LAVORO);
        await expect(oreOrdinarieGiorno(paginaMaestra, 0)).toHaveText('6h');
        await expect(oreOrdinarieGiorno(paginaMaestra, 4)).toHaveText('3h');
        // Sabato (chiusura implicita) parte in Chiusura, senza ore previste da mostrare.
        await expect(campoGiorno(paginaMaestra, 'Stato', 'Sabato')).toHaveValue('chiusura');
      } finally {
        // L'utente è eliminato dalla fixture; qui resta solo il profilo di test.
        await eliminaProfiloOrarioSeEsiste(page, nomeProfilo);
      }
    });

    // Scenari "l'admin riapre una settimana già confermata" e "solo l'admin
    // può riaprire una settimana" (issue #90). Usa una settimana lontana
    // nel passato (10 settimane fa), per non toccare quella corrente su cui
    // lavorano gli altri test, e la lascia riaperta (non confermata).
    test("l'admin riapre una settimana confermata; la maestra non può e torna a poterla modificare", async ({
      page,
      creaUtente,
      apriComeUtente,
    }) => {
      // "Oggi" nel fuso Europe/Rome, non UTC (#163).
      const lunedi = lunediDellaSettimana(dataFraGiorni(-70));

      const dipendente = await creaUtente({ ruolo: 'maestra', abilitato: true });

      const utenteId = await apriOreDipendente(page, dipendente.email);
      const urlAdmin = urlOreLavoro(lunedi, utenteId);
      const urlMaestra = urlOreLavoro(lunedi);

      // Parto da una settimana confermata (la confermo se serve).
      await page.goto(urlAdmin);
      if ((await bottoneRiapriSettimana(page).count()) === 0) {
        await bottoneConfermaSettimana(page).click();
        await page.getByRole('button', { name: 'Sì', exact: true }).click();
      }
      await expect(avvisoSettimanaConfermata(page)).toBeVisible({ timeout: 20_000 });
      await nessunaViolazioneA11yGrave(page);

      // La maestra la vede di sola lettura, senza alcun "Riapri settimana".
      const paginaMaestra = await apriComeUtente(dipendente);
      await paginaMaestra.goto(urlMaestra);
      await expect(avvisoSettimanaConfermata(paginaMaestra)).toBeVisible();
      await expect(bottoneSalvaModifiche(paginaMaestra)).toHaveCount(0);
      await expect(bottoneRiapriSettimana(paginaMaestra)).toHaveCount(0);

      // L'admin riapre: prima chiede conferma (Annulla non cambia nulla)...
      await bottoneRiapriSettimana(page).click();
      await expect(page.getByText('Riaprire la settimana', { exact: false })).toBeVisible();
      await page.getByRole('button', { name: 'Annulla' }).click();
      await expect(avvisoSettimanaConfermata(page)).toBeVisible();

      // ...poi riapre davvero.
      await bottoneRiapriSettimana(page).click();
      await page.getByRole('button', { name: 'Sì, riapri' }).click();
      await expect(avvisoSettimanaConfermata(page)).toHaveCount(0, { timeout: 20_000 });
      await expect(bottoneConfermaSettimana(page)).toBeVisible();

      // La maestra può di nuovo modificarla (e deve riconfermarla).
      await paginaMaestra.goto(urlMaestra);
      await expect(bottoneSalvaModifiche(paginaMaestra)).toBeVisible();
      await expect(bottoneConfermaSettimana(paginaMaestra)).toBeVisible();
    });

    // Scenario "una conferma settimana che fallisce apre un popup bloccante"
    // (issue #189). Usa una settimana lontana (11 settimane fa, diversa da
    // quella del test di riapertura, per non contendersi lo stesso stato) e
    // la lascia non confermata. La maestra apre la pagina quando la settimana
    // è ancora da confermare; poi l'admin la conferma; la conferma della
    // maestra, ormai superata, fallisce con "già confermata".
    test('una conferma settimana che fallisce apre il popup bloccante "Settimana non confermata"', async ({
      page,
      creaUtente,
      apriComeUtente,
    }) => {
      const lunedi = lunediDellaSettimana(dataFraGiorni(-77));

      const dipendente = await creaUtente({ ruolo: 'maestra', abilitato: true });

      const utenteId = await apriOreDipendente(page, dipendente.email);
      const urlAdmin = urlOreLavoro(lunedi, utenteId);

      // Parto da una settimana non confermata (la riapro se serve).
      await page.goto(urlAdmin);
      if ((await bottoneRiapriSettimana(page).count()) > 0) {
        await bottoneRiapriSettimana(page).click();
        await clickEAttendiAzione(page, page.getByRole('button', { name: 'Sì, riapri' }));
      }
      await expect(bottoneConfermaSettimana(page)).toBeVisible({ timeout: 20_000 });

      const paginaMaestra = await apriComeUtente(dipendente);
      await paginaMaestra.goto(urlOreLavoro(lunedi));
      await expect(bottoneConfermaSettimana(paginaMaestra)).toBeVisible();

      // L'admin conferma per conto della maestra.
      await bottoneConfermaSettimana(page).click();
      await clickEAttendiAzione(page, page.getByRole('button', { name: 'Sì', exact: true }));
      await expect(avvisoSettimanaConfermata(page)).toBeVisible({ timeout: 20_000 });

      // La pagina della maestra è rimasta indietro: la sua conferma fallisce.
      await bottoneConfermaSettimana(paginaMaestra).click();
      await clickEAttendiAzione(paginaMaestra, paginaMaestra.getByRole('button', { name: 'Sì', exact: true }));
      const popup = popupErrore(paginaMaestra, 'Settimana non confermata');
      await expect(popup).toBeVisible();
      await expect(popup).toContainText('già confermata');
      await nessunaViolazioneA11yGrave(paginaMaestra);

      // Si chiude con Esc e la pagina torna utilizzabile.
      await paginaMaestra.keyboard.press('Escape');
      await expect(popup).toBeHidden();
      await expect(paginaMaestra.getByRole('button', { name: 'Annulla' })).toBeVisible();
    });

    test('un parametro utente usato da chi non è admin viene ignorato', async ({ creaUtente, apriComeUtente }) => {
      const dipendente = await creaUtente({ ruolo: 'maestra', abilitato: true });

      const paginaMaestra = await apriComeUtente(dipendente);
      // Un id qualunque diverso dal proprio: una maestra non deve mai
      // vedere le ore di qualcun altro, nemmeno forzando l'URL.
      await paginaMaestra.goto('/dashboard/ore-lavoro?utente=00000000-0000-0000-0000-000000000000');
      await expect(titoloOreLavoro(paginaMaestra)).toBeVisible();
      await expect(titoloOreLavoroDipendente(paginaMaestra)).not.toContainText('—');
      await expect(paginaMaestra.getByRole('link', { name: 'Torna alla dashboard' })).toBeVisible();
    });
  });
});
