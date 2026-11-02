// Selettori e2e per la sezione "Prezzi" di "Parametri di funzionamento"
// (specs/62, issue #396), per il campo "Tipo" delle sezioni (specs/50) e per
// i campi della scheda Costi del bambino (specs/55).
//
// STRUTTURA ATTESA (l'implementazione deve rispettarla).
//   * Sezione "Prezzi": ruolo "region" con nome "Prezzi", titolo h2 "Prezzi",
//     breve descrizione `data-testid="descrizione-prezzi"` (dice che i valori
//     servono solo per i bambini nuovi e non cambiano quelli esistenti), otto
//     campi di testo con le etichette di ETICHETTE_PREZZI (valore mostrato con
//     due decimali e la virgola, es. "160,00"), pulsante "Salva prezzi".
//     Dopo il salvataggio riuscito compare il testo "Prezzi salvati". Un campo
//     non valido ha aria-invalid="true" e il messaggio d'errore
//     (MESSAGGIO_IMPORTO_NON_VALIDO) in un elemento role="alert" nella sezione.
//     Un salvataggio con dati vecchi mostra in un role="alert" il testo
//     MESSAGGIO_CONCORRENZA.
//   * Campo "Tipo" nel form di creazione della sezione, su `/admin`: <select>
//     con etichetta "Tipo", name="tipo", opzioni "Nessuno" (valore iniziale,
//     value ""), "Materna" (value "materna"), "Primavera" (value "primavera").
//   * Riga di una sezione nell'elenco "Sezioni": se ha un tipo mostra il testo
//     "Materna" o "Primavera" in `data-testid="tipo-sezione"` (nessun elemento
//     se il tipo manca); un <select name="tipo"> con etichetta
//     "Tipo di <nome sezione>" e il pulsante "Salva tipo" ne permettono la
//     modifica.
//   * Scheda Costi (`/admin/bambini/[id]`): i campi prezzo sono di testo (non
//     number), con le etichette già esistenti, e mostrano due decimali con la
//     virgola ("6,00").
import type { Locator, Page } from '@playwright/test';
import { clickEAttendiAzione } from './helpers';
import type { Prezzi } from './fixture-prezzi';

export const PERCORSO_PARAMETRI = '/admin/parametri-funzionamento';

export const MESSAGGIO_IMPORTO_NON_VALIDO = 'Inserisci un importo tra 0 e 9999,99 con al massimo due decimali';
export const MESSAGGIO_CONCORRENZA = 'I prezzi sono stati modificati da un altro utente: ricarica la pagina e riprova';

export const ETICHETTE_PREZZI: Record<keyof Prezzi, string> = {
  retta_materna: 'Retta Materna (€)',
  retta_primavera: 'Retta Primavera (€)',
  buono_pasto: 'Buono pasto (€)',
  marca_da_bollo: 'Marca da bollo (€)',
  abbonamento_pre_asilo: 'Abbonamento pre-asilo (€)',
  abbonamento_post_asilo: 'Abbonamento post-asilo (€)',
  gettone_pre_asilo: 'Gettone pre-asilo (€)',
  gettone_post_asilo: 'Gettone post-asilo (€)',
};

export function sezionePrezzi(page: Page): Locator {
  return page.getByRole('region', { name: 'Prezzi', exact: true });
}

export function campoPrezzo(page: Page, campo: keyof Prezzi): Locator {
  return sezionePrezzi(page).getByLabel(ETICHETTE_PREZZI[campo], { exact: true });
}

export function pulsanteSalvaPrezzi(page: Page): Locator {
  return sezionePrezzi(page).getByRole('button', { name: 'Salva prezzi', exact: true });
}

export function erroriPrezzi(page: Page): Locator {
  return sezionePrezzi(page).locator('[role="alert"]:not(#__next-route-announcer__)');
}

export async function compilaPrezzi(page: Page, valori: Partial<Record<keyof Prezzi, string>>): Promise<void> {
  for (const [campo, valore] of Object.entries(valori)) {
    await campoPrezzo(page, campo as keyof Prezzi).fill(valore);
  }
}

export async function salvaPrezzi(page: Page): Promise<void> {
  await clickEAttendiAzione(page, pulsanteSalvaPrezzi(page));
}

// --- Tipo della sezione su /admin -----------------------------------------

// Il form di creazione sezione è l'unico con un campo "Nome sezione".
export function formCreaSezione(page: Page): Locator {
  return page.locator('form', { has: page.getByPlaceholder('Nome sezione (es. Girasoli)') });
}

export function campoTipoNuovaSezione(page: Page): Locator {
  return formCreaSezione(page).getByLabel('Tipo', { exact: true });
}

export function tipoSezioneInElenco(riga: Locator): Locator {
  return riga.getByTestId('tipo-sezione');
}

export function campoTipoRiga(riga: Locator, nomeSezione: string): Locator {
  return riga.getByLabel(`Tipo di ${nomeSezione}`, { exact: true });
}

// --- Scheda Costi del bambino ---------------------------------------------

export const ETICHETTE_COSTI = {
  retta: 'Prezzo retta mensile (€)',
  buonoPasto: 'Prezzo buono pasto (€)',
  marcaDaBollo: 'Prezzo marca da bollo (€)',
  preAsilo: 'Prezzo pre-asilo (€)',
  postAsilo: 'Prezzo post-asilo (€)',
} as const;

export function formCosti(page: Page): Locator {
  return page.locator('form', { has: page.getByRole('button', { name: 'Salva costi' }) });
}

// Crea un bambino dal form su `/admin` e attende che compaia nell'elenco.
// `nomeSezione` = null: nessuna sezione scelta. Il form mostra le sezioni per
// nome (stesso testo dell'<option>), quindi basta il nome unico della sezione.
export async function creaBambinoDaForm(page: Page, cognome: string, nomeSezione: string | null): Promise<void> {
  await page.goto('/admin');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Prezzi');
  await page.getByPlaceholder('Cognome').fill(cognome);
  await page.getByLabel('Data di nascita').fill('2021-04-04');
  await page.getByLabel('Sesso').selectOption('F');
  if (nomeSezione !== null) {
    await page
      .locator('form', { has: page.getByRole('button', { name: 'Aggiungi bambino' }) })
      .locator('select[name="sezione_id"]')
      .selectOption({ label: nomeSezione });
  }
  await clickEAttendiAzione(page, page.getByRole('button', { name: 'Aggiungi bambino' }));
  await page.getByRole('link', { name: new RegExp(cognome) }).waitFor({ timeout: 20_000 });
}
