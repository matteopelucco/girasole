import { formattaDataItaliana, giornoSettimanaIso, lunediSettimana } from '@/lib/date';
import { isGiornoChiuso, trovaChiusura, type GiornoChiusura } from '@/lib/calendarioScolastico';
import type { ProfiloOrario } from '@/lib/profiliOrari';

export type StatoGiornoOreLavoro = 'lavorativo' | 'malattia' | 'assenza' | 'chiusura' | 'ferie';

// Etichette in italiano dello stato di un giorno (specs/18): definite
// qui, non nel componente client RigaOreLavoro, perché la vista di sola
// lettura di una settimana confermata (app/dashboard/ore-lavoro/page.tsx,
// un Server Component) le usa direttamente — un valore non-componente
// importato da un modulo 'use client' non è risolvibile dal bundler RSC
// in produzione ("Could not find the module ... in the React Client
// Manifest"), anche se in sviluppo sembra funzionare. Riesportata da
// RigaOreLavoro.tsx per compatibilità di chi la importava da lì.
export const ETICHETTE_STATO_ORE_LAVORO: Record<StatoGiornoOreLavoro, string> = {
  lavorativo: 'Lavorativo',
  malattia: 'Malattia',
  assenza: 'Assenza',
  chiusura: 'Chiusura',
  ferie: 'Ferie',
};

// Chiusura e Ferie (specs/18) sono giorni "di vacanza": nessun campo, ore
// a 0 e nessun effetto su ore dovute, differenza e monte ore — come se il
// dipendente avesse fatto tutto quello che doveva. Funzione pura.
export function isStatoNeutroOreLavoro(stato: string): boolean {
  return stato === 'chiusura' || stato === 'ferie';
}

// Testo mostrato al posto dei campi per un giorno di Chiusura/Ferie.
export const TESTO_GIORNO_DI_VACANZA = 'Giorno di vacanza: non conta nel calcolo del monte ore.';

// Stato di un giorno non ancora salvato (specs/18): "chiusura" se l'asilo
// è chiuso (weekend o intervallo del calendario scolastico, specs/53),
// altrimenti "lavorativo". L'utente può cambiarlo. Funzione pura.
export function statoPredefinitoGiornoOreLavoro(data: string, chiusure: GiornoChiusura[]): StatoGiornoOreLavoro {
  return isGiornoChiuso(data, chiusure) ? 'chiusura' : 'lavorativo';
}

// Lunedì della settimana da mostrare/modificare in "Ore di lavoro"
// (specs/18): quello richiesto (query string `?settimana=`, o campo
// nascosto `settimana_inizio` inviato dal form) se è un lunedì valido e
// non è nel futuro rispetto a `oggiData`; altrimenti quello della
// settimana corrente. Mai una settimana futura — vincolo assoluto di
// specs/18, applicato qui una volta sola e riusato sia dalla pagina
// (per risolvere il parametro in query string) sia dalle server action
// (per validare quanto inviato dal form, invece di duplicare lo stesso
// controllo in due punti — CLAUDE.md, jscpd). Funzione pura.
export function settimanaOreLavoroRichiesta(richiesta: string | undefined, oggiData: string): string {
  const inizioCorrente = lunediSettimana(oggiData);
  if (!richiesta || !/^\d{4}-\d{2}-\d{2}$/.test(richiesta)) return inizioCorrente;
  if (lunediSettimana(richiesta) !== richiesta) return inizioCorrente;
  if (richiesta > inizioCorrente) return inizioCorrente;
  return richiesta;
}

// Selettore di data (specs/18, "saltare a una settimana qualunque"):
// una data qualunque scelta dall'utente (`?settimana=` inviato da un
// <input type="date">) viene portata al lunedì della sua settimana, mai
// oltre la settimana corrente. Restituisce null se `richiesta` non è una
// data di calendario valida (YYYY-MM-DD): la pagina userà allora la
// settimana corrente senza redirect. Resta separata da
// settimanaOreLavoroRichiesta, che le server action usano per validare in
// modo rigido un lunedì inviato dal form. Funzione pura.
export function normalizzaSettimanaScelta(richiesta: string | undefined, oggiData: string): string | null {
  if (!richiesta || !/^\d{4}-\d{2}-\d{2}$/.test(richiesta)) return null;
  // Scarta le date di calendario inesistenti (es. 2024-02-31), che
  // new Date(...) riporterebbe silenziosamente al mese successivo.
  const [anno, mese, giorno] = richiesta.split('-').map(Number);
  const d = new Date(Date.UTC(anno, mese - 1, giorno, 12));
  if (d.getUTCFullYear() !== anno || d.getUTCMonth() !== mese - 1 || d.getUTCDate() !== giorno) return null;
  const inizioCorrente = lunediSettimana(oggiData);
  const lunedi = lunediSettimana(richiesta);
  return lunedi > inizioCorrente ? inizioCorrente : lunedi;
}

