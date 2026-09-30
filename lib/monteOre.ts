import { formattaOreConSegno, oreOrdinariePreviste } from '@/lib/oreLavoro';
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

// Nota descrittiva del movimento che accredita sul monte ore lo
// straordinario residuo, registrato solo quando l'admin sceglie
// "Aggiungi al monte ore (a credito)" (specs/19). Funzione pura.
export function notaMovimentoStraordinarioResiduo(straordinarioResiduo: number): string {
  return `Straordinario residuo accreditato sul monte ore su decisione dell'admin: ${straordinarioResiduo}h.`;
}

// Convenzione unica del segno del monte ore (specs/19): positivo = ore già
// erogate in più (a credito), negativo = ore ancora da erogare (da
// recuperare), zero = in pari.
export type SignificatoSaldoMonteOre = 'a credito' | 'da recuperare' | 'in pari';

export function significatoSaldoMonteOre(saldo: number): SignificatoSaldoMonteOre {
  if (saldo > 0) return 'a credito';
  if (saldo < 0) return 'da recuperare';
  return 'in pari';
}

// Saldo con segno esplicito e significato, sempre insieme (specs/19): mai
// un numero nudo. Es. "+3h a credito (ore già erogate in più)",
// "-3h da recuperare (ore ancora da erogare)", "0h in pari". Funzione pura.
export function descrizioneSaldoMonteOre(saldo: number): string {
  const valore = `${formattaOreConSegno(saldo)}h`;
  switch (significatoSaldoMonteOre(saldo)) {
    case 'a credito':
      return `${valore} a credito (ore già erogate in più)`;
    case 'da recuperare':
      return `${valore} da recuperare (ore ancora da erogare)`;
    default:
      return `${valore} in pari`;
  }
}

// Versione breve per elenchi e tabelle (es. "+3h a credito").
export function saldoMonteOreBreve(saldo: number): string {
  return `${formattaOreConSegno(saldo)}h ${significatoSaldoMonteOre(saldo)}`;
}

export const LEGENDA_MONTE_ORE =
  'Positivo (+): ore già erogate in più, a credito. Negativo (-): ore ancora da erogare, da recuperare.';

// Verso di un movimento scelto nel form dell'admin (specs/19): "credito" =
// il dipendente ha erogato ore in più (+1), "debito" = deve ancora
// erogare ore (−1). Qualunque altro valore è non valido (null): niente
// default silenzioso. Funzione pura.
export function segnoVersoMovimentoMonteOre(verso: string): 1 | -1 | null {
  if (verso === 'credito') return 1;
  if (verso === 'debito') return -1;
  return null;
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
