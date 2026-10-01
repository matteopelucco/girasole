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
// La suite NON preme "Sì" su "Conferma settimana" per la settimana
// corrente: confermare bloccherebbe la scrittura sull'account di test
// condiviso per il resto della settimana (solo lo scenario di riapertura,
// issue #90, conferma e poi riapre una settimana lontana nel passato) — stessa
// cautela già presa per "Pasti comunicati a Rojac" in
// 16-comunicazione-pasti-rojac.spec.ts. Lo scenario "settimana
// confermata non è più modificabile" si attiva da solo (altrimenti
// test.skip) solo se qualcuno l'ha già confermata manualmente questa
// settimana.
import { test, expect, type Page } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione, alertApp } from './helpers';

// Ore ordinarie mostrate (testo, non un campo: specs/18) del giorno
// `indice` della settimana (0 = lunedì ... 5 = sabato).
const oreOrdinarieGiorno = (page: Page, indice: number) => page.locator('[data-ore-ordinarie]').nth(indice);
const totaleErogato = (page: Page, giorno: string) => page.getByRole('status', { name: `Totale ore erogate ${giorno}` });

// Scenario "una settimana confermata non è più modificabile dal
// personale": in sola lettura ogni giorno lavorativo mostra il totale
// erogato con il testo di stato (non più "Ordinarie / Straordinarie").
async function verificaCardSolaLettura(page: Page) {
  const totali = page.getByRole('status', { name: /^Totale ore erogate/ });
  expect(await totali.count()).toBeGreaterThan(0);
  await expect(totali.first()).toContainText(/✓ Ore come previsto|⚠ .*(in più|in meno) del previsto/);
  await expect(page.getByText('Straordinarie:', { exact: false })).toHaveCount(0);
  await expect(page.locator('input[name^="differenza_ore"]')).toHaveCount(0);
}

