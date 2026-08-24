import path from 'node:path';
import fs from 'node:fs';
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export type Ruolo = 'admin' | 'maestra' | 'assistente' | 'genitore';

// "Oggi"/"ieri" nel fuso Europe/Rome, per i test che devono navigare a
// una data diversa da oggi (specs/13 - segna-presenza.md, specs/14 -
// segna-pasto.md, regola "sola data odierna per la maestra") —
// indipendente dal fuso orario della macchina che esegue Playwright.
// Duplica intenzionalmente la logica di lib/date.ts: qui è codice di
// test, fuori dallo scope di jscpd (vedi .jscpd.json, path: app/components/lib).
export function dataOggiRoma(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
}

export function dataIeriRoma(): string {
  const [anno, mese, giorno] = dataOggiRoma().split('-').map(Number);
  const d = new Date(Date.UTC(anno, mese - 1, giorno - 1, 12));
  return d.toISOString().slice(0, 10);
}

// Il form di creazione bambino su /admin (specs/50 - amministrazione_base.md)
// e i mini-form "assegna rapidamente" (uno per bambino "senza classe")
// condividono lo stesso name="sezione_id": gli <form> non si annidano
// mai in HTML, quindi risalire al <form> che contiene il pulsante
// "Aggiungi bambino" individua sempre e solo il form di creazione, a
// differenza di un <div> (che invece può avere antenati anch'essi <div>
// che "contengono" lo stesso elemento — vedi uso di `has` più sotto).
export function formCreaBambino(page: Page) {
  return page.locator('form', { has: page.getByRole('button', { name: 'Aggiungi bambino' }) });
}

// Il nome di una sezione compare anche come <option> (nel form Bambini
// e in ogni mini-form "assegna rapidamente" della sezione "Bambini
// senza classe o disattivati" — specs/50) e come intestazione <h3> nel
// gruppo classi (specs/50): mi limito all'unico <li> dell'elenco
// Sezioni, escludendo quelli che hanno un <select> di assegnazione
// (solo le righe bambino ce l'hanno). Non filtro sul testo del
// pulsante ("Disattiva"/"Riattiva") perché cambia proprio durante i
// test che verificano il toggle.
export function rigaSezione(page: Page, nomeSezione: string) {
  return page
    .locator('li', { hasText: nomeSezione })
    .filter({ hasNot: page.locator('select[name="sezione_id"]') });
}

export function credenziali(ruolo: Ruolo): { email: string; password: string } | null {
  const prefisso = `E2E_${ruolo.toUpperCase()}`;
  const email = process.env[`${prefisso}_EMAIL`];
  const password = process.env[`${prefisso}_PASSWORD`];
  if (!email || !password) return null;
  return { email, password };
}

// Vero se le credenziali per il ruolo sono configurate (via .env.local in
// locale, via secret di GitHub Actions in CI). Usalo con test.skip() nei
// test che richiedono una sessione autenticata, così la suite resta verde
// finché gli account di test non sono stati creati e collegati.
export function hasCredenziali(ruolo: Ruolo): boolean {
  return credenziali(ruolo) !== null;
}

// Cartella dove il progetto "setup" (e2e/auth.setup.ts) salva la sessione
// già autenticata di ogni ruolo, una sola volta per l'intera esecuzione
// della suite. Riusarla evita che decine di test facciano ciascuno un
// login reale in parallelo — oltre a essere più lento, Supabase Auth ha
// una protezione anti-brute-force che con molti login concorrenti sullo
// stesso account finisce per bloccarli (visto in pratica: molti test
// andavano in timeout su page.waitForURL('/dashboard') perché il login
// veniva rifiutato, non per un problema di rete).
const CARTELLA_AUTH = path.join(process.cwd(), 'playwright', '.auth');

export function fileSessione(ruolo: Ruolo): string {
  return path.join(CARTELLA_AUTH, `${ruolo}.json`);
}

// Percorso da passare a test.use({ storageState }) — undefined se il
// setup non ha (ancora) prodotto una sessione per questo ruolo (perché le
// credenziali non sono configurate): in quel caso i singoli test restano
// responsabili di saltarsi con test.skip(!hasCredenziali(ruolo), ...).
export function statoAutenticazione(ruolo: Ruolo): string | undefined {
  const file = fileSessione(ruolo);
  return fs.existsSync(file) ? file : undefined;
}

// Effettua il login e attende il redirect alla dashboard. La chiamata
// reale a Supabase Auth può richiedere diversi secondi: non ridurre il
// timeout di navigazione sotto ai 20s.
export async function loginCome(page: Page, ruolo: Ruolo): Promise<void> {
  const cred = credenziali(ruolo);
  if (!cred) {
    throw new Error(
      `Credenziali E2E per il ruolo "${ruolo}" non configurate — usa hasCredenziali() con test.skip() prima di chiamare loginCome().`
    );
  }
  await page.goto('/login');
  await page.getByLabel('Email').fill(cred.email);
  await page.getByLabel('Password', { exact: true }).fill(cred.password);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await page.waitForURL('/dashboard', { timeout: 20_000 });
}

// Esegue axe-core sulla pagina corrente e fa fallire il test se trova
// violazioni di impatto "serious" o "critical". Le violazioni "minor"/
// "moderate" vengono loggate ma non bloccano la suite, per non renderla
// fragile su dettagli stilistici mentre l'app matura.
export async function nessunaViolazioneA11yGrave(page: Page): Promise<void> {
  const risultati = await new AxeBuilder({ page }).analyze();
  const gravi = risultati.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );

  if (risultati.violations.length > gravi.length) {
    console.warn(
      `[a11y] ${risultati.violations.length - gravi.length} violazioni minor/moderate su ${page.url()} (non bloccanti):`,
      risultati.violations
        .filter((v) => v.impact !== 'serious' && v.impact !== 'critical')
        .map((v) => v.id)
    );
  }

  expect(
    gravi,
    gravi.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.helpUrl}`).join('\n')
  ).toEqual([]);
}
