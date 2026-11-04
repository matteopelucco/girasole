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
import type { Page } from '@playwright/test';
import { test, expect, type UtenteFixture } from './fixture-utente';
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
  PERCORSO_MESE_ORE_LAVORO,
  bottoneConfermaMese,
  bottoneConfermaResidua,
  cellaMovimentiMese,
  cellaSaldoMese,
  dataOggiItaliana,
  leggiOreCella,
  lunediDelMese,
  meseRoma,
  nomeMese,
  registraDifferenzeSettimana,
  rigaMese,
  selectMeseCompetenza,
  testoNonConfermate,
} from './pagina-monte-ore';
import {
  apriOreDipendente,
  creaProfiloOrario,
  eliminaProfiloOrarioSeEsiste,
  impostaProfiloOrario,
  PERCORSO_ELENCO_ORE_LAVORO,
  PERCORSO_ORE_LAVORO,
  PERCORSO_UTENTI,
  rigaUtente,
  type GiornoSettimana,
} from './pagina-personale';

// Differenze ore di una settimana lavorativa che sommano +14.5h (step 0.25).
const GIORNI_PIU_14_5: Partial<Record<GiornoSettimana, string>> = {
  Lunedì: '3',
  Martedì: '3',
  Mercoledì: '3',
  Giovedì: '3',
  Venerdì: '2.5',
};

// Dipendente di prova abilitato alle ore, con le differenze indicate nella
// settimana "tipo" di ciascun mese, poi apre la sua vista mensile come admin.
async function preparaDipendenteConMesi(
  page: Page,
  creaUtente: (opzioni?: { ruolo?: 'maestra'; abilitato?: boolean }) => Promise<UtenteFixture>,
  mesi: { mese: string; giorni: Partial<Record<GiornoSettimana, string>> }[]
) {
  const dipendente = await creaUtente({ ruolo: 'maestra', abilitato: true });
  const utenteId = await apriOreDipendente(page, dipendente.email);
  for (const { mese, giorni } of mesi) await registraDifferenzeSettimana(page, utenteId, lunediDelMese(mese), giorni);
  await apriVistaMensile(page, utenteId);
  return { dipendente, utenteId };
}

async function apriVistaMensile(page: Page, utenteId: string) {
  await page.goto(`${PERCORSO_MESE_ORE_LAVORO}?utente=${utenteId}`);
  await expect(titoloCalcoloMesePerMese(page)).toBeVisible();
}

