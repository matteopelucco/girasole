// Fixture e2e "utente proprio" (issue #230, sotto-issue c di #172 e #77).
//
// PERCHÉ. 17, 18 e 19 abilitano e disabilitano "Ore di lavoro" (e assegnano
// un profilo orario) sugli account di test condivisi (admin, maestra): in
// parallelo tra loro un test abilitava mentre un altro verificava che
// l'account NON fosse abilitato. Per questo giravano in un solo worker
// (`chromium-stato-condiviso`, playwright.config.ts). Con questa fixture
// ogni test che ha bisogno di un flag attivo crea il SUO utente di staff,
// con email unica, lo usa e lo elimina alla fine: gli account condivisi non
// vengono più modificati da nessuno e i test che li usano "così come sono"
// (es. "senza abilitazione...") sono deterministici.
//
// COME SI USA (`page` resta quella del test: con `test.use({ storageState:
// statoAutenticazione('admin') })` è l'admin condiviso, che agisce sull'utente
// creato).
//   import { test, expect } from './fixture-utente';
//
//   test('...', async ({ page, creaUtente, apriComeUtente }) => {
//     const utente = await creaUtente({ ruolo: 'maestra', abilitato: true });
//     const paginaUtente = await apriComeUtente(utente); // sessione propria
//     ...
//   });
//
// `creaUtente({ ruolo, abilitato })` crea l'utente dalla stessa schermata
// che usa l'admin (/admin/maestre, helper in ./pagina-personale, nessuna chiave service_role: il server
// dell'app fa da sé la parte privilegiata), in un contesto di browser a
// parte con la sessione dell'admin di test. Il ruolo di default è
// `maestra`; `abilitato: true` spunta "Ore di lavoro" già alla creazione.
// `apriComeUtente(utente)` fa il login come quell'utente in un contesto
// separato e ritorna la sua pagina: non tocca la sessione dell'admin né
// quella degli altri test.
//
// PULIZIA. Il teardown di una fixture gira sempre, anche se il test fallisce:
// i contesti aperti da `apriComeUtente` vengono chiusi e gli utenti creati
// vengono eliminati dalla scheda dell'admin; ore di lavoro, monte ore e
// movimenti vanno via con l'utente (ON DELETE CASCADE su profili). Se la
// cancellazione non riesce il test fallisce: una perdita non resta
// silenziosa. Resta fuori solo il caso di un worker ucciso a metà: l'utente
// orfano ha email `e2e-fx-...@example.com`, è innocuo e lo ripulisce il
// reset del DB di test che la CI fa ad ogni PR (ADR-0006, ADR-0008).
//
// Dati sempre fittizi (nome "Fixture", telefono di prova): mai dati reali.
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { hasCredenziali, statoAutenticazione } from './helpers';
import { creaUtenteDaForm, eliminaUtentePerEmail } from './pagina-personale';

// Rispetta la regola di complessità delle password dell'app (REGOLA_PASSWORD).
const PASSWORD_UTENTE_FIXTURE = 'PasswordE2E!1';

export type RuoloStaffFixture = 'admin' | 'maestra' | 'assistente';

export type OpzioniUtenteFixture = {
  ruolo?: RuoloStaffFixture;
  abilitato?: boolean;
};

export type UtenteFixture = {
  email: string;
  password: string;
  ruolo: RuoloStaffFixture;
};

function emailUnica(): string {
  const casuale = Math.floor(Math.random() * 36 ** 4).toString(36);
  return `e2e-fx-${Date.now().toString(36)}${casuale}@example.com`;
}

async function creaUtenteDaAdmin(page: Page, opzioni: Required<OpzioniUtenteFixture>): Promise<UtenteFixture> {
  const email = emailUnica();
  await creaUtenteDaForm(page, {
    nome: 'Fixture',
    cognome: 'Utente',
    email,
    password: PASSWORD_UTENTE_FIXTURE,
    ruolo: opzioni.ruolo,
    oreLavoro: opzioni.abilitato,
  });
  return { email, password: PASSWORD_UTENTE_FIXTURE, ruolo: opzioni.ruolo };
}

export const test = base.extend<{
  creaUtente: (opzioni?: OpzioniUtenteFixture) => Promise<UtenteFixture>;
  apriComeUtente: (utente: UtenteFixture) => Promise<Page>;
}>({
  creaUtente: async ({ browser, baseURL }, use) => {
    base.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD (fixture utente)');
    const creati: UtenteFixture[] = [];
    let contestoAdmin: BrowserContext | null = null;
    const paginaAdmin = async () => {
      contestoAdmin ??= await browser.newContext({ baseURL, storageState: statoAutenticazione('admin') });
      return contestoAdmin.newPage();
    };

    try {
      await use(async (opzioni = {}) => {
        const pagina = await paginaAdmin();
        try {
          const utente = await creaUtenteDaAdmin(pagina, {
            ruolo: opzioni.ruolo ?? 'maestra',
            abilitato: opzioni.abilitato ?? false,
          });
          creati.push(utente);
          return utente;
        } finally {
          await pagina.close();
        }
      });
    } finally {
      const errori: string[] = [];
      for (const utente of creati) {
        try {
          const pagina = await paginaAdmin();
          try {
            await eliminaUtentePerEmail(pagina, utente.email);
          } finally {
            await pagina.close();
          }
        } catch (e) {
          errori.push(`${utente.email}: ${(e as Error).message}`);
        }
      }
      await (contestoAdmin as BrowserContext | null)?.close();
      if (errori.length > 0) {
        throw new Error(`Pulizia degli utenti fixture non riuscita: ${errori.join('; ')}`);
      }
    }
  },

  apriComeUtente: async ({ browser, baseURL }, use) => {
    const contesti: BrowserContext[] = [];
    try {
      await use(async (utente) => {
        const contesto = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
        contesti.push(contesto);
        const pagina = await contesto.newPage();
        await pagina.goto('/login');
        await pagina.getByLabel('Email').fill(utente.email);
        await pagina.getByLabel('Password', { exact: true }).fill(utente.password);
        await pagina.getByRole('button', { name: 'Accedi' }).click();
        await pagina.waitForURL('/dashboard', { timeout: 20_000 });
        return pagina;
      });
    } finally {
      for (const contesto of contesti) await contesto.close();
    }
  },
});

export { expect };
