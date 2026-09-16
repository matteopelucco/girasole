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

export type BambinoBase = { id: string; nome: string; cognome: string; sezione_id: string | null };

// Raggruppa un elenco per sezione (specs/12 - dashboard-maestre.md,
// specs/56 - comunicazione-retta-mensile.md): un gruppo per ciascuna
// sezione che ha almeno un elemento (ordine alfabetico, stesso di
// `sezioni`), più "Senza sezione" in coda se non vuoto — mai un gruppo
// vuoto in mezzo, non aggiunge valore in una pagina già densa. Funzione
// pura, generica sul tipo di elemento (bambini di Presenze/Pasti/Rette,
// coppie {bambino, comunicazione} di Rette hanno forme diverse ma lo
// stesso bisogno di raggruppamento — CLAUDE.md, jscpd: condivisa da
// app/dashboard/presenze/page.tsx, app/dashboard/pasti/page.tsx e
// app/admin/rette/page.tsx invece di essere ridefinita in ciascuno).
export function raggruppaPerSezione<T>(
  elementi: T[],
  sezioneIdDi: (elemento: T) => string | null,
  sezioni: SezioneAttiva[]
): { titolo: string; elementi: T[] }[] {
  const perSezione = new Map<string, T[]>();
  const senzaSezione: T[] = [];

  for (const elemento of elementi) {
    const sezioneId = sezioneIdDi(elemento);
    if (!sezioneId) {
      senzaSezione.push(elemento);
      continue;
    }
    const lista = perSezione.get(sezioneId) ?? [];
    lista.push(elemento);
    perSezione.set(sezioneId, lista);
  }

  const gruppi = sezioni
    .map((sezione) => ({ titolo: sezione.nome, elementi: perSezione.get(sezione.id) ?? [] }))
    .filter((gruppo) => gruppo.elementi.length > 0);

  if (senzaSezione.length) {
    gruppi.push({ titolo: 'Senza sezione', elementi: senzaSezione });
  }

  return gruppi;
}

// Messaggio da mostrare quando l'utente non ha nessuna sezione visibile
// (Presenze/Pasti, specs/12 - dashboard-maestre.md): invito a chiedere
// un'assegnazione per maestra/assistente, semplice presa d'atto per
// l'admin (che vede sempre tutte le sezioni attive — se non ce ne sono,
// nessuna è stata ancora creata). Funzione pura, nessun I/O: stesso
// testo ripetuto identico in app/dashboard/presenze/page.tsx e
// app/dashboard/pasti/page.tsx prima di questa estrazione (CLAUDE.md,
// jscpd).
export function messaggioSezioniVuote(ruolo: string | null | undefined): string {
  return ruolo === 'maestra' || ruolo === 'assistente'
    ? 'Non hai ancora nessuna sezione assegnata: chiedi all’admin di assegnartene una.'
    : 'Nessuna classe attiva ancora creata.';
}

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

// Sezioni e bambini visibili per l'utente corrente, in un solo giro: le
// due chiamate vanno sempre in coppia (il secondo elenco dipende dal
// primo) — usata dalla pagina Report (specs/51) e dall'elenco classi di
// Presenze/Pasti (specs/12), per non ripetere la stessa sequenza di
// query in più punti (CLAUDE.md, jscpd).
export async function sezioniEBambiniVisibili(
  supabase: SupabaseClient,
  userId: string,
  ruolo: string | null | undefined
): Promise<{ sezioni: SezioneAttiva[]; bambini: BambinoBase[] }> {
  const sezioni = await sezioniAttiveVisibili(supabase, userId, ruolo);
  const bambini = await bambiniAttiviVisibili(
    supabase,
    ruolo,
    sezioni.map((s) => s.id)
  );
  return { sezioni, bambini };
}
