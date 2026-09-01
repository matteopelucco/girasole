import { formattaDataItaliana, giornoSettimanaIso, lunediSettimana } from '@/lib/date';
import { isGiornoChiuso, trovaChiusura, type GiornoChiusura } from '@/lib/calendarioScolastico';
import type { ProfiloOrario } from '@/lib/profiliOrari';

export type StatoGiornoOreLavoro = 'lavorativo' | 'malattia' | 'assenza';

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
  oreOrdinarie: number;
  oreStraordinarie: number;
  motivoStraordinario: string;
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
// una nota, ore straordinarie richiedono un motivo. Passare a
// malattia/assenza azzera le ore; passare a lavorativo azzera
// codice/nota. Funzione pura, nessun I/O: chi chiama (la server action)
// valida così ogni giorno del submit prima di scrivere qualunque cosa
// (nessun salvataggio parziale su un errore, specs/05 - feedback.md).
export function validaGiornoOreLavoro(input: InputGiornoOreLavoro): EsitoValidazioneGiorno {
  const stato: StatoGiornoOreLavoro =
    input.stato === 'malattia' || input.stato === 'assenza' ? input.stato : 'lavorativo';
  const etichettaGiorno = formattaDataItaliana(input.data);

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

  const oreOrdinarie = Math.max(0, Number(input.oreOrdinarie) || 0);
  const oreStraordinarie = Math.max(0, Number(input.oreStraordinarie) || 0);
  const motivoStraordinario = input.motivoStraordinario.trim();
  if (oreStraordinarie > 0 && !motivoStraordinario) {
    return { ok: false, errore: `Indica il motivo delle ore straordinarie di ${etichettaGiorno}.` };
  }

  return {
    ok: true,
    giorno: {
      data: input.data,
      stato,
      oreOrdinarie,
      oreStraordinarie,
      motivoStraordinario: oreStraordinarie > 0 ? motivoStraordinario : null,
      codiceMalattia: null,
      notaAssenza: null,
    },
  };
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
