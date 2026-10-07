// Helper e2e per l'amministrazione del personale, issue #250 (#173 b).
//
// PERCHÉ. I selettori di utenti (/admin/maestre), profili orari
// (/admin/profili-orari) e report ore di lavoro (/dashboard/ore-lavoro, elenco
// admin /admin/ore-lavoro) erano ripetuti in 17, 18, 50, 54 e nella fixture
// `fixture-utente.ts`: se cambia un'etichetta o il nome di un campo, si
// corregge qui, in una riga, non in decine di test.
//
// COME SI USA. `import { rigaUtente, creaProfiloOrario, ... } from
// './pagina-personale'`. Stesso stile di `./pagina-giornata`: i selettori
// generici (login, a11y, `clickEAttendiAzione`, `eliminaUtenteDaScheda`,
// date) restano in `./helpers`, che questo modulo importa (mai il contrario).
// `./fixture-utente` importa questo modulo per il form di creazione utente.
//
// STRUTTURA (specs/03, 17, 18, 54):
// - /admin/maestre: un form "Crea utente" e, sotto, un <li> per utente con le
//   proprie spunte/select e un pulsante "Aggiorna" per riga. Due modi di
//   individuare la riga: `rigaUtente` (il <li>, per i campi) e
//   `schedaUtente` (il genitore del testo dell'email, per "Elimina utente").
// - /admin/profili-orari: form di creazione (nome + ore dei 5 giorni feriali)
//   e elenco; la scheda di un profilo ha il pulsante "Elimina profilo orario"
//   con conferma "Sì".
// - /dashboard/ore-lavoro: una card per giorno (7), i cui campi hanno il nome
//   accessibile "<campo> <giorno>" (es. "Differenza ore Lunedì").
import { expect, type Locator, type Page } from '@playwright/test';
import { clickEAttendiAzione, eliminaUtenteDaScheda } from './helpers';

export const PERCORSO_UTENTI = '/admin/maestre';
export const PERCORSO_PROFILI_ORARI = '/admin/profili-orari';
export const PERCORSO_ORE_LAVORO = '/dashboard/ore-lavoro';
export const PERCORSO_ELENCO_ORE_LAVORO = '/admin/ore-lavoro';
export const PERCORSO_PROFILO_ORARIO_PERSONALE = '/dashboard/profilo-orario';

// --- Utenti (/admin/maestre) -------------------------------------------------

export type DatiNuovoUtente = {
  nome: string;
  cognome: string;
  email: string;
  password: string;
  // Ruolo staff da scegliere; se assente resta il predefinito (genitore).
  ruolo?: 'admin' | 'maestra' | 'assistente';
  oreLavoro?: boolean;
  // Nome (etichetta) del profilo orario da assegnare alla creazione.
  profiloOrario?: string;
};

export function formCreazioneUtente(page: Page): Locator {
  return page.locator('form', { has: page.getByRole('button', { name: 'Crea utente' }) });
}

// Crea un utente dal form di /admin/maestre e attende che compaia in elenco.
// Telefono di prova fisso: dati sempre fittizi.
export async function creaUtenteDaForm(page: Page, dati: DatiNuovoUtente): Promise<void> {
  await page.goto(PERCORSO_UTENTI);
  const form = formCreazioneUtente(page);
  await page.getByPlaceholder('Nome').first().fill(dati.nome);
  await page.getByPlaceholder('Cognome').first().fill(dati.cognome);
  await page.getByPlaceholder('Email').fill(dati.email);
  await page.getByPlaceholder('Telefono').first().fill('3331234567');
  await page.getByLabel('Password', { exact: true }).fill(dati.password);
  await page.getByLabel('Conferma password').fill(dati.password);
  if (dati.ruolo) await form.getByLabel('Ruolo').selectOption(dati.ruolo);
  if (dati.oreLavoro) await form.getByLabel('Ore di lavoro').check();
  if (dati.profiloOrario) await form.getByLabel('Profilo orario').selectOption({ label: dati.profiloOrario });
  await page.getByRole('button', { name: 'Crea utente' }).click();
  await expect(page.getByText(dati.email, { exact: false })).toBeVisible({ timeout: 20_000 });
}

// La riga (<li>) dell'utente con quell'email: da qui si raggiungono i campi.
export function rigaUtente(page: Page, email: string): Locator {
  return page.locator('li', { hasText: email });
}

