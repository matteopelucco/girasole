import type { SupabaseClient } from '@supabase/supabase-js';
import { isWeekend } from '@/lib/date';

export type GiornoChiusura = { id: string; dataInizio: string; dataFine: string; nota: string | null };

// Il giorno di chiusura (registrato dall'admin) che copre `data`, se
// esiste — funzione pura, nessun I/O: riceve l'elenco già caricato
// invece di interrogare il database (vedi chiusuraPerData sotto per la
// query). Non gestisce sovrapposizioni tra più chiusure (specs/53,
// "Regole": non sono un caso da distinguere, il giorno risulta comunque
// chiuso) — restituisce la prima che copre la data.
export function trovaChiusura(data: string, chiusure: GiornoChiusura[]): GiornoChiusura | null {
  return chiusure.find((c) => data >= c.dataInizio && data <= c.dataFine) ?? null;
}

// Vero se in `data` l'asilo è chiuso: weekend (specs/53) o dentro un
// giorno di chiusura registrato dall'admin. Funzione pura, stessa
// duplice regola implementata lato database in
// supabase/migrations/0022_calendario_scolastico.sql:giorno_chiuso.
export function isGiornoChiuso(data: string, chiusure: GiornoChiusura[]): boolean {
  return isWeekend(data) || trovaChiusura(data, chiusure) !== null;
}

// Messaggio da mostrare in Presenze/Pasti quando il giorno è chiuso,
// null se scrivibile (specs/53, scenari "un giorno di chiusura è
// visibile e bloccante in Presenze/Pasti"). Pura: nessun I/O.
export function messaggioChiusura(data: string, chiusure: GiornoChiusura[]): string | null {
  const chiusura = trovaChiusura(data, chiusure);
  if (chiusura) {
    return chiusura.nota
      ? `Giorno di chiusura scolastica: ${chiusura.nota}.`
      : 'Giorno di chiusura scolastica.';
  }
  if (isWeekend(data)) {
    return "L'asilo è chiuso: sabato e domenica non è possibile registrare presenze o pasti.";
  }
  return null;
}

// Giorni di chiusura registrati dall'admin che coprono `data` (fa I/O,
// resta coperta solo da e2e — vedi CLAUDE.md, criterio unit test). Una
// data può ricadere in al più una chiusura in pratica (le sovrapposizioni
// non sono vietate ma non cambiano il comportamento, specs/53), quindi
// basta la prima riga trovata.
export async function chiusuraPerData(supabase: SupabaseClient, data: string): Promise<GiornoChiusura | null> {
  const { data: riga } = await supabase
    .from('giorni_chiusura')
    .select('id, data_inizio, data_fine, nota')
    .lte('data_inizio', data)
    .gte('data_fine', data)
    .limit(1)
    .maybeSingle();

  if (!riga) return null;
  return { id: riga.id, dataInizio: riga.data_inizio, dataFine: riga.data_fine, nota: riga.nota };
}

// Giorni di chiusura registrati dall'admin che si sovrappongono al
// periodo [inizio, fine] (fa I/O, resta coperta solo da e2e — vedi
// CLAUDE.md, criterio unit test) — usata dal report ore di lavoro
// (specs/18 - report-ore-lavoro.md), che deve conoscere le chiusure di
// un'intera settimana in una sola query invece di una per giorno.
export async function chiusurePerPeriodo(
  supabase: SupabaseClient,
  inizio: string,
  fine: string
): Promise<GiornoChiusura[]> {
  const { data: righe } = await supabase
    .from('giorni_chiusura')
    .select('id, data_inizio, data_fine, nota')
    .lte('data_inizio', fine)
    .gte('data_fine', inizio);

  return (righe ?? []).map((r) => ({ id: r.id, dataInizio: r.data_inizio, dataFine: r.data_fine, nota: r.nota }));
}

// Controllo esplicito lato server action, prima di scrivere su
// presenze/pasti (specs/53 - calendario-scolastico.md): per un messaggio
// d'errore chiaro, oltre al trigger DB che è la difesa reale (vedi
// supabase/migrations/0022_calendario_scolastico.sql) — stesso pattern
// già in uso per assicuraScrivibile (lib/auth.ts) e assicuraNonAssente
// (app/dashboard/pasti/actions.ts). Vale per QUALUNQUE ruolo, admin
// incluso: a differenza di assicuraScrivibile, non riceve né controlla
// il ruolo.
export async function assicuraGiornoApribile(supabase: SupabaseClient, data: string): Promise<void> {
  const chiusura = await chiusuraPerData(supabase, data);
  if (isGiornoChiuso(data, chiusura ? [chiusura] : [])) {
    throw new Error('Impossibile registrare: è un giorno di chiusura scolastica.');
  }
}
