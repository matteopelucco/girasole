// Requisito: specs/57 - reset-giornata.md
//
// ATTENZIONE: il test "registrare... poi resettarli" scrive davvero
// presenze/pasti sul progetto Supabase di test per una data lontana e
// fissa (2019-05-15, mai una data reale usata dall'asilo), e li elimina
// da solo alla fine — stesso genere di pulizia automatica delle altre
// suite che scrivono dati veri.
import { test, expect } from '@playwright/test';
import {
  apriGiornata,
  clickEAttendiAzione,
  colonnaPasto,
  colonnaPresenza,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  primaCardConPulsante,
  statoAutenticazione,
} from './helpers';

const DATA_TEST = '2019-05-15';

test.describe('57 — Reset giornata', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
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

  test('registrare presenza e pasto, poi resettarli con doppia conferma', async ({ page }) => {
    // Registro una presenza per la prima classe/bambino disponibile,
    // sulla data di test (l'admin può scrivere su qualunque data,
    // specs/13).
    // Schermata unica "Presenze e pasti" (specs/10): presenza e pasto
    // dello stesso bambino sono nella stessa card.
    await apriGiornata(page, DATA_TEST);
    const card = primaCardConPulsante(page, 'Presenza', 'Presente');
    test.skip((await card.count()) === 0, 'nessun bambino visibile per questo account');
    // Attendo la risposta della Server Action: con un'attesa fissa il goto
    // successivo poteva interrompere il salvataggio (issue #70).
    await clickEAttendiAzione(page, colonnaPresenza(card).getByRole('button', { name: 'Presente' }));

    // Registro anche un pasto, stessa data e stesso bambino.
    await clickEAttendiAzione(page, colonnaPasto(card).getByRole('button', { name: 'Sì' }));

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
    await page.getByRole('button', { name: 'Sì, elimina tutto' }).click();
    await page.waitForTimeout(1000);
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
      await page.goto('/admin/reset-giornata');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await context.close();
    }
  });
});
