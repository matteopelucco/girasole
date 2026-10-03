import path from 'node:path';
import fs from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
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

// Il mese successivo a quello corrente, "YYYY-MM", calcolato sul mese di
// "oggi" nel fuso Europe/Rome (non sull'orario locale del runner, che in CI
// è UTC): tra le 22:00 e le 24:00 UTC dell'ultimo giorno del mese Roma è già
// nel mese nuovo e i due valori differirebbero di un mese (issue #163).
// Gestisce dicembre -> gennaio. Equivale a meseSuccessivo(meseDaData(oggi()))
// di lib/date.ts (già coperto da lib/date.test.ts), duplicato qui per lo
// stesso motivo di dataOggiRoma.
export function meseSuccessivoRoma(): string {
  const [anno, mese] = dataOggiRoma().split('-').map(Number);
  return new Date(Date.UTC(anno, mese, 1, 12)).toISOString().slice(0, 7);
}

// L'ultimo giorno APERTO prima di oggi (fuso Europe/Rome): salta sabato e
// domenica, chiusura implicita (specs/53). Serve ai test "sola lettura su
// una data diversa da oggi" (specs/13, specs/14): su un giorno chiuso la
// pagina mostra giustamente l'avviso di chiusura, che ha la precedenza sul
// banner "Sola lettura", e il test fallirebbe il lunedì. Limite noto: non
// conosce i giorni di chiusura registrati in `giorni_chiusura`. Il seed
// (supabase/seed.sql) non ne definisce e l'unico test che ne crea
// (53-calendario-scolastico.spec.ts) usa date lontane nel futuro e le
// elimina a fine test, quindi oggi nessuno cade su un giorno passato.
export function dataUltimoGiornoApertoPrimaDiOggi(): string {
  for (let i = 1; i <= 7; i++) {
    const candidata = dataFraGiorni(-i);
    const [anno, mese, giorno] = candidata.split('-').map(Number);
    const giornoSettimana = new Date(Date.UTC(anno, mese - 1, giorno, 12)).getUTCDay();
    if (giornoSettimana !== 0 && giornoSettimana !== 6) return candidata;
  }
  throw new Error('impossibile trovare un giorno feriale nei 7 giorni precedenti');
}

// Oggi + n giorni (fuso Europe/Rome, n può essere negativo) — usata dai
// test di specs/53 - calendario-scolastico.md per trovare un prossimo
// sabato/domenica e una data lontana su cui creare un giorno di chiusura
// di prova senza collidere con "oggi"/"ieri", usate da altri test.
export function dataFraGiorni(giorni: number): string {
  const [anno, mese, giorno] = dataOggiRoma().split('-').map(Number);
  const d = new Date(Date.UTC(anno, mese - 1, giorno + giorni, 12));
  return d.toISOString().slice(0, 10);
}

// Il prossimo sabato, oggi compreso se oggi stesso è sabato (specs/53,
// scenario "sabato e domenica sono chiusura implicita").
export function dataProssimoSabato(): string {
  for (let i = 0; i < 7; i++) {
    const candidata = dataFraGiorni(i);
    const [anno, mese, giorno] = candidata.split('-').map(Number);
    if (new Date(Date.UTC(anno, mese - 1, giorno, 12)).getUTCDay() === 6) return candidata;
  }
  throw new Error('impossibile trovare un sabato entro 7 giorni');
}

