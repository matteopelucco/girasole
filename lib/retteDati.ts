import type { SupabaseClient } from '@supabase/supabase-js';
import { primoGiornoMese, ultimoGiornoMese } from './date';

// Pasti effettivi di un mese (specs/56, conguaglio pasti): per ogni bambino il
// numero di righe `pasti` con mangiato = 'si'. Lette a pagine perché il tetto di
// righe per richiesta di PostgREST (1000) troncherebbe in silenzio un mese con
// tanti bambini e darebbe un conguaglio sbagliato. Con la sessione dell'admin
// (RLS). Condivisa dalla pagina «Rette» e dall'invio, così il numero mostrato e
// quello comunicato nascono dalla stessa lettura.
// grant-check: authenticated
export async function pastiEffettiviPerBambino(
  supabase: SupabaseClient,
  bambinoIds: string[],
  mese: string
): Promise<Map<string, number>> {
  const conteggio = new Map<string, number>();
  if (!bambinoIds.length) return conteggio;
  for (let da = 0; ; da += 1000) {
    const { data, error } = await supabase
      .from('pasti')
      .select('bambino_id')
      .in('bambino_id', bambinoIds)
      .gte('data', primoGiornoMese(mese))
      .lte('data', ultimoGiornoMese(mese))
      .eq('mangiato', 'si')
      .order('id')
      .range(da, da + 999);
    // Un errore non si trasforma in «0 pasti»: il conguaglio comunicato per email
    // sarebbe sbagliato. Meglio fermarsi (la pagina o l'invio falliscono in modo visibile).
    if (error) throw new Error(`lettura pasti non riuscita (${error.code})`);
    for (const riga of data ?? []) {
      conteggio.set(riga.bambino_id, (conteggio.get(riga.bambino_id) ?? 0) + 1);
    }
    if ((data?.length ?? 0) < 1000) break;
  }
  return conteggio;
}
