// Helper e2e per il monte ore, issue #251 (#173 c).
//
// PERCHÉ. Il saldo "Monte ore attuale" e il form dei movimenti manuali
// (specs/19) comparivano ripetuti in 19 e 18: se cambia un'etichetta o il nome
// di un campo, si corregge qui, in una riga, non in più test.
//
// COME SI USA. `import { leggiSaldoMonteOre, compilaMovimento, ... } from
// './pagina-monte-ore'`. Stesso stile di `./pagina-giornata` e
// `./pagina-personale`: login, a11y, `clickEAttendiAzione`, `alertApp`
// restano in `./helpers`. Per aprire la vista mensile di un dipendente dall'
// elenco admin c'è già `apriOreDipendente` in `./pagina-personale`.
//
// STRUTTURA (specs/19). Nella scheda ore (vista personale, o vista mensile
// aperta dall'admin) c'è il saldo "Monte ore attuale: ±Nh" e il "Calcolo mese
// per mese". Solo l'admin vede il form "Registra movimento" (ore, verso, nota)
// e, per ogni riga dello storico, "Modifica" (un form con gli stessi nomi di
// campo) ed "Elimina".
import type { Locator, Page } from '@playwright/test';
import { clickEAttendiAzione, dataOggiRoma } from './helpers';
import { campoGiorno, bottoneSalvaModifiche, urlOreLavoro, type GiornoSettimana } from './pagina-personale';

// Dove cercare un campo: l'intera pagina, il form di inserimento o una riga.
type Ambito = Page | Locator;

// Il testo "Monte ore attuale: ±Nh" (saldo con segno).
export function testoSaldoMonteOre(page: Page): Locator {
  return page.getByText('Monte ore attuale:', { exact: false });
}

// Il saldo come numero (NaN se il testo non lo riporta). Il saldo si aggiorna
// quando la pagina ricarica i dati dopo la Server Action, non all'arrivo della
// sua risposta: per aspettarlo si usa `expect.poll(() => leggiSaldoMonteOre(page))`.
export async function leggiSaldoMonteOre(page: Page): Promise<number> {
  const testo = await testoSaldoMonteOre(page).innerText();
  return Number(testo.match(/(-?\d+(\.\d+)?)h/)?.[1]);
}

export function titoloCalcoloMesePerMese(page: Page): Locator {
  return page.getByRole('heading', { name: 'Calcolo mese per mese' });
}

// --- Movimenti manuali (solo admin) ------------------------------------------

export type DatiMovimento = {
  ore?: string;
  verso?: 'credito' | 'debito';
  nota?: string;
  // Mese di competenza (AAAA-MM); omesso = quello preimpostato (il corrente).
  meseCompetenza?: string;
};

export function bottoneRegistraMovimento(page: Page): Locator {
  return page.getByRole('button', { name: 'Registra movimento' });
}

// Form di inserimento di un movimento: le righe dello storico hanno a loro
// volta un form di modifica con gli stessi nomi di campo.
export function formMovimento(page: Page): Locator {
  return page.locator('form').filter({ has: bottoneRegistraMovimento(page) });
}

export function campoOreMovimento(ambito: Ambito): Locator {
  return ambito.locator('input[name="ore"]');
}

export function selectVersoMovimento(ambito: Ambito): Locator {
  return ambito.locator('select[name="verso"]');
}

export function campoNotaMovimento(ambito: Ambito): Locator {
  return ambito.locator('input[name="nota"]');
}

// Compila solo i campi indicati del form di inserimento (ordine: ore, verso,
// nota). Un campo omesso resta com'è, una nota '' la svuota.
export async function compilaMovimento(page: Page, dati: DatiMovimento): Promise<void> {
  const form = formMovimento(page);
  if (dati.ore !== undefined) await campoOreMovimento(form).fill(dati.ore);
  if (dati.verso !== undefined) await selectVersoMovimento(form).selectOption(dati.verso);
  if (dati.nota !== undefined) await campoNotaMovimento(form).fill(dati.nota);
  if (dati.meseCompetenza !== undefined) await selectMeseCompetenza(form).selectOption(dati.meseCompetenza);
}

// Preme "Registra movimento" e attende la risposta della Server Action (#70).
export async function registraMovimento(page: Page): Promise<void> {
  await clickEAttendiAzione(page, bottoneRegistraMovimento(page));
}

// La riga dello storico con quella nota (<li>).
export function rigaMovimento(page: Page, nota: string): Locator {
  return page.locator('li', { hasText: nota });
}

// "Modifica" della riga (apre il suo form) e "Elimina": in sola lettura non ci
// sono né l'uno né l'altro.
export function apriModificaMovimento(ambito: Ambito): Locator {
  return ambito.getByText('Modifica', { exact: true });
}

export function bottoneEliminaMovimento(ambito: Ambito): Locator {
  return ambito.getByRole('button', { name: 'Elimina' });
}

export function bottoneSalvaModificaMovimento(riga: Locator): Locator {
  return riga.getByRole('button', { name: 'Salva modifica' });
}

