// Helper e2e per "Pagamenti bambino" (specs/60 PAG-16..PAG-22) e per la verifica
// del bonifico che vi si fa (specs/59; issue #417).
//
// Attesi dall'implementazione (nomi da rispettare):
//   * ogni riga di mese è `tr#mese-AAAA-MM`;
//   * colonna "Bonifico": stato (testo) e pulsanti "Bonifico corretto",
//     "Importo diverso", "Annulla verifica", finestra `Importo bonifico diverso per <nome> <cognome>`;
//   * colonna "Nota": campo con nome `Nota per <nome> <cognome>, <mese anno>`,
//     pulsante "Salva", conferma "Nota salvata";
//   * in "Rette" ogni riga inviata ha lo stato del bonifico in sola lettura e
//     un link "Verifica il bonifico di <nome> <cognome>" (testo visibile "Verifica").
//
// I dati sono di un bambino fixture (e2e/fixture-bambino.ts), con login admin e
// chiave anon (RLS come l'app); la comunicazione si inserisce direttamente nel
// DB (niente email) e sparisce con il bambino (ON DELETE CASCADE).
import { expect, type Locator, type Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BambinoFixture } from './fixture-bambino';

export const PERCORSO_PAGAMENTI = '/admin/pagamenti-bambino';

// Anno di inizio dell'anno scolastico che contiene il mese "AAAA-MM".
export function annoScolasticoDi(mese: string): number {
  const [anno, m] = mese.split('-').map(Number);
  return m >= 9 ? anno : anno - 1;
}