// La scheda dell'utente come genitore del testo dell'email: serve a
// `eliminaUtenteDaScheda` (helpers.ts) e ai campi della riga.
export function schedaUtente(page: Page, email: string): Locator {
  return page.getByText(email, { exact: false }).locator('..');
}

export function spuntaOreLavoro(riga: Locator): Locator {
  return riga.getByLabel('Ore di lavoro');
}

export function selectProfiloOrario(riga: Locator): Locator {
  return riga.getByLabel('Profilo orario');
}

export function selectRuolo(riga: Locator): Locator {
  return riga.locator('select[name="ruolo"]');
}

// "Aggiorna" della riga: attende la risposta della Server Action, così un
// reload/goto successivo non la annulla (issue #70).
export async function aggiornaRigaUtente(page: Page, riga: Locator): Promise<void> {
  await clickEAttendiAzione(page, riga.getByRole('button', { name: 'Aggiorna' }));
}

// Abilita/disabilita "Ore di lavoro" per l'utente e salva. Si aspetta di
// essere già su /admin/maestre.
export async function impostaOreLavoro(page: Page, email: string, abilitato: boolean): Promise<void> {
  const riga = rigaUtente(page, email);
  if (abilitato) await spuntaOreLavoro(riga).check();
  else await spuntaOreLavoro(riga).uncheck();
  await aggiornaRigaUtente(page, riga);
}

// Sceglie il profilo orario (per nome, o "Nessun profilo orario") dell'utente
// e salva. Si aspetta di essere già su /admin/maestre.
export async function impostaProfiloOrario(page: Page, email: string, etichetta: string): Promise<void> {
  const riga = rigaUtente(page, email);
  await selectProfiloOrario(riga).selectOption({ label: etichetta });
  await aggiornaRigaUtente(page, riga);
}

// Elimina l'utente (se c'è ancora) dalla sua scheda e verifica che sparisca.
export async function eliminaUtentePerEmail(page: Page, email: string): Promise<void> {
  await page.goto(PERCORSO_UTENTI);
  const riga = schedaUtente(page, email);
  if ((await riga.count()) === 0) return;
  await eliminaUtenteDaScheda(page, riga);
  await expect(page.getByText(email, { exact: false })).toHaveCount(0);
}

// --- Profili orari (/admin/profili-orari) ------------------------------------

export const GIORNI_PROFILO = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'] as const;
export type GiornoProfilo = (typeof GIORNI_PROFILO)[number];

export function campoNomeProfilo(page: Page): Locator {
  return page.getByPlaceholder('Nome (es. 35 ore settimanali)');
}

// Campo delle ore di un giorno (form di creazione e scheda di modifica).
export function campoOreProfilo(page: Page, giorno: GiornoProfilo): Locator {
  return page.getByLabel(giorno);
}

export function rigaProfiloOrario(page: Page, nome: string): Locator {
  return page.getByText(nome, { exact: false });
}

// Crea un profilo dal form di /admin/profili-orari (ore dei 5 giorni feriali,
// lunedì-venerdì) e attende che compaia in elenco. Ritorna la riga.
export async function creaProfiloOrario(
  page: Page,
  nome: string,
  ore: readonly [number, number, number, number, number]
): Promise<Locator> {
  await page.goto(PERCORSO_PROFILI_ORARI);
  await campoNomeProfilo(page).fill(nome);
  for (const [i, giorno] of GIORNI_PROFILO.entries()) {
    await campoOreProfilo(page, giorno).fill(String(ore[i]));
  }
  await page.getByRole('button', { name: 'Crea profilo orario' }).click();
  const riga = rigaProfiloOrario(page, nome);
  await expect(riga).toBeVisible({ timeout: 20_000 });
  return riga;
}

// Dall'elenco apre la scheda del profilo.
export async function apriProfiloOrario(page: Page, riga: Locator): Promise<void> {
  await riga.click();
  await page.waitForURL(/\/admin\/profili-orari\/.+/);
}

// Dalla scheda aperta elimina il profilo (conferma "Sì") e torna all'elenco.
export async function eliminaProfiloOrarioAperto(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Elimina profilo orario' }).click();
  await clickEAttendiAzione(page, page.getByRole('button', { name: 'Sì' }));
  await page.waitForURL(PERCORSO_PROFILI_ORARI);
}

