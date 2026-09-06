import { oreOrdinariePreviste } from '@/lib/oreLavoro';
import type { ProfiloOrario } from '@/lib/profiliOrari';

// Arrotonda a 2 decimali (stessa precisione di numeric(6,2) nel
// database), evitando artefatti in virgola mobile (es. 0.1 + 0.2).
function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100;
}

export type GiornoPerMonteOre = {
  data: string;
  stato: string;
  oreOrdinarie: number | string;
  oreStraordinarie: number | string;
};

export type EsuberoCarenza = { esubero: number; carenza: number };

// Esubero (ore straordinarie) e carenza (ore mancanti rispetto al
// profilo orario) di una settimana (specs/19 - monte-ore.md): solo i
// giorni in stato "lavorativo" contribuiscono — malattia/assenza sono
// esclusi dal calcolo esplicitamente (hanno comunque sempre ore a 0 per
// costruzione, vedi lib/oreLavoro.ts:validaGiornoOreLavoro, ma qui
// l'esclusione è esplicita per chiarezza del requisito, non solo un
// effetto collaterale dei dati). Riusa oreOrdinariePreviste (stessa
// fonte di verità del precaricamento in specs/18, CLAUDE.md/jscpd).
// Funzione pura, nessun I/O.
export function calcolaEsuberoCarenza(
  giorni: GiornoPerMonteOre[],
  profiloOrario: ProfiloOrario | null | undefined
): EsuberoCarenza {
  let esubero = 0;
  let carenza = 0;

  for (const giorno of giorni) {
    if (giorno.stato !== 'lavorativo') continue;

    esubero += Number(giorno.oreStraordinarie);

    const previsto = oreOrdinariePreviste(profiloOrario, giorno.data);
    const ordinarie = Number(giorno.oreOrdinarie);
    if (previsto > ordinarie) {
      carenza += previsto - ordinarie;
    }
  }

  return { esubero: arrotonda(esubero), carenza: arrotonda(carenza) };
}

// Variazione di monte ore di una settimana (specs/19): positiva = il
// monte ore aumenta (carenza in eccesso sull'esubero, cresce il debito
// verso la struttura); negativa = il monte ore scala (esubero in
// eccesso sulla carenza, si riduce il debito). Funzione pura.
export function variazioneMonteOre(esubero: number, carenza: number): number {
  return arrotonda(carenza - esubero);
}

// Nota descrittiva del movimento automatico settimanale, mostrata nello
// storico (specs/19): la data della settimana è già nella colonna
// settimana_inizio del movimento, qui solo il dettaglio del calcolo.
// Funzione pura.
export function notaMovimentoSettimanale(esubero: number, carenza: number): string {
  return `Calcolo automatico: ${esubero}h di straordinario, ${carenza}h di carenza rispetto al profilo orario.`;
}

export type MovimentoMonteOre = { variazione: number | string };

// Saldo attuale di monte ore (specs/19): somma di tutte le variazioni,
// positiva o negativa — nessun campo "saldo" salvato a parte, sempre
// ricalcolato dallo storico dei movimenti. Funzione pura, nessun I/O:
// chi chiama ha già recuperato i movimenti (query separata,
// RLS-dipendente).
export function saldoMonteOre(movimenti: MovimentoMonteOre[]): number {
  return arrotonda(movimenti.reduce((totale, m) => totale + Number(m.variazione), 0));
}

export type MovimentoConUtente = { utente_id: string; variazione: number | string };

// Saldo di monte ore per ciascun utente presente nell'elenco di
// movimenti (specs/19, scenari "l'admin vede il monte ore di ciascuna
// persona" e riepilogo nella mail giornaliera): una sola query per più
// persone, invece di una per persona. Funzione pura.
export function saldiPerUtente(movimenti: MovimentoConUtente[]): Map<string, number> {
  const saldi = new Map<string, number>();
  for (const m of movimenti) {
    saldi.set(m.utente_id, arrotonda((saldi.get(m.utente_id) ?? 0) + Number(m.variazione)));
  }
  return saldi;
}
