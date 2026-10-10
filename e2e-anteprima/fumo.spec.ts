// Giro di fumo sull'anteprima di Vercel (issue #267).
//
// NON è l'e2e di `e2e/` e non risponde a nessuno `specs/NN`: controlla solo
// che l'anteprima appena distribuita sia viva — entra ed esce con i quattro
// ruoli, apre le pagine principali, salva un dato di prova (dove il ruolo
// può) e lo ripulisce, senza errori in console né violazioni gravi di
// accessibilità. Il DB è sempre quello di test (gli account E2E_* esistono
// solo lì). Vedi docs/sviluppo-dettagli.md, "Giro di fumo sull'anteprima".
//
// Differenze volute rispetto all'e2e:
//   - le credenziali mancanti fanno FALLIRE il giro (in un controllo di
//     fumo uno skip silenzioso sarebbe un falso verde);
//   - ogni ruolo fa un login vero, senza sessioni salvate;
//   - i dati di prova si chiamano "Fumo anteprima <ruolo> <tempo>" e si
//     cancellano nello stesso test; se restasse qualcosa, lo ripulisce il
//     reset del DB di test della prossima CI (ADR-0006).
// Gli helper di `e2e/helpers.ts` sono importati senza modificarli.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
  alertApp,
  clickEAttendiAzione,
  credenziali,
  nessunaViolazioneA11yGrave,
  type Ruolo,
} from '../e2e/helpers';

// --- Osservatore: errori in console, errori JS non gestiti, risposte 5xx ---

type Osservatore = { verifica: () => void };

function osserva(page: Page, testInfo: TestInfo): Osservatore {
  const origine = new URL(String(testInfo.project.use.baseURL)).origin;
  const problemi: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const sorgente = msg.location().url;
    // Il widget di feedback di Vercel sulle anteprime non è codice nostro.
    if (sorgente.includes('vercel.live')) return;
    problemi.push(`console.error: ${msg.text()} (${sorgente || 'senza origine'})`);
  });
  page.on('pageerror', (errore) => problemi.push(`errore JS non gestito: ${errore.message}`));
  page.on('response', (risposta) => {
    if (risposta.url().startsWith(origine) && risposta.status() >= 500) {
      problemi.push(`risposta ${risposta.status()} da ${risposta.url()}`);
    }
  });

  return {
    verifica: () => expect(problemi, 'errori rilevati nel browser').toEqual([]),
  };
}

// --- Passi comuni ---

// Login vero. Se l'account non c'è o la password non coincide si ferma con
// un messaggio che dice dove guardare, invece di un generico timeout.
async function accedi(page: Page, ruolo: Ruolo): Promise<void> {
  const cred = credenziali(ruolo);
  if (!cred) {
    throw new Error(
      `Mancano E2E_${ruolo.toUpperCase()}_EMAIL / E2E_${ruolo.toUpperCase()}_PASSWORD: il giro di fumo non salta i ruoli senza account.`
    );
  }
  await page.goto('/login');
  await page.getByLabel('Email').fill(cred.email);
  await page.getByLabel('Password', { exact: true }).fill(cred.password);
  await page.getByRole('button', { name: 'Accedi' }).click();

  const rifiutato = page.getByText('Credenziali non valide. Riprova.');
  await expect
    .poll(
      async () => {
        if (new URL(page.url()).pathname === '/dashboard') return 'dentro';
        if ((await rifiutato.count()) > 0) return 'rifiutato';
        return 'attesa';
      },
      { timeout: 45_000, message: `login ${ruolo}: nessuna risposta dall'anteprima` }
    )
    .not.toBe('attesa');

  if ((await rifiutato.count()) > 0) {
    throw new Error(
      `Login rifiutato per il ruolo ${ruolo}. L'anteprima punta al DB di test? Gli account E2E_* esistono solo lì e li ricrea la CI dopo ogni reset (scripts/crea-utenti-e2e.mjs): se il DB è stato appena azzerato, rilancia dopo la CI e2e.`
    );
  }
}

async function esci(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Esci' }).click();
  await expect(page).toHaveURL(/\/login/);
  // Dopo l'uscita le pagine protette tornano a chiedere l'accesso.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
}

type PaginaAttesa = {
  percorso: string;
  /** Titolo h1, se lo conosciamo con certezza; altrimenti solo il controllo generico. */
  titolo?: string;
};

// Apre la pagina e controlla: risposta non d'errore, nessun reindirizzamento
// (sessione persa o accesso negato), nessun errore a schermo, pagina non
// vuota, nessuna violazione grave di accessibilità.
async function apriEControlla(page: Page, attesa: PaginaAttesa): Promise<void> {
  const risposta = await page.goto(attesa.percorso);
  expect(risposta?.status() ?? 0, `${attesa.percorso}: risposta HTTP`).toBeLessThan(400);
  expect(new URL(page.url()).pathname, `${attesa.percorso}: reindirizzata altrove`).toBe(
    attesa.percorso
  );

  if (attesa.titolo) {
    await expect(
      page.getByRole('heading', { name: attesa.titolo, exact: true, level: 1 })
    ).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Qualcosa è andato storto' })).toHaveCount(0);
  await expect
    .poll(async () => (await page.locator('body').innerText()).trim().length, {
      message: `${attesa.percorso}: pagina vuota`,
    })
    .toBeGreaterThan(40);

  await nessunaViolazioneA11yGrave(page);
}

// Cancella un avviso di prova dal suo dettaglio, passando dalla conferma.
async function eliminaAvviso(page: Page, titolo: string): Promise<void> {
  await page.goto('/dashboard');
  const link = page.getByRole('link', { name: titolo });
  if ((await link.count()) === 0) return;
  await link.click();
  await page.waitForURL(/\/dashboard\/promemoria\/.+/);
  await page.getByRole('button', { name: 'Elimina avviso' }).click();
  await clickEAttendiAzione(page, page.getByRole('button', { name: 'Sì' }));
  await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 30_000 });
  await expect(page.getByText('Avviso eliminato.')).toBeVisible();
  await expect(page.getByText(titolo)).toHaveCount(0);
}

