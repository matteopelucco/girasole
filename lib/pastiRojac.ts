import { createAdminClient } from '@/lib/supabase/admin';

// Numero di telefono di Rojac (la mensa esterna), mostrato nel riquadro
// di conferma della comunicazione pasti (specs/16 -
// comunicazione-pasti-rojac.md).
export const TELEFONO_ROJAC = '0331 955630';

// Totale dei pasti "sì" segnati oggi in TUTTO l'asilo, non solo le
// classi visibili a chi chiama (specs/16): usa la service_role key
// perché una sessione maestra vede via RLS solo le proprie sezioni,
// mentre la comunicazione a Rojac riguarda un totale unico per l'intero
// asilo. Nessun I/O testabile in unità (CLAUDE.md): coperta da e2e.
export async function contaPastiSiOggiTuttoAsilo(data: string): Promise<number> {
  const supabase = createAdminClient();

  const { data: bambiniAttivi, error: erroreBambini } = await supabase
    .from('bambini')
    .select('id')
    .eq('attiva', true);
  if (erroreBambini) throw new Error(`lettura bambini: ${erroreBambini.message}`);

  const idBambini = (bambiniAttivi ?? []).map((b) => b.id);
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
