// Helper e2e per verificare gli scenari "dopo la comunicazione pasti" di
// specs/16 SENZA mai comunicare i pasti di oggi (issue #177).
//
// PERCHÉ. La comunicazione a Rojac è una sola per data, per tutto l'asilo, e
// non si annulla: comunicare "oggi" bloccherebbe i pasti di tutte le maestre
// per il resto della giornata. Una data PASSATA invece non disturba nessuno:
// la maestra scrive solo oggi (specs/14), quindi nessun altro test tocca
// quella data. La comunicazione di quella data la fa l'admin.
//
// COME. Con il client `adminDb` (chiave anon + login admin, mai service_role:
// vedi e2e/fixture-bambino.ts), che passa dalla RLS come l'app:
//   1. il bambino fixture del test riceve presenza "presente" e pasto "sì" su
//      quella data (l'admin può scrivere qualunque data);
//   2. se la data NON è ancora comunicata, ogni bambino attivo senza presenza
//      riceve "presente" (il database lo richiede per comunicare), poi si
//      chiama la funzione `comunica_pasti_rojac` (migration 0057). Chiamarla
//      direttamente NON manda nessuna email: l'email parte dall'azione
//      dell'app, che qui non si usa.
// La comunicazione resta nel DB di test (si azzera con il reset della CI); in
// locale un secondo giro la trova già fatta e salta il passo 2. Se un altro
// test crea un bambino proprio in quel momento, la funzione rifiuta
// (presenza mancante): si riprova con l'elenco aggiornato.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BambinoFixture } from './fixture-bambino';

// Un mercoledì passato e lontano, giorno di scuola (non sabato/domenica) e
// lontano dalle date usate dagli altri test (oggi, ieri, chiusure future).
export const DATA_PASSATA_COMUNICATA = '2025-03-12';

const TENTATIVI_COMUNICAZIONE = 4;

async function scrivi(promessa: PromiseLike<{ error: { message: string } | null }>, cosa: string) {
  const { error } = await promessa;
  if (error) throw new Error(`${cosa}: ${error.message}`);
}

// Presenza "presente" e pasto "sì" del bambino fixture sulla data passata.
async function segnaPresenteConPasto(db: SupabaseClient, bambino: BambinoFixture): Promise<void> {
  await scrivi(
    db.from('presenze').upsert(
      { bambino_id: bambino.id, data: DATA_PASSATA_COMUNICATA, stato: 'presente' },
      { onConflict: 'bambino_id,data' }
    ),
    'Presenza del bambino fixture sulla data passata non salvata'
  );
  await scrivi(
    db.from('pasti').upsert(
      { bambino_id: bambino.id, data: DATA_PASSATA_COMUNICATA, mangiato: 'si' },
      { onConflict: 'bambino_id,data' }
    ),
    'Pasto del bambino fixture sulla data passata non salvato'
  );
}

async function giaComunicata(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db
    .from('pasti_comunicati')
    .select('data')
    .eq('data', DATA_PASSATA_COMUNICATA)
    .maybeSingle();
  if (error) throw new Error(`Lettura della comunicazione passata non riuscita: ${error.message}`);
  return data !== null;
}

// Mette "presente" ai bambini attivi che non hanno ancora una presenza sulla
// data passata (solo quelli: le presenze già segnate restano com'erano).
async function completaPresenze(db: SupabaseClient): Promise<void> {
  const { data: attivi, error } = await db.from('bambini').select('id').eq('attiva', true);
  if (error) throw new Error(`Lettura dei bambini attivi non riuscita: ${error.message}`);
  const { data: presenti, error: errPresenti } = await db
    .from('presenze')
    .select('bambino_id')
    .eq('data', DATA_PASSATA_COMUNICATA);
  if (errPresenti) throw new Error(`Lettura delle presenze non riuscita: ${errPresenti.message}`);

  const conPresenza = new Set((presenti ?? []).map((p) => p.bambino_id as string));
  const mancanti = (attivi ?? []).map((b) => b.id as string).filter((id) => !conPresenza.has(id));
  if (mancanti.length === 0) return;
  await scrivi(
    db.from('presenze').upsert(
      mancanti.map((id) => ({ bambino_id: id, data: DATA_PASSATA_COMUNICATA, stato: 'presente' })),
      { onConflict: 'bambino_id,data' }
    ),
    'Presenze mancanti sulla data passata non salvate'
  );
}

// Prepara la data passata: il bambino fixture è presente con pasto "sì" e i
// pasti della data sono comunicati (una volta sola, poi si riusa).
export async function preparaGiornoPassatoComunicato(db: SupabaseClient, bambino: BambinoFixture): Promise<void> {
  await segnaPresenteConPasto(db, bambino);
  if (await giaComunicata(db)) return;

  let ultimoErrore = '';
  for (let tentativo = 1; tentativo <= TENTATIVI_COMUNICAZIONE; tentativo++) {
    await completaPresenze(db);
    const { error } = await db.rpc('comunica_pasti_rojac', { p_data: DATA_PASSATA_COMUNICATA });
    if (!error) return;
    // Un altro worker l'ha comunicata nel frattempo: va bene così.
    if (error.code === '23505') return;
    ultimoErrore = error.message;
  }
  throw new Error(`Comunicazione dei pasti sulla data passata non riuscita: ${ultimoErrore}`);
}
