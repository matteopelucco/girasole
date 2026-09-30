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
// Il monte ore è gestito a mano dall'admin (specs/19): questo controllo
// serve solo a registrare lo snapshot della settimana alla conferma
// (ore dovute ed erogate), non genera alcun movimento. Funzione pura,
// nessun I/O.
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

  return { oreDovute, oreOrdinarieErogate, oreStraordinarieErogate };
}

export type RiepilogoSettimanaOreLavoro = {
  orePreviste: number;
  // Ore fatte in più (+) o in meno (−) rispetto al previsto (specs/18).
  differenza: number;
};

function riepilogo(orePreviste: number, differenza: number): RiepilogoSettimanaOreLavoro {
  // "+ 0" normalizza -0 in 0.
  return { orePreviste: arrotonda(orePreviste), differenza: arrotonda(differenza) + 0 };
}

// Riepilogo "a vivo" della settimana (specs/18): usa le differenze mostrate
// nelle card, anche non ancora salvate. Solo i giorni "lavorativo"
// contano (malattia/assenza/chiusura/ferie sono esclusi); una differenza
// non valida (null) vale 0. Funzione pura, nessun I/O.
export function riepilogoSettimanaDaDifferenze(
  giorni: { stato: string; orePreviste: number; differenza: number | null }[]
): RiepilogoSettimanaOreLavoro {
  let orePreviste = 0;
  let differenza = 0;
  for (const g of giorni) {
    if (g.stato !== 'lavorativo') continue;
    orePreviste += g.orePreviste;
    differenza += g.differenza ?? 0;
  }
  return riepilogo(orePreviste, differenza);
}

// Nota descrittiva del movimento di scalo dal monte ore dello
// straordinario residuo, registrato solo quando l'admin sceglie
// "Scala dal monte ore" (specs/19). Funzione pura.
export function notaMovimentoStraordinarioResiduo(straordinarioResiduo: number): string {
  return `Straordinario residuo scalato dal monte ore su decisione dell'admin: ${straordinarioResiduo}h.`;
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