// Il salvataggio di prova dello staff: pubblica un avviso per tutti, lo
// vede in lista, lo cancella. Se qualcosa va storto prima della cancellazione
// tenta comunque di ripulire (senza coprire l'errore originale).
async function pubblicaEdEliminaAvviso(page: Page, ruolo: Ruolo): Promise<void> {
  const titolo = `Fumo anteprima ${ruolo} ${Date.now()}`;
  await page.goto('/dashboard');
  try {
    await page.getByPlaceholder('Titolo').fill(titolo);
    await page.getByPlaceholder("Testo dell'avviso").fill('Prova automatica: si cancella da sola.');
    await page.locator('select[name="destinatario_tipo"]').selectOption('tutti');
    await clickEAttendiAzione(page, page.getByRole('button', { name: 'Pubblica avviso' }));
    await expect(page.getByText(titolo)).toBeVisible({ timeout: 30_000 });
    await expect(alertApp(page)).toHaveCount(0);
  } catch (errore) {
    await eliminaAvviso(page, titolo).catch(() => undefined);
    throw errore;
  }
  await eliminaAvviso(page, titolo);
}

// --- Il giro ---

test.describe('Giro di fumo sull\'anteprima', () => {
  test('anonimo: login visibile, pagine protette rimandano al login', async ({ page }, testInfo) => {
    const osservatore = osserva(page, testInfo);

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Girasole' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accedi' })).toBeVisible();
    await nessunaViolazioneA11yGrave(page);

    for (const percorso of ['/dashboard', '/admin']) {
      await page.goto(percorso);
      await expect(page).toHaveURL(/\/login/);
    }
    osservatore.verifica();
  });

  test('admin: entra, apre le pagine di amministrazione, salva un avviso, esce', async ({ page }, testInfo) => {
    const osservatore = osserva(page, testInfo);
    await accedi(page, 'admin');

    const pagine: PaginaAttesa[] = [
      { percorso: '/dashboard', titolo: 'Avvisi' },
      { percorso: '/dashboard/giornata' },
      { percorso: '/dashboard/report', titolo: 'Report' },
      { percorso: '/admin', titolo: 'Sezioni' },
      { percorso: '/admin/maestre', titolo: 'Utenti e ruoli' },
      { percorso: '/admin/calendario', titolo: 'Calendario scolastico' },
      { percorso: '/admin/profili-orari', titolo: 'Profili orari' },
      { percorso: '/admin/rette' },
      { percorso: '/admin/pagamenti-bambino' },
      { percorso: '/admin/impostazioni-avanzate' },
    ];
    for (const pagina of pagine) await apriEControlla(page, pagina);

    await pubblicaEdEliminaAvviso(page, 'admin');
    await esci(page);
    osservatore.verifica();
  });

  test('maestra: entra, apre le sue pagine, salva un avviso, esce', async ({ page }, testInfo) => {
    const osservatore = osserva(page, testInfo);
    await accedi(page, 'maestra');

    for (const pagina of [
      { percorso: '/dashboard', titolo: 'Avvisi' },
      { percorso: '/dashboard/giornata' },
      { percorso: '/dashboard/report', titolo: 'Report' },
    ]) {
      await apriEControlla(page, pagina);
    }

    await pubblicaEdEliminaAvviso(page, 'maestra');
    await esci(page);
    osservatore.verifica();
  });

  test('assistente: entra, apre le sue pagine, salva un avviso, esce', async ({ page }, testInfo) => {
    const osservatore = osserva(page, testInfo);
    await accedi(page, 'assistente');

    for (const pagina of [
      { percorso: '/dashboard', titolo: 'Avvisi' },
      { percorso: '/dashboard/giornata' },
    ]) {
      await apriEControlla(page, pagina);
    }

    await pubblicaEdEliminaAvviso(page, 'assistente');
    await esci(page);
    osservatore.verifica();
  });

  test('genitore: entra (sola lettura, nessun salvataggio), non entra in staff e admin, esce', async ({ page }, testInfo) => {
    const osservatore = osserva(page, testInfo);
    await accedi(page, 'genitore');

    await apriEControlla(page, { percorso: '/dashboard' });
    await expect(page.getByText('Ruolo: genitore')).toBeVisible();

    // Le aree riservate allo staff rimandano alla dashboard del genitore.
    for (const percorso of ['/admin', '/dashboard/giornata', '/dashboard/report']) {
      await page.goto(percorso);
      await expect(page).toHaveURL((url) => url.pathname === '/dashboard');
    }

    await esci(page);
    osservatore.verifica();
  });
});
