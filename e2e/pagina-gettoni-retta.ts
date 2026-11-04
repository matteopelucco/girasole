// Helper e2e per i gettoni pre/post-asilo del mese precedente nella retta
// (specs/56 RET-01..RET-12, specs/60 PAG-01; issue #400).
//
// Attesi dall'implementazione (nomi da rispettare):
//   * tabella "Rette": due colonne con intestazione esatta "Gettoni pre-asilo" e
//     "Gettoni post-asilo", dopo "Post-asilo" e prima di "Costi extra";
//   * riga "da inviare": un campo numerico per voce con aria-label
//     `Gettoni pre-asilo per <nome> <cognome>` / `Gettoni post-asilo per ...`,
//     precompilato con l'importo come numero semplice (es. "21", "0");
//   * numero di gettoni (sola lettura) con `data-testid="numero-gettoni-pre-asilo"` /
//     `"numero-gettoni-post-asilo"` e testo esattamente "3 gettoni" (anche "0 gettoni"),
//     nella riga da inviare, in quella inviata e nella revisione di un mese passato;
//   * riga "Inviata" (o mese passato): importo di sola lettura con
//     `data-testid="importo-gettoni-pre-asilo"` / `"importo-gettoni-post-asilo"` e
//     testo es. "21,00 €";
//   * segnaposto del modello email: {{gettoni_pre_asilo}}, {{numero_gettoni_pre_asilo}},
//     {{gettoni_post_asilo}}, {{numero_gettoni_post_asilo}}, elencati in "Modello email".
//
// Tutti i dati sono di un bambino fixture (e2e/fixture-bambino.ts) con login admin e
// chiave anon (RLS come l'app); spariscono con il bambino (ON DELETE CASCADE),
// tranne le chiusure di prova, che il test elimina nel `finally`.
import { expect, type Locator, type Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BambinoFixture } from './fixture-bambino';
import { scriviCostiInModoEsplicito, type CostiBambino } from './fixture-prezzi';
import { dataOggiRoma } from './helpers';
import { inserisciPresenzaConAsilo, type Voce } from './pagina-gettone';

const SUFFISSO: Record<Voce, string> = { pre: 'pre-asilo', post: 'post-asilo' };

// Mese corrente "YYYY-MM" nel fuso Europe/Rome.
export function meseCorrenteRoma(): string {
  return dataOggiRoma().slice(0, 7);
}

// Mese precedente "YYYY-MM" (gestisce gennaio -> dicembre).
export function mesePrecedenteRoma(): string {
  const [anno, mese] = meseCorrenteRoma().split('-').map(Number);
  return new Date(Date.UTC(anno, mese - 2, 1, 12)).toISOString().slice(0, 7);
}

// I primi `n` giorni feriali (lun-ven) di un mese "YYYY-MM", come "YYYY-MM-DD".
export function primiGiorniFeriali(mese: string, n: number): string[] {
  const [anno, m] = mese.split('-').map(Number);
  const giorni: string[] = [];
  for (let g = 1; giorni.length < n && g <= 28; g++) {
    const d = new Date(Date.UTC(anno, m - 1, g, 12));
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) giorni.push(d.toISOString().slice(0, 10));
  }
  return giorni;
}

// Costi con gettone pre 7,00 e post 8,00 (esempio di specs/56 RET-01); abbonamenti a scelta.
export async function impostaCostiGettoni(
  db: SupabaseClient,
  bambino: BambinoFixture,
  opzioni: { abbonamentoPre?: boolean; abbonamentoPost?: boolean; gettonePre?: number; gettonePost?: number } = {}
): Promise<void> {
  const costi: CostiBambino = {
    prezzo_mensile: 100,
    prezzo_buono_pasto: 0,
    prezzo_marca_da_bollo: 2,
    pre_asilo_richiesto: opzioni.abbonamentoPre ?? false,
    prezzo_pre_asilo: 70,
    post_asilo_richiesto: opzioni.abbonamentoPost ?? false,
    prezzo_post_asilo: 70,
    gettone_pre_asilo: opzioni.gettonePre ?? 7,
    gettone_post_asilo: opzioni.gettonePost ?? 8,
    email_promemoria: `e2e-gettoni-${bambino.id.slice(0, 8)}@example.com`,
  };
  await scriviCostiInModoEsplicito(db, bambino.id, costi);
}

