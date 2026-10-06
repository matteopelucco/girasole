import { giorniInRange, primoGiornoMese, ultimoGiornoMese } from './date';
import { isGiornoChiuso, type GiornoChiusura } from './calendarioScolastico';
import { escapeHtml } from './htmlEscape';

// Mese da mostrare/rivedere in "Rette" (specs/56, scenario "navigare a
// un mese passato per rivedere le comunicazioni inviate"): quello
// richiesto (query string `?mese=`) se è un formato "YYYY-MM" valido e
// non è nel futuro rispetto al mese corrente; altrimenti il mese
// corrente. Mai un mese futuro — stesso vincolo assoluto già applicato
// alle settimane di "Ore di lavoro" (specs/18,
// `lib/oreLavoro.ts:settimanaOreLavoroRichiesta`), stesso motivo:
// l'invio/annullamento di una comunicazione resta possibile solo per il
// mese corrente (specs/56, "Fuori scope"), quindi non ha senso poter
// nemmeno navigare oltre. Funzione pura, nessun I/O.
export function meseRettaRichiesto(richiesta: string | undefined, meseCorrente: string): string {
  if (!richiesta || !/^\d{4}-\d{2}$/.test(richiesta)) return meseCorrente;
  if (richiesta > meseCorrente) return meseCorrente;
  return richiesta;
}

// Giorni di apertura di un mese (specs/56 - comunicazione-retta-mensile.md):
// i giorni che non sono weekend e non ricadono in un giorno di chiusura
// registrato (stessa regola di lib/calendarioScolastico.ts,
// isGiornoChiuso) — usato per proiettare il costo pasti del mese
// corrente, che non è ancora trascorso. `mese` in formato "YYYY-MM"
// (stessa convenzione di lib/date.ts). Funzione pura, nessun I/O.
export function giorniAperturaMese(mese: string, chiusure: GiornoChiusura[]): number {
  const giorni = giorniInRange(primoGiornoMese(mese), ultimoGiornoMese(mese));
  return giorni.filter((data) => !isGiornoChiuso(data, chiusure)).length;
}

export type ParametriRiepilogoRetta = {
  prezzoMensile: number;
  prezzoBuonoPasto: number;
  giorniAperturaMeseCorrente: number;
  // Pasti potenziali (giorni di apertura, pagati in anticipo) ed
  // effettivi (pasti segnati "sì") del mese precedente: la loro
  // differenza è il conguaglio pasti.
  pastiPotenzialiMesePrecedente: number;
  pastiEffettiviMesePrecedente: number;
  marcaDaBollo: number;
  preAsiloRichiesto: boolean;
  prezzoPreAsilo: number;
  postAsiloRichiesto: boolean;
  prezzoPostAsilo: number;
  costiExtra: number;
  // Credito/debito "da conteggiare" questo mese (specs/58): negativo se
  // credito, positivo se debito, 0 se il bambino non ne ha nessuno in
  // attesa per questo mese.
  creditoDebito: number;
};

export type RiepilogoRetta = {
  rettaMensile: number;
  costoPasti: number;
  conguaglioPasti: number;
  marcaDaBollo: number;
  costoPreAsilo: number;
  costoPostAsilo: number;
  costiExtra: number;
  creditoDebito: number;
  totale: number;
};

// Il `+ 0` finale normalizza un eventuale -0 (es. 0 pasti non
// consumati per un conguaglio pasti) a 0: stesso valore numerico, ma -0 !== 0 per
// Object.is/toEqual e comparirebbe come "-0,00" se mai renderizzato.
export function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100 + 0;
}

// Il riepilogo economico di un bambino per la comunicazione del mese
// corrente (specs/56): costo pasti proiettato sui giorni di apertura
// (il mese non è ancora trascorso), conguaglio pasti negativo pari ai
// pasti potenziali meno gli effettivi del mese precedente (già
// trascorso, dati reali; mai un addebito: al minimo zero), pre-asilo/post-asilo al prezzo pieno solo se richiesti,
// credito/debito "da conteggiare" questo mese (specs/58). Funzione
// pura, nessun I/O.
export function calcolaRiepilogoRetta(parametri: ParametriRiepilogoRetta): RiepilogoRetta {
  const costoPasti = arrotonda(parametri.giorniAperturaMeseCorrente * parametri.prezzoBuonoPasto);
  const pastiNonConsumati = Math.max(0, parametri.pastiPotenzialiMesePrecedente - parametri.pastiEffettiviMesePrecedente);
  const conguaglioPasti = arrotonda(-pastiNonConsumati * parametri.prezzoBuonoPasto);
  const costoPreAsilo = parametri.preAsiloRichiesto ? parametri.prezzoPreAsilo : 0;
  const costoPostAsilo = parametri.postAsiloRichiesto ? parametri.prezzoPostAsilo : 0;
  const creditoDebito = arrotonda(parametri.creditoDebito);
  const totale = arrotonda(
    parametri.prezzoMensile +
      costoPasti +
      conguaglioPasti +
      parametri.marcaDaBollo +
      costoPreAsilo +
      costoPostAsilo +
      parametri.costiExtra +
      creditoDebito
  );

  return {
    rettaMensile: parametri.prezzoMensile,
    costoPasti,
    conguaglioPasti,
    marcaDaBollo: parametri.marcaDaBollo,
    costoPreAsilo,
    costoPostAsilo,
    costiExtra: parametri.costiExtra,
    creditoDebito,
    totale,
  };
}

// La differenza tra il totale comunicato e l'importo realmente
// ricevuto via bonifico (specs/59): positiva se la famiglia ha pagato
// meno del dovuto (diventerà un debito sulla prossima retta), negativa
// se ha pagato di più (diventerà un credito) — stessa convenzione di
// segno di `creditoDebito` sopra. Funzione pura, nessun I/O.
export function calcolaDifferenzaBonifico(totaleComunicato: number, importoRicevuto: number): number {
  return arrotonda(totaleComunicato - importoRicevuto);
}

// Sostituisce i placeholder "{{chiave}}" nel template della mail
// (specs/56) con i valori corrispondenti; un placeholder sconosciuto o
// scritto in modo errato resta invariato (nessun errore bloccante).
// Funzione pura, nessun I/O.
export function sostituisciPlaceholder(testo: string, valori: Record<string, string>): string {
  return testo.replace(/\{\{(\w+)\}\}/g, (corrispondenza, chiave: string) =>
    Object.prototype.hasOwnProperty.call(valori, chiave) ? valori[chiave] : corrispondenza
  );
}

// Corpo HTML della mail (specs/56, "il markup nel template o nei dati è
// mostrato come testo"): il template è solo testo, non HTML. Sostituisce i
// segnaposto, escapa l'INTERO risultato (template e valori, es. il nome di
// un bambino: dati non fidati) una sola volta e solo dopo trasforma gli a
// capo in <br>, così gli unici tag nel corpo sono quelli aggiunti qui.
// Escapare dopo la sostituzione equivale a escapare template e valori
// separatamente: i segnaposto `{{chiave}}` non contengono caratteri
// speciali HTML. L'oggetto della mail NON passa di qui: è testo semplice
// (campo `subject` di Resend), non HTML. Funzione pura, nessun I/O.
export function corpoEmailHtmlRetta(template: string, valori: Record<string, string>): string {
  return escapeHtml(sostituisciPlaceholder(template, valori)).replace(/\n/g, '<br>');
}

// Formattazione euro condivisa tra la tabella di revisione (UI) e i
// placeholder della mail (specs/56), per non avere due formati diversi
// per lo stesso numero.
export function formattaImporto(valore: number): string {
  return arrotonda(valore).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
