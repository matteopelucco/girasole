import type { SupabaseClient } from '@supabase/supabase-js';

// Impostazione "indirizzo iCal del Google Calendar" (specs/64 - calendario-eventi.md),
// tabella a riga singola `impostazioni_calendario` (migration 0065). Con la
// sessione dell'admin: la RLS lascia leggere e modificare solo a lui.
//
// L'indirizzo è un SEGRETO: `statoCalendario` restituisce solo se è impostato e
// quando è stato salvato (è la sola cosa che la pagina manda al browser);
// l'indirizzo vero lo restituisce solo `indirizzoCalendario`, dopo la verifica
// della password. Nessuna funzione qui scrive l'indirizzo in un log o in un
// messaggio, né riporta il dettaglio degli errori del database (un errore di
// vincolo può contenere la riga con l'indirizzo).

export type StatoCalendario = { configurato: boolean; aggiornatoIl: string | null };

// grant-check: authenticated
export async function statoCalendario(supabase: SupabaseClient): Promise<StatoCalendario | null> {
  const { data, error } = await supabase.from('impostazioni_calendario').select('ical_url, updated_at').maybeSingle();
  if (error || !data) return null;
  const riga = data as { ical_url: string | null; updated_at: string | null };
  return { configurato: Boolean(riga.ical_url), aggiornatoIl: riga.updated_at };
}

// grant-check: authenticated
export async function indirizzoCalendario(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.from('impostazioni_calendario').select('ical_url').maybeSingle();
  if (error || !data) return null;
  return (data as { ical_url: string | null }).ical_url || null;
}

// Solo "c'è un indirizzo salvato?", per la pagina Calendario (specs/64): la query
// non legge la colonna dell'indirizzo, lo usa soltanto come filtro, così non può
// finire nella risposta, nei log o nella pagina. Falso anche se non si riesce a leggere.
// grant-check: authenticated
export async function calendarioCollegato(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from('impostazioni_calendario')
    .select('id')
    .not('ical_url', 'is', null)
    .neq('ical_url', '')
    .maybeSingle();
  return !error && Boolean(data);
}

// `indirizzo` null = sincronizzazione disattivata. Vero se la riga è stata
// aggiornata (una riga mancante o un permesso negato non danno errore, ma
// nessuna riga modificata).
// grant-check: authenticated
export async function salvaIndirizzoCalendario(supabase: SupabaseClient, indirizzo: string | null): Promise<boolean> {
  const { data, error } = await supabase
    .from('impostazioni_calendario')
    .update({ ical_url: indirizzo, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select('id');
  return !error && Array.isArray(data) && data.length === 1;
}
