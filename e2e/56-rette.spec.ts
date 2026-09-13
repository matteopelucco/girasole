// Requisito: specs/56 - rette.md
//
// ATTENZIONE: questi test creano davvero anni scolastici, sezioni e
// bambini sul progetto Supabase di test, e impostano un anno
// scolastico come corrente (stato globale, condiviso con tutta la
// suite — vedi il commento sullo scenario "nessun anno scolastico
// corrente" più sotto). Nessuno di questi elementi viene eliminato
// alla fine (stesso pattern già in uso per i bambini di prova, vedi
// 50-amministrazione_base.spec.ts): l'ultimo anno scolastico impostato
// come corrente resta tale anche dopo la suite.
import { test, expect, type Page } from '@playwright/test';
import { formCreaBambino, hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

// Crea un anno scolastico con anno di inizio, lo imposta come corrente,
// crea una sezione assegnata a quell'anno e un bambino attivo in quella
// sezione. Restituisce i nomi usati, per farci asserzioni.
async function creaAnnoSezioneEBambino(page: Page) {
  const suffisso = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const nomeAnno = `E2E Rette ${suffisso}`;
  const nomeSezione = `Sezione Rette E2E ${suffisso}`;
  const cognomeBambino = `E2eRette${suffisso}`;

  await page.goto('/admin');
  await page.getByPlaceholder('Nome anno scolastico (es. 2026/2027)').fill(nomeAnno);
  await page.getByLabel('Anno di inizio').fill('2031');
  await page.getByRole('button', { name: 'Crea' }).first().click();

  const rigaAnno = page.locator('li', { hasText: nomeAnno });
  await expect(rigaAnno).toBeVisible({ timeout: 20_000 });
  await rigaAnno.getByRole('button', { name: 'Imposta come corrente' }).click();
  await expect(rigaAnno.getByText('Corrente', { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByPlaceholder('Nome sezione (es. Girasoli)').fill(nomeSezione);
  await page.getByLabel('Anno scolastico').selectOption({ label: nomeAnno });
  await page.getByRole('button', { name: 'Crea' }).nth(1).click();
  await expect(page.getByText(nomeSezione, { exact: false }).first()).toBeVisible({ timeout: 20_000 });

  const formBambino = formCreaBambino(page);
  await page.getByPlaceholder('Nome', { exact: true }).fill('Rette');
  await page.getByPlaceholder('Cognome').fill(cognomeBambino);
  await page.getByLabel('Data di nascita').fill('2022-05-05');
  await page.getByLabel('Sesso').selectOption('F');
  await formBambino.locator('select[name="sezione_id"]').selectOption({ label: nomeSezione });
  await page.getByRole('button', { name: 'Aggiungi bambino' }).click();
  await expect(page.getByText(cognomeBambino, { exact: false })).toBeVisible({ timeout: 20_000 });

  return { nomeAnno, nomeSezione, cognomeBambino };
}

test.describe('56 — Rette', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  test('impostare l\'anno scolastico corrente', async ({ page }) => {
    const suffisso = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const nomeAnno = `E2E Corrente ${suffisso}`;

    await page.goto('/admin');
    await page.getByPlaceholder('Nome anno scolastico (es. 2026/2027)').fill(nomeAnno);
    await page.getByLabel('Anno di inizio').fill('2032');
    await page.getByRole('button', { name: 'Crea' }).first().click();

    const rigaAnno = page.locator('li', { hasText: nomeAnno });
    await expect(rigaAnno).toBeVisible({ timeout: 20_000 });
    await expect(rigaAnno.getByText('Corrente', { exact: true })).toHaveCount(0);

    await rigaAnno.getByRole('button', { name: 'Imposta come corrente' }).click();
    await expect(rigaAnno.getByText('Corrente', { exact: true })).toBeVisible({ timeout: 20_000 });

    // Resta corrente anche dopo un ricaricamento.
    await page.reload();
    await expect(rigaAnno.getByText('Corrente', { exact: true })).toBeVisible();
  });

  test('nessun anno scolastico corrente: messaggio invece di tabella vuota', async ({ page }) => {
    await page.goto('/admin');
    const giaUnoCorrente = await page.getByText('Corrente', { exact: true }).count();
    test.skip(
      giaUnoCorrente > 0,
      'un anno scolastico è già impostato come corrente sul progetto di test — scenario non isolabile senza alterare lo stato di altri test'
    );

    await page.goto('/admin/rette');
    await expect(page.getByText(/Nessun anno scolastico è impostato come corrente/)).toBeVisible();
  });

  test('vedere la tabella rette dell\'anno scolastico corrente + accessibilità', async ({ page }) => {
    const { nomeAnno, nomeSezione, cognomeBambino } = await creaAnnoSezioneEBambino(page);

    await page.goto('/admin/rette');
    await expect(page.getByRole('heading', { name: new RegExp(`Rette.*${nomeAnno}`) })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Settembre' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Giugno' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Totale' })).toBeVisible();

    const rigaBambino = page.locator('tr', { hasText: cognomeBambino });
    await expect(rigaBambino).toBeVisible();
    await expect(rigaBambino.getByText(nomeSezione)).toBeVisible();
    // Nessun pagamento ancora registrato: 0,00 su ogni mese e sul totale.
    await expect(rigaBambino.getByRole('cell', { name: '0,00' }).first()).toBeVisible();

    await nessunaViolazioneA11yGrave(page);
  });

  test('aprire il dettaglio rette di un bambino', async ({ page }) => {
    const { cognomeBambino } = await creaAnnoSezioneEBambino(page);

    await page.goto('/admin/rette');
    const rigaBambino = page.locator('tr', { hasText: cognomeBambino });
    await rigaBambino.getByRole('link', { name: new RegExp(cognomeBambino) }).click();
    await page.waitForURL(/\/admin\/rette\/.+/);

    await expect(page.getByRole('heading', { name: new RegExp(cognomeBambino) })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Settembre' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Totale' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '0,00' }).first()).toBeVisible();

    await nessunaViolazioneA11yGrave(page);
  });

  test('accesso negato a chi non è admin', async ({ browser }) => {
    for (const ruolo of ['maestra', 'assistente', 'genitore'] as const) {
      test.skip(!hasCredenziali(ruolo), `richiede E2E_${ruolo.toUpperCase()}_EMAIL/PASSWORD`);
      const stato = statoAutenticazione(ruolo);
      test.skip(!stato, `sessione non disponibile per ${ruolo}`);

      const context = await browser.newContext({ storageState: stato });
      const page = await context.newPage();
      await page.goto('/admin/rette');
      await page.waitForURL('/dashboard', { timeout: 20_000 });
      await context.close();
    }
  });
});
