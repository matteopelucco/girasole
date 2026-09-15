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

export type ControlloSettimanaOreLavoro = {
  oreDovute: number;
  oreOrdinarieErogate: number;
  oreStraordinarieErogate: number;
  // Variazione del movimento automatico "settimanale" (specs/19): può
  // essere negativa (scala il monte ore) da quando la formula è a
  // netto pieno — vedi sotto.
  variazioneMonteOre: number;
};

// Controllo di una settimana di ore di lavoro alla conferma (specs/19 -
// monte-ore.md): solo i giorni in stato "lavorativo" contribuiscono —
// malattia/assenza sono esclusi dal calcolo esplicitamente (hanno
// comunque sempre ore a 0 per costruzione, vedi
// lib/oreLavoro.ts:validaGiornoOreLavoro, ma qui l'esclusione è
// esplicita per chiarezza del requisito, non solo un effetto
// collaterale dei dati). Riusa oreOrdinariePreviste (stessa fonte di
// verità del precaricamento in specs/18, CLAUDE.md/jscpd).
//
// Netto pieno: variazioneMonteOre = ore dovute − ore ordinarie erogate
// − ore straordinarie erogate. Positiva = il monte ore aumenta (ha
// lavorato meno del dovuto); negativa = il monte ore scala (ha
// lavorato più del dovuto, ordinario e straordinario insieme). Nessuna
// decisione dell'admin richiesta: il movimento automatico copre da solo
// sia la carenza sia l'eventuale eccedenza (a differenza del modello
// precedente con "straordinario residuo" in attesa di decisione, ormai
// solo per lo storico — vedi
// app/dashboard/ore-lavoro/actions.ts:decidiStraordinarioResiduo,
// components/StraordinarioResiduo.tsx, che restano per risolvere le
// settimane confermate PRIMA di questo cambio, ma non se ne generano
// più di nuove). Funzione pura, nessun I/O.
export function controlloSettimanaOreLavoro(
  giorni: GiornoPerMonteOre[],
  profiloOrario: ProfiloOrario | null | undefined
): ControlloSettimanaOreLavoro {
  let oreDovute = 0;
  let oreOrdinarieErogate = 0;
  let oreStraordinarieErogate = 0;

  for (const giorno of giorni) {
    if (giorno.stato !== 'lavorativo') continue;

    oreDovute += oreOrdinariePreviste(profiloOrario, giorno.data);
    oreOrdinarieErogate += Number(giorno.oreOrdinarie);
    oreStraordinarieErogate += Number(giorno.oreStraordinarie);
  }

  oreDovute = arrotonda(oreDovute);
  oreOrdinarieErogate = arrotonda(oreOrdinarieErogate);
  oreStraordinarieErogate = arrotonda(oreStraordinarieErogate);

  const variazioneMonteOre = arrotonda(oreDovute - oreOrdinarieErogate - oreStraordinarieErogate);

  return { oreDovute, oreOrdinarieErogate, oreStraordinarieErogate, variazioneMonteOre };
}

// Descrizione in italiano dell'effetto di una variazione di monte ore
// (specs/19): stessa frase riusata sia nell'anteprima mostrata prima
// della conferma ("Ore di lavoro", tabellina del riepilogo settimanale)
// sia nella nota del movimento registrato alla conferma — un solo posto
// che decide come esprimere "positiva"/"negativa"/"zero" (CLAUDE.md,
// jscpd). Funzione pura.
export function descrizioneEffettoMonteOre(variazioneMonteOre: number): string {
  if (variazioneMonteOre > 0) return `${variazioneMonteOre}h in più sul monte ore`;
  if (variazioneMonteOre < 0) return `${Math.abs(variazioneMonteOre)}h in meno sul monte ore`;
  return 'nessuna variazione del monte ore';
}

// Nota descrittiva del movimento automatico settimanale, mostrata nello
// storico (specs/19): la data della settimana è già nella colonna
// settimana_inizio del movimento, qui solo il dettaglio del calcolo.
// Funzione pura.
export function notaMovimentoSettimanale(controllo: ControlloSettimanaOreLavoro): string {
  return (
    `Calcolo automatico: ${controllo.oreDovute}h dovute, ${controllo.oreOrdinarieErogate}h ordinarie erogate, ` +
    `${controllo.oreStraordinarieErogate}h straordinarie erogate — ${descrizioneEffettoMonteOre(controllo.variazioneMonteOre)}.`
  );
}

// Nota descrittiva del movimento di scalo dal monte ore dello
// straordinario residuo, registrato solo quando l'admin sceglie
// "Scala dal monte ore" (specs/19). Funzione pura.
export function notaMovimentoStraordinarioResiduo(straordinarioResiduo: number): string {
  return `Straordinario residuo scalato dal monte ore su decisione dell'admin: ${straordinarioResiduo}h.`;
}

// Solo un movimento manuale (`precarico`) è eliminabile (specs/19,
// "l'admin elimina un movimento manuale inserito per errore"): i
// movimenti automatici (`settimanale`, `straordinario_residuo`) restano
// immutabili, legati alla conferma di una settimana o a una decisione
// già presa. Stessa regola usata sia per mostrare/nascondere il
// pulsante "Elimina" (components/MonteOre.tsx) sia come controllo
// difensivo lato server (app/dashboard/ore-lavoro/actions.ts) — la RLS
// (supabase/migrations/0044_elimina_movimento_precarico.sql) resta
// comunque la difesa primaria. Funzione pura, nessun I/O.
export function movimentoEliminabile(tipo: string): boolean {
  return tipo === 'precarico';
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
