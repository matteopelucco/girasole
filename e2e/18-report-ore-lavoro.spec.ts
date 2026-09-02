// Requisito: specs/18 - report-ore-lavoro.md
//
// ATTENZIONE: il test principale abilita temporaneamente l'account admin
// di test al report ore e gli assegna/rimuove un profilo orario di test
// per poter verificare il contenuto reale della sezione, poi ripristina
// tutto in `finally` — stesso pattern di 17-ore-di-lavoro.spec.ts e
// 54-profili-orari.spec.ts. Un solo test esegue l'intero percorso in
// sequenza (non test separati) per evitare che esecuzioni parallele
// sullo stesso account condiviso si contendano lo stesso stato
// (fullyParallel: true, stessa cautela di
// 16-comunicazione-pasti-rojac.spec.ts).
//
// La suite NON preme mai per davvero "Sì" su "Conferma settimana":
// confermare è irreversibile fino al lunedì successivo (nessuna
// "riapertura" in questa fase, specs/18) e bloccherebbe la scrittura
// sull'account di test condiviso per il resto della settimana — stessa
// cautela già presa per "Pasti comunicati a Rojac" in
// 16-comunicazione-pasti-rojac.spec.ts. Lo scenario "settimana
// confermata non è più modificabile" si attiva da solo (altrimenti
// test.skip) solo se qualcuno l'ha già confermata manualmente questa
// settimana.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('18 — Report ore di lavoro', () => {
  test.describe('come admin', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
    });

    test('senza abilitazione, /dashboard/ore-lavoro reindirizza alla dashboard', async ({ page }) => {
      await page.goto('/dashboard/ore-lavoro');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });

    test('form settimanale: precaricamento dal profilo orario, validazioni, giorni chiusi lavorabili, conferma (senza premere Sì)', async ({
      page,
    }) => {
      const nomeProfilo = `E2E ore lavoro ${Date.now()}`;

      // Setup: abilito l'account SENZA profilo orario, per lo scenario
      // "senza profilo orario assegnato le ore ordinarie partono da zero".
      await page.goto('/admin/maestre');
      const rigaAbilita = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
      await rigaAbilita.getByLabel('Ore di lavoro').check();
      await rigaAbilita.getByRole('button', { name: 'Aggiorna' }).click();
      await page.waitForTimeout(1000);

      try {
        await page.goto('/dashboard/ore-lavoro');
        await expect(page.getByRole('heading', { name: 'Ore di lavoro' })).toBeVisible();

        const giaConfermata = await page.getByText('Settimana confermata il', { exact: false }).count();
        if (giaConfermata > 0) {
          // Vedi nota in testa al file: verifico solo la sola lettura,
          // il resto del test presuppone di poter ancora modificare.
          await expect(page.getByRole('button', { name: 'Salva modifiche' })).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Conferma settimana' })).toHaveCount(0);
          await nessunaViolazioneA11yGrave(page);
          return;
        }

        // Tutti i 7 giorni sono mostrati ed editabili, sabato/domenica
        // inclusi: il personale può lavorare anche nei giorni in cui
        // l'asilo è chiuso (specs/18, specs/53 — nessun blocco, a
        // differenza di presenze/pasti).
        await expect(page.getByLabel('Stato Sabato')).toBeVisible();
        await expect(page.getByLabel('Stato Domenica')).toBeVisible();
        await expect(page.getByLabel('Ore ordinarie Sabato')).toBeEditable();

        await expect(page.getByRole('button', { name: 'Salva modifiche' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Conferma settimana' })).toBeVisible();
        await nessunaViolazioneA11yGrave(page);

        // Senza profilo orario: ore ordinarie a 0.
        await expect(page.getByLabel('Ore ordinarie Lunedì')).toHaveValue('0');

        // Assegno un profilo orario e ricarico: ore ordinarie precaricate.
        await page.goto('/admin/profili-orari');
        await page.getByPlaceholder('Nome (es. 35 ore settimanali)').fill(nomeProfilo);
        await page.getByLabel('Lunedì').fill('7');
        await page.getByLabel('Martedì').fill('7');
        await page.getByLabel('Mercoledì').fill('7');
        await page.getByLabel('Giovedì').fill('7');
        await page.getByLabel('Venerdì').fill('4');
        await page.getByRole('button', { name: 'Crea profilo orario' }).click();
        await expect(page.getByText(nomeProfilo, { exact: false })).toBeVisible({ timeout: 20_000 });

        await page.goto('/admin/maestre');
        const rigaAssegna = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
        await rigaAssegna.getByLabel('Profilo orario').selectOption({ label: nomeProfilo });
        await rigaAssegna.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);

        await page.goto('/dashboard/ore-lavoro');
        await expect(page.getByLabel('Ore ordinarie Lunedì')).toHaveValue('7');
        await expect(page.getByLabel('Ore ordinarie Venerdì')).toHaveValue('4');

        // Straordinario senza motivo: rifiutato, nessuna scrittura.
        await page.getByLabel('Ore straordinarie Lunedì').fill('2');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await expect(page.getByRole('alert')).toContainText('motivo');

        // Con il motivo: accettato, il totale della settimana si aggiorna.
        // Il form invia sempre tutti e 7 i giorni in un solo
        // salvataggio: se oggi non è domenica, questo submit include
        // anche giorni non ancora accaduti della stessa settimana, e
        // deve comunque andare a buon fine (scenario "salvare le ore
        // anche a metà settimana" — bug: un trigger sul database
        // rifiutava erroneamente qualunque giorno futuro anche dentro
        // la settimana corrente, impedendo di salvare a metà settimana;
        // vedi supabase/migrations/0029_fix_ore_lavoro_vincolo_futuro.sql).
        await page.getByLabel('Ore straordinarie Lunedì').fill('2');
        await page.getByLabel('Motivo straordinario Lunedì').fill('Riunione E2E');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.getByText('2h straordinarie', { exact: false })).toBeVisible({ timeout: 20_000 });

        // Malattia senza codice: rifiutata.
        await page.getByLabel('Stato Martedì').selectOption('malattia');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await expect(page.getByRole('alert')).toContainText('codice malattia');

        // Con il codice: accettata, e resta salvata dopo un ricaricamento.
        await page.getByLabel('Stato Martedì').selectOption('malattia');
        await page.getByLabel('Codice malattia Martedì').fill('COD-E2E');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(page.getByLabel('Stato Martedì')).toHaveValue('malattia');
        await expect(page.getByLabel('Codice malattia Martedì')).toHaveValue('COD-E2E');

        // Assenza senza nota: rifiutata.
        await page.getByLabel('Stato Mercoledì').selectOption('assenza');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await expect(page.getByRole('alert')).toContainText('nota giustificativa');

        // Con la nota: accettata, e resta salvata dopo un ricaricamento.
        await page.getByLabel('Stato Mercoledì').selectOption('assenza');
        await page.getByLabel('Nota assenza Mercoledì').fill('Visita E2E');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(page.getByLabel('Stato Mercoledì')).toHaveValue('assenza');
        await expect(page.getByLabel('Nota assenza Mercoledì')).toHaveValue('Visita E2E');

        // Il personale può lavorare anche in un giorno di chiusura
        // (qui sabato, chiusura implicita): l'inserimento è accettato,
        // non bloccato (specs/18, specs/53).
        await page.getByLabel('Ore ordinarie Sabato').fill('3');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(page.getByLabel('Ore ordinarie Sabato')).toHaveValue('3');

        // --- Navigazione tra settimane (specs/18) ---

        // Sulla settimana corrente non c'è alcun modo di andare oltre
        // (scenario "non è possibile navigare oltre la settimana corrente").
        await expect(page.getByRole('link', { name: 'Settimana successiva' })).toHaveCount(0);

        // Un indirizzo diretto verso una settimana futura mostra comunque
        // quella corrente, senza errori (stesso scenario, clamp lato pagina).
        await page.goto('/dashboard/ore-lavoro?settimana=2099-01-05');
        await expect(page.getByRole('link', { name: 'Settimana successiva' })).toHaveCount(0);
        await expect(page.getByLabel('Ore ordinarie Lunedì')).toHaveValue('7');

        // "←" porta alla settimana precedente, con gli stessi dati
        // (precaricati dal profilo orario dove non ho ancora salvato
        // nulla per quella settimana) — scenario "navigare a una
        // settimana passata".
        await page.goto('/dashboard/ore-lavoro');
        await page.getByRole('link', { name: 'Settimana precedente' }).click();
        await page.waitForURL(/settimana=\d{4}-\d{2}-\d{2}/);
        await expect(page.getByRole('link', { name: 'Settimana successiva' })).toBeVisible();
        await nessunaViolazioneA11yGrave(page);

        const settimanaPassataConfermata = await page.getByText('Settimana confermata il', { exact: false }).count();
        if (settimanaPassataConfermata > 0) {
          // Scenario "una settimana passata già confermata resta di
          // sola lettura": si attiva da solo se una settimana
          // precedente risulta già confermata.
          await expect(page.getByRole('button', { name: 'Salva modifiche' })).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Conferma settimana' })).toHaveCount(0);
        } else {
          // Scenario "modificare o confermare una settimana passata non
          // ancora confermata": stesso comportamento della settimana
          // corrente. Ripristino lo stesso valore trovato, per non
          // lasciare lo stato diverso da come l'ho trovato.
          await expect(page.getByLabel('Ore ordinarie Lunedì')).toBeEditable();
          const valorePrecedente = await page.getByLabel('Ore ordinarie Lunedì').inputValue();
          await page.getByLabel('Ore ordinarie Lunedì').fill('5');
          await page.getByRole('button', { name: 'Salva modifiche' }).click();
          await page.waitForTimeout(1000);
          await page.reload();
          await expect(page.getByLabel('Ore ordinarie Lunedì')).toHaveValue('5');

          await page.getByRole('button', { name: 'Conferma settimana' }).click();
          await expect(
            page.getByText('Da questo momento non potrai più modificarle', { exact: false })
          ).toBeVisible();
          await page.getByRole('button', { name: 'Annulla' }).click();

          await page.getByLabel('Ore ordinarie Lunedì').fill(valorePrecedente);
          await page.getByRole('button', { name: 'Salva modifiche' }).click();
          await page.waitForTimeout(1000);
        }

        // "→" torna verso la settimana corrente (scenario "tornare
        // verso la settimana corrente"): il pulsante "→" scompare di
        // nuovo una volta tornati sulla settimana corrente.
        await page.getByRole('link', { name: 'Settimana successiva' }).click();
        await expect(page.getByRole('link', { name: 'Settimana successiva' })).toHaveCount(0);

        // "Conferma settimana" chiede conferma esplicita: verifico solo
        // che il dialogo compaia e che "Annulla" non confermi nulla (non
        // premo mai "Sì", vedi nota in testa al file).
        await page.getByRole('button', { name: 'Conferma settimana' }).click();
        await expect(
          page.getByText('Da questo momento non potrai più modificarle', { exact: false })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Annulla' }).click();
        await expect(page.getByRole('button', { name: 'Salva modifiche' })).toBeVisible();
      } finally {
        // Ripristino: martedì/mercoledì tornano lavorativo, sabato torna
        // a 0 ore, l'account torna disabilitato e senza profilo, il
        // profilo di test viene eliminato (svuota anche l'eventuale
        // assegnazione, specs/54).
        const confermata = await page.getByText('Settimana confermata il', { exact: false }).count();
        if (!confermata) {
          await page.goto('/dashboard/ore-lavoro');
          if ((await page.getByLabel('Stato Martedì').count()) > 0) {
            await page.getByLabel('Stato Martedì').selectOption('lavorativo');
          }
          if ((await page.getByLabel('Stato Mercoledì').count()) > 0) {
            await page.getByLabel('Stato Mercoledì').selectOption('lavorativo');
          }
          if ((await page.getByLabel('Ore ordinarie Sabato').count()) > 0) {
            await page.getByLabel('Ore ordinarie Sabato').fill('0');
          }
          const salva = page.getByRole('button', { name: 'Salva modifiche' });
          if ((await salva.count()) > 0) {
            await salva.click();
            await page.waitForTimeout(1000);
          }
        }

        await page.goto('/admin/maestre');
        const rigaRipristina = page.locator('li', { hasText: process.env.E2E_ADMIN_EMAIL! });
        await rigaRipristina.getByLabel('Ore di lavoro').uncheck();
        if ((await rigaRipristina.getByLabel('Profilo orario').count()) > 0) {
          await rigaRipristina.getByLabel('Profilo orario').selectOption({ label: 'Nessun profilo orario' });
        }
        await rigaRipristina.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);

        await page.goto('/admin/profili-orari');
        const rigaProfilo = page.getByText(nomeProfilo, { exact: false });
        if ((await rigaProfilo.count()) > 0) {
          await rigaProfilo.click();
          await page.waitForURL(/\/admin\/profili-orari\/.+/);
          await page.getByRole('button', { name: 'Elimina profilo orario' }).click();
          await page.getByRole('button', { name: 'Sì' }).click();
        }
      }
    });
  });

  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test('senza abilitazione, /dashboard/ore-lavoro reindirizza alla dashboard', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await page.goto('/dashboard/ore-lavoro');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
    });
  });

  // Amministrazione (specs/18, sezione "Amministrazione"): l'admin può
  // rivedere/correggere le ore di chiunque sia abilitato, anche una
  // settimana già confermata. Usa l'account maestra come "dipendente"
  // di prova, abilitandolo temporaneamente e ripristinandolo in
  // `finally` — stesso pattern del blocco "come admin" sopra. Non
  // preme mai "Sì" su "Conferma settimana" (stessa cautela di sopra:
  // irreversibile sull'account condiviso) né "Salva modifiche" su dati
  // reali del dipendente — verifica solo che i controlli siano
  // presenti/editabili, non li usa per davvero.
  test.describe('amministrazione: rivedere/correggere le ore di un dipendente', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(
        !hasCredenziali('admin') || !hasCredenziali('maestra'),
        'richiede E2E_ADMIN_EMAIL/PASSWORD e E2E_MAESTRA_EMAIL/PASSWORD'
      );
    });

    test('elenco, apertura, navigazione e correzione delle ore di un dipendente abilitato', async ({ page }) => {
      await page.goto('/admin/maestre');
      const rigaAbilita = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
      await rigaAbilita.getByLabel('Ore di lavoro').check();
      await rigaAbilita.getByRole('button', { name: 'Aggiorna' }).click();
      await page.waitForTimeout(1000);

      try {
        // Scenario: l'admin apre l'elenco del personale abilitato.
        await page.goto('/admin/ore-lavoro');
        const rigaDipendente = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
        await expect(rigaDipendente).toBeVisible();
        await expect(rigaDipendente).toContainText(/Settimana corrente (non )?confermata/);
        await nessunaViolazioneA11yGrave(page);

        // Scenario: l'admin apre le ore di un dipendente — vale anche
        // se il profilo admin non è personalmente abilitato (nessun
        // redirect alla dashboard).
        await rigaDipendente.getByRole('link').click();
        await page.waitForURL(/\/dashboard\/ore-lavoro\?utente=.+/);
        await expect(page.getByRole('heading', { name: /Ore di lavoro/ })).toContainText('—');
        await expect(page.getByRole('link', { name: /Torna all.elenco del personale/ })).toBeVisible();
        await nessunaViolazioneA11yGrave(page);

        const url = new URL(page.url());
        const utenteId = url.searchParams.get('utente')!;

        const giaConfermata = (await page.getByText('Settimana confermata il', { exact: false }).count()) > 0;
        if (giaConfermata) {
          // Scenario: l'admin modifica le ore di un dipendente, anche
          // se la settimana è già confermata — a differenza della
          // vista del diretto interessato (sola lettura), l'admin vede
          // comunque i campi modificabili.
          await expect(page.getByRole('button', { name: 'Salva modifiche' })).toBeVisible();
          await expect(page.getByLabel('Ore ordinarie Lunedì')).toBeEditable();
          await expect(page.getByText('Puoi comunque correggerla qui sotto', { exact: false })).toBeVisible();
        } else {
          // Scenario: l'admin conferma per conto di un dipendente una
          // settimana non ancora confermata — verifico solo che il
          // dialogo compaia con il testo corretto, senza confermare
          // per davvero.
          await expect(page.getByRole('button', { name: 'Salva modifiche' })).toBeVisible();
          await page.getByRole('button', { name: 'Conferma settimana' }).click();
          await expect(page.getByText('Confermi le ore di questa settimana per', { exact: false })).toBeVisible();
          await page.getByRole('button', { name: 'Annulla' }).click();
        }

        // Scenario: l'admin naviga tra le settimane di un dipendente —
        // resta sulle ore della stessa persona (il parametro `utente`
        // resta nell'URL).
        await page.getByRole('link', { name: 'Settimana precedente' }).click();
        await page.waitForURL(new RegExp(`settimana=\\d{4}-\\d{2}-\\d{2}&utente=${utenteId}`));
        await expect(page.getByRole('heading', { name: /Ore di lavoro/ })).toContainText('—');

        // Scenario: un parametro `utente` non valido viene ignorato —
        // torno a vedere le mie proprie ore (che, essendo io admin non
        // abilitato personalmente in questo test, mi reindirizzano alla
        // dashboard esattamente come senza alcun parametro).
        await page.goto('/dashboard/ore-lavoro?utente=00000000-0000-0000-0000-000000000000');
        await page.waitForURL('/dashboard', { timeout: 20_000 });
      } finally {
        await page.goto('/admin/maestre');
        const rigaRipristina = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
        await rigaRipristina.getByLabel('Ore di lavoro').uncheck();
        await rigaRipristina.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);
      }
    });

    test('un parametro utente usato da chi non è admin viene ignorato', async ({ page, browser }) => {
      await page.goto('/admin/maestre');
      const rigaAbilita = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
      await rigaAbilita.getByLabel('Ore di lavoro').check();
      await rigaAbilita.getByRole('button', { name: 'Aggiorna' }).click();
      await page.waitForTimeout(1000);

      try {
        const contestoMaestra = await browser.newContext({ storageState: statoAutenticazione('maestra') });
        const paginaMaestra = await contestoMaestra.newPage();
        // Un id qualunque diverso dal proprio: una maestra non deve mai
        // vedere le ore di qualcun altro, nemmeno forzando l'URL.
        await paginaMaestra.goto('/dashboard/ore-lavoro?utente=00000000-0000-0000-0000-000000000000');
        await expect(paginaMaestra.getByRole('heading', { name: 'Ore di lavoro' })).toBeVisible();
        await expect(paginaMaestra.getByRole('heading', { name: /Ore di lavoro/ })).not.toContainText('—');
        await expect(paginaMaestra.getByRole('link', { name: 'Torna alla dashboard' })).toBeVisible();
        await contestoMaestra.close();
      } finally {
        await page.goto('/admin/maestre');
        const rigaRipristina = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
        await rigaRipristina.getByLabel('Ore di lavoro').uncheck();
        await rigaRipristina.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);
      }
    });
  });
});
