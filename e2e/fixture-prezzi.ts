// Aiuti e2e per i prezzi predefiniti, il tipo di sezione e i costi iniziali del
// bambino (issue #396; specs/62 PRZ-*, specs/50 AMM-*, specs/55 COS-*).
//
// Dati attesi dall'implementazione (nomi da rispettare):
//   * tabella `prezzi_predefiniti` (riga unica, `id` = true) con le colonne
//     retta_materna, retta_primavera, buono_pasto, marca_da_bollo,
//     abbonamento_pre_asilo, abbonamento_post_asilo, gettone_pre_asilo,
//     gettone_post_asilo (numeric, euro) e updated_at;
//   * colonna `sezioni.tipo`: 'materna' | 'primavera' | null;
//   * tabella `costi_bambini` (bambino_id, prezzo_mensile, prezzo_buono_pasto,
//     prezzo_marca_da_bollo, pre_asilo_richiesto, prezzo_pre_asilo,
//     post_asilo_richiesto, prezzo_post_asilo, gettone_pre_asilo,
//     gettone_post_asilo, email_promemoria, updated_at) (gettoni: issue #398).
//
// ATTENZIONE. I prezzi sono UNA riga per tutto l'asilo: i test che li cambiano
// li rimettono com'erano alla fine (`salvaPrezziOriginali`/`ripristinaPrezzi`,
// anche se il test fallisce) e girano in sequenza dentro il proprio file. I
// test che dipendono dai prezzi li rileggono dal database subito prima di
// creare il bambino, invece di assumere i valori iniziali.
//
// SICUREZZA. Come e2e/fixture-bambino.ts: client con la chiave anon, login
// come admin di test, scritture sotto RLS; mai la service_role key. Dati
// fittizi, mai reali.
import type { SupabaseClient } from '@supabase/supabase-js';
import { expect } from '@playwright/test';

export type TipoSezione = 'materna' | 'primavera';

export type Prezzi = {
  retta_materna: number;
  retta_primavera: number;
  buono_pasto: number;
  marca_da_bollo: number;
  abbonamento_pre_asilo: number;
  abbonamento_post_asilo: number;
  gettone_pre_asilo: number;
  gettone_post_asilo: number;
};

// Valori iniziali della migration (specs/62, "Sezione Prezzi").
export const PREZZI_INIZIALI: Prezzi = {
  retta_materna: 160,
  retta_primavera: 200,
  buono_pasto: 6,
  marca_da_bollo: 2,
  abbonamento_pre_asilo: 70,
  abbonamento_post_asilo: 70,
  gettone_pre_asilo: 7,
  gettone_post_asilo: 7,
};

const COLONNE_PREZZI = Object.keys(PREZZI_INIZIALI) as (keyof Prezzi)[];

export type CostiBambino = {
  prezzo_mensile: number;
  prezzo_buono_pasto: number;
  prezzo_marca_da_bollo: number;
  pre_asilo_richiesto: boolean;
  prezzo_pre_asilo: number;
  post_asilo_richiesto: boolean;
  prezzo_post_asilo: number;
  gettone_pre_asilo: number;
  gettone_post_asilo: number;
  email_promemoria: string | null;
};

// Importo come lo scrive l'app: due decimali, virgola, niente migliaia.
export function formatta(euro: number): string {
  return euro.toFixed(2).replace('.', ',');
}

export async function leggiPrezzi(db: SupabaseClient): Promise<Prezzi & { updated_at: string }> {
  const { data, error } = await db.from('prezzi_predefiniti').select('*').eq('id', true).single();
  if (error || !data) throw new Error(`Lettura dei prezzi non riuscita: ${error?.message ?? 'nessuna riga'}`);
  const prezzi = {} as Prezzi;
  for (const c of COLONNE_PREZZI) prezzi[c] = Number(data[c]);
  return { ...prezzi, updated_at: data.updated_at as string };
}

