// Requisito: specs/19 - monte-ore.md
//
// Il calcolo automatico del movimento settimanale (esubero/carenza alla
// conferma di una settimana) è coperto da unit test puri
// (lib/monteOre.test.ts — CLAUDE.md, criterio "funzioni senza I/O"): la
// suite e2e qui sotto NON preme mai per davvero "Conferma settimana"
// (irreversibile sull'account condiviso, stessa cautela di
// 18-report-ore-lavoro.spec.ts), quindi non può verificare quel calcolo
// end-to-end senza bloccare la scrittura sull'account di test per il
// resto della settimana. Copre invece ciò che i unit test non possono:
// visibilità del saldo per ruolo, validazione del form di movimento
// manuale, e che il saldo si aggiorna davvero dopo un salvataggio reale.
//
// Il movimento manuale di test (+1.5h) viene sempre compensato con un
// movimento uguale e opposto in `finally` (nota "Correzione E2E"): i
// movimenti sono un ledger insert-only (nessun delete, specs/19), quindi
// "ripristinare" significa riportare il saldo al valore di partenza, non
// cancellare le righe di test.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

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
      await rigaAbilita.getByRole('button', { name: 'Aggiorna' }).click();
      await page.waitForTimeout(1000);

      try {
        const contestoMaestra = await browser.newContext({ storageState: statoAutenticazione('maestra') });
        const paginaMaestra = await contestoMaestra.newPage();
        await paginaMaestra.goto('/dashboard/ore-lavoro');

        await expect(paginaMaestra.getByText('Monte ore attuale:', { exact: false })).toBeVisible();
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
      await page.goto('/admin/maestre');
      const rigaAbilita = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
      await rigaAbilita.getByLabel('Ore di lavoro').check();
      await rigaAbilita.getByRole('button', { name: 'Aggiorna' }).click();
      await page.waitForTimeout(1000);

      try {
        // Scenario: l'admin vede il monte ore di ciascuna persona
        // nell'elenco del personale abilitato.
        await page.goto('/admin/ore-lavoro');
        const rigaDipendente = page.locator('li', { hasText: process.env.E2E_MAESTRA_EMAIL! });
        await expect(rigaDipendente).toContainText(/Monte ore: -?\d+(\.\d+)?h/);

        await rigaDipendente.getByRole('link').click();
        await page.waitForURL(/\/dashboard\/ore-lavoro\?utente=.+/);
        await expect(page.getByText('Monte ore attuale:', { exact: false })).toBeVisible();
        await nessunaViolazioneA11yGrave(page);

        const testoSaldo = await page.getByText('Monte ore attuale:', { exact: false }).innerText();
        const saldoIniziale = Number(testoSaldo.match(/(-?\d+(\.\d+)?)h/)?.[1]);
        expect(Number.isFinite(saldoIniziale)).toBe(true);

        // Scenario: un movimento manuale senza nota viene rifiutato.
        await page.getByLabel('Ore', { exact: true }).fill('1.5');
        await page.getByLabel('Movimento', { exact: true }).selectOption('aumenta');
        await page.getByRole('button', { name: 'Registra movimento' }).click();
        await expect(page.getByRole('alert')).toContainText('nota');

        // Con la nota: accettato, il saldo aumenta di 1.5h e compare
        // nello storico.
        await page.getByLabel('Ore', { exact: true }).fill('1.5');
        await page.getByLabel('Movimento', { exact: true }).selectOption('aumenta');
        await page.getByLabel('Nota', { exact: true }).fill('Movimento E2E');
        await page.getByRole('button', { name: 'Registra movimento' }).click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.getByText('Movimento E2E', { exact: false })).toBeVisible({ timeout: 20_000 });

        const testoSaldoDopo = await page.getByText('Monte ore attuale:', { exact: false }).innerText();
        const saldoDopo = Number(testoSaldoDopo.match(/(-?\d+(\.\d+)?)h/)?.[1]);
        expect(saldoDopo).toBeCloseTo(saldoIniziale + 1.5, 2);

        // Scenario: il monte ore può risultare negativo, senza alcun
        // blocco — una riduzione ben più grande di qualunque saldo
        // realistico (5000h) porta il saldo sotto zero senza errori.
        await page.getByLabel('Ore', { exact: true }).fill('5000');
        await page.getByLabel('Movimento', { exact: true }).selectOption('riduce');
        await page.getByLabel('Nota', { exact: true }).fill('Riduzione ampia E2E (per testare il saldo negativo)');
        await page.getByRole('button', { name: 'Registra movimento' }).click();
        await expect(page.getByRole('alert')).toHaveCount(0);

        const testoSaldoNegativo = await page.getByText('Monte ore attuale:', { exact: false }).innerText();
        const saldoNegativo = Number(testoSaldoNegativo.match(/(-?\d+(\.\d+)?)h/)?.[1]);
        expect(saldoNegativo).toBeLessThan(0);

        // Compensazione (vedi nota in testa al file): due movimenti
        // uguali e opposti (+5000h, poi -1.5h) riportano il saldo
        // esattamente al valore di partenza.
        await page.getByLabel('Ore', { exact: true }).fill('5000');
        await page.getByLabel('Movimento', { exact: true }).selectOption('aumenta');
        await page.getByLabel('Nota', { exact: true }).fill('Correzione E2E (riduzione ampia)');
        await page.getByRole('button', { name: 'Registra movimento' }).click();
        await expect(page.getByRole('alert')).toHaveCount(0);

        await page.getByLabel('Ore', { exact: true }).fill('1.5');
        await page.getByLabel('Movimento', { exact: true }).selectOption('riduce');
        await page.getByLabel('Nota', { exact: true }).fill('Correzione E2E');
        await page.getByRole('button', { name: 'Registra movimento' }).click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.getByText('Correzione E2E', { exact: false }).first()).toBeVisible({ timeout: 20_000 });

        const testoSaldoFinale = await page.getByText('Monte ore attuale:', { exact: false }).innerText();
        const saldoFinale = Number(testoSaldoFinale.match(/(-?\d+(\.\d+)?)h/)?.[1]);
        expect(saldoFinale).toBeCloseTo(saldoIniziale, 2);
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
