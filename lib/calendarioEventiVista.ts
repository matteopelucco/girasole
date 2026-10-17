import { formattaIntervalloItaliano, formattaMeseItaliano, sommaGiorni } from './date';

// Vista della pagina "Calendario" (specs/64 - calendario-eventi.md, issue #320):
// raggruppa gli eventi letti da `calendario_eventi` per mese e giorno e
// prepara i testi (orari in Europe/Rome). Logica pura, nessun I/O: la query è
// nella pagina. Titolo, descrizione e luogo arrivano da un feed non fidato:
// qui restano testo semplice, non alterato (chi li mostra li rende come testo,
// mai come HTML né come link).

export type EventoRiga = {
  id: string;
  titolo: string;
  descrizione: string | null;
  luogo: string | null;
  // Istanti ISO (timestamptz). Per gli eventi di tutto il giorno `inizio` è la
  // mezzanotte (Europe/Rome) del primo giorno e `fine` quella del giorno dopo
  // l'ultimo (fine esclusa).
  inizio: string;
  fine: string;
  tutto_il_giorno: boolean;
};

export type Orario = {
  tutto: boolean;
  // "Tutto il giorno", oppure "10:00 – 11:00" / "20 ott, 22:00 – 21 ott, 09:00".
  testo: string;
  // Solo per gli eventi di tutto il giorno su più giorni: "10 ott – 12 ott".
  intervallo: string | null;
};

export type EventoVista = {
  id: string;
  titolo: string;
  descrizione: string | null;
  luogo: string | null;
  orario: Orario;
  multiGiorno: boolean;
  // Già cominciato prima di oggi e ancora in corso (solo tra i prossimi).
  inCorso: boolean;
};

export type GiornoVista = {
  data: string;
  nomeGiorno: string;
  numero: string;
  eOggi: boolean;
  eventi: EventoVista[];
};

export type MeseVista = {
  chiave: string;
  titolo: string;
  giorni: GiornoVista[];
};

export type VistaEventi = { prossimi: MeseVista[]; passati: MeseVista[] };

const TITOLO_VUOTO = '(Senza titolo)';

export function dataRoma(istante: string | Date): string {
  const d = typeof istante === 'string' ? new Date(istante) : istante;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(d);
}

// "HH:MM" in Europe/Rome, ciclo 0-23 (mai "24:00" per la mezzanotte).
export function oraRoma(istante: string | Date): string {
  const d = typeof istante === 'string' ? new Date(istante) : istante;
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

// Primo e ultimo giorno (inclusi, Europe/Rome) occupati dall'evento.
export function intervalloGiorniEvento(evento: EventoRiga): { primo: string; ultimo: string } {
  const primo = dataRoma(evento.inizio);
  const giornoFine = dataRoma(evento.fine);
  // La fine è esclusa per gli eventi di tutto il giorno e per quelli con orario
  // che terminano esattamente a mezzanotte: l'ultimo giorno è quello prima.
  const fineEsclusa =
    evento.tutto_il_giorno || (new Date(evento.fine) > new Date(evento.inizio) && oraRoma(evento.fine) === '00:00');
  const ultimo = fineEsclusa ? sommaGiorni(giornoFine, -1) : giornoFine;
  return { primo, ultimo: ultimo < primo ? primo : ultimo };
}

function giornoBreve(data: string): string {
  return formattaIntervalloItaliano(data, data).split(' – ')[0];
}

export function descriviOrario(evento: EventoRiga): Orario {
  const { primo, ultimo } = intervalloGiorniEvento(evento);
  if (evento.tutto_il_giorno) {
    return {
      tutto: true,
      testo: 'Tutto il giorno',
      intervallo: ultimo > primo ? formattaIntervalloItaliano(primo, ultimo) : null,
    };
  }
  const inizio = oraRoma(evento.inizio);
  const fine = oraRoma(evento.fine);
  const senzaDurata = new Date(evento.fine) <= new Date(evento.inizio);
  if (ultimo > primo) {
    return {
      tutto: false,
      testo: `${giornoBreve(primo)}, ${inizio} – ${giornoBreve(ultimo)}, ${fine}`,
      intervallo: null,
    };
  }
  return { tutto: false, testo: senzaDurata ? inizio : `${inizio} – ${fine}`, intervallo: null };
}

function nomeGiornoBreve(data: string): string {
  const [anno, mese, giorno] = data.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(new Date(Date.UTC(anno, mese - 1, giorno, 12)));
}

function pulisci(testo: string | null): string | null {
  return testo && testo.trim() !== '' ? testo : null;
}

type Voce = { chiaveGiorno: string; riga: EventoRiga; vista: EventoVista };

function ordinaVoci(a: Voce, b: Voce): number {
  if (a.riga.tutto_il_giorno !== b.riga.tutto_il_giorno) return a.riga.tutto_il_giorno ? -1 : 1;
  const tempo = new Date(a.riga.inizio).getTime() - new Date(b.riga.inizio).getTime();
  return tempo !== 0 ? tempo : a.vista.titolo.localeCompare(b.vista.titolo, 'it');
}

function raggruppa(voci: Voce[], oggi: string, piuRecentiPrima: boolean): MeseVista[] {
  const perGiorno = new Map<string, Voce[]>();
  for (const voce of voci) {
    perGiorno.set(voce.chiaveGiorno, [...(perGiorno.get(voce.chiaveGiorno) ?? []), voce]);
  }
  const date = [...perGiorno.keys()].sort();
  if (piuRecentiPrima) date.reverse();

  const mesi: MeseVista[] = [];
  for (const data of date) {
    const chiave = data.slice(0, 7);
    let mese = mesi[mesi.length - 1];
    if (!mese || mese.chiave !== chiave) {
      mese = { chiave, titolo: formattaMeseItaliano(chiave), giorni: [] };
      mesi.push(mese);
    }
    mese.giorni.push({
      data,
      nomeGiorno: nomeGiornoBreve(data),
      numero: String(Number(data.slice(8, 10))),
      eOggi: data === oggi,
      eventi: (perGiorno.get(data) ?? []).sort(ordinaVoci).map((v) => v.vista),
    });
  }
  return mesi;
}

// `oggi` è "YYYY-MM-DD" in Europe/Rome. Un evento è passato se il suo ultimo
// giorno è prima di oggi; un evento su più giorni compare una volta, nel
// giorno d'inizio (o sotto oggi, "in corso", se è già cominciato).
export function costruisciVistaEventi(righe: EventoRiga[], oggi: string): VistaEventi {
  const prossimi: Voce[] = [];
  const passati: Voce[] = [];

  for (const riga of righe) {
    const { primo, ultimo } = intervalloGiorniEvento(riga);
    const passato = ultimo < oggi;
    const inCorso = !passato && primo < oggi;
    const vista: EventoVista = {
      id: riga.id,
      titolo: pulisci(riga.titolo) ? riga.titolo : TITOLO_VUOTO,
      descrizione: pulisci(riga.descrizione),
      luogo: pulisci(riga.luogo),
      orario: descriviOrario(riga),
      multiGiorno: ultimo > primo,
      inCorso,
    };
    (passato ? passati : prossimi).push({ chiaveGiorno: inCorso ? oggi : primo, riga, vista });
  }

  return { prossimi: raggruppa(prossimi, oggi, false), passati: raggruppa(passati, oggi, true) };
}
