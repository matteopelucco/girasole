import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { bambiniConIncoerenze, type BambinoConIncoerenze, type StatoPasto, type StatoPresenza } from '@/lib/consistenza';

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

// Bambini attivi con nome e cognome, ordinati per cognome: punto di
// partenza comune delle due funzioni sotto che elencano bambini da
// correggere (presenza mancante, dati incoerenti).
async function bambiniAttiviConNome(supabase: SupabaseClient): Promise<BambinoSenzaPresenza[]> {
  const { data, error } = await supabase.from('bambini').select('id, nome, cognome').eq('attiva', true).order('cognome');
  if (error) throw new Error(`lettura bambini: ${error.message}`);
  return data ?? [];
}

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

  const bambiniAttivi = await bambiniAttiviConNome(supabase);
  if (!bambiniAttivi.length) return [];

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

// Bambini attivi, in TUTTO l'asilo, con dati incoerenti per la data
// (specs/16, specs/06): in pratica un pasto "sì" su un bambino assente o
// malato, cioè pasti segnati > bambini presenti. La comunicazione a
// Rojac è bloccata finché ne esiste uno. Regola in
// lib/consistenza.ts:bambiniConIncoerenze (pura, con unit test); qui solo
// la lettura, con la service_role key per la stessa ragione delle
// funzioni sopra (il blocco riguarda l'intero asilo, anche le classi non
// visibili a chi guarda). Nessun I/O testabile in unità (CLAUDE.md):
// coperta da e2e.
export async function bambiniConIncoerenzeOggiTuttoAsilo(data: string): Promise<BambinoConIncoerenze[]> {
  const supabase = createAdminClient();

  const bambiniAttivi = await bambiniAttiviConNome(supabase);
  if (!bambiniAttivi.length) return [];

  const idBambini = bambiniAttivi.map((b) => b.id);
  const [{ data: presenze, error: errorePresenze }, { data: pasti, error: errorePasti }] = await Promise.all([
    supabase
      .from('presenze')
      .select('bambino_id, stato, pre_asilo, post_asilo')
      .eq('data', data)
      .in('bambino_id', idBambini),
    supabase.from('pasti').select('bambino_id, mangiato').eq('data', data).in('bambino_id', idBambini),
  ]);
  if (errorePresenze) throw new Error(`lettura presenze: ${errorePresenze.message}`);
  if (errorePasti) throw new Error(`lettura pasti: ${errorePasti.message}`);

  const presenzaPerBambino = new Map((presenze ?? []).map((p) => [p.bambino_id, p]));
  const pastoPerBambino = new Map((pasti ?? []).map((p) => [p.bambino_id, p]));

  return bambiniConIncoerenze(
    bambiniAttivi.map((b) => {
      const presenza = presenzaPerBambino.get(b.id);
      return {
        ...b,
        stato: presenza?.stato as StatoPresenza | undefined,
        preAsilo: presenza?.pre_asilo,
        postAsilo: presenza?.post_asilo,
        mangiato: pastoPerBambino.get(b.id)?.mangiato as StatoPasto | undefined,
      };
    })
  );
}
