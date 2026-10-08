// Requisito: specs/19 - monte-ore.md
//
// Il monte ore è gestito a mano dall'admin (nessun calcolo automatico alla
// conferma della settimana): la suite e2e qui sotto NON preme mai per
// davvero "Conferma settimana" (irreversibile sull'account condiviso,
// stessa cautela di 18-report-ore-lavoro.spec.ts), quindi lo scenario
// "la conferma della settimana non tocca il monte ore" è coperto da
// 18-report-ore-lavoro.spec.ts (nessuna anteprima dell'effetto) e dalle
// server action, che non inseriscono più alcun movimento. Per lo stesso
// motivo restano coperti solo da unit test gli scenari "storici"
// (straordinario residuo di settimane già confermate).
// Copre invece ciò che i unit test non possono: visibilità del saldo e del
// calcolo mese per mese per ruolo, validazione del form di movimento,
// inserimento, modifica ed eliminazione di un movimento da parte
// dell'admin, e che il saldo si aggiorna davvero dopo un salvataggio.
//
// Dati propri (issue #230): ogni test lavora su un dipendente creato apposta,
// già abilitato alle ore di lavoro (e2e/fixture-utente.ts), ed eliminato a fine
// test insieme ai suoi movimenti: nessun flag degli account condivisi viene
// toccato e nessun movimento va compensato.
import { test, expect } from './fixture-utente';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione, alertApp, clickEAttendiAzione } from './helpers';
import {
  apriModificaMovimento,
  bottoneEliminaMovimento,
  bottoneRegistraMovimento,
  bottoneSalvaModificaMovimento,
  campoNotaMovimento,
  campoOreMovimento,
  compilaMovimento,
  formMovimento,
  leggiSaldoMonteOre,
  registraMovimento,
  rigaMovimento,
  selectVersoMovimento,
  testoSaldoMonteOre,
  titoloCalcoloMesePerMese,
} from './pagina-monte-ore';
import { apriOreDipendente, PERCORSO_ELENCO_ORE_LAVORO, PERCORSO_ORE_LAVORO, rigaUtente } from './pagina-personale';