// Il campo "Differenza ore" ha step 0.25: il browser bloccherebbe da sé
// l'invio di valori non validi. Per verificare la validazione LATO
// SERVER (fonte di verità, specs/18) disattivo quella nativa.
async function disattivaValidazioneNativa(page: Page) {
  await page.getByRole('button', { name: 'Salva modifiche' }).evaluate((b) => {
    (b.closest('form') as HTMLFormElement).noValidate = true;
  });
}

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
          await verificaCardSolaLettura(page);
          await nessunaViolazioneA11yGrave(page);
          return;
        }

        // Tutti i 7 giorni sono mostrati ed editabili, sabato/domenica
        // inclusi: il personale può lavorare anche nei giorni in cui
        // l'asilo è chiuso (specs/18, specs/53 — nessun blocco, a
        // differenza di presenze/pasti).
        await expect(page.getByLabel('Stato Sabato')).toBeVisible();
        await expect(page.getByLabel('Stato Domenica')).toBeVisible();
        // Scenario "un giorno di chiusura scolastica è Chiusura per
        // impostazione predefinita": sabato/domenica (chiusura implicita)
        // partono in stato Chiusura, senza campi da compilare.
        await expect(page.getByLabel('Stato Sabato')).toHaveValue('chiusura');
        await expect(page.getByLabel('Stato Domenica')).toHaveValue('chiusura');
        await expect(page.getByLabel('Differenza ore Sabato')).toHaveCount(0);
        await expect(page.getByText('Giorno di vacanza', { exact: false }).first()).toBeVisible();

        await expect(page.getByRole('button', { name: 'Salva modifiche' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Conferma settimana' })).toBeVisible();
        await nessunaViolazioneA11yGrave(page);

        // Senza profilo orario: ore ordinarie a 0 (testo, non un campo),
        // riferimento statico esplicito con il suggerimento di chiedere
        // all'admin (scenari "senza profilo orario assegnato" e "il
        // profilo orario resta sempre visibile come riferimento
        // statico"), nessun pulsante "Copia" (scenario "le ore ordinarie
        // non sono modificabili e non c'è il pulsante Copia").
        await expect(oreOrdinarieGiorno(page, 0)).toHaveText('0h');
        await expect(page.getByLabel('Ore ordinarie Lunedì')).toHaveCount(0);
        await expect(page.getByText('Nessun profilo orario assegnato', { exact: false }).first()).toBeVisible();
        await expect(page.getByText("chiedi all'admin", { exact: false }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Copia/ })).toHaveCount(0);

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
        await expect(oreOrdinarieGiorno(page, 0)).toHaveText('7h');
        await expect(oreOrdinarieGiorno(page, 4)).toHaveText('4h');
        await expect(page.getByLabel('Ore ordinarie Lunedì')).toHaveCount(0);
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
        await expect(page.getByLabel('Differenza ore Lunedì')).toHaveValue('0');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('7h');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('Ore come previsto');
        await expect(page.getByLabel('Motivo Lunedì')).toHaveCount(0);
        await page.getByLabel('Differenza ore Lunedì').fill('2');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('9h');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('2h in più del previsto');
        await expect(page.getByLabel('Motivo Lunedì')).toBeVisible();
        await page.getByRole('button', { name: "Un quarto d'ora in meno Lunedì" }).click();
        await expect(page.getByLabel('Differenza ore Lunedì')).toHaveValue('1.75');
        await page.getByLabel('Differenza ore Lunedì').fill('-1');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('6h');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('1h in meno del previsto');
        await nessunaViolazioneA11yGrave(page);
        await page.getByLabel('Differenza ore Lunedì').fill('0');
        await expect(totaleErogato(page, 'Lunedì')).toContainText('Ore come previsto');
        await expect(page.getByLabel('Motivo Lunedì')).toHaveCount(0);
        await expect(page.getByLabel('Stato Lunedì')).toBeVisible();

        // La scheda mostra ore previste e differenza ore, in un riquadro
        // separato dai singoli giorni (scenario "la scheda della
        // settimana mostra ore previste e differenza ore") — valori
        // letti, non fissati: dipendono dallo storico della settimana
        // sull'account di test condiviso. Nessuna distinzione
        // ordinarie/straordinarie.
        await expect(page.getByText('Ore previste:', { exact: false })).toContainText(/[0-9]+([.][0-9]+)?h/);
        await expect(page.getByText('Differenza ore:', { exact: false })).toContainText(/[+-]?[0-9]+([.][0-9]+)?h/);
        await expect(page.getByText('Ore ordinarie erogate:', { exact: false })).toHaveCount(0);
        await expect(page.getByText('Ore straordinarie erogate:', { exact: false })).toHaveCount(0);

        // Scenario "il riepilogo si aggiorna con quanto digitato, prima
        // di salvare": la differenza della settimana segue la card.
        const differenzaSettimana = async () =>
          Number(
            ((await page.getByText('Differenza ore:', { exact: false }).textContent()) ?? '').match(
              /Differenza ore: *([+-]?[0-9]+(?:[.][0-9]+)?)h/
            )![1]
          );
        const differenzaPrima = await differenzaSettimana();
        await page.getByLabel('Differenza ore Lunedì').fill('1.5');
        await expect.poll(differenzaSettimana).toBe(differenzaPrima + 1.5);
        await page.getByLabel('Differenza ore Lunedì').fill('0');
        await expect.poll(differenzaSettimana).toBe(differenzaPrima);

        // specs/19, "la conferma della settimana non tocca il monte ore":
        // il monte ore è gestito a mano dall'admin, quindi non compare
        // più alcuna anteprima del suo effetto.
        await expect(page.getByText('A settimana confermata:', { exact: false })).toHaveCount(0);
        await expect(page.getByText('sul monte ore', { exact: false })).toHaveCount(0);

        // Differenza senza motivo: rifiutata, nessuna scrittura
        // (scenario "una differenza diversa da zero richiede un motivo").
        await page.getByLabel('Differenza ore Lunedì').fill('2');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await expect(alertApp(page)).toContainText('motivo');

        // Scenario "le ore ammettono solo multipli di un quarto d'ora e
        // il totale non è mai negativo": validazione lato server.
        await disattivaValidazioneNativa(page);
        await page.getByLabel('Differenza ore Lunedì').fill('0.2');
        await page.getByLabel('Motivo Lunedì').fill('Prova E2E');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await expect(alertApp(page)).toContainText("quarto d'ora");
        await page.getByLabel('Differenza ore Lunedì').fill('-8');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await expect(alertApp(page)).toContainText('negativo');

        // Scenario "i dati storici non a quarti d'ora sono mostrati
        // arrotondati e non vengono modificati finché non si salva": non
        // simulabile via UI (il server rifiuta i valori non a quarti
        // d'ora e l'e2e non ha accesso al DB con dati arbitrari); la
        // logica di arrotondamento è coperta da lib/oreLavoro.test.ts
        // (arrotondaAQuartiDora) e la pagina la applica in lettura.

        // Differenza negativa valida: salvata come ordinarie ridotte,
        // riletta come stessa differenza (scenario "la differenza è
        // salvata nei dati esistenti senza cambiare monte ore e report").
        await page.getByLabel('Differenza ore Lunedì').fill('-0.5');
        await page.getByLabel('Motivo Lunedì').fill('Uscita anticipata E2E');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await expect(alertApp(page)).toHaveCount(0);
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(page.getByLabel('Differenza ore Lunedì')).toHaveValue('-0.5');
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
        await page.getByLabel('Differenza ore Lunedì').fill('2');
        await page.getByLabel('Motivo Lunedì').fill('Riunione E2E');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await expect(alertApp(page)).toHaveCount(0);
        await expect(page.getByText('Differenza ore:', { exact: false })).toContainText('+2h', {
          timeout: 20_000,
        });

        // Malattia senza codice: rifiutata.
        await page.getByLabel('Stato Martedì').selectOption('malattia');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await expect(alertApp(page)).toContainText('codice malattia');

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
        await expect(alertApp(page)).toContainText('nota giustificativa');

        // Con la nota: accettata, e resta salvata dopo un ricaricamento.
        await page.getByLabel('Stato Mercoledì').selectOption('assenza');
        await page.getByLabel('Nota assenza Mercoledì').fill('Visita E2E');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(page.getByLabel('Stato Mercoledì')).toHaveValue('assenza');
        await expect(page.getByLabel('Nota assenza Mercoledì')).toHaveValue('Visita E2E');

        // Il personale può lavorare anche in un giorno di chiusura
        // (qui sabato, chiusura implicita): cambia lo stato in
        // Lavorativo e l'inserimento è accettato, non bloccato
        // (specs/18, specs/53); lo stato scelto resta dopo il reload.
        await page.getByLabel('Stato Sabato').selectOption('lavorativo');
        await page.getByLabel('Differenza ore Sabato').fill('3');
        await page.getByLabel('Motivo Sabato').fill('Pulizie E2E');
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(page.getByLabel('Stato Sabato')).toHaveValue('lavorativo');
        await expect(page.getByLabel('Differenza ore Sabato')).toHaveValue('3');

        // Scenari "segnare un giorno di ferie" e "Chiusura e Ferie non
        // alterano il monte ore": giovedì (7h previste) in Ferie non ha
        // campi e toglie 7h dalle ore dovute della settimana.
        const oreDovuteLette = async () =>
          Number(((await page.getByText('Ore previste:', { exact: false }).textContent()) ?? '').match(/(\d+(?:\.\d+)?)h/)![1]);
        const dovutePrima = await oreDovuteLette();
        await page.getByLabel('Stato Giovedì').selectOption('ferie');
        await expect(page.getByLabel('Differenza ore Giovedì')).toHaveCount(0);
        await expect(page.getByText('non conta nel calcolo del monte ore', { exact: false }).first()).toBeVisible();
        await page.getByRole('button', { name: 'Salva modifiche' }).click();
        await page.waitForTimeout(1000);
        await page.reload();
        await expect(page.getByLabel('Stato Giovedì')).toHaveValue('ferie');
        await expect(page.getByLabel('Differenza ore Giovedì')).toHaveCount(0);
        await expect.poll(oreDovuteLette).toBe(dovutePrima - 7);
        await nessunaViolazioneA11yGrave(page);

        // --- Navigazione tra settimane (specs/18) ---

        // Sulla settimana corrente non c'è alcun modo di andare oltre
        // (scenario "non è possibile navigare oltre la settimana corrente").
        await expect(page.getByRole('link', { name: 'Settimana successiva' })).toHaveCount(0);

        // Un indirizzo diretto verso una settimana futura mostra comunque
        // quella corrente, senza errori (stesso scenario, clamp lato pagina).
        await page.goto('/dashboard/ore-lavoro?settimana=2099-01-05');
        await expect(page.getByRole('link', { name: 'Settimana successiva' })).toHaveCount(0);
        await expect(oreOrdinarieGiorno(page, 0)).toHaveText('7h');

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
          await verificaCardSolaLettura(page);
        } else {
          // Scenario "modificare o confermare una settimana passata non
          // ancora confermata": stesso comportamento della settimana
          // corrente. Ripristino lo stesso valore trovato, per non
          // lasciare lo stato diverso da come l'ho trovato.
          await expect(page.getByLabel('Differenza ore Lunedì')).toBeEditable();
          const valorePrecedente = await page.getByLabel('Differenza ore Lunedì').inputValue();
          const motivoPrecedente = await page.getByLabel('Motivo Lunedì').count() ? await page.getByLabel('Motivo Lunedì').inputValue() : '';
          await page.getByLabel('Differenza ore Lunedì').fill('1');
          await page.getByLabel('Motivo Lunedì').fill('Prova E2E');
          await page.getByRole('button', { name: 'Salva modifiche' }).click();
          await page.waitForTimeout(1000);
          await page.reload();
          await expect(page.getByLabel('Differenza ore Lunedì')).toHaveValue('1');

          await page.getByRole('button', { name: 'Conferma settimana' }).click();
          await expect(
            page.getByText('Da questo momento non potrai più modificarle', { exact: false })
          ).toBeVisible();
          await page.getByRole('button', { name: 'Annulla' }).click();

          await page.getByLabel('Differenza ore Lunedì').fill(valorePrecedente);
          if (Number(valorePrecedente) !== 0) await page.getByLabel('Motivo Lunedì').fill(motivoPrecedente || 'Ripristino E2E');
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
        // Ripristino: martedì/mercoledì/giovedì tornano lavorativo, sabato
        // torna Chiusura, l'account torna disabilitato e senza profilo, il
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
          if ((await page.getByLabel('Stato Giovedì').count()) > 0) {
            await page.getByLabel('Stato Giovedì').selectOption('lavorativo');
          }
          if ((await page.getByLabel('Stato Sabato').count()) > 0) {
            await page.getByLabel('Stato Sabato').selectOption('chiusura');
          }
          if ((await page.getByLabel('Differenza ore Lunedì').count()) > 0) {
            await page.getByLabel('Differenza ore Lunedì').fill('0');
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

    // Scenario "l'admin genera e scarica il PDF mensile del personale":
    // il file viene scaricato direttamente (nessuna email) ed è un PDF vero.
    test('genera e scarica il PDF mensile del personale sotto l\'elenco', async ({ page }) => {
      await page.goto('/admin/ore-lavoro');
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

        // Scenario: l'admin apre un dipendente e vede per prima la vista
        // mensile — vale anche se il profilo admin non è personalmente
        // abilitato (nessun redirect alla dashboard).
        await rigaDipendente.getByRole('link').click();
        await page.waitForURL(/\/dashboard\/ore-lavoro\/mese\?utente=.+/);
        await expect(page.getByRole('heading', { name: /Ore di lavoro/ })).toContainText('—');
        await expect(page.getByRole('link', { name: /Torna all.elenco del personale/ })).toBeVisible();
        const selettore = page.getByRole('navigation', { name: 'Vista ore di lavoro' });
        await expect(selettore.getByRole('link', { name: 'Mese' })).toHaveAttribute('aria-current', 'page');

        // Scenario: la vista mensile mostra i giorni del mese e i totali.
        const giorniMese = page.getByRole('list', { name: 'Giorni del mese' }).getByRole('listitem');
        expect(await giorniMese.count()).toBeGreaterThanOrEqual(28);
        await expect(page.getByText('Ore previste:', { exact: false })).toContainText(/[0-9]+([.][0-9]+)?h/);
        await expect(page.getByText('Differenza ore:', { exact: false })).toContainText(/[+-]?[0-9]+([.][0-9]+)?h/);
        await expect(page.getByText('Monte ore attuale:', { exact: false })).toBeVisible();
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
        await expect(page.getByRole('heading', { name: /Ore di lavoro/ })).toContainText('—');

        // Un mese futuro in query string mostra il mese corrente.
        await page.goto(`/dashboard/ore-lavoro/mese?mese=2099-01&utente=${utenteInUrl}`);
        await expect(page.getByRole('link', { name: 'Mese successivo' })).toHaveCount(0);

        // Scenario: passare tra vista mensile e settimanale, e ritorno.
        await page.getByRole('navigation', { name: 'Vista ore di lavoro' }).getByRole('link', { name: 'Settimana' }).click();
        await page.waitForURL(/\/dashboard\/ore-lavoro\?settimana=[0-9]{4}-[0-9]{2}-[0-9]{2}&utente=.+/);
        await expect(page.getByRole('heading', { name: /Ore di lavoro/ })).toContainText('—');
        await nessunaViolazioneA11yGrave(page);

        // Il riquadro ore previste/differenza è visibile anche da qui
        // (specs/18: "per ogni vista"), non solo dalla vista personale.
        await expect(page.getByText('Ore previste:', { exact: false })).toBeVisible();

        const url = new URL(page.url());
        const utenteId = url.searchParams.get('utente')!;

        const giaConfermata = (await page.getByText('Settimana confermata il', { exact: false }).count()) > 0;
        if (giaConfermata) {
          // Scenario: l'admin modifica le ore di un dipendente, anche
          // se la settimana è già confermata — a differenza della
          // vista del diretto interessato (sola lettura), l'admin vede
          // comunque i campi modificabili.
          await expect(page.getByRole('button', { name: 'Salva modifiche' })).toBeVisible();
          await expect(page.getByLabel('Differenza ore Lunedì')).toBeEditable();
          await expect(page.getByLabel('Ore ordinarie Lunedì')).toHaveCount(0);
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

        // Scenario "il riepilogo si aggiorna con quanto digitato" (anche
        // per una settimana confermata e corretta dall'admin, #151):
        // "Differenza ore" del riquadro è la somma delle differenze dei
        // giorni mostrati nelle card, mai un valore congelato alla
        // conferma.
        const campiDifferenza = page.getByLabel(/^Differenza ore (Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica)$/);
        const valoriDifferenza = await campiDifferenza.evaluateAll((els) => els.map((el) => Number((el as HTMLInputElement).value)));
        const sommaDifferenze = Math.round(valoriDifferenza.reduce((t, v) => t + v, 0) * 100) / 100;
        const testoDifferenza = (await page.getByText('Differenza ore:', { exact: false }).textContent()) ?? '';
        const differenzaRiquadro = Number(testoDifferenza.match(/Differenza ore: *([+-]?[0-9]+(?:[.][0-9]+)?)h/)![1]);
        expect(differenzaRiquadro).toBe(sommaDifferenze);

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
      browser,
    }) => {
      const nomeProfilo = `E2E ore lavoro maestra ${Date.now()}`;

      await page.goto('/admin/profili-orari');
      await page.getByPlaceholder('Nome (es. 35 ore settimanali)').fill(nomeProfilo);
      await page.getByLabel('Lunedì').fill('6');
      await page.getByLabel('Martedì').fill('6');
      await page.getByLabel('Mercoledì').fill('6');
      await page.getByLabel('Giovedì').fill('6');
      await page.getByLabel('Venerdì').fill('3');
      await page.getByRole('button', { name: 'Crea profilo orario' }).click();
      await expect(page.getByText(nomeProfilo, { exact: false })).toBeVisible({ timeout: 20_000 });

      await page.goto('/admin/maestre');
      const rigaAssegna = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
      await rigaAssegna.getByLabel('Ore di lavoro').check();
      await rigaAssegna.getByLabel('Profilo orario').selectOption({ label: nomeProfilo });
      await rigaAssegna.getByRole('button', { name: 'Aggiorna' }).click();
      await page.waitForTimeout(1000);

      try {
        const contestoMaestra = await browser.newContext({ storageState: statoAutenticazione('maestra') });
        const paginaMaestra = await contestoMaestra.newPage();
        await paginaMaestra.goto('/dashboard/ore-lavoro');
        const giaConfermata =
          (await paginaMaestra.getByText('Settimana confermata il', { exact: false }).count()) > 0;
        if (!giaConfermata) {
          await expect(oreOrdinarieGiorno(paginaMaestra, 0)).toHaveText('6h');
          await expect(oreOrdinarieGiorno(paginaMaestra, 4)).toHaveText('3h');
          // Sabato (chiusura implicita) parte in Chiusura, senza ore previste da mostrare.
          await expect(paginaMaestra.getByLabel('Stato Sabato')).toHaveValue('chiusura');
        }
        await contestoMaestra.close();
      } finally {
        await page.goto('/admin/maestre');
        const rigaRipristina = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
        await rigaRipristina.getByLabel('Ore di lavoro').uncheck();
        await rigaRipristina.getByLabel('Profilo orario').selectOption({ label: 'Nessun profilo orario' });
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

    // Scenari "l'admin riapre una settimana già confermata" e "solo l'admin
    // può riaprire una settimana" (issue #90). Usa una settimana lontana
    // nel passato (10 settimane fa), per non toccare quella corrente su cui
    // lavorano gli altri test, e la lascia riaperta (non confermata).
    test("l'admin riapre una settimana confermata; la maestra non può e torna a poterla modificare", async ({
      page,
      browser,
      baseURL,
    }) => {
      const dieciSettimaneFa = new Date();
      dieciSettimaneFa.setUTCDate(dieciSettimaneFa.getUTCDate() - 70);
      dieciSettimaneFa.setUTCDate(dieciSettimaneFa.getUTCDate() - ((dieciSettimaneFa.getUTCDay() + 6) % 7));
      const lunedi = dieciSettimaneFa.toISOString().slice(0, 10);

      await page.goto('/admin/maestre');
      const rigaAbilita = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
      await rigaAbilita.getByLabel('Ore di lavoro').check();
      await rigaAbilita.getByRole('button', { name: 'Aggiorna' }).click();
      await page.waitForTimeout(1000);

      try {
        await page.goto('/admin/ore-lavoro');
        await page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! }).getByRole('link').click();
        await page.waitForURL(/\/dashboard\/ore-lavoro\/mese\?utente=.+/);
        const utenteId = new URL(page.url()).searchParams.get('utente')!;
        const urlAdmin = `/dashboard/ore-lavoro?settimana=${lunedi}&utente=${utenteId}`;
        const urlMaestra = `/dashboard/ore-lavoro?settimana=${lunedi}`;

        // Parto da una settimana confermata (la confermo se serve).
        await page.goto(urlAdmin);
        if ((await page.getByRole('button', { name: 'Riapri settimana' }).count()) === 0) {
          await page.getByRole('button', { name: 'Conferma settimana' }).click();
          await page.getByRole('button', { name: 'Sì', exact: true }).click();
        }
        await expect(page.getByText('Settimana confermata il', { exact: false })).toBeVisible({ timeout: 20_000 });
        await nessunaViolazioneA11yGrave(page);

        // La maestra la vede di sola lettura, senza alcun "Riapri settimana".
        const contestoMaestra = await browser.newContext({ storageState: statoAutenticazione('maestra'), baseURL });
        const paginaMaestra = await contestoMaestra.newPage();
        await paginaMaestra.goto(urlMaestra);
        await expect(paginaMaestra.getByText('Settimana confermata il', { exact: false })).toBeVisible();
        await expect(paginaMaestra.getByRole('button', { name: 'Salva modifiche' })).toHaveCount(0);
        await expect(paginaMaestra.getByRole('button', { name: 'Riapri settimana' })).toHaveCount(0);

        // L'admin riapre: prima chiede conferma (Annulla non cambia nulla)...
        await page.getByRole('button', { name: 'Riapri settimana' }).click();
        await expect(page.getByText('Riaprire la settimana', { exact: false })).toBeVisible();
        await page.getByRole('button', { name: 'Annulla' }).click();
        await expect(page.getByText('Settimana confermata il', { exact: false })).toBeVisible();

        // ...poi riapre davvero.
        await page.getByRole('button', { name: 'Riapri settimana' }).click();
        await page.getByRole('button', { name: 'Sì, riapri' }).click();
        await expect(page.getByText('Settimana confermata il', { exact: false })).toHaveCount(0, { timeout: 20_000 });
        await expect(page.getByRole('button', { name: 'Conferma settimana' })).toBeVisible();

        // La maestra può di nuovo modificarla (e deve riconfermarla).
        await paginaMaestra.goto(urlMaestra);
        await expect(paginaMaestra.getByRole('button', { name: 'Salva modifiche' })).toBeVisible();
        await expect(paginaMaestra.getByRole('button', { name: 'Conferma settimana' })).toBeVisible();
        await contestoMaestra.close();
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
