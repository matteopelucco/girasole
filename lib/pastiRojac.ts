import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

// Numero di telefono di Rojac (la mensa esterna), mostrato nel riquadro
// di conferma della comunicazione pasti (specs/16 -
// comunicazione-pasti-rojac.md).
export const TELEFONO_ROJAC = '0331 955630';

// Id di tutti i bambini attivi dell'asilo, condivisa dalle due funzioni
// sotto: entrambe partono dallo stesso insieme (tutti i bambini attivi,
// non solo le classi visibili a chi chiama) e poi lo incrociano con una
// tabella diversa (pasti/presenze).
async function idBambiniAttivi(supabase: SupabaseClient): Promise<string[]> {
  const { data: bambiniAttivi, error } = await supabase.from('bambini').select('id').eq('attiva', true);
  if (error) throw new Error(`lettura bambini: ${error.message}`);
  return (bambiniAttivi ?? []).map((b) => b.id);
}

// Totale dei pasti "sì" segnati oggi in TUTTO l'asilo, non solo le
// classi visibili a chi chiama (specs/16): usa la service_role key
// perché una sessione maestra vede via RLS solo le proprie sezioni,
// mentre la comunicazione a Rojac riguarda un totale unico per l'intero
// asilo. Nessun I/O testabile in unità (CLAUDE.md): coperta da e2e.
export async function contaPastiSiOggiTuttoAsilo(data: string): Promise<number> {
  const supabase = createAdminClient();

  const idBambini = await idBambiniAttivi(supabase);
  if (!idBambini.length) return 0;

  const { count, error } = await supabase
    .from('pasti')
    .select('id', { count: 'exact', head: true })
    .eq('data', data)
    .eq('mangiato', 'si')
    .in('bambino_id', idBambini);
  if (error) throw new Error(`lettura pasti: ${error.message}`);

  return count ?? 0;
}

export type BambinoSenzaPresenza = { id: string; nome: string; cognome: string };

// Bambini attivi, in TUTTO l'asilo, senza ancora una presenza segnata
// per la data data (specs/16: la comunicazione pasti è bloccata finché
// anche un solo bambino ne è privo, qualunque sia lo stato che gli
// manca — e il messaggio di blocco elenca chi manca, con un link di
// scorciatoia alla schermata Presenze). Stessa ragione delle funzioni
// sopra per l'uso della service_role key: il blocco riguarda l'intero
// asilo, non solo le classi visibili a chi chiama, quindi anche
// l'elenco include bambini di classi altrui. Nessun I/O testabile in
// unità (CLAUDE.md): coperta da e2e.
export async function bambiniSenzaPresenzaOggiTuttoAsilo(data: string): Promise<BambinoSenzaPresenza[]> {
  const supabase = createAdminClient();

  const { data: bambiniAttivi, error } = await supabase
    .from('bambini')
    .select('id, nome, cognome')
    .eq('attiva', true)
    .order('cognome');
  if (error) throw new Error(`lettura bambini: ${error.message}`);
  if (!bambiniAttivi?.length) return [];

  const { data: presenze, error: erroreLetturaPresenze } = await supabase
    .from('presenze')
    .select('bambino_id')
    .eq('data', data)
    .in(
      'bambino_id',
      bambiniAttivi.map((b) => b.id)
    );
  if (erroreLetturaPresenze) throw new Error(`lettura presenze: ${erroreLetturaPresenze.message}`);

  const idConPresenza = new Set((presenze ?? []).map((p) => p.bambino_id));
  return bambiniAttivi.filter((b) => !idConPresenza.has(b.id));
}