export async function inserisciComunicazioneDaVerificare(
  db: SupabaseClient,
  bambino: BambinoFixture,
  mese: string,
  campi: { retta_mensile?: number; totale?: number; nota_pagamento?: string | null } = {}
): Promise<string> {
  const retta = campi.retta_mensile ?? 100;
  const { data, error } = await db
    .from('comunicazioni_retta')
    .insert({
      bambino_id: bambino.id,
      mese,
      retta_mensile: retta,
      costo_pasti: 0,
      conguaglio_pasti: 0,
      costo_pre_asilo: 0,
      costo_post_asilo: 0,
      costi_extra: 0,
      totale: campi.totale ?? retta,
      email_destinatario: 'e2e-pagamenti-bonifico@example.com',
      inviata_da_nome: 'E2E',
      ...(campi.nota_pagamento !== undefined ? { nota_pagamento: campi.nota_pagamento } : {}),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Inserimento della comunicazione di prova non riuscito: ${error?.message}`);
  return data.id as string;
}

// Legge la nota di pagamento salvata (null se vuota).
export async function leggiNotaPagamento(db: SupabaseClient, comunicazioneId: string): Promise<string | null> {
  const { data, error } = await db
    .from('comunicazioni_retta')
    .select('nota_pagamento')
    .eq('id', comunicazioneId)
    .single();
  if (error) throw new Error(`Lettura della nota non riuscita: ${error.message}`);
  return data.nota_pagamento as string | null;
}

export async function apriPagamentiBambino(page: Page, bambino: BambinoFixture, mese: string): Promise<Locator> {
  await page.goto(`${PERCORSO_PAGAMENTI}?bambino=${bambino.id}&anno=${annoScolasticoDi(mese)}`);
  const riga = rigaMese(page, mese);
  await expect(riga).toBeVisible();
  return riga;
}

export function rigaMese(page: Page, mese: string): Locator {
  return page.locator(`tr#mese-${mese}`);
}

export function campoNota(riga: Locator): Locator {
  return riga.getByRole('textbox', { name: /^Nota per / });
}

export function finestraImportoDiverso(page: Page, bambino: BambinoFixture): Locator {
  return page.getByRole('dialog', { name: `Importo bonifico diverso per ${bambino.nomeCompleto}` });
}

// Marca il bonifico come "importo diverso" dalla riga del mese.
export async function marcaImportoDiverso(
  page: Page,
  riga: Locator,
  bambino: BambinoFixture,
  importoRicevuto: string,
  nota: string,
  meseCompetenza?: string
): Promise<void> {
  await riga.getByRole('button', { name: 'Importo diverso' }).click();
  const popup = finestraImportoDiverso(page, bambino);
  await expect(popup).toBeVisible();
  await popup.getByLabel('Importo ricevuto (€)').fill(importoRicevuto);
  await popup.getByLabel('Nota bonifico').fill(nota);
  // Per un mese passato il mese proposto sarebbe già trascorso: se ne sceglie uno valido.
  if (meseCompetenza) await popup.getByLabel('Mese su cui conteggiare la differenza').fill(meseCompetenza);
  await popup.getByRole('button', { name: 'Conferma' }).click();
  await expect(riga.getByRole('button', { name: 'Annulla verifica' })).toBeVisible({ timeout: 20_000 });
}

// --- "Modifica importi" (specs/60 PAG-02..PAG-15; issue #421) -----------------
//
// Attesi dall'implementazione (nomi da rispettare):
//   * nella colonna "Inviata" di ogni mese comunicato: pulsante "Modifica importi"
//     (disattivato col bonifico verificato, con la spiegazione accanto), "Storico
//     modifiche" (solo se il mese è stato modificato) e, se modificato,
//     "Modificata il … da …" e "Totale della mail: X €";
//   * finestra `Modifica importi di <nome> <cognome>, <mese anno>` con un campo
//     `<Voce> (€)` per ciascuna delle dieci voci, `Nota costi extra`,
//     `Nota credito/debito`, `Motivo della modifica (obbligatorio)`, il totale
//     `Totale: X €`, i pulsanti "Annulla" e "Salva".

export type VociRiga = {
  retta_mensile: number;
  marca_da_bollo?: number;
  costo_pasti?: number;
  conguaglio_pasti?: number;
  costo_pre_asilo?: number;
  costo_post_asilo?: number;
  gettoni_pre_asilo?: number;
  numero_gettoni_pre_asilo?: number;
  gettoni_post_asilo?: number;
  numero_gettoni_post_asilo?: number;
  costi_extra?: number;
  note_costi_extra?: string;
  credito_debito?: number;
  nota_credito_debito?: string;
  totale: number;
  bonifico_stato?: 'in_attesa' | 'corretto' | 'importo_errato';
};

// Inserisce una comunicazione con tutte le voci scelte (default 0), sul mese dato.
export async function inserisciComunicazioneConVoci(
  db: SupabaseClient,
  bambino: BambinoFixture,
  mese: string,
  voci: VociRiga
): Promise<string> {
  const corretto = voci.bonifico_stato === 'corretto' || voci.bonifico_stato === 'importo_errato';
  const { data, error } = await db
    .from('comunicazioni_retta')
    .insert({
      bambino_id: bambino.id,
      mese,
      costo_pasti: 0,
      conguaglio_pasti: 0,
      costo_pre_asilo: 0,
      costo_post_asilo: 0,
      costi_extra: 0,
      email_destinatario: 'e2e-modifica-importi@example.com',
      inviata_da_nome: 'E2E',
      ...(corretto ? { bonifico_importo_ricevuto: voci.totale } : {}),
      ...voci,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Inserimento della comunicazione di prova non riuscito: ${error?.message}`);
  return data.id as string;
}

export type RigaComunicazione = Record<string, string | number | null>;

export async function leggiComunicazione(db: SupabaseClient, id: string): Promise<RigaComunicazione> {
  const { data, error } = await db.from('comunicazioni_retta').select('*').eq('id', id).single();
  if (error) throw new Error(`Lettura della comunicazione non riuscita: ${error.message}`);
  return data as RigaComunicazione;
}

export async function leggiStorico(db: SupabaseClient, comunicazioneId: string): Promise<RigaComunicazione[]> {
  const { data, error } = await db
    .from('modifiche_comunicazioni_retta')
    .select('*')
    .eq('comunicazione_id', comunicazioneId)
    .order('modificata_il', { ascending: false });
  if (error) throw new Error(`Lettura dello storico non riuscita: ${error.message}`);
  return (data ?? []) as RigaComunicazione[];
}

// Modifica una retta dal DB con la funzione, come farebbe l'app (sessione admin,
// chiave anon): serve a preparare i dati senza passare dalla finestra.
export async function modificaViaFunzione(
  db: SupabaseClient,
  comunicazioneId: string,
  motivo: string,
  voci: Partial<Record<keyof VociRiga, number>> & { retta_mensile: number },
  note: { extra?: string | null; creditoDebito?: string | null } = {}
): Promise<void> {
  const attuale = await leggiComunicazione(db, comunicazioneId);
  const valore = (chiave: string) => Number((voci as Record<string, number | undefined>)[chiave] ?? attuale[chiave]);
  const { error } = await db.rpc('modifica_importi_comunicazione_retta', {
    p_comunicazione_id: comunicazioneId,
    p_motivo: motivo,
    p_retta_mensile: valore('retta_mensile'),
    p_marca_da_bollo: valore('marca_da_bollo'),
    p_costo_pasti: valore('costo_pasti'),
    p_conguaglio_pasti: valore('conguaglio_pasti'),
    p_costo_pre_asilo: valore('costo_pre_asilo'),
    p_costo_post_asilo: valore('costo_post_asilo'),
    p_gettoni_pre_asilo: valore('gettoni_pre_asilo'),
    p_gettoni_post_asilo: valore('gettoni_post_asilo'),
    p_costi_extra: valore('costi_extra'),
    p_credito_debito: valore('credito_debito'),
    p_note_costi_extra: note.extra !== undefined ? note.extra : (attuale.note_costi_extra as string | null),
    p_nota_credito_debito:
      note.creditoDebito !== undefined ? note.creditoDebito : (attuale.nota_credito_debito as string | null),
  });
  if (error) throw new Error(`Modifica via funzione non riuscita: ${error.message}`);
}

export function bottoneModificaImporti(riga: Locator): Locator {
  return riga.getByRole('button', { name: 'Modifica importi' });
}

export function finestraModificaImporti(page: Page, bambino: BambinoFixture, meseEtichetta: string): Locator {
  return page.getByRole('dialog', { name: `Modifica importi di ${bambino.nomeCompleto}, ${meseEtichetta}` });
}

export function campoVoce(finestra: Locator, voce: string): Locator {
  return finestra.getByLabel(`${voce} (€)`, { exact: true });
}

export function campoMotivo(finestra: Locator): Locator {
  return finestra.getByLabel('Motivo della modifica (obbligatorio)');
}

export function pulsanteSalvaModifica(finestra: Locator): Locator {
  return finestra.getByRole('button', { name: 'Salva', exact: true });
}

// Apre la finestra "Modifica importi" della riga del mese e la ritorna.
export async function apriModificaImporti(
  page: Page,
  riga: Locator,
  bambino: BambinoFixture,
  meseEtichetta: string
): Promise<Locator> {
  await bottoneModificaImporti(riga).click();
  const finestra = finestraModificaImporti(page, bambino, meseEtichetta);
  await expect(finestra).toBeVisible();
  return finestra;
}
