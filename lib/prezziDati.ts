import type { SupabaseClient } from '@supabase/supabase-js';
import { CAMPI_PREZZI, type Prezzi } from './prezzi';

// Lettura e salvataggio della riga unica `prezzi_predefiniti` (specs/62,
// migration 0067), con la sessione dell'admin: la RLS lascia leggere e
// modificare solo a lui.

export type PrezziLetti = { prezzi: Prezzi; aggiornatoIl: string };

export type EsitoSalvataggioPrezzi = 'ok' | 'concorrenza' | 'errore';

const COLONNE = [...CAMPI_PREZZI.map((c) => c.colonna), 'updated_at'].join(', ');

// null = prezzi non leggibili (errore, riga mancante o permesso negato): chi
// chiama non deve mai inventare dei valori al loro posto.
// grant-check: authenticated
export async function leggiPrezzi(supabase: SupabaseClient): Promise<PrezziLetti | null> {
  const { data, error } = await supabase.from('prezzi_predefiniti').select(COLONNE).eq('id', true).maybeSingle();
  if (error || !data) return null;
  const riga = data as unknown as Record<string, unknown>;
  const prezzi = {} as Prezzi;
  for (const { colonna } of CAMPI_PREZZI) {
    const valore = Number(riga[colonna]);
    if (!Number.isFinite(valore)) return null;
    prezzi[colonna] = valore;
  }
  if (typeof riga.updated_at !== 'string') return null;
  return { prezzi, aggiornatoIl: riga.updated_at };
}

// Salva tutti gli otto prezzi in un solo UPDATE (tutto o niente), ma solo se la
// riga non è cambiata da quando l'admin l'ha letta: `aggiornatoIlAtteso` è il
// `updated_at` letto allora, confrontato così com'è (testo, mai passato da
// Date: si perderebbero i microsecondi). Nessuna riga aggiornata = qualcun altro
// ha salvato prima (l'admin è già verificato da chi chiama).
// grant-check: authenticated
export async function salvaPrezzi(
  supabase: SupabaseClient,
  prezzi: Prezzi,
  aggiornatoIlAtteso: string
): Promise<EsitoSalvataggioPrezzi> {
  const { data, error } = await supabase
    .from('prezzi_predefiniti')
    .update({ ...prezzi, updated_at: new Date().toISOString() })
    .eq('id', true)
    .eq('updated_at', aggiornatoIlAtteso)
    .select('id');
  if (error) return 'errore';
  return Array.isArray(data) && data.length === 1 ? 'ok' : 'concorrenza';
}