// Il prossimo giorno feriale (lun-ven), oggi compreso se oggi stesso lo
// è già — usata dai test che devono verificare "nessuna chiusura" su un
// giorno qualunque senza dipendere da che giorno della settimana sia
// "oggi" quando la suite viene eseguita (specs/53).
export function dataProssimoGiornoFeriale(): string {
  for (let i = 0; i < 7; i++) {
    const candidata = dataFraGiorni(i);
    const [anno, mese, giorno] = candidata.split('-').map(Number);
    const giornoSettimana = new Date(Date.UTC(anno, mese - 1, giorno, 12)).getUTCDay();
    if (giornoSettimana !== 0 && giornoSettimana !== 6) return candidata;
  }
  throw new Error('impossibile trovare un giorno feriale entro 7 giorni');
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

// Il nome di un anno scolastico compare anche come <option> nel select
// "Anno scolastico" del form di creazione sezione (specs/04, specs/50):
// mi limito al <li> dell'elenco "Anni scolastici" (nessun altro <li> in
// pagina ha questo testo, a differenza delle sezioni — vedi rigaSezione
// sopra — quindi qui basta il tag).
export function rigaAnnoScolastico(page: Page, nomeAnno: string) {
  return page.locator('li').filter({ hasText: nomeAnno });
}

// Schermata unica "Presenze e pasti" (specs/10 - presenze-e-pasti.md):
// una card per bambino (<li id="bambino-<id>">) con un'intestazione
// (<header>, nome del bambino come titolo <h3>) e una sezione
// "Presenza" e, per maestra/admin, una sezione "Pasto" (role="group"
// con nome accessibile). Le due sezioni hanno ciascuna un proprio campo
// "Nota (opzionale)" e un proprio "Salva nota": i test vanno sempre
// ristretti alla sezione giusta, altrimenti un getByRole/getByLabel
// sulla card intera trova due elementi. Il selettore sull'id esclude anche gli altri <li>
// della pagina (es. l'elenco "Bambini senza presenza" del box Rojac).
export const PERCORSO_GIORNATA = '/dashboard/giornata';

export function cardBambini(page: Page): Locator {
  return page.locator('li[id^="bambino-"]');
}

// Intestazione della card (sfondo e avatar per sesso, issue #106 e #108)
// e nome del bambino, titolo della card.
export function intestazioneCard(card: Locator): Locator {
  return card.locator('header');
}

export function nomeBambinoCard(card: Locator): Locator {
  return card.getByRole('heading', { level: 3 });
}

export function colonnaPresenza(contenitore: Page | Locator): Locator {
  return contenitore.getByRole('group', { name: 'Presenza', exact: true });
}

export function colonnaPasto(contenitore: Page | Locator): Locator {
  return contenitore.getByRole('group', { name: 'Pasto', exact: true });
}

// Sezione "Nota" in fondo alla card (issue #110): campo "Nota
// (opzionale)" e "Salva nota" della presenza.
export function sezioneNota(contenitore: Page | Locator): Locator {
  return contenitore.getByRole('group', { name: 'Nota', exact: true });
}

// Card del primo bambino la cui colonna indicata contiene il pulsante
// `nomePulsante` (es. la prima card con "Sì" ancora disponibile).
export function primaCardConPulsante(
  page: Page,
  colonna: 'Presenza' | 'Pasto',
  nomePulsante: string
): Locator {
  return cardBambini(page)
    .filter({
      has: page
        .getByRole('group', { name: colonna, exact: true })
        .getByRole('button', { name: nomePulsante, exact: true }),
    })
    .first();
}

// Apre "Presenze e pasti" per la data indicata; ritorna false se
// l'account non vede nessun bambino (il test chiamante si salta).
export async function apriGiornata(page: Page, data: string): Promise<boolean> {
  await page.goto(`${PERCORSO_GIORNATA}?data=${data}`);
  return (await cardBambini(page).count()) > 0;
}

// Segna Assente o Malattia nella sezione "Presenza" `presenza` di una card
// (specs/13). Se il bambino ha un pasto "sì" o un pre/post-asilo già
// segnati, il pulsante non salva subito ma apre l'avviso di conferma
// (`aria-expanded` presente, issue #186): in quel caso conferma con
// "Conferma e azzera". Gli altri test condividono lo stesso stato dei
// bambini, quindi non sanno a priori se serva la conferma. Attende la
// risposta della Server Action, come clickEAttendiAzione.
export async function segnaAssenteOMalattia(
  page: Page,
  presenza: Locator,
  stato: 'Assente' | 'Malattia'
): Promise<void> {
  const bottone = presenza.getByRole('button', { name: stato });
  if ((await bottone.getAttribute('aria-expanded')) === null) {
    await clickEAttendiAzione(page, bottone);
    return;
  }
  await bottone.click();
  await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Conferma e azzera' }));
}

// Vero se la pagina corrente (Presenze e pasti, ore di lavoro...) mostra
// l'avviso di chiusura scolastica (specs/53): "L'asilo è chiuso..." per
// sabato/domenica, "Giorno di chiusura scolastica..." per un giorno
// registrato in `giorni_chiusura` (lib/calendarioScolastico.ts:
// messaggioChiusura). In un giorno chiuso le card dei bambini ci sono
// ancora ma senza i pulsanti di presenza/pasto: apriGiornata() ritorna true
// comunque (i test di specs/53 ne dipendono), quindi i test che si aspettano
// un giorno scrivibile usano questa funzione per saltarsi invece di fallire
// il sabato. Da chiamare dopo apriGiornata(): la pagina è renderizzata dal
// server, l'avviso è già nel DOM.
export async function giornoDiChiusura(page: Page): Promise<boolean> {
  const avviso = page.getByText(/L'asilo è chiuso|Giorno di chiusura scolastica/);
  return (await avviso.count()) > 0;
}

// Messaggi con role="alert" mostrati dall'app (errori dei form, banner),
// escluso l'annunciatore di route di Next.js: un <div role="alert"
// id="__next-route-announcer__"> vuoto che compare dopo una navigazione
// client-side e che getByRole('alert') conterebbe (strict mode violation
// o toHaveCount(0) falliti senza alcun errore visibile — issue #70).
export function alertApp(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

// Popup bloccante d'errore (components/DialogErrore.tsx, specs/05 e 18):
// <dialog> modale con ruolo alertdialog, il cui nome accessibile è il titolo
// (es. "Settimana non salvata"). Mentre è aperto il resto della pagina è
// inerte: i test devono chiuderlo ("Chiudi e correggi" o Esc) prima di
// interagire di nuovo con il form.
export function popupErrore(page: Page, titolo: string): Locator {
  return page.getByRole('alertdialog', { name: titolo });
}

// Chiude il popup con il pulsante e verifica che sparisca.
export async function chiudiPopupErrore(popup: Locator): Promise<void> {
  await popup.getByRole('button', { name: 'Chiudi e correggi' }).click();
  await expect(popup).toBeHidden();
}

// Click su un bottone che invia una Server Action, attendendo che la
// risposta sia arrivata per intero (non solo le intestazioni). Il campo
// di un form mostra già il valore digitato prima del salvataggio: senza
// questa attesa un page.reload() subito dopo poteva arrivare prima che
// l'azione avesse scritto sul DB (issue #70). Le Server Action si
// riconoscono dall'header Next-Action della richiesta POST.
//
// Si aspetta la risposta, non response.finished(): con il server di
// produzione la risposta di una Server Action resta aperta (stream RSC) e
// finished() non si risolveva mai.
export async function clickEAttendiAzione(page: Page, bottone: Locator): Promise<void> {
  const risposta = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.request().headers()['next-action'] !== undefined
  );
  await bottone.click();
  await risposta;
}

// Elimina l'utente della scheda `riga` su /admin/maestre passando dalla
// finestra di conferma (specs/03 - utenti-e-ruoli.md): icona cestino,
// spunta "Ne sono consapevole", "Procedi con la cancellazione utente".
// Attende la risposta della Server Action, così un reload/goto successivo
// non la annulla.
export function finestraEliminaUtente(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Eliminare definitivamente questo utente?' });
}

export async function eliminaUtenteDaScheda(page: Page, riga: Locator): Promise<void> {
  await riga.getByRole('button', { name: 'Elimina utente' }).click();
  const finestra = finestraEliminaUtente(page);
  await expect(finestra).toBeVisible();
  await finestra.getByLabel('Ne sono consapevole').check();
  await clickEAttendiAzione(
    page,
    finestra.getByRole('button', { name: 'Procedi con la cancellazione utente' })
  );
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