// Scrive i prezzi (anche solo alcuni) come farebbe l'admin; verifica che la riga
// sia stata davvero aggiornata (RLS che rifiuta = 0 righe, senza errore).
export async function scriviPrezzi(db: SupabaseClient, prezzi: Partial<Prezzi>): Promise<void> {
  const { data, error } = await db
    .from('prezzi_predefiniti')
    .update({ ...prezzi, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select('id');
  if (error || !data || data.length !== 1) {
    throw new Error(`Scrittura dei prezzi non riuscita: ${error?.message ?? 'nessuna riga aggiornata'}`);
  }
}

// Da usare in `afterAll`: rimette i prezzi com'erano prima del file di test.
export async function salvaPrezziOriginali(db: SupabaseClient): Promise<Prezzi> {
  const letti = await leggiPrezzi(db);
  const prezzi = {} as Prezzi;
  for (const c of COLONNE_PREZZI) prezzi[c] = letti[c];
  return prezzi;
}

export async function ripristinaPrezzi(db: SupabaseClient, originali: Prezzi): Promise<void> {
  await scriviPrezzi(db, originali);
}

// Sezione di prova con nome unico e tipo scelto (null = senza tipo).
export async function creaSezioneConTipo(
  db: SupabaseClient,
  tipo: TipoSezione | null
): Promise<{ id: string; nome: string }> {
  const nome = `E2ePrezzi ${tipo ?? 'senza tipo'} ${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const { data, error } = await db.from('sezioni').insert({ nome, tipo }).select('id').single();
  if (error || !data) throw new Error(`Creazione della sezione di prova non riuscita: ${error?.message ?? 'nessuna riga'}`);
  return { id: data.id as string, nome };
}

export async function impostaTipoSezione(db: SupabaseClient, sezioneId: string, tipo: TipoSezione | null): Promise<void> {
  const { data, error } = await db.from('sezioni').update({ tipo }).eq('id', sezioneId).select('id');
  if (error || !data || data.length !== 1) {
    throw new Error(`Cambio del tipo della sezione non riuscito: ${error?.message ?? 'nessuna riga aggiornata'}`);
  }
}

export async function leggiTipoSezione(db: SupabaseClient, sezioneId: string): Promise<TipoSezione | null> {
  const { data, error } = await db.from('sezioni').select('tipo').eq('id', sezioneId).single();
  if (error || !data) throw new Error(`Lettura del tipo non riuscita: ${error?.message ?? 'nessuna riga'}`);
  return (data.tipo as TipoSezione | null) ?? null;
}

// Pulizia: elimina la sezione di prova (i bambini restano, senza sezione) e i
// bambini creati dal test, riconosciuti dal cognome unico. I costi vanno via con
// il bambino (ON DELETE CASCADE).
export async function pulisciSezioneEBambini(db: SupabaseClient, sezioneId: string | null, cognomi: string[]): Promise<void> {
  for (const cognome of cognomi) {
    await db.from('bambini').delete().eq('cognome', cognome);
  }
  if (sezioneId) await db.from('sezioni').delete().eq('id', sezioneId);
}

export async function idBambinoPerCognome(db: SupabaseClient, cognome: string): Promise<string> {
  const { data, error } = await db.from('bambini').select('id').eq('cognome', cognome).single();
  if (error || !data) throw new Error(`Bambino ${cognome} non trovato: ${error?.message ?? 'nessuna riga'}`);
  return data.id as string;
}

// Riga dei costi di un bambino, o null se non esiste (maybeSingle: nessun errore).
export async function leggiCosti(db: SupabaseClient, bambinoId: string): Promise<CostiBambino | null> {
  const { data, error } = await db
    .from('costi_bambini')
    .select(
      'prezzo_mensile, prezzo_buono_pasto, prezzo_marca_da_bollo, pre_asilo_richiesto, prezzo_pre_asilo, post_asilo_richiesto, prezzo_post_asilo, gettone_pre_asilo, gettone_post_asilo, email_promemoria'
    )
    .eq('bambino_id', bambinoId)
    .maybeSingle();
  if (error) throw new Error(`Lettura dei costi non riuscita: ${error.message}`);
  if (!data) return null;
  return {
    prezzo_mensile: Number(data.prezzo_mensile),
    prezzo_buono_pasto: Number(data.prezzo_buono_pasto),
    prezzo_marca_da_bollo: Number(data.prezzo_marca_da_bollo),
    pre_asilo_richiesto: data.pre_asilo_richiesto as boolean,
    prezzo_pre_asilo: Number(data.prezzo_pre_asilo),
    post_asilo_richiesto: data.post_asilo_richiesto as boolean,
    prezzo_post_asilo: Number(data.prezzo_post_asilo),
    gettone_pre_asilo: Number(data.gettone_pre_asilo),
    gettone_post_asilo: Number(data.gettone_post_asilo),
    email_promemoria: (data.email_promemoria as string | null) ?? null,
  };
}

// Scrive a mano una riga di costi con valori noti (come farebbe l'admin dalla scheda).
export async function scriviCostiInModoEsplicito(db: SupabaseClient, bambinoId: string, costi: CostiBambino): Promise<void> {
  const { error } = await db.from('costi_bambini').upsert({ bambino_id: bambinoId, ...costi });
  expect(error?.message ?? null).toBeNull();
}
