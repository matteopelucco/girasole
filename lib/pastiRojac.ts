import type { SupabaseClient } from '@supabase/supabase-js';
import { bambiniConIncoerenzeDaRighe, type BambinoConIncoerenze, type RigaIncoerenzaDb } from '@/lib/consistenza';

// Numero di telefono di Rojac (la mensa esterna), mostrato nel riquadro
// di conferma della comunicazione pasti (specs/16 -
// comunicazione-pasti-rojac.md).
export const TELEFONO_ROJAC = '0331 955630';

// Le tre letture qui sotto riguardano TUTTO l'asilo, non solo le classi
// visibili a chi chiama (una maestra vede via RLS solo le proprie
// sezioni, mentre la comunicazione a Rojac è un totale unico). Passano da
// funzioni Postgres `security definer` (migration 0056) richiamate via
// RPC con il client della sessione dell'utente, NON più con la
// service_role key: il controllo del ruolo (admin/maestra, e per la
// maestra solo la giornata odierna) è dentro la funzione, che altrimenti
// risponde con un errore. Nessun I/O testabile in unità (CLAUDE.md):
// coperte da pgTAP (supabase/tests/database/rpc_pasti_rojac.test.sql) ed
// e2e.

// Totale dei pasti "sì" segnati nella data in TUTTO l'asilo (specs/16).
export async function contaPastiSiOggiTuttoAsilo(supabase: SupabaseClient, data: string): Promise<number> {
  const { data: totale, error } = await supabase.rpc('pasti_si_oggi_asilo', { p_data: data });
  if (error) throw new Error(`lettura pasti: ${error.message}`);
  return (totale as number | null) ?? 0;
}

export type BambinoSenzaPresenza = { id: string; nome: string; cognome: string };

// Bambini attivi, in TUTTO l'asilo, senza ancora una presenza segnata
// per la data data (specs/16: la comunicazione pasti è bloccata finché
// anche un solo bambino ne è privo, qualunque sia lo stato che gli
// manca — e il messaggio di blocco elenca chi manca, con un link di
// scorciatoia alla schermata Presenze). L'elenco include bambini di
// classi altrui: è il comportamento voluto da specs/16.
export async function bambiniSenzaPresenzaOggiTuttoAsilo(
  supabase: SupabaseClient,
  data: string
): Promise<BambinoSenzaPresenza[]> {
  const { data: bambini, error } = await supabase.rpc('bambini_senza_presenza_asilo', { p_data: data });
  if (error) throw new Error(`lettura presenze: ${error.message}`);
  return (bambini as BambinoSenzaPresenza[] | null) ?? [];
}

export type EsitoComunicazioneRojac = { numero: number; nome: string };

// Registra la comunicazione dei pasti a Rojac (specs/16) via RPC
// `comunica_pasti_rojac` (migration 0057, sessione dell'utente): la
// funzione verifica il ruolo, applica i blocchi (presenze mancanti, dati
// incoerenti, già comunicato) e decide da sé totale e nome di chi
// comunica, in una sola transazione. Non lancia: restituisce l'errore
// così l'azione può mappare il codice (es. 23505 = già comunicato) in un
// messaggio per l'utente.
export async function comunicaPastiRojacDb(
  supabase: SupabaseClient,
  data: string
): Promise<{ esito: EsitoComunicazioneRojac | null; errore: { code?: string; message: string } | null }> {
  const { data: righe, error } = await supabase.rpc('comunica_pasti_rojac', { p_data: data });
  if (error) return { esito: null, errore: { code: error.code, message: error.message } };
  const riga = (righe as { numero_comunicato: number; comunicato_nome: string }[] | null)?.[0];
  if (!riga) return { esito: null, errore: { message: 'risposta vuota da comunica_pasti_rojac' } };
  return { esito: { numero: riga.numero_comunicato, nome: riga.comunicato_nome }, errore: null };
}

// Bambini attivi, in TUTTO l'asilo, con dati incoerenti per la data
// (specs/16, specs/06): in pratica un pasto "sì" su un bambino assente o
// malato, cioè pasti segnati > bambini presenti. La comunicazione a
// Rojac è bloccata finché ne esiste uno. La RPC restituisce solo le righe dei
// bambini incoerenti; i messaggi sono composti da lib/consistenza.ts:bambiniConIncoerenzeDaRighe
// (pura, con unit test).
export async function bambiniConIncoerenzeOggiTuttoAsilo(
  supabase: SupabaseClient,
  data: string
): Promise<BambinoConIncoerenze[]> {
  const { data: righe, error } = await supabase.rpc('bambini_incoerenti_asilo', { p_data: data });
  if (error) throw new Error(`lettura presenze e pasti: ${error.message}`);
  return bambiniConIncoerenzeDaRighe((righe as RigaIncoerenzaDb[] | null) ?? []);
}