// Utente su cui una server action di "Ore di lavoro" deve scrivere
// (specs/18, sezione "Amministrazione"): l'admin può correggere le ore
// di chiunque sia abilitato indicando un campo nascosto `utente_id` nel
// form, chiunque altro scrive sempre e solo su se stesso — il valore
// ricevuto dal client viene ignorato per qualunque ruolo diverso da
// admin, così un utente non-admin non può scrivere sui dati di
// qualcun altro anche forzando il campo nascosto (la RLS resta
// comunque la difesa reale, questo è solo un controllo applicativo in
// più). Funzione pura, nessun I/O.
export function utenteBersaglioOreLavoro(
  ruolo: string | null | undefined,
  propriUtenteId: string,
  utenteIdForm: string | null | undefined
): string {
  if (ruolo === 'admin' && utenteIdForm) return utenteIdForm;
  return propriUtenteId;
}

// Nota puramente informativa per un giorno di chiusura scolastica nel
// report ore di lavoro (specs/18, specs/53): a differenza del messaggio
// usato in Presenze/Pasti (lib/calendarioScolastico.ts:messaggioChiusura,
// che parla di un blocco reale), qui il giorno resta scrivibile — il
// testo lo dice esplicitamente, per non suggerire un blocco che non
// c'è. null se il giorno non è chiuso. Funzione pura, nessun I/O.
export function notaGiornoChiusoOreLavoro(data: string, chiusure: GiornoChiusura[]): string | null {
  if (!isGiornoChiuso(data, chiusure)) return null;
  const chiusura = trovaChiusura(data, chiusure);
  const dettaglio = chiusura ? (chiusura.nota ? `: ${chiusura.nota}` : '') : ' (weekend)';
  return `Giorno di chiusura scolastica${dettaglio} — puoi comunque registrare le ore.`;
}

// Ore ordinarie previste per `data` dal profilo orario assegnato
// all'utente (specs/54 - profili-orari.md), 0 se non ne ha uno
// (specs/18 - report-ore-lavoro.md, scenario "senza profilo orario
// assegnato"). Funzione pura, nessun I/O.
export function oreOrdinariePreviste(profiloOrario: ProfiloOrario | null | undefined, data: string): number {
  if (!profiloOrario) return 0;
  switch (giornoSettimanaIso(data)) {
    case 1:
      return Number(profiloOrario.ore_lunedi);
    case 2:
      return Number(profiloOrario.ore_martedi);
    case 3:
      return Number(profiloOrario.ore_mercoledi);
    case 4:
      return Number(profiloOrario.ore_giovedi);
    case 5:
      return Number(profiloOrario.ore_venerdi);
    default:
      return 0;
  }
}

export type InputGiornoOreLavoro = {
  data: string;
  stato: string;
  // Ore previste dal profilo orario per `data` (oreOrdinariePreviste,
  // 0 senza profilo): calcolate dal server, mai fidandosi del client.
  orePreviste: number;
  // Ore in più (+) o in meno (-) rispetto al previsto, l'unico valore
  // che l'insegnante modifica (specs/18).
  differenzaOre: number;
  motivo: string;
  codiceMalattia: string;
  notaAssenza: string;
};

export type GiornoOreLavoroValidato = {
  data: string;
  stato: StatoGiornoOreLavoro;
  oreOrdinarie: number;
  oreStraordinarie: number;
  motivoStraordinario: string | null;
  codiceMalattia: string | null;
  notaAssenza: string | null;
};

export type EsitoValidazioneGiorno =
  | { ok: true; giorno: GiornoOreLavoroValidato }
  | { ok: false; errore: string };

