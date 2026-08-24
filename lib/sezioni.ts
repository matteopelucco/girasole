import type { SupabaseClient } from '@supabase/supabase-js';

export type SezioneAttiva = { id: string; nome: string };

// Classi rilevanti per l'utente corrente: tutte per l'admin, solo quelle
// assegnate per la maestra o l'assistente (specs/12 - dashboard-maestre.md,
// specs/03 - utenti-e-ruoli.md). Con `soloAttive` (default true) filtra
// anche le classi disattivate — le pagine operative (Presenze/Pasti/
// promemoria) non ne hanno bisogno, solo l'anagrafica classi
// (specs/51 - report.md) vuole vederle tutte.
async function sezioniPerRuolo(
  supabase: SupabaseClient,
  userId: string,
  ruolo: string | null | undefined,
  soloAttive: boolean
): Promise<SezioneAttiva[]> {
  if (ruolo === 'admin') {
    let query = supabase.from('sezioni').select('id, nome').order('nome');
    if (soloAttive) query = query.eq('attiva', true);
    const { data } = await query;
    return data ?? [];
  }

  if (ruolo === 'maestra' || ruolo === 'assistente') {
    const { data } = await supabase
      .from('maestre_sezioni')
      .select('sezioni(id, nome, attiva)')
      .eq('maestra_id', userId);

    return (data ?? [])
      .map((r) => r.sezioni as unknown as (SezioneAttiva & { attiva: boolean }) | null)
      .filter((s): s is SezioneAttiva & { attiva: boolean } => !!s && (!soloAttive || s.attiva))
      .map(({ id, nome }) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  return [];
}

export function sezioniAttiveVisibili(
  supabase: SupabaseClient,
  userId: string,
  ruolo: string | null | undefined
): Promise<SezioneAttiva[]> {
  return sezioniPerRuolo(supabase, userId, ruolo, true);
}

// Tutte le classi rilevanti per l'utente corrente, ATTIVE O NO — usata
// solo dall'anagrafica classi (specs/51 - report.md).
export function sezioniComplete(
  supabase: SupabaseClient,
  userId: string,
  ruolo: string | null | undefined
): Promise<SezioneAttiva[]> {
  return sezioniPerRuolo(supabase, userId, ruolo, false);
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

export type BambinoBase = { id: string; nome: string; cognome: string; sezione_id: string | null };

// Bambini attivi rilevanti per l'utente corrente: tutti per l'admin,
// solo quelli delle sezioni indicate (già filtrate per ruolo da
// sezioniAttiveVisibili) per maestra/assistente — usata dal form Avvisi
// (specs/15 - memo.md, per popolare la selezione a cascata) e dal
// report (specs/51 - report.md).
export async function bambiniAttiviVisibili(
  supabase: SupabaseClient,
  ruolo: string | null | undefined,
  sezioneIds: string[]
): Promise<BambinoBase[]> {
  if (ruolo === 'admin') {
    const { data } = await supabase
      .from('bambini')
      .select('id, nome, cognome, sezione_id')
      .eq('attiva', true)
      .order('cognome');
    return data ?? [];
  }

  if (!sezioneIds.length) return [];
  const { data } = await supabase
    .from('bambini')
    .select('id, nome, cognome, sezione_id')
    .in('sezione_id', sezioneIds)
    .eq('attiva', true)
    .order('cognome');
  return data ?? [];
}
