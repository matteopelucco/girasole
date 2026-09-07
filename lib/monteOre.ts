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
  carenza: number;
  carenzaResidua: number;
  straordinarioResiduo: number;
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
// La carenza (ore dovute non coperte dall'ordinario erogato) viene
// prima coperta dallo straordinario erogato della stessa settimana:
// solo quanto resta scoperto ("carenza residua") fa aumentare il monte
// ore. Lo straordinario che resta dopo questa copertura
// ("straordinario residuo") NON scala automaticamente il monte ore:
// richiede una decisione dell'admin (vedi
// app/dashboard/ore-lavoro/actions.ts:decidiStraordinarioResiduo).
// Funzione pura, nessun I/O.
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

  const carenza = arrotonda(Math.max(0, oreDovute - oreOrdinarieErogate));
  const carenzaCoperta = Math.min(carenza, oreStraordinarieErogate);
  const carenzaResidua = arrotonda(carenza - carenzaCoperta);
  const straordinarioResiduo = arrotonda(Math.max(0, oreStraordinarieErogate - carenzaCoperta));

  return { oreDovute, oreOrdinarieErogate, oreStraordinarieErogate, carenza, carenzaResidua, straordinarioResiduo };
}

// Nota descrittiva del movimento automatico settimanale, mostrata nello
// storico (specs/19): la data della settimana è già nella colonna
// settimana_inizio del movimento, qui solo il dettaglio del calcolo.
// Funzione pura.
export function notaMovimentoSettimanale(controllo: ControlloSettimanaOreLavoro): string {
  return (
    `Calcolo automatico: ${controllo.oreDovute}h dovute, ${controllo.oreOrdinarieErogate}h ordinarie erogate, ` +
    `${controllo.carenzaResidua}h di carenza residua dopo la copertura dallo straordinario.`
  );
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