const notaConferma = (mese: string) => `Conferma differenza ore di ${nomeMese(mese)}`;

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

  // Conferma del mese e mese di competenza (MOR-01..MOR-10). Ogni test lavora
  // su un dipendente proprio con differenze ore registrate nelle settimane del
  // mese scorso (e, dove serve, di due mesi fa) dalla stessa scheda settimanale
  // che usa l'admin. Non si preme mai "Conferma settimana".
  // Non provabili in e2e e coperti altrove (rimandi):
  //  - MOR-06, parte "due admin nello stesso istante" (richieste davvero
  //    simultanee): indice unico in supabase/tests/database/monte_ore_conferma_mese.test.sql;
  //    qui si provano doppio click e conferma "vecchia" di un secondo admin.
  //  - MOR-04, rifiuto lato server di un non admin / di un mese non chiuso: RLS
  //    nello stesso file pgTAP; mese chiuso e parte da registrare in lib (unit
  //    puoConfermareMese / parteNonConfermata / nuovaVariazioneConferma).
  //  - MOR-09, backfill dei movimenti esistenti: pgTAP + db reset della CI;
  //    calcolo identico a prima con competenza vuota: unit calcoloMensileMonteOre.
  //  - MOR-10, email e PDF: usano la stessa somma di tutte le variazioni
  //    (saldiPerUtente, unit); qui si verifica il saldo nell'elenco admin.
  test.describe('conferma del mese di competenza', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('MOR-01: l\'admin vede "Conferma" su un mese chiuso con differenza', async ({ page, creaUtente }) => {
      test.slow();
      const prec = meseRoma(-1);
      await preparaDipendenteConMesi(page, creaUtente, [{ mese: prec, giorni: GIORNI_PIU_14_5 }]);

      const riga = rigaMese(page, prec);
      await expect(riga).toContainText(/\+?14[.,]5h a credito/);
      await expect(bottoneConfermaMese(riga)).toBeVisible();
      expect(await leggiOreCella(cellaMovimentiMese(riga))).toBe(0);
      await nessunaViolazioneA11yGrave(page);
    });

    test('MOR-02: la conferma crea un movimento nel mese di competenza giusto', async ({ page, creaUtente }) => {
      test.slow();
      const prec = meseRoma(-1);
      const corr = meseRoma(0);
      await preparaDipendenteConMesi(page, creaUtente, [{ mese: prec, giorni: GIORNI_PIU_14_5 }]);

      const rigaPrec = rigaMese(page, prec);
      const rigaCorr = rigaMese(page, corr);
      const saldoIniziale = await leggiSaldoMonteOre(page);
      const saldoCorrIniziale = await leggiOreCella(cellaSaldoMese(rigaCorr));

      await clickEAttendiAzione(page, bottoneConfermaMese(rigaPrec));

      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaPrec)), { timeout: 20_000 }).toBe(14.5);
      await expect.poll(() => leggiOreCella(cellaSaldoMese(rigaPrec))).toBe(14.5);
      await expect.poll(() => leggiOreCella(cellaSaldoMese(rigaCorr))).toBeCloseTo(saldoCorrIniziale + 14.5, 2);
      await expect.poll(() => leggiSaldoMonteOre(page)).toBeCloseTo(saldoIniziale + 14.5, 2);
      await expect(bottoneConfermaMese(rigaPrec)).toHaveCount(0);

      // Storico: data reale di oggi e mese di competenza, nota automatica.
      const movimento = rigaMovimento(page, notaConferma(prec));
      await expect(movimento).toBeVisible();
      await expect(movimento).toContainText(dataOggiItaliana());
      await expect(movimento).toContainText(`(competenza ${nomeMese(prec)})`);
      await expect(movimento).toContainText(/\+14[.,]5h a credito/);
      await nessunaViolazioneA11yGrave(page);
    });

    test('MOR-03: conferma di una differenza negativa ("da recuperare")', async ({ page, creaUtente }) => {
      test.slow();
      const prec = meseRoma(-1);
      // Serve un profilo orario con ore previste: la differenza non puo' superare le ore previste.
      const nomeProfilo = `E2E conferma mese ${Date.now()}`;
      await creaProfiloOrario(page, nomeProfilo, [3, 3, 3, 3, 3]);
      try {
        const dipendente = await creaUtente({ ruolo: 'maestra', abilitato: true });
        await page.goto(PERCORSO_UTENTI);
        await impostaProfiloOrario(page, dipendente.email, nomeProfilo);
        const utenteId = await apriOreDipendente(page, dipendente.email);
        await registraDifferenzeSettimana(page, utenteId, lunediDelMese(prec), { Lunedì: '-3', Martedì: '-3' });
        await apriVistaMensile(page, utenteId);

        const riga = rigaMese(page, prec);
        await expect(riga).toContainText(/6h da recuperare/);
        await clickEAttendiAzione(page, bottoneConfermaMese(riga));

        await expect.poll(() => leggiOreCella(cellaMovimentiMese(riga)), { timeout: 20_000 }).toBe(-6);
        await expect.poll(() => leggiSaldoMonteOre(page)).toBeCloseTo(-6, 2);
        await expect(bottoneConfermaMese(riga)).toHaveCount(0);
        const movimento = rigaMovimento(page, notaConferma(prec));
        await expect(movimento).toContainText('da recuperare');
        await expect(movimento).toContainText(`(competenza ${nomeMese(prec)})`);
        await nessunaViolazioneA11yGrave(page);
      } finally {
        await eliminaProfiloOrarioSeEsiste(page, nomeProfilo);
      }
    });

    test('MOR-04: il pulsante non compare per il personale, per il mese in corso e con parte non confermata zero', async ({
      page,
      creaUtente,
      apriComeUtente,
    }) => {
      test.slow();
      const prec = meseRoma(-1);
      const prec2 = meseRoma(-2);
      const corr = meseRoma(0);
      const { dipendente } = await preparaDipendenteConMesi(page, creaUtente, [
        { mese: prec2, giorni: { Lunedì: '2' } },
        { mese: prec, giorni: GIORNI_PIU_14_5 },
      ]);

      // Admin: controllo positivo sul mese scorso, nessun pulsante sul mese in corso.
      await expect(bottoneConfermaMese(rigaMese(page, prec))).toBeVisible();
      await expect(bottoneConfermaMese(rigaMese(page, corr))).toHaveCount(0);

      // Parte non confermata zero: un movimento manuale da +2h con competenza di due mesi fa
      // copre la differenza di quel mese (+2h), quindi niente "Conferma" su quella riga.
      await expect(bottoneConfermaMese(rigaMese(page, prec2))).toBeVisible();
      await compilaMovimento(page, { ore: '2', verso: 'credito', nota: 'Copertura MOR-04', meseCompetenza: prec2 });
      await registraMovimento(page);
      await expect(alertApp(page)).toHaveCount(0);
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec2))), { timeout: 20_000 }).toBe(2);
      await expect(bottoneConfermaMese(rigaMese(page, prec2))).toHaveCount(0);
      await expect(bottoneConfermaMese(rigaMese(page, prec))).toBeVisible();

      // Personale non admin: vede la tabella (con la differenza) ma nessun pulsante.
      const paginaMaestra = await apriComeUtente(dipendente);
      await paginaMaestra.goto(PERCORSO_ORE_LAVORO);
      await expect(titoloCalcoloMesePerMese(paginaMaestra)).toBeVisible();
      await expect(rigaMese(paginaMaestra, prec)).toContainText(/14[.,]5h/);
      await expect(bottoneConfermaMese(paginaMaestra)).toHaveCount(0);
      await expect(bottoneConfermaResidua(paginaMaestra)).toHaveCount(0);
      await nessunaViolazioneA11yGrave(paginaMaestra);
    });

    test('MOR-05: la conferma si modifica ed elimina come ogni movimento; un mese gia\' confermato dà errore', async ({
      page,
      creaUtente,
    }) => {
      test.slow();
      const prec = meseRoma(-1);
      const prec2 = meseRoma(-2);
      await preparaDipendenteConMesi(page, creaUtente, [
        { mese: prec2, giorni: { Lunedì: '2' } },
        { mese: prec, giorni: GIORNI_PIU_14_5 },
      ]);
      await clickEAttendiAzione(page, bottoneConfermaMese(rigaMese(page, prec2)));
      await expect(rigaMovimento(page, notaConferma(prec2))).toBeVisible({ timeout: 20_000 });
      await clickEAttendiAzione(page, bottoneConfermaMese(rigaMese(page, prec)));
      await expect(rigaMovimento(page, notaConferma(prec))).toBeVisible({ timeout: 20_000 });

      // Spostare la conferma di due mesi fa sul mese scorso (che ne ha gia' una): errore, nulla cambia.
      const movimentoVecchio = rigaMovimento(page, notaConferma(prec2));
      await apriModificaMovimento(movimentoVecchio).click();
      await selectMeseCompetenza(movimentoVecchio).selectOption(prec);
      await clickEAttendiAzione(page, bottoneSalvaModificaMovimento(movimentoVecchio));
      await expect(alertApp(page)).toContainText(/confermat/i);
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec2)))).toBe(2);
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec)))).toBe(14.5);

      // Modifica delle ore: la parte non confermata ricompare.
      await page.reload();
      const movimento = rigaMovimento(page, notaConferma(prec));
      await apriModificaMovimento(movimento).click();
      await campoOreMovimento(movimento).fill('10');
      await clickEAttendiAzione(page, bottoneSalvaModificaMovimento(movimento));
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec))), { timeout: 20_000 }).toBe(10);
      await expect(testoNonConfermate(rigaMese(page, prec), '4.5')).toBeVisible();

      // Eliminazione: il pulsante "Conferma" riappare sulla riga di quel mese.
      page.once('dialog', (dialog) => dialog.accept());
      await bottoneEliminaMovimento(rigaMovimento(page, notaConferma(prec))).click();
      await expect(rigaMovimento(page, notaConferma(prec))).toHaveCount(0, { timeout: 20_000 });
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec)))).toBe(0);
      await expect(bottoneConfermaMese(rigaMese(page, prec))).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('MOR-06: doppio click o secondo admin con la pagina vecchia: una sola conferma', async ({ page, creaUtente }) => {
      test.slow();
      const prec = meseRoma(-1);
      const { utenteId } = await preparaDipendenteConMesi(page, creaUtente, [{ mese: prec, giorni: GIORNI_PIU_14_5 }]);

      // Secondo admin: stessa sessione in un'altra scheda, che mostra ancora il pulsante.
      const secondaPagina = await page.context().newPage();
      await apriVistaMensile(secondaPagina, utenteId);
      await expect(bottoneConfermaMese(rigaMese(secondaPagina, prec))).toBeVisible();

      // Doppio click sulla prima scheda.
      await bottoneConfermaMese(rigaMese(page, prec)).dblclick();
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec))), { timeout: 20_000 }).toBe(14.5);
      await expect(rigaMovimento(page, notaConferma(prec))).toHaveCount(1);
      await expect(bottoneConfermaMese(rigaMese(page, prec))).toHaveCount(0);

      // Il secondo admin preme "Conferma" sulla pagina vecchia: nessun errore tecnico, nessun doppione.
      await bottoneConfermaMese(rigaMese(secondaPagina, prec)).click();
      await expect(secondaPagina.getByText('Mese già confermato')).toBeVisible({ timeout: 20_000 });
      await expect(bottoneConfermaMese(rigaMese(secondaPagina, prec))).toHaveCount(0);
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(secondaPagina, prec)))).toBe(14.5);
      await page.reload();
      await expect(rigaMovimento(page, notaConferma(prec))).toHaveCount(1);
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec)))).toBe(14.5);
      await nessunaViolazioneA11yGrave(secondaPagina);
    });

    test('MOR-07: la differenza cambia dopo la conferma, "non confermate" e conferma residua', async ({ page, creaUtente }) => {
      test.slow();
      const prec = meseRoma(-1);
      const lunedi = lunediDelMese(prec);
      const { utenteId } = await preparaDipendenteConMesi(page, creaUtente, [{ mese: prec, giorni: GIORNI_PIU_14_5 }]);
      await clickEAttendiAzione(page, bottoneConfermaMese(rigaMese(page, prec)));
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec))), { timeout: 20_000 }).toBe(14.5);

      // Ore aggiunte: la differenza sale a +16.5 (lunedi' da 3 a 5).
      await registraDifferenzeSettimana(page, utenteId, lunedi, { Lunedì: '5' });
      await apriVistaMensile(page, utenteId);
      const riga = rigaMese(page, prec);
      await expect(testoNonConfermate(riga, '2')).toBeVisible();
      await expect(bottoneConfermaResidua(riga)).toBeVisible();
      await nessunaViolazioneA11yGrave(page);

      await clickEAttendiAzione(page, bottoneConfermaResidua(riga));
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec))), { timeout: 20_000 }).toBe(16.5);
      await expect(bottoneConfermaResidua(rigaMese(page, prec))).toHaveCount(0);
      await expect(rigaMovimento(page, notaConferma(prec))).toHaveCount(1);

      // La differenza scende a +12 (lunedi' da 5 a 0.5): -4.5h su 16.5.
      await registraDifferenzeSettimana(page, utenteId, lunedi, { Lunedì: '0.5' });
      await apriVistaMensile(page, utenteId);
      await expect(testoNonConfermate(rigaMese(page, prec), '4.5')).toBeVisible();
      await clickEAttendiAzione(page, bottoneConfermaResidua(rigaMese(page, prec)));
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec))), { timeout: 20_000 }).toBe(12);
      await expect(bottoneConfermaResidua(rigaMese(page, prec))).toHaveCount(0);
      await expect(rigaMovimento(page, notaConferma(prec))).toHaveCount(1);
    });

    test('MOR-08: sposta un movimento esistente al mese di competenza giusto', async ({ page, creaUtente }) => {
      test.slow();
      const prec = meseRoma(-1);
      const corr = meseRoma(0);
      await preparaDipendenteConMesi(page, creaUtente, [{ mese: prec, giorni: GIORNI_PIU_14_5 }]);

      // Il campo e' preimpostato al mese corrente e non offre mesi futuri.
      const form = formMovimento(page);
      await expect(selectMeseCompetenza(form)).toHaveValue(corr);
      const valoriOpzioni = await selectMeseCompetenza(form).locator('option').evaluateAll((o) =>
        o.map((e) => (e as HTMLOptionElement).value)
      );
      expect(valoriOpzioni.length).toBeGreaterThan(0);
      expect(valoriOpzioni.every((v) => v <= corr)).toBe(true);

      const nota = `Movimento da spostare ${Date.now()}`;
      await compilaMovimento(page, { ore: '14.5', verso: 'credito', nota });
      await registraMovimento(page);
      const movimento = rigaMovimento(page, nota);
      await expect(movimento).toBeVisible({ timeout: 20_000 });
      await expect(movimento).toContainText(`(competenza ${nomeMese(corr)})`);
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, corr)))).toBe(14.5);
      const saldoPrima = await leggiSaldoMonteOre(page);

      await apriModificaMovimento(movimento).click();
      await selectMeseCompetenza(movimento).selectOption(prec);
      await clickEAttendiAzione(page, bottoneSalvaModificaMovimento(movimento));

      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec))), { timeout: 20_000 }).toBe(14.5);
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, corr)))).toBe(0);
      await expect.poll(() => leggiOreCella(cellaSaldoMese(rigaMese(page, prec)))).toBe(14.5);
      await expect(rigaMovimento(page, nota)).toContainText(`(competenza ${nomeMese(prec)})`);
      await expect(rigaMovimento(page, nota)).toContainText(dataOggiItaliana());
      await expect(bottoneConfermaMese(rigaMese(page, prec))).toHaveCount(0);
      await expect(bottoneConfermaResidua(rigaMese(page, prec))).toHaveCount(0);
      expect(await leggiSaldoMonteOre(page)).toBeCloseTo(saldoPrima, 2);
      await nessunaViolazioneA11yGrave(page);
    });

    test('MOR-09: il modulo ha "Mese di competenza" preimpostato al mese corrente', async ({ page, creaUtente }) => {
      test.slow();
      const corr = meseRoma(0);
      const dipendente = await creaUtente({ ruolo: 'maestra', abilitato: true });
      await apriOreDipendente(page, dipendente.email);

      await expect(page.getByLabel('Mese di competenza', { exact: true })).toBeVisible();
      await expect(selectMeseCompetenza(formMovimento(page))).toHaveValue(corr);

      // Registrato col mese preimpostato: conta nel mese corrente.
      await compilaMovimento(page, { ore: '2', verso: 'credito', nota: 'Movimento MOR-09' });
      await registraMovimento(page);
      await expect(rigaMovimento(page, 'Movimento MOR-09')).toContainText(`(competenza ${nomeMese(corr)})`, { timeout: 20_000 });
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, corr)))).toBe(2);
      await nessunaViolazioneA11yGrave(page);
    });

    test('MOR-10: la conferma conta nel saldo mostrato nell\'elenco admin (stesso saldo di email e PDF)', async ({
      page,
      creaUtente,
    }) => {
      test.slow();
      const prec = meseRoma(-1);
      const { dipendente } = await preparaDipendenteConMesi(page, creaUtente, [{ mese: prec, giorni: GIORNI_PIU_14_5 }]);
      await clickEAttendiAzione(page, bottoneConfermaMese(rigaMese(page, prec)));
      await expect.poll(() => leggiOreCella(cellaMovimentiMese(rigaMese(page, prec))), { timeout: 20_000 }).toBe(14.5);

      await page.goto(PERCORSO_ELENCO_ORE_LAVORO);
      await expect(rigaUtente(page, dipendente.email)).toContainText(/Monte ore: \+14[.,]5h a credito/);
      await nessunaViolazioneA11yGrave(page);
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
      await expect.poll(leggiSaldo).toBeLessThan(0);
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