// Valida e normalizza i dati di un giorno del report ore (specs/18 -
// report-ore-lavoro.md): malattia richiede il codice, assenza richiede
// una nota, una differenza ore diversa da 0 richiede un motivo (e deve
// essere un multiplo di 0.25 con totale non negativo). Passare a
// malattia/assenza azzera le ore; passare a lavorativo azzera
// codice/nota. Funzione pura, nessun I/O: chi chiama (la server action)
// valida così ogni giorno del submit prima di scrivere qualunque cosa
// (nessun salvataggio parziale su un errore, specs/05 - feedback.md).
export function validaGiornoOreLavoro(input: InputGiornoOreLavoro): EsitoValidazioneGiorno {
  const stato: StatoGiornoOreLavoro =
    input.stato === 'malattia' || input.stato === 'assenza' || isStatoNeutroOreLavoro(input.stato)
      ? (input.stato as StatoGiornoOreLavoro)
      : 'lavorativo';
  const etichettaGiorno = formattaDataItaliana(input.data);

  if (isStatoNeutroOreLavoro(stato)) {
    return {
      ok: true,
      giorno: {
        data: input.data,
        stato,
        oreOrdinarie: 0,
        oreStraordinarie: 0,
        motivoStraordinario: null,
        codiceMalattia: null,
        notaAssenza: null,
      },
    };
  }

  if (stato === 'malattia') {
    const codiceMalattia = input.codiceMalattia.trim();
    if (!codiceMalattia) {
      return { ok: false, errore: `Indica il codice malattia per ${etichettaGiorno}.` };
    }
    return {
      ok: true,
      giorno: {
        data: input.data,
        stato,
        oreOrdinarie: 0,
        oreStraordinarie: 0,
        motivoStraordinario: null,
        codiceMalattia,
        notaAssenza: null,
      },
    };
  }

  if (stato === 'assenza') {
    const notaAssenza = input.notaAssenza.trim();
    if (!notaAssenza) {
      return { ok: false, errore: `Indica una nota giustificativa per l'assenza di ${etichettaGiorno}.` };
    }
    return {
      ok: true,
      giorno: {
        data: input.data,
        stato,
        oreOrdinarie: 0,
        oreStraordinarie: 0,
        motivoStraordinario: null,
        codiceMalattia: null,
        notaAssenza,
      },
    };
  }

  const differenza = Number(input.differenzaOre);
  if (!Number.isFinite(differenza) || !sonoQuartiDora(differenza)) {
    return {
      ok: false,
      errore: `Le ore di ${etichettaGiorno} devono essere multipli di un quarto d'ora (es. 1, 2,5, 0,25).`,
    };
  }
  if (differenza < -input.orePreviste) {
    return {
      ok: false,
      errore: `La differenza di ${etichettaGiorno} non può superare le ore ordinarie (${input.orePreviste}h): il totale non può essere negativo.`,
    };
  }
  const motivo = input.motivo.trim();
  if (differenza !== 0 && !motivo) {
    return { ok: false, errore: `Indica il motivo della differenza ore di ${etichettaGiorno}.` };
  }

  const { oreOrdinarie, oreStraordinarie } = oreDaDifferenza(input.orePreviste, differenza);
  return {
    ok: true,
    giorno: {
      data: input.data,
      stato,
      oreOrdinarie,
      oreStraordinarie,
      motivoStraordinario: differenza !== 0 ? motivo : null,
      codiceMalattia: null,
      notaAssenza: null,
    },
  };
}

export type EsitoValidazioneSettimana =
  | { ok: true; giorni: GiornoOreLavoroValidato[] }
  | { ok: false; errori: string[] };

// Valida TUTTI i giorni di un salvataggio e ne raccoglie gli errori, uno
// per giorno non valido, nell'ordine dei giorni (specs/18, popup "Settimana
// non salvata": l'utente vede in una volta sola tutte le incongruenze da
// sanare, non una alla volta). Le regole sono quelle, invariate, di
// validaGiornoOreLavoro; cambia solo che non ci si ferma al primo errore.
// Funzione pura, nessun I/O.
export function validaSettimanaOreLavoro(giorni: InputGiornoOreLavoro[]): EsitoValidazioneSettimana {
  const validati: GiornoOreLavoroValidato[] = [];
  const errori: string[] = [];
  for (const input of giorni) {
    const esito = validaGiornoOreLavoro(input);
    if (esito.ok) validati.push(esito.giorno);
    else errori.push(esito.errore);
  }
  return errori.length ? { ok: false, errori } : { ok: true, giorni: validati };
}

// true se `valore` è un multiplo di un quarto d'ora (0.25), anche
// negativo o zero (specs/18). Le moltiplicazioni per 4 di multipli di
// 0.25 sono esatte in virgola mobile, quindi il confronto è sicuro.
export function sonoQuartiDora(valore: number): boolean {
  return Number.isFinite(valore) && Number.isInteger(valore * 4);
}

// Conversione differenza -> colonne esistenti (specs/18, nessuna
// migration): differenza > 0 => ordinarie = previste e straordinarie =
// differenza; < 0 => ordinarie = previste + differenza, straordinarie
// 0; = 0 => ordinarie = previste. Funzione pura.
export function oreDaDifferenza(
  orePreviste: number,
  differenza: number
): { oreOrdinarie: number; oreStraordinarie: number } {
  if (differenza > 0) return { oreOrdinarie: orePreviste, oreStraordinarie: differenza };
  return { oreOrdinarie: orePreviste + differenza, oreStraordinarie: 0 };
}

// Differenza mostrata in lettura: (ordinarie + straordinarie) -
// previste, la stessa formula di deltaGiornoOreLavoro (report, monte
// ore), arrotondata a due decimali contro i residui della virgola
// mobile. Compatibile con lo storico. Funzione pura.
export function differenzaGiornoOreLavoro(orePreviste: number, oreOrdinarie: number, oreStraordinarie: number): number {
  return Math.round(deltaGiornoOreLavoro(orePreviste, oreOrdinarie, oreStraordinarie) * 100) / 100;
}