// --- Conferma del mese e mese di competenza (specs/19, MOR-01..MOR-10) --------
//
// STRUTTURA ATTESA. Nel "Calcolo mese per mese" la riga di un mese (intestazione
// di riga = "ottobre 2026") ha 4 celle: ore previste, differenza ore, movimenti,
// saldo a fine mese. Se il mese e' chiuso e la parte non confermata e' diversa da
// zero, la riga mostra (solo all'admin) l'indicazione "+14.5h a credito" /
// "-6h da recuperare" col pulsante "Conferma"; se esiste gia' una conferma, il
// testo "+2h non confermate" col pulsante "Conferma la differenza residua".
// Il modulo dei movimenti ha un campo `select[name="mese_competenza"]` (etichetta
// "Mese di competenza", valori AAAA-MM, dal piu' vecchio al mese corrente,
// preimpostato al corrente); la "Modifica" di ogni riga dello storico ha lo stesso
// campo (aria-label "Mese di competenza movimento <id>"). Lo storico mostra
// "(competenza ottobre 2026)" accanto a ogni movimento.
export const PERCORSO_MESE_ORE_LAVORO = '/dashboard/ore-lavoro/mese';

// Mese (AAAA-MM) a `scarto` mesi da quello corrente (fuso Europe/Rome); -1 = il mese scorso.
export function meseRoma(scarto: number): string {
  const [anno, mese] = dataOggiRoma().split('-').map(Number);
  return new Date(Date.UTC(anno, mese - 1 + scarto, 1, 12)).toISOString().slice(0, 7);
}

// "ottobre 2026" (come nella tabella e nello storico).
export function nomeMese(mese: string): string {
  const [anno, m] = mese.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(anno, m - 1, 1, 12)));
}

// Il primo lunedi' (AAAA-MM-GG) del mese a partire dall'8: tutta la settimana
// lavorativa (lun-ven) cade nello stesso mese.
export function lunediDelMese(mese: string): string {
  const [anno, m] = mese.split('-').map(Number);
  for (let giorno = 8; giorno <= 14; giorno++) {
    const data = new Date(Date.UTC(anno, m - 1, giorno, 12));
    if (data.getUTCDay() === 1) return data.toISOString().slice(0, 10);
  }
  throw new Error('nessun lunedi trovato');
}

// Data di oggi come nello storico: gg/mm/aaaa (fuso Europe/Rome).
export function dataOggiItaliana(): string {
  const [anno, mese, giorno] = dataOggiRoma().split('-');
  return `${giorno}/${mese}/${anno}`;
}

// Riga del "Calcolo mese per mese" del mese AAAA-MM.
export function rigaMese(page: Page, mese: string): Locator {
  return page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: nomeMese(mese) }) });
}

export function cellaDifferenzaMese(riga: Locator): Locator {
  return riga.getByRole('cell').nth(1);
}

export function cellaMovimentiMese(riga: Locator): Locator {
  return riga.getByRole('cell').nth(2);
}

export function cellaSaldoMese(riga: Locator): Locator {
  return riga.getByRole('cell').nth(3);
}

// Numero (con segno) contenuto in una cella o nel testo di un locator.
export async function leggiOreCella(cella: Locator): Promise<number> {
  const testo = await cella.innerText();
  return Number(testo.match(/([+-]?\d+(?:\.\d+)?)h/)?.[1]);
}

export function bottoneConfermaMese(ambito: Ambito): Locator {
  return ambito.getByRole('button', { name: 'Conferma', exact: true });
}

export function bottoneConfermaResidua(ambito: Ambito): Locator {
  return ambito.getByRole('button', { name: 'Conferma la differenza residua' });
}

// "+2h non confermate" / "-2.5h non confermate" (segno - o −).
export function testoNonConfermate(riga: Locator, ore: string): Locator {
  return riga.getByText(new RegExp(`[-−+]?${ore.replace('.', '[.,]')}h non confermate`));
}

export function selectMeseCompetenza(ambito: Ambito): Locator {
  return ambito.locator('select[name="mese_competenza"]');
}

// Registra le differenze ore (stringhe, step 0.25) dei giorni indicati della
// settimana che inizia di `lunedi`, per il dipendente `utenteId`, e salva. Ogni
// differenza diversa da zero ha il motivo obbligatorio.
export async function registraDifferenzeSettimana(
  page: Page,
  utenteId: string,
  lunedi: string,
  differenze: Partial<Record<GiornoSettimana, string>>
): Promise<void> {
  await page.goto(urlOreLavoro(lunedi, utenteId));
  for (const [giorno, valore] of Object.entries(differenze) as [GiornoSettimana, string][]) {
    await campoGiorno(page, 'Differenza ore', giorno).fill(valore);
    if (Number(valore) !== 0) await campoGiorno(page, 'Motivo', giorno).fill('Motivo E2E');
  }
  await clickEAttendiAzione(page, bottoneSalvaModifiche(page));
}