// Presenze nel mese precedente: `pre` giorni con pre-asilo e `post` giorni con
// post-asilo (i primi giorni feriali; i giorni con entrambe le voci sono i primi
// min(pre, post)). Ritorna le date usate.
export async function inserisciPresenzeMesePrecedente(
  db: SupabaseClient,
  bambino: BambinoFixture,
  conteggi: { pre: number; post: number }
): Promise<string[]> {
  const totale = Math.max(conteggi.pre, conteggi.post);
  const giorni = primiGiorniFeriali(mesePrecedenteRoma(), totale);
  for (let i = 0; i < totale; i++) {
    await inserisciPresenzaConAsilo(db, bambino, giorni[i], { pre: i < conteggi.pre, post: i < conteggi.post });
  }
  return giorni;
}

// Giorno di chiusura di prova (admin, RLS); ritorna una funzione che lo elimina.
export async function inserisciChiusura(db: SupabaseClient, data: string): Promise<() => Promise<void>> {
  const { data: riga, error } = await db
    .from('giorni_chiusura')
    .insert({ data_inizio: data, data_fine: data, nota: 'E2E gettoni retta' })
    .select('id')
    .single();
  if (error || !riga) throw new Error(`Inserimento della chiusura di prova non riuscito: ${error?.message ?? 'nessuna riga'}`);
  return async () => {
    const { error: errDel } = await db.from('giorni_chiusura').delete().eq('id', riga.id as string);
    if (errDel) throw new Error(`Pulizia della chiusura di prova non riuscita: ${errDel.message}`);
  };
}

// Retta inviata con i gettoni registrati (colonne nuove di `comunicazioni_retta`).
export async function inserisciRettaConGettoni(
  db: SupabaseClient,
  bambino: BambinoFixture,
  mese: string,
  voci: {
    rettaMensile: number;
    costoPreAsilo?: number;
    costoPostAsilo?: number;
    gettoniPre?: { importo: number; numero: number };
    gettoniPost?: { importo: number; numero: number };
    totale: number;
  }
): Promise<void> {
  const { error } = await db.from('comunicazioni_retta').insert({
    bambino_id: bambino.id,
    mese,
    retta_mensile: voci.rettaMensile,
    costo_pasti: 0,
    conguaglio_pasti: 0,
    costo_pre_asilo: voci.costoPreAsilo ?? 0,
    costo_post_asilo: voci.costoPostAsilo ?? 0,
    gettoni_pre_asilo: voci.gettoniPre?.importo ?? 0,
    numero_gettoni_pre_asilo: voci.gettoniPre?.numero ?? 0,
    gettoni_post_asilo: voci.gettoniPost?.importo ?? 0,
    numero_gettoni_post_asilo: voci.gettoniPost?.numero ?? 0,
    costi_extra: 0,
    totale: voci.totale,
    email_destinatario: 'e2e-gettoni@example.com',
    inviata_da_nome: 'E2E',
  });
  if (error) throw new Error(`Inserimento della retta con gettoni di prova non riuscito: ${error.message}`);
}

// --- Selettori ----------------------------------------------------------

export function rigaRette(page: Page, bambino: BambinoFixture): Locator {
  return page.locator('tr', { hasText: bambino.cognome });
}

export function campoGettoni(riga: Locator, bambino: BambinoFixture, voce: Voce): Locator {
  return riga.getByLabel(`Gettoni ${SUFFISSO[voce]} per ${bambino.nome} ${bambino.cognome}`);
}

export function numeroGettoni(riga: Locator, voce: Voce): Locator {
  return riga.getByTestId(`numero-gettoni-${SUFFISSO[voce]}`);
}

export function importoGettoniInviato(riga: Locator, voce: Voce): Locator {
  return riga.getByTestId(`importo-gettoni-${SUFFISSO[voce]}`);
}

// Apre l'anteprima della comunicazione singola e ritorna la finestra.
export async function apriAnteprima(page: Page, bambino: BambinoFixture): Promise<Locator> {
  await rigaRette(page, bambino).getByRole('button', { name: 'Invia comunicazione' }).click();
  const popup = page.getByRole('dialog', { name: new RegExp(`Anteprima comunicazione per.*${bambino.cognome}`) });
  await expect(popup).toBeVisible();
  return popup;
}
