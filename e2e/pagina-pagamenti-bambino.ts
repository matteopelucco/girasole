// Helper e2e per "Pagamenti bambino" (specs/60 PAG-02..PAG-08) e per la verifica
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
