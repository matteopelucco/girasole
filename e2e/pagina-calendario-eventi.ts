// Helper e2e per la pagina "Calendario" (`/dashboard/calendario`, specs/64 -
// calendario-eventi.md, issue #320). Il file `pagina-calendario.ts` riguarda
// invece la sezione "Calendario Google" di "Parametri di funzionamento".
//
// STRUTTURA. Titolo "Calendario attività"; sezione "Giorni di chiusura" (ruolo
// "region"; ogni chiusura è `data-testid="chiusura"`); sezione "A calendario"
// (ruolo "region") con i blocchi `eventi-prossimi` e `eventi-passati`. In
// ciascun blocco un titolo per mese (h4), un blocco per giorno
// (`giorno-YYYY-MM-DD`) e una scheda per evento (`evento`, con `orario-evento`,
// `luogo-evento`, `descrizione-evento`, `in-corso`). Le chiusure si creano ed
// eliminano dalla pagina admin (specs/53), come fa e2e/53.
import { expect, type Locator, type Page } from '@playwright/test';
import { clickEAttendiAzione } from './helpers';

export const PERCORSO_CALENDARIO = '/dashboard/calendario';
export const PERCORSO_CHIUSURE_ADMIN = '/admin/calendario';

// Classe della scheda di un evento passato (attenuato con colori, non con
// l'opacità, per non perdere contrasto).
export const CLASSE_EVENTO_PASSATO = /bg-stone-50/;

export function sezioneChiusure(page: Page): Locator {
  return page.getByRole('region', { name: 'Giorni di chiusura' });
}

export function sezioneEventi(page: Page): Locator {
  return page.getByRole('region', { name: 'A calendario' });
}

export function eventiProssimi(page: Page): Locator {
  return sezioneEventi(page).getByTestId('eventi-prossimi');
}

export function eventiPassati(page: Page): Locator {
  return sezioneEventi(page).getByTestId('eventi-passati');
}

export function schedaEvento(contenitore: Locator | Page, titolo: string): Locator {
  return contenitore.getByTestId('evento').filter({ hasText: titolo });
}

export function bloccoGiorno(page: Page, data: string): Locator {
  return sezioneEventi(page).getByTestId(`giorno-${data}`);
}

// Giorno e mese breve come li scrive la pagina ("20 ott").
export function giornoBreveItaliano(data: string): string {
  const [anno, mese, giorno] = data.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(
    new Date(Date.UTC(anno, mese - 1, giorno, 12))
  );
}

export async function apriCalendario(page: Page): Promise<void> {
  await page.goto(PERCORSO_CALENDARIO);
  await expect(page.getByRole('heading', { name: 'Calendario attività', level: 1 })).toBeVisible();
  // Le due sezioni si completano a parte: si aspetta che non siano più sagome.
  await expect(sezioneChiusure(page).getByRole('status')).toHaveCount(0);
  await expect(sezioneEventi(page).getByRole('status')).toHaveCount(0);
}

// Voce "Calendario attività" del menu (specs/64), dentro il gruppo "Calendario".
export function voceMenuCalendario(page: Page): Locator {
  return page.getByRole('navigation').getByRole('link', { name: 'Calendario attività', exact: true });
}

// Voce "Giorni di chiusura" del menu (specs/53), dentro il gruppo "Calendario".
export function voceMenuGiorniChiusura(page: Page): Locator {
  return page.getByRole('navigation').getByRole('link', { name: 'Giorni di chiusura', exact: true });
}

// Gruppo "Calendario" del menu: solo intestazione con le sue voci dentro.
export function gruppoMenuCalendario(page: Page): Locator {
  return page.getByRole('navigation').getByRole('group', { name: 'Calendario', exact: true });
}

// Crea un giorno di chiusura dalla pagina admin (specs/53). Date lontane e nota
// unica: lo individua e lo elimina `eliminaChiusura`.
export async function creaChiusura(page: Page, inizio: string, fine: string, nota: string): Promise<void> {
  await page.goto(PERCORSO_CHIUSURE_ADMIN);
  await page.getByLabel('Data di inizio').fill(inizio);
  await page.getByLabel('Data di fine').fill(fine);
  await page.getByPlaceholder('Nota (opzionale, es. Vacanze di Natale)').fill(nota);
  await clickEAttendiAzione(page, page.getByRole('button', { name: 'Aggiungi giorno di chiusura' }));
  await expect(page.getByText(nota, { exact: false })).toBeVisible({ timeout: 20_000 });
}

export async function eliminaChiusura(page: Page, nota: string): Promise<void> {
  await page.goto(PERCORSO_CHIUSURE_ADMIN);
  await page.getByText(nota, { exact: false }).click();
  await page.waitForURL(/\/admin\/calendario\/.+/);
  await page.getByRole('button', { name: 'Elimina giorno di chiusura' }).click();
  await clickEAttendiAzione(page, page.getByRole('button', { name: 'Sì' }));
}

// ---------------------------------------------------------------------------
// Riquadro "Prossimi eventi" nella dashboard (issue #321). Ruolo "region" con
// nome "Prossimi eventi"; ogni evento è `data-testid="prossimo-evento"` (con
// `titolo-evento`, `orario-evento`, `in-corso`); il messaggio vuoto è
// `nessun-prossimo-evento`; il link fisso è "Vedi tutto".
// ---------------------------------------------------------------------------
export const TESTO_NESSUN_PROSSIMO_EVENTO = 'Non ci sono eventi in programma.';

export function riquadroProssimiEventi(page: Page): Locator {
  return page.getByRole('region', { name: 'Prossimi eventi' });
}

export function prossimiEventiDashboard(page: Page): Locator {
  return riquadroProssimiEventi(page).getByTestId('prossimo-evento');
}

export function linkVediTutto(page: Page): Locator {
  return riquadroProssimiEventi(page).getByRole('link', { name: 'Vedi tutto' });
}

// Apre la dashboard e aspetta che il riquadro abbia finito di caricarsi.
export async function apriDashboardConEventi(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await expect(riquadroProssimiEventi(page)).toBeVisible();
  await expect(riquadroProssimiEventi(page).getByRole('status')).toHaveCount(0);
}