test.describe('19 — Monte ore', () => {
  test.describe('il diretto interessato vede il proprio saldo, in sola lettura', () => {
    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('la maestra vede "Monte ore attuale" ma nessun form per modificarlo', async ({
      creaUtente,
      apriComeUtente,
    }) => {
      const maestra = await creaUtente({ ruolo: 'maestra', abilitato: true });
      const paginaMaestra = await apriComeUtente(maestra);
      await paginaMaestra.goto(PERCORSO_ORE_LAVORO);

      await expect(testoSaldoMonteOre(paginaMaestra)).toBeVisible();
      // Scenario: la scheda ore mostra il calcolo mese per mese, in sola
      // lettura (nessun pulsante di modifica/eliminazione dei movimenti).
      await expect(titoloCalcoloMesePerMese(paginaMaestra)).toBeVisible();
      await expect(apriModificaMovimento(paginaMaestra)).toHaveCount(0);
      await expect(bottoneEliminaMovimento(paginaMaestra)).toHaveCount(0);
      await expect(paginaMaestra.getByLabel('Nota', { exact: true })).toHaveCount(0);
      await expect(bottoneRegistraMovimento(paginaMaestra)).toHaveCount(0);

      await nessunaViolazioneA11yGrave(paginaMaestra);
    });
  });

  test.describe('amministrazione: saldo e movimenti manuali di un dipendente', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('elenco con saldo, movimento senza nota rifiutato, movimento manuale registrato e riflesso nel saldo', async ({
      page,
      creaUtente,
    }) => {
      // Scenario lungo (creazione del dipendente, più movimenti con
      // salvataggio e ricarica): supera i 60s di default senza essere
      // bloccato su nessun passo (issue #70).
      test.slow();
      const dipendente = await creaUtente({ ruolo: 'maestra', abilitato: true });

      // Scenario: l'admin vede il monte ore di ciascuna persona
      // nell'elenco del personale abilitato.
      await page.goto(PERCORSO_ELENCO_ORE_LAVORO);
      const rigaDipendente = rigaUtente(page, dipendente.email);
      // Convenzione del segno (specs/19): saldo con segno esplicito e
      // significato, mai un numero nudo.
      await expect(rigaDipendente).toContainText(/Monte ore: [+-]?[0-9]+([.][0-9]+)?h (a credito|da recuperare|in pari)/);

      await rigaDipendente.getByRole('link').click();
      // L'elenco apre la vista mensile (specs/18), dove l'admin gestisce
      // il monte ore del dipendente (specs/19).
      await page.waitForURL(/\/dashboard\/ore-lavoro\/mese\?utente=.+/);
      await expect(testoSaldoMonteOre(page)).toBeVisible();
      await nessunaViolazioneA11yGrave(page);

      // Il saldo si aggiorna quando la pagina ricarica i dati dopo la
      // Server Action, non all'arrivo della sua risposta: lo leggo con
      // expect.poll, che riprova finché non vale quanto atteso (#70).
      const leggiSaldo = () => leggiSaldoMonteOre(page);
      const saldoIniziale = await leggiSaldo();
      expect(Number.isFinite(saldoIniziale)).toBe(true);

      // Label non equivoche: legenda del segno e nessun verso preselezionato.
      await expect(page.getByText('Positivo (+): ore già erogate in più, a credito', { exact: false })).toBeVisible();
      await expect(selectVersoMovimento(formMovimento(page))).toHaveValue('');
      await compilaMovimento(page, { ore: '1', nota: 'Senza verso E2E' });
      await registraMovimento(page);
      await expect(alertApp(page)).toContainText('Scegli');
      // Il form non si azzera su un errore: svuoto la nota per il passo
      // successivo ("senza nota").
      await compilaMovimento(page, { nota: '' });

      // Scenario: un movimento manuale senza nota viene rifiutato.
      await compilaMovimento(page, { ore: '1.5', verso: 'credito' });
      await registraMovimento(page);
      await expect(alertApp(page)).toContainText('nota');

      // Con la nota: accettato, il saldo aumenta di 1.5h e compare
      // nello storico.
      await compilaMovimento(page, { ore: '1.5', verso: 'credito', nota: 'Movimento E2E' });
      await registraMovimento(page);
      await expect(alertApp(page)).toHaveCount(0);
      // .first(): un eventuale retry del test trova anche il movimento
      // registrato dal tentativo precedente.
      await expect(page.getByText('Movimento E2E', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
      await expect.poll(leggiSaldo, { timeout: 20_000 }).toBeCloseTo(saldoIniziale + 1.5, 2);

      // Scenario: il monte ore può risultare negativo, senza alcun
      // blocco — una riduzione ben più grande di qualunque saldo
      // realistico (5000h) porta il saldo sotto zero senza errori.
      await compilaMovimento(page, {
        ore: '5000',
        verso: 'debito',
        nota: 'Riduzione ampia E2E (per testare il saldo negativo)',
      });
      await registraMovimento(page);
      await expect(alertApp(page)).toHaveCount(0);
      await expect.poll(leggiSaldo, { timeout: 20_000 }).toBeCloseTo(saldoIniziale + 1.5 - 5000, 2);
      expect(await leggiSaldo()).toBeLessThan(0);
    });

    test("l'admin modifica ed elimina un movimento di monte ore, e vede il calcolo mese per mese", async ({
      page,
      creaUtente,
    }) => {
      // Scenario lungo (creazione del dipendente, più movimenti con
      // salvataggio e ricarica): supera i 60s di default senza essere
      // bloccato su nessun passo (issue #70).
      test.slow();
      const dipendente = await creaUtente({ ruolo: 'maestra', abilitato: true });

      // L'elenco apre la vista mensile (specs/18), dove l'admin gestisce
      // il monte ore del dipendente (specs/19).
      await apriOreDipendente(page, dipendente.email);

      const saldoIniziale = await leggiSaldoMonteOre(page);

      // Scenario: l'admin modifica un movimento: cambia ore e nota, il
      // saldo si aggiorna e la riga riporta i nuovi valori.
      const notaMovimento = `Movimento E2E da eliminare ${Date.now()}`;
      await compilaMovimento(page, { ore: '2', verso: 'credito', nota: notaMovimento });
      await registraMovimento(page);
      const riga = rigaMovimento(page, notaMovimento);
      await expect(riga).toBeVisible({ timeout: 20_000 });

      const saldoDopoAggiunta = await leggiSaldoMonteOre(page);
      expect(saldoDopoAggiunta).toBeCloseTo(saldoIniziale + 2, 2);

      await apriModificaMovimento(riga).click();
      const notaModificata = `${notaMovimento} (modificato)`;
      await campoOreMovimento(riga).fill('3');
      await campoNotaMovimento(riga).fill(notaModificata);
      await clickEAttendiAzione(page, bottoneSalvaModificaMovimento(riga));
      const rigaModificata = rigaMovimento(page, notaModificata);
      await expect(rigaModificata).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => leggiSaldoMonteOre(page)).toBeCloseTo(saldoIniziale + 3, 2);

      // Scenario: l'admin elimina un movimento di monte ore.
      page.once('dialog', (dialog) => dialog.accept());
      await bottoneEliminaMovimento(rigaModificata).click();
      await expect(rigaMovimento(page, notaMovimento)).toHaveCount(0, { timeout: 20_000 });

      const saldoFinale = await leggiSaldoMonteOre(page);
      expect(saldoFinale).toBeCloseTo(saldoIniziale, 2);

      // Scenario: il calcolo mese per mese è sempre visibile e completo.
      await expect(titoloCalcoloMesePerMese(page)).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });
  });
});
