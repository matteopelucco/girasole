import type { SupabaseClient } from '@supabase/supabase-js';

// I campi ore_* arrivano da una colonna `numeric` di Postgres via
// PostgREST: a seconda della versione può essere già un number oppure
// una stringa (per non perdere precisione) — number | string accetta
// entrambi, Number(...) sotto normalizza.
export type ProfiloOrario = {
  ore_lunedi: number | string;
  ore_martedi: number | string;
  ore_mercoledi: number | string;
  ore_giovedi: number | string;
  ore_venerdi: number | string;
};

// Totale ore settimanali di un profilo orario (specs/54 -
// profili-orari.md): somma dei 5 giorni feriali — sabato e domenica
// sono chiusura implicita (specs/53 - calendario-scolastico.md), quindi
// non previsti nel profilo. Non è un campo salvato a parte da tenere
// sincronizzato a mano: chi mostra il profilo (elenco, scheda) lo
// ricalcola sempre da qui. Funzione pura, nessun I/O.
export function totaleOreSettimanali(profilo: ProfiloOrario): number {
  return [profilo.ore_lunedi, profilo.ore_martedi, profilo.ore_mercoledi, profilo.ore_giovedi, profilo.ore_venerdi]
    .map(Number)
    .reduce((totale, ore) => totale + ore, 0);
}

// Ore previste per ciascun giorno feriale (lunedì-venerdì, in ordine),
// per il pannello di sola lettura del personale
// (/dashboard/profilo-orario, specs/54). Funzione pura, nessun I/O.
export function oreGiorniFeriali(profilo: ProfiloOrario): { giorno: string; ore: number }[] {
  return [
    { giorno: 'Lunedì', ore: Number(profilo.ore_lunedi) },
    { giorno: 'Martedì', ore: Number(profilo.ore_martedi) },
    { giorno: 'Mercoledì', ore: Number(profilo.ore_mercoledi) },
    { giorno: 'Giovedì', ore: Number(profilo.ore_giovedi) },
    { giorno: 'Venerdì', ore: Number(profilo.ore_venerdi) },
  ];
}

// Se la query è fallita (es. grant mancante, permessi) solleva un errore
// invece di trattarla come "nessuna riga": un errore scartato produceva
// "Nessun profilo orario assegnato" e ore dovute a 0 nel report (bug in
// produzione, grant mancante a service_role su profili_orari). Stesso
// principio di righeOSollevaErrore (lib/reportPresenze.ts).
export function rigaOSollevaErrore<T>(
  risultato: { data: T | null; error: { message: string } | null },
  descrizione: string
): T | null {
  if (risultato.error) {
    throw new Error(`${descrizione}: ${risultato.error.message}`);
  }
  return risultato.data;
}

// Il profilo orario assegnato a un utente (specs/18 -
// report-ore-lavoro.md, precarica le ore ordinarie del report
// settimanale), null se `profiloOrarioId` è null o non esiste più (fa
// I/O, resta coperta solo da e2e — vedi CLAUDE.md, criterio unit test).
// grant-check: authenticated
export async function recuperaProfiloOrario(
  supabase: SupabaseClient,
  profiloOrarioId: string | null | undefined
): Promise<ProfiloOrario | null> {
  if (!profiloOrarioId) return null;

  const risultato = await supabase
    .from('profili_orari')
    .select('ore_lunedi, ore_martedi, ore_mercoledi, ore_giovedi, ore_venerdi')
    .eq('id', profiloOrarioId)
    .maybeSingle();

  return rigaOSollevaErrore(risultato, 'lettura profilo orario');
}

export type ProfiloOrarioConNome = ProfiloOrario & { nome: string };

// Come recuperaProfiloOrario, ma include anche il nome del profilo
// (specs/52 - report-email-automatico.md, PDF mensile ore di lavoro:
// "il profilo orario di riferimento" va identificato per nome, non solo
// per ore) — funzione distinta perché il resto dell'app non ha mai
// bisogno del nome, solo delle ore per il precaricamento (specs/18).
// Il client è del chiamante: la sessione dell'admin (download PDF) o la
// service_role (cron), quindi nessuna annotazione `grant-check` — il
// parametro generico richiede il GRANT per entrambi i ruoli.
export async function recuperaProfiloOrarioConNome(
  supabase: SupabaseClient,
  profiloOrarioId: string | null | undefined
): Promise<ProfiloOrarioConNome | null> {
  if (!profiloOrarioId) return null;

  const risultato = await supabase
    .from('profili_orari')
    .select('nome, ore_lunedi, ore_martedi, ore_mercoledi, ore_giovedi, ore_venerdi')
    .eq('id', profiloOrarioId)
    .maybeSingle();

  return rigaOSollevaErrore(risultato, 'lettura profilo orario');
}
