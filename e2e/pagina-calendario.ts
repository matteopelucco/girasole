// Helper e2e per la sezione "Calendario Google" di "Parametri di funzionamento"
// (specs/64 - calendario-eventi.md).
//
// STRUTTURA. Una sezione (ruolo "region", titolo "Calendario Google") con lo
// stato (`data-testid="stato-calendario"`: "Sincronizzazione attiva" o
// "Sincronizzazione disattivata"), il campo "Indirizzo iCal del calendario" e il
// pulsante "Salva indirizzo". Con un indirizzo salvato compare il segnaposto
// (`data-testid="indirizzo-calendario"`) e il pulsante "Mostra indirizzo", che
// apre la richiesta della password ("La tua password", "Verifica e mostra").
// L'indirizzo non è mai nella pagina finché non si verifica la password.
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { clickEAttendiAzione, credenziali } from './helpers';

export const PERCORSO_PARAMETRI = '/admin/parametri-funzionamento';
export const STATO_ATTIVA = 'Sincronizzazione attiva';
export const STATO_DISATTIVATA = 'Sincronizzazione disattivata';

export function sezioneCalendario(page: Page): Locator {
  return page.getByRole('region', { name: 'Calendario Google' });
}

export function statoCalendario(page: Page): Locator {
  return sezioneCalendario(page).getByTestId('stato-calendario');
}

export function campoIndirizzo(page: Page): Locator {
  return sezioneCalendario(page).getByLabel('Indirizzo iCal del calendario', { exact: true });
}

export function indirizzoCalendario(page: Page): Locator {
  return sezioneCalendario(page).getByTestId('indirizzo-calendario');
}

export function pulsanteMostraIndirizzo(page: Page): Locator {
  return sezioneCalendario(page).getByRole('button', { name: 'Mostra indirizzo', exact: true });
}

export function pulsanteNascondiIndirizzo(page: Page): Locator {
  return sezioneCalendario(page).getByRole('button', { name: 'Nascondi indirizzo', exact: true });
}

export async function salvaIndirizzo(page: Page, valore: string): Promise<void> {
  await campoIndirizzo(page).fill(valore);
  await clickEAttendiAzione(page, sezioneCalendario(page).getByRole('button', { name: 'Salva indirizzo', exact: true }));
}

// Porta la sezione allo stato voluto, attendendo che lo stato sia aggiornato.
export async function impostaIndirizzo(page: Page, valore: string): Promise<void> {
  await page.goto(PERCORSO_PARAMETRI);
  await salvaIndirizzo(page, valore);
  await expect(statoCalendario(page)).toHaveText(valore === '' ? STATO_DISATTIVATA : STATO_ATTIVA);
}

export async function verificaPassword(page: Page, password: string): Promise<void> {
  await pulsanteMostraIndirizzo(page).click();
  await sezioneCalendario(page).getByLabel('La tua password', { exact: true }).fill(password);
  await clickEAttendiAzione(page, sezioneCalendario(page).getByRole('button', { name: 'Verifica e mostra' }));
}

export function passwordAdmin(): string {
  return credenziali('admin')!.password;
}

// Lancia il cron notturno come Vercel Cron (secret nell'intestazione) e
// ritorna il corpo JSON della risposta. Il report è prodotto come sempre.
export async function lanciaCronNotturno(
  request: APIRequestContext
): Promise<{ testo: string; json: { calendario: Record<string, unknown> } & Record<string, unknown> }> {
  const risposta = await request.get('/api/cron/report-presenze', {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(risposta.status(), 'il cron non deve fallire').toBe(200);
  const testo = await risposta.text();
  return { testo, json: JSON.parse(testo) };
}
