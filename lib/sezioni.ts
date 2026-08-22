import type { SupabaseClient } from '@supabase/supabase-js';

export type SezioneAttiva = { id: string; nome: string };

// Classi attive rilevanti per l'utente corrente: tutte per l'admin, solo
// quelle assegnate per la maestra (specs/12 - dashboard-maestre.md). Le
// classi non attive non compaiono: non servono per l'appello quotidiano.
export async function sezioniAttiveVisibili(
  supabase: SupabaseClient,
  userId: string,
  ruolo: string | null | undefined
): Promise<SezioneAttiva[]> {
  if (ruolo === 'admin') {
    const { data } = await supabase
      .from('sezioni')
      .select('id, nome')
      .eq('attiva', true)
      .order('nome');
    return data ?? [];
  }

  if (ruolo === 'maestra') {
    const { data } = await supabase
      .from('maestre_sezioni')
      .select('sezioni(id, nome, attiva)')
      .eq('maestra_id', userId);

    return (data ?? [])
      .map((r) => r.sezioni as unknown as (SezioneAttiva & { attiva: boolean }) | null)
      .filter((s): s is SezioneAttiva & { attiva: boolean } => !!s && s.attiva)
      .map(({ id, nome }) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  return [];
}

// Una singola classe per id, o null se non esiste (o non è visibile per
// via della RLS) — usata dalle pagine "elenco bambini della classe" per
// Presenze e Pasti prima di caricarne i bambini.
export async function sezionePerId(
  supabase: SupabaseClient,
  sezioneId: string
): Promise<SezioneAttiva | null> {
  const { data } = await supabase.from('sezioni').select('id, nome').eq('id', sezioneId).maybeSingle();
  return data;
}