// Pulizia: elimina il profilo se esiste ancora (usabile nei finally).
export async function eliminaProfiloOrarioSeEsiste(page: Page, nome: string): Promise<void> {
  await page.goto(PERCORSO_PROFILI_ORARI);
  const riga = rigaProfiloOrario(page, nome);
  if ((await riga.count()) > 0) {
    await apriProfiloOrario(page, riga);
    await eliminaProfiloOrarioAperto(page);
  }
}

// Pannello "Il mio profilo orario" (sola lettura, issue #92).
export function titoloProfiloOrarioPersonale(page: Page): Locator {
  return page.getByRole('heading', { name: 'Il mio profilo orario' });
}

// --- Report ore di lavoro ----------------------------------------------------

export type CampoGiorno = 'Differenza ore' | 'Stato' | 'Motivo' | 'Codice malattia' | 'Nota assenza' | 'Ore ordinarie';
export type GiornoSettimana = 'Lunedì' | 'Martedì' | 'Mercoledì' | 'Giovedì' | 'Venerdì' | 'Sabato' | 'Domenica';

// Campo di una card giornaliera: il nome accessibile è "<campo> <giorno>".
export function campoGiorno(page: Page, campo: CampoGiorno, giorno: GiornoSettimana): Locator {
  return page.getByLabel(`${campo} ${giorno}`);
}

// Ore ordinarie mostrate (testo, non un campo: specs/18) del giorno
// `indice` della settimana (0 = lunedì ... 5 = sabato).
export function oreOrdinarieGiorno(page: Page, indice: number): Locator {
  return page.locator('[data-ore-ordinarie]').nth(indice);
}

export function titoloOreLavoro(page: Page): Locator {
  return page.getByRole('heading', { name: 'Ore di lavoro' });
}

// Titolo con il nome del dipendente ("Ore di lavoro — <nome>") nelle viste
// dell'admin.
export function titoloOreLavoroDipendente(page: Page): Locator {
  return page.getByRole('heading', { name: /Ore di lavoro/ });
}

// Card "Ore di lavoro" della dashboard (assente per chi non è abilitato).
export function cardOreLavoro(page: Page): Locator {
  return page.getByRole('link', { name: 'Ore di lavoro', exact: true });
}

export function bottoneSalvaModifiche(page: Page): Locator {
  return page.getByRole('button', { name: 'Salva modifiche' });
}

export function bottoneConfermaSettimana(page: Page): Locator {
  return page.getByRole('button', { name: 'Conferma settimana' });
}

export function bottoneRiapriSettimana(page: Page): Locator {
  return page.getByRole('button', { name: 'Riapri settimana' });
}

// Messaggio "Settimana confermata il <data>" (settimana chiusa).
export function avvisoSettimanaConfermata(page: Page): Locator {
  return page.getByText('Settimana confermata il', { exact: false });
}

export function linkSettimanaPrecedente(page: Page): Locator {
  return page.getByRole('link', { name: 'Settimana precedente' });
}

export function linkSettimanaSuccessiva(page: Page): Locator {
  return page.getByRole('link', { name: 'Settimana successiva' });
}

// Riquadro della settimana: "Ore previste: Nh" e "Differenza ore: ±Nh".
export function oreInRiquadro(page: Page, voce: 'Ore previste' | 'Differenza ore'): Locator {
  return page.getByText(`${voce}:`, { exact: false });
}

// Indirizzo della settimana (lunedì `settimana`, AAAA-MM-GG) di sé o, per
// l'admin, di un dipendente (`utente` = id).
export function urlOreLavoro(settimana: string, utenteId?: string): string {
  return `${PERCORSO_ORE_LAVORO}?settimana=${settimana}${utenteId ? `&utente=${utenteId}` : ''}`;
}

// Lunedì (AAAA-MM-GG) della settimana in cui cade il giorno `giorno`.
export function lunediDellaSettimana(giorno: string): string {
  const data = new Date(`${giorno}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() - ((data.getUTCDay() + 6) % 7));
  return data.toISOString().slice(0, 10);
}

// Dall'elenco admin del personale abilitato apre le ore del dipendente (vista
// mensile) e ritorna il suo id (dal parametro `utente` dell'indirizzo).
export async function apriOreDipendente(page: Page, email: string): Promise<string> {
  await page.goto(PERCORSO_ELENCO_ORE_LAVORO);
  await rigaUtente(page, email).getByRole('link').click();
  await page.waitForURL(/\/dashboard\/ore-lavoro\/mese\?utente=.+/);
  return new URL(page.url()).searchParams.get('utente')!;
}
