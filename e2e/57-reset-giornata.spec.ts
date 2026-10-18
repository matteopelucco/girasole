// Requisito: specs/57 - reset-giornata.md
//
// ATTENZIONE: il test "registrare... poi resettarli" scrive davvero
// presenze/pasti sul progetto Supabase di test per una data lontana e
// fissa (2019-05-15, mai una data reale usata dall'asilo), e li elimina
// da solo alla fine — stesso genere di pulizia automatica delle altre
// suite che scrivono dati veri.
//
// Il bambino su cui scrive è proprio del test (fixture `bambino`,
// e2e/fixture-bambino.ts, issue #249): non "il primo della lista", che in un
// run parallelo poteva essere il bambino di un altro test, eliminato a metà.
import { test, expect } from './fixture-bambino';
import { clickEAttendiAzione, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';
import { apriGiornata, bottonePasto, bottonePresenza, cardConPulsante, segnaStato } from './pagina-giornata';

const DATA_TEST = '2019-05-15';

test.describe('57 — Reset giornata', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  // I tre test seguenti non dipendono dal calendario né scrivono dati:
  // controllano solo menu e pagina indice (nessun reset eseguito).
  test('"Impostazioni" è in fondo al menu con "Reset giornata", "Parametri di funzionamento", "Azioni" e "Utenti" rientrate sotto', async ({
    page,
  }) => {
    await page.goto('/admin');
    const menu = page.getByRole('navigation');
    const voci = menu.getByRole('link');
    const impostazioni = menu.getByRole('link', { name: 'Impostazioni', exact: true });
    const reset = menu.getByRole('link', { name: 'Reset giornata', exact: true });
    const utenti = menu.getByRole('link', { name: 'Utenti', exact: true });

    // Ultime cinque voci: "Impostazioni", "Reset giornata", "Parametri di funzionamento"
    // (specs/62), "Azioni" (specs/63) e "Utenti".
    await expect(voci.nth(-5)).toHaveText(/Impostazioni/);
    await expect(voci.nth(-5)).toHaveAttribute('href', '/admin/impostazioni-avanzate');
    await expect(voci.nth(-4)).toHaveAttribute('href', '/admin/reset-giornata');
    await expect(voci.nth(-3)).toHaveAttribute('href', '/admin/parametri-funzionamento');
    await expect(voci.nth(-2)).toHaveAttribute('href', '/admin/cron-job');
    await expect(voci.last()).toHaveText(/Utenti/);
    await expect(voci.last()).toHaveAttribute('href', '/admin/maestre');
    await expect(menu.getByRole('link', { name: 'Impostazioni avanzate' })).toHaveCount(0);

    // Le sottosezioni stanno sotto "Impostazioni" e rientrate; "Utenti" non è prima di "Calendario scolastico".
    const y = async (l: typeof utenti) => (await l.boundingBox())!.y;
    const x = async (l: typeof utenti) => (await l.locator('span').first().boundingBox())!.x;
    expect(await y(impostazioni)).toBeLessThan(await y(reset));
    expect(await y(reset)).toBeLessThan(await y(utenti));
    expect(await x(reset)).toBeGreaterThan(await x(impostazioni));
    expect(await x(utenti)).toBeGreaterThan(await x(impostazioni));
    expect(await y(menu.getByRole('link', { name: 'Calendario scolastico', exact: true }))).toBeLessThan(
      await y(impostazioni)
    );

    // Sulla pagina del reset la voce "Reset giornata" è evidenziata.
    await reset.click();
    await page.waitForURL('/admin/reset-giornata');
    await expect(menu.getByRole('link', { name: 'Reset giornata', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('la pagina Impostazioni mostra i quattro riquadri delle sottosezioni e "Reset giornata" porta alla pagina di reset', async ({
    page,
  }) => {
    await page.goto('/admin/impostazioni-avanzate');
    await expect(page.getByRole('heading', { name: 'Impostazioni', exact: true })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);

    // Riquadri nello stesso ordine delle voci rientrate del menu, ciascuno con descrizione.
    const riquadri = page.getByRole('main').getByRole('link');
    await expect(riquadri).toHaveCount(4);
    const attesi = [
      ['Reset giornata', '/admin/reset-giornata', 'presenze e i pasti'],
      ['Parametri di funzionamento', '/admin/parametri-funzionamento', 'ambiente'],
      ['Azioni', '/admin/cron-job', 'job pianificati'],
      ['Utenti', '/admin/maestre', 'ruoli'],
    ] as const;
    for (const [i, [titolo, href, testo]] of attesi.entries()) {
      await expect(riquadri.nth(i)).toContainText(titolo);
      await expect(riquadri.nth(i)).toContainText(testo);
      await expect(riquadri.nth(i)).toHaveAttribute('href', href);
    }

    const azione = riquadri.first();
    const riquadro = await azione.boundingBox();
    expect(riquadro?.height ?? 0).toBeGreaterThanOrEqual(44);

    await azione.click();
    await page.waitForURL('/admin/reset-giornata');
    await expect(page.getByRole('heading', { name: 'Reset presenze e pasti di una giornata' })).toBeVisible();
  });

  test('pagina raggiungibile con selettore data + accessibilità', async ({ page }) => {
    await page.goto('/admin/reset-giornata');
    await expect(page.getByRole('heading', { name: 'Reset presenze e pasti di una giornata' })).toBeVisible();
    await expect(page.getByLabel('Data')).toBeVisible();
    await nessunaViolazioneA11yGrave(page);
  });

  test('una data senza nulla registrato mostra 0/0 e il pulsante disabilitato', async ({ page }) => {
    await page.goto('/admin/reset-giornata?data=2018-01-01');
    await expect(page.getByText('0 presenze')).toBeVisible();
    await expect(page.getByText('0 pasti')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resetta giornata' })).toBeDisabled();
  });

  test('registrare presenza e pasto, poi resettarli con doppia conferma', async ({ page, bambino }) => {
    // Registro una presenza per il bambino fixture, sulla data di test
    // (l'admin può scrivere su qualunque data, specs/13).
    // Schermata unica "Presenze e pasti" (specs/10): presenza e pasto
    // dello stesso bambino sono nella stessa card.
    await apriGiornata(page, DATA_TEST);
    const card = await cardConPulsante(page, bambino, 'Presenza', 'Presente');
    // Attendo la risposta della Server Action: con un'attesa fissa il goto
    // successivo poteva interrompere il salvataggio (issue #70).
    await segnaStato(page, bottonePresenza(card, 'Presente'));

    // Registro anche un pasto, stessa data e stesso bambino.
    await segnaStato(page, bottonePasto(card, 'Sì'));

    await page.goto(`/admin/reset-giornata?data=${DATA_TEST}`);
    await expect(page.getByText(/^[1-9]\d* presenze$/)).toBeVisible();
    await expect(page.getByText(/^[1-9]\d* pasti$/)).toBeVisible();

    // "Annulla" chiude il riquadro di conferma senza eliminare nulla.
    await page.getByRole('button', { name: 'Resetta giornata' }).click();
    await expect(page.getByText(/Sei sicuro di voler eliminare/)).toBeVisible();
    await page.getByRole('button', { name: 'Annulla' }).click();
    await page.reload();
    await expect(page.getByText(/^[1-9]\d* presenze$/)).toBeVisible();

    // Il secondo click di conferma elimina davvero.
    await page.getByRole('button', { name: 'Resetta giornata' }).click();
    await clickEAttendiAzione(page, page.getByRole('button', { name: 'Sì, elimina tutto' }));
    await page.reload();
    await expect(page.getByText('0 presenze')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('0 pasti')).toBeVisible();
  });

  test('accesso negato a chi non è admin', async ({ browser }) => {
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);

      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      // La voce non compare nel menu di chi non è admin...
      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Impostazioni', exact: true })).toHaveCount(0);

      // ...e le pagine admin respingono alla dashboard.
      for (const url of ['/admin/impostazioni-avanzate', '/admin/reset-giornata']) {
        await page.goto(url);
        await page.waitForURL('/dashboard', { timeout: 20_000 });
      }
      await context.close();
    }
  });
});
