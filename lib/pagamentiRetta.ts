import type { SupabaseClient } from '@supabase/supabase-js';

// I 10 mesi dell'anno scolastico (specs/56 - rette.md): sempre
// Settembre-Giugno, fissi — l'asilo è chiuso in Luglio/Agosto.
// `annoInizio` è l'anno solare in cui inizia l'anno scolastico (es.
// 2025 per "2025/2026"): Settembre-Dicembre cadono in quell'anno
// solare, Gennaio-Giugno in quello successivo. `mese` è il primo
// giorno del mese di competenza (formato YYYY-MM-01), stessa colonna
// usata da `pagamenti_retta`. Funzione pura, nessun I/O.
export type MeseAnnoScolastico = { mese: string; etichetta: string };

const NOMI_MESI = [
  'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
];

export function mesiAnnoScolastico(annoInizio: number): MeseAnnoScolastico[] {
  return NOMI_MESI.map((etichetta, indice) => {
    const numeroMese = ((8 + indice) % 12) + 1;
    const anno = indice < 4 ? annoInizio : annoInizio + 1;
    return { mese: `${anno}-${String(numeroMese).padStart(2, '0')}-01`, etichetta };
  });
}

// Somma degli importi di una riga della tabella rette (specs/56):
// arrotondata a due decimali per evitare somme con più cifre di quante
// ne abbia una valuta (e i classici errori di somma in virgola
// mobile). Funzione pura, nessun I/O.
export function totaleImporti(importi: number[]): number {
  const somma = importi.reduce((totale, importo) => totale + importo, 0);
  return Math.round(somma * 100) / 100;
}

// Importo registrato per ciascuno dei mesi mostrati (specs/56): 0 se
// quel mese non ha ancora un pagamento registrato in `pagamenti_retta`.
// Un pagamento per un mese fuori da `mesi` (es. un anno scolastico
// diverso) viene ignorato. Funzione pura, nessun I/O.
export function importiPerMese(
  pagamenti: { mese: string; importo: number }[],
  mesi: MeseAnnoScolastico[]
): Map<string, number> {
  const perMese = new Map(pagamenti.map((p) => [p.mese, Number(p.importo)]));
  return new Map(mesi.map((m) => [m.mese, perMese.get(m.mese) ?? 0]));
}

export type AnnoScolasticoCorrente = { id: string; nome: string; anno_inizio: number };

// L'anno scolastico impostato come corrente (specs/56 - rette.md),
// null se nessuno lo è (o se il flag è impostato su un anno scolastico
// senza anno di inizio — non dovrebbe succedere, la server action lo
// impedisce, ma qui restiamo difensivi). Fa I/O, resta coperta solo da
// e2e (vedi CLAUDE.md, criterio unit test).
export async function recuperaAnnoScolasticoCorrente(
  supabase: SupabaseClient
): Promise<AnnoScolasticoCorrente | null> {
  const { data } = await supabase
    .from('anni_scolastici')
    .select('id, nome, anno_inizio')
    .eq('corrente', true)
    .not('anno_inizio', 'is', null)
    .maybeSingle();

  return data;
}
