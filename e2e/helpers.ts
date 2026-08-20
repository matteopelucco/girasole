import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export type Ruolo = 'admin' | 'maestra' | 'genitore';

function credenziali(ruolo: Ruolo): { email: string; password: string } | null {
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
  await page.getByLabel('Password').fill(cred.password);
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
