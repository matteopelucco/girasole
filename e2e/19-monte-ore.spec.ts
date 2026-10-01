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
// Il movimento manuale di test (+1.5h) nel primo test sotto viene sempre
// compensato con un movimento uguale e opposto in `finally` (nota
// "Correzione E2E"); il test di modifica ed eliminazione usa
// l'eliminazione per il proprio cleanup.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione, alertApp, clickEAttendiAzione } from './helpers';

// Form di inserimento di un movimento: le righe dello storico hanno a loro
// volta un form di modifica con gli stessi nomi di campo.
const formAggiungi = (page: import('@playwright/test').Page) =>
  page.locator('form').filter({ has: page.getByRole('button', { name: 'Registra movimento' }) });

test.describe('19 — Monte ore', () => {
  test.describe('il diretto interessato vede il proprio saldo, in sola lettura', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(
        !hasCredenziali('admin') || !hasCredenziali('maestra'),
        'richiede E2E_ADMIN_EMAIL/PASSWORD e E2E_MAESTRA_EMAIL/PASSWORD'
      );
    });

    test('la maestra vede "Monte ore attuale" ma nessun form per modificarlo', async ({ page, browser }) => {
      await page.goto('/admin/maestre');
      const rigaAbilita = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
      await rigaAbilita.getByLabel('Ore di lavoro').check();
      await clickEAttendiAzione(page, rigaAbilita.getByRole('button', { name: 'Aggiorna' }));

      try {
        const contestoMaestra = await browser.newContext({ storageState: statoAutenticazione('maestra') });
        const paginaMaestra = await contestoMaestra.newPage();
        await paginaMaestra.goto('/dashboard/ore-lavoro');

        await expect(paginaMaestra.getByText('Monte ore attuale:', { exact: false })).toBeVisible();
        // Scenario: la scheda ore mostra il calcolo mese per mese, in sola
        // lettura (nessun pulsante di modifica/eliminazione dei movimenti).
        await expect(paginaMaestra.getByRole('heading', { name: 'Calcolo mese per mese' })).toBeVisible();
        await expect(paginaMaestra.getByText('Modifica', { exact: true })).toHaveCount(0);
        await expect(paginaMaestra.getByRole('button', { name: 'Elimina' })).toHaveCount(0);
        await expect(paginaMaestra.getByLabel('Nota', { exact: true })).toHaveCount(0);
        await expect(paginaMaestra.getByRole('button', { name: 'Registra movimento' })).toHaveCount(0);

        await nessunaViolazioneA11yGrave(paginaMaestra);
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

  test.describe('amministrazione: saldo e movimenti manuali di un dipendente', () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test.beforeEach(async ({ page }) => {
      test.skip(
        !hasCredenziali('admin') || !hasCredenziali('maestra'),
        'richiede E2E_ADMIN_EMAIL/PASSWORD e E2E_MAESTRA_EMAIL/PASSWORD'
      );
    });

    test('elenco con saldo, movimento senza nota rifiutato, movimento manuale registrato e riflesso nel saldo', async ({
      page,
    }) => {
      // Scenario lungo (abilitazione, più movimenti con salvataggio e
      // ricarica, ripristino): supera i 60s di default senza essere
      // bloccato su nessun passo (issue #70).
      test.slow();
      await page.goto('/admin/maestre');
      const rigaAbilita = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
      await rigaAbilita.getByLabel('Ore di lavoro').check();
      await clickEAttendiAzione(page, rigaAbilita.getByRole('button', { name: 'Aggiorna' }));

      try {
        // Scenario: l'admin vede il monte ore di ciascuna persona
        // nell'elenco del personale abilitato.
        await page.goto('/admin/ore-lavoro');
        const rigaDipendente = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
        // Convenzione del segno (specs/19): saldo con segno esplicito e
        // significato, mai un numero nudo.
        await expect(rigaDipendente).toContainText(/Monte ore: [+-]?[0-9]+([.][0-9]+)?h (a credito|da recuperare|in pari)/);

        await rigaDipendente.getByRole('link').click();
        // L'elenco apre la vista mensile (specs/18), dove l'admin gestisce
        // il monte ore del dipendente (specs/19).
        await page.waitForURL(/\/dashboard\/ore-lavoro\/mese\?utente=.+/);
        await expect(page.getByText('Monte ore attuale:', { exact: false })).toBeVisible();
        await nessunaViolazioneA11yGrave(page);

        // Il saldo si aggiorna quando la pagina ricarica i dati dopo la
        // Server Action, non all'arrivo della sua risposta: lo leggo con
        // expect.poll, che riprova finché non vale quanto atteso (#70).
        const leggiSaldo = async () => {
          const testo = await page.getByText('Monte ore attuale:', { exact: false }).innerText();
          return Number(testo.match(/(-?\d+(\.\d+)?)h/)?.[1]);
        };
        const saldoIniziale = await leggiSaldo();
        expect(Number.isFinite(saldoIniziale)).toBe(true);

        // Label non equivoche: legenda del segno e nessun verso preselezionato.
        await expect(page.getByText('Positivo (+): ore già erogate in più, a credito', { exact: false })).toBeVisible();
        await expect(formAggiungi(page).locator('select[name="verso"]')).toHaveValue('');
        await formAggiungi(page).locator('input[name="ore"]').fill('1');
        await formAggiungi(page).locator('input[name="nota"]').fill('Senza verso E2E');
        await clickEAttendiAzione(page, page.getByRole('button', { name: 'Registra movimento' }));
        await expect(alertApp(page)).toContainText('Scegli');
        // Il form non si azzera su un errore: svuoto la nota per il passo
        // successivo ("senza nota").
        await formAggiungi(page).locator('input[name="nota"]').fill('');

        // Scenario: un movimento manuale senza nota viene rifiutato.
        await formAggiungi(page).locator('input[name="ore"]').fill('1.5');
        await formAggiungi(page).locator('select[name="verso"]').selectOption('credito');
        await clickEAttendiAzione(page, page.getByRole('button', { name: 'Registra movimento' }));
        await expect(alertApp(page)).toContainText('nota');

        // Con la nota: accettato, il saldo aumenta di 1.5h e compare
        // nello storico.
        await formAggiungi(page).locator('input[name="ore"]').fill('1.5');
        await formAggiungi(page).locator('select[name="verso"]').selectOption('credito');
        await formAggiungi(page).locator('input[name="nota"]').fill('Movimento E2E');
        await clickEAttendiAzione(page, page.getByRole('button', { name: 'Registra movimento' }));
        await expect(alertApp(page)).toHaveCount(0);
        // .first(): un eventuale retry del test trova anche il movimento
        // registrato dal tentativo precedente.
        await expect(page.getByText('Movimento E2E', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
        await expect.poll(leggiSaldo, { timeout: 20_000 }).toBeCloseTo(saldoIniziale + 1.5, 2);

        // Scenario: il monte ore può risultare negativo, senza alcun
        // blocco — una riduzione ben più grande di qualunque saldo
        // realistico (5000h) porta il saldo sotto zero senza errori.
        await formAggiungi(page).locator('input[name="ore"]').fill('5000');
        await formAggiungi(page).locator('select[name="verso"]').selectOption('debito');
        await formAggiungi(page).locator('input[name="nota"]').fill('Riduzione ampia E2E (per testare il saldo negativo)');
        await clickEAttendiAzione(page, page.getByRole('button', { name: 'Registra movimento' }));
        await expect(alertApp(page)).toHaveCount(0);
        await expect.poll(leggiSaldo, { timeout: 20_000 }).toBeCloseTo(saldoIniziale + 1.5 - 5000, 2);
        expect(await leggiSaldo()).toBeLessThan(0);

        // Compensazione (vedi nota in testa al file): due movimenti
        // uguali e opposti (+5000h, poi -1.5h) riportano il saldo
        // esattamente al valore di partenza.
        await formAggiungi(page).locator('input[name="ore"]').fill('5000');
        await formAggiungi(page).locator('select[name="verso"]').selectOption('credito');
        await formAggiungi(page).locator('input[name="nota"]').fill('Correzione E2E (riduzione ampia)');
        await clickEAttendiAzione(page, page.getByRole('button', { name: 'Registra movimento' }));
        await expect(alertApp(page)).toHaveCount(0);
        await expect.poll(leggiSaldo, { timeout: 20_000 }).toBeCloseTo(saldoIniziale + 1.5, 2);

        await formAggiungi(page).locator('input[name="ore"]').fill('1.5');
        await formAggiungi(page).locator('select[name="verso"]').selectOption('debito');
        await formAggiungi(page).locator('input[name="nota"]').fill('Correzione E2E');
        await clickEAttendiAzione(page, page.getByRole('button', { name: 'Registra movimento' }));
        await expect(alertApp(page)).toHaveCount(0);
        await expect.poll(leggiSaldo, { timeout: 20_000 }).toBeCloseTo(saldoIniziale, 2);
      } finally {
        await page.goto('/admin/maestre');
        const rigaRipristina = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
        await rigaRipristina.getByLabel('Ore di lavoro').uncheck();
        await rigaRipristina.getByRole('button', { name: 'Aggiorna' }).click();
        await page.waitForTimeout(1000);
      }
    });

    test("l'admin modifica ed elimina un movimento di monte ore, e vede il calcolo mese per mese", async ({
      page,
    }) => {
      // Scenario lungo (abilitazione, più movimenti con salvataggio e
      // ricarica, ripristino): supera i 60s di default senza essere
      // bloccato su nessun passo (issue #70).
      test.slow();
      await page.goto('/admin/maestre');
      const rigaAbilita = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
      await rigaAbilita.getByLabel('Ore di lavoro').check();
      await clickEAttendiAzione(page, rigaAbilita.getByRole('button', { name: 'Aggiorna' }));

      try {
        await page.goto('/admin/ore-lavoro');
        const rigaDipendente = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
        await rigaDipendente.getByRole('link').click();
        // L'elenco apre la vista mensile (specs/18), dove l'admin gestisce
        // il monte ore del dipendente (specs/19).
        await page.waitForURL(/\/dashboard\/ore-lavoro\/mese\?utente=.+/);

        const testoSaldo = await page.getByText('Monte ore attuale:', { exact: false }).innerText();
        const saldoIniziale = Number(testoSaldo.match(/(-?\d+(\.\d+)?)h/)?.[1]);

        // Scenario: l'admin modifica un movimento: cambia ore e nota, il
        // saldo si aggiorna e la riga riporta i nuovi valori.
        const notaMovimento = `Movimento E2E da eliminare ${Date.now()}`;
        await formAggiungi(page).locator('input[name="ore"]').fill('2');
        await formAggiungi(page).locator('select[name="verso"]').selectOption('credito');
        await formAggiungi(page).locator('input[name="nota"]').fill(notaMovimento);
        await clickEAttendiAzione(page, page.getByRole('button', { name: 'Registra movimento' }));
        const rigaMovimento = page.locator('li', { hasText: notaMovimento });
        await expect(rigaMovimento).toBeVisible({ timeout: 20_000 });

        const testoSaldoDopoAggiunta = await page.getByText('Monte ore attuale:', { exact: false }).innerText();
        const saldoDopoAggiunta = Number(testoSaldoDopoAggiunta.match(/(-?\d+(\.\d+)?)h/)?.[1]);
        expect(saldoDopoAggiunta).toBeCloseTo(saldoIniziale + 2, 2);

        await rigaMovimento.getByText('Modifica', { exact: true }).click();
        const notaModificata = `${notaMovimento} (modificato)`;
        await rigaMovimento.locator('input[name="ore"]').fill('3');
        await rigaMovimento.locator('input[name="nota"]').fill(notaModificata);
        await clickEAttendiAzione(page, rigaMovimento.getByRole('button', { name: 'Salva modifica' }));
        const rigaModificata = page.locator('li', { hasText: notaModificata });
        await expect(rigaModificata).toBeVisible({ timeout: 20_000 });
        await expect
          .poll(async () => {
            const t = await page.getByText('Monte ore attuale:', { exact: false }).innerText();
            return Number(t.match(/(-?\d+(\.\d+)?)h/)?.[1]);
          })
          .toBeCloseTo(saldoIniziale + 3, 2);

        // Scenario: l'admin elimina un movimento di monte ore.
        page.once('dialog', (dialog) => dialog.accept());
        await rigaModificata.getByRole('button', { name: 'Elimina' }).click();
        await expect(page.locator('li', { hasText: notaMovimento })).toHaveCount(0, { timeout: 20_000 });

        const testoSaldoFinale = await page.getByText('Monte ore attuale:', { exact: false }).innerText();
        const saldoFinale = Number(testoSaldoFinale.match(/(-?\d+(\.\d+)?)h/)?.[1]);
        expect(saldoFinale).toBeCloseTo(saldoIniziale, 2);

        // Scenario: il calcolo mese per mese è sempre visibile e completo.
        await expect(page.getByRole('heading', { name: 'Calcolo mese per mese' })).toBeVisible();
        await nessunaViolazioneA11yGrave(page);
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
