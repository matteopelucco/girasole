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
