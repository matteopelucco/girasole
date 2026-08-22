// Requisito: specs/05 - feedback.md
//
// ATTENZIONE: questi test scrivono davvero in `anni_scolastici`/
// `sezioni` sul progetto Supabase di test — vedi la nota in
// 50-amministrazione_base.spec.ts.
//
// Lo scenario "errore non gestito puntualmente dalla pagina" (error
// boundary globale, app/error.tsx) non ha un test E2E dedicato: per
// osservarlo servirebbe un errore server imprevisto e riproducibile in
// modo deterministico nel flusso presenza/pasto, che condivide un
// form con più azioni per pulsante (vedi Regole in specs/05) — non c'è
// un modo pulito per forzarlo dall'interfaccia senza corrompere dati
// condivisi del progetto di test. Il meccanismo stesso (component
// error.tsx di Next.js) è una convenzione framework, non codice
// applicativo su misura.
import { test, expect } from '@playwright/test';
import { hasCredenziali, nessunaViolazioneA11yGrave, statoAutenticazione } from './helpers';

test.describe('05 — Feedback sulle azioni', () => {
  test.use({ storageState: statoAutenticazione('admin') });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');
  });

  test('avvio ed esecuzione: il pulsante si disabilita finché il server non risponde', async ({
    page,
  }) => {
    await page.goto('/admin');
    const nome = `Sezione Feedback E2E ${Date.now()}`;
    await page.getByPlaceholder('Nome sezione (es. Girasoli)').fill(nome);

    // Rallenta la risposta della server action per poter osservare lo
    // stato "in corso", altrimenti troppo rapido da intercettare in un
    // test reale contro Supabase.
    await page.route('**/admin', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((r) => setTimeout(r, 1500));
      }
      await route.continue();
    });

    await page.getByRole('button', { name: 'Crea' }).nth(1).click();

    const pulsanteInAttesa = page.locator('button[aria-busy="true"]');
    await expect(pulsanteInAttesa).toBeVisible();
    await expect(pulsanteInAttesa).toBeDisabled();

    // Aspetto che la richiesta rallentata dalla route (1.5s) sia
    // arrivata a destinazione prima di rimuovere l'intercettazione:
    // altrimenti route.continue() rischia di essere chiamato su una
    // route già gestita da page.unroute().
    await expect(page.getByText(nome)).toBeVisible({ timeout: 20_000 });
    await page.unroute('**/admin');
    // Terminata l'azione, il pulsante torna disponibile.
    await expect(page.locator('button[aria-busy="true"]')).toHaveCount(0);
  });

  test('azione riuscita: solo l\'effetto visibile, nessun banner aggiuntivo', async ({ page }) => {
    await page.goto('/admin');
    const nome = `Anno Feedback E2E ${Date.now()}`;
    await page.getByPlaceholder('Nome anno scolastico (es. 2026/2027)').fill(nome);
    await page.getByRole('button', { name: 'Crea' }).first().click();

    await expect(page.getByText(nome)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[role="alert"]')).toHaveCount(0);
    await nessunaViolazioneA11yGrave(page);
  });

  test('azione fallita per validazione: messaggio chiaro vicino al form', async ({ page }) => {
    await page.goto('/admin');
    // Nessun campo dell'app lascia passare dati non validi lato client:
    // rimuovo `required` via JS per verificare la validazione lato
    // server (stesso approccio di 03-utenti-e-ruoli.spec.ts).
    await page.evaluate(() => {
      document
        .querySelectorAll('form input[required]')
        .forEach((el) => el.removeAttribute('required'));
    });

    await page.getByRole('button', { name: 'Crea' }).first().click();

    const banner = page.getByRole('alert').filter({ hasText: "Inserisci un nome per l'anno scolastico." });
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await nessunaViolazioneA11yGrave(page);
  });

  test('azione fallita per un errore del server: messaggio chiaro + dettaglio tecnico', async ({
    page,
  }) => {
    const nome = `Anno Duplicato E2E ${Date.now()}`;

    await page.goto('/admin');
    await page.getByPlaceholder('Nome anno scolastico (es. 2026/2027)').fill(nome);
    await page.getByRole('button', { name: 'Crea' }).first().click();
    await expect(page.getByText(nome)).toBeVisible({ timeout: 20_000 });

    // Ripeto lo stesso nome: viola il vincolo di unicità su
    // anni_scolastici.nome (supabase/migrations/0006_data_types.sql) —
    // un errore reale del database, non simulato.
    await page.getByPlaceholder('Nome anno scolastico (es. 2026/2027)').fill(nome);
    await page.getByRole('button', { name: 'Crea' }).first().click();

    const banner = page.getByRole('alert').filter({ hasText: "Impossibile creare l'anno scolastico." });
    await expect(banner).toBeVisible({ timeout: 20_000 });
    // Dettaglio tecnico per il troubleshooting: il messaggio grezzo di
    // Postgres per la violazione del vincolo di unicità.
    await expect(banner).toContainText(/duplicate key|unique constraint/i);
  });
});