// Arrotonda `valore` al quarto d'ora più vicino, con la metà strada
// verso +infinito (0.125 => 0.25, -0.125 => 0). Usata solo in LETTURA
// per mostrare/precaricare la differenza dei dati storici non a quarti
// d'ora (specs/18): il dato salvato non cambia finché non si salva la
// card. Le operazioni sui multipli di 0.25 sono esatte in virgola
// mobile. Funzione pura.
export function arrotondaAQuartiDora(valore: number): number {
  // "+ 0" normalizza -0 in 0.
  return Math.floor(valore * 4 + 0.5) / 4 + 0;
}

function arrotondaDueDecimali(valore: number): number {
  return Math.round(valore * 100) / 100;
}

// Totale ore erogate di un giorno lavorativo (specs/18): ore previste +
// differenza, ripulito dai residui della virgola mobile. Usato dalla
// card modificabile e dalla vista di sola lettura. Funzione pura.
export function totaleOreErogate(orePreviste: number, differenza: number): number {
  return arrotondaDueDecimali(orePreviste + differenza);
}

// Testo di stato della card di un giorno lavorativo (specs/18): "✓ Ore
// come previsto" con differenza 0, altrimenti "⚠ Xh in più/in meno del
// previsto" — un testo oltre al colore (specs/01). Condiviso da card
// modificabile e vista di sola lettura. Funzione pura.
export function descrizioneDifferenzaOre(differenza: number): { inRegola: boolean; testo: string } {
  if (differenza === 0) return { inRegola: true, testo: '✓ Ore come previsto' };
  return {
    inRegola: false,
    testo: `⚠ ${arrotondaDueDecimali(Math.abs(differenza))}h ${differenza > 0 ? 'in più' : 'in meno'} del previsto`,
  };
}

// Scostamento di un giorno rispetto all'orario dovuto (specs/18,
// specs/52 - PDF mensile ore di lavoro): ore ordinarie effettuate meno
// ore dovute (dal profilo orario, `oreOrdinariePreviste`), più le ore
// straordinarie — positivo se la persona ha lavorato più del previsto,
// negativo se meno (es. malattia/assenza, dove le ore effettuate sono
// sempre 0). Funzione pura.
export function deltaGiornoOreLavoro(oreDovute: number, oreOrdinarie: number, oreStraordinarie: number): number {
  return oreOrdinarie - oreDovute + oreStraordinarie;
}

// Scostamento di un giorno tenendo conto dello stato (specs/18): 0 per
// chiusura/ferie (neutri, il giorno non conta), altrimenti
// deltaGiornoOreLavoro (malattia/assenza risultano in meno del previsto
// nel PDF). Funzione pura.
export function deltaGiornoPerStatoOreLavoro(
  stato: string,
  oreDovute: number,
  oreOrdinarie: number,
  oreStraordinarie: number
): number {
  if (isStatoNeutroOreLavoro(stato)) return 0;
  return deltaGiornoOreLavoro(oreDovute, oreOrdinarie, oreStraordinarie);
}

// Formatta un numero di ore con il segno esplicito se positivo (es.
// "+1.5", "-2", "0"), arrotondato a due decimali per evitare i residui
// dell'aritmetica in virgola mobile (es. 3.5 - 3.3 = 0.19999999999999996)
// — usata sia per il delta giornaliero sia per la variazione mensile di
// monte ore nel PDF (lib/pdfOreLavoro.ts), invece di ripetere la stessa
// logica del segno in più punti (CLAUDE.md, jscpd).
export function formattaOreConSegno(valore: number): string {
  const arrotondato = Math.round(valore * 100) / 100;
  const segno = arrotondato > 0 ? '+' : '';
  return `${segno}${arrotondato}`;
}

// Totali della settimana (specs/18): somma delle ore ordinarie e
// straordinarie di tutti i giorni passati (tipicamente i giorni
// lavorativi/malattia/assenza già registrati — malattia/assenza hanno
// sempre ore a 0, quindi contribuiscono naturalmente 0 al totale senza
// bisogno di escluderli esplicitamente). Funzione pura.
export function totaliSettimanaOreLavoro(
  giorni: { oreOrdinarie: number | string; oreStraordinarie: number | string }[]
): { ordinarie: number; straordinarie: number; totale: number } {
  const ordinarie = giorni.reduce((totale, g) => totale + Number(g.oreOrdinarie), 0);
  const straordinarie = giorni.reduce((totale, g) => totale + Number(g.oreStraordinarie), 0);
  return { ordinarie, straordinarie, totale: ordinarie + straordinarie };
}
