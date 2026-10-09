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
import { clickEAttendiAzione } from './helpers';

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
