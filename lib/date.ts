export function oggi(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
}

// Somma (o sottrae, con n negativo) giorni a una data "YYYY-MM-DD".
// Opera su un istante UTC di mezzogiorno solo per l'aritmetica sul
// calendario: non rappresenta un orario reale, quindi non risente di
// fusi orari o ora legale.
export function sommaGiorni(data: string, giorni: number): string {
  const [anno, mese, giorno] = data.split('-').map(Number);
  const d = new Date(Date.UTC(anno, mese - 1, giorno + giorni, 12));
  return d.toISOString().slice(0, 10);
}

export function formattaDataItaliana(data: string): string {
  const [anno, mese, giorno] = data.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(anno, mese - 1, giorno, 12)));
}

// Helper per il report (specs/51 - report.md): periodi mese/settimana
// espressi come stringhe "YYYY-MM" (mese) o "YYYY-MM-DD" (un giorno
// qualunque della settimana, usato come ancora).

export function meseDaData(data: string): string {
  return data.slice(0, 7);
}

export function primoGiornoMese(mese: string): string {
  return `${mese}-01`;
}

export function ultimoGiornoMese(mese: string): string {
  const [anno, m] = mese.split('-').map(Number);
  // Giorno 0 del mese successivo = ultimo giorno del mese corrente.
  const d = new Date(Date.UTC(anno, m, 0, 12));
  return d.toISOString().slice(0, 10);
}

export function meseSuccessivo(mese: string): string {
  const [anno, m] = mese.split('-').map(Number);
  const d = new Date(Date.UTC(anno, m, 1, 12));
  return d.toISOString().slice(0, 7);
}

export function mesePrecedente(mese: string): string {
  const [anno, m] = mese.split('-').map(Number);
  const d = new Date(Date.UTC(anno, m - 2, 1, 12));
  return d.toISOString().slice(0, 7);
}

export function formattaMeseItaliano(mese: string): string {
  const [anno, m] = mese.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(anno, m - 1, 1, 12))
  );
}

// Lunedì della settimana che contiene `data` (0 = lunedì ISO).
export function lunediSettimana(data: string): string {
  const [anno, mese, giorno] = data.split('-').map(Number);
  const d = new Date(Date.UTC(anno, mese - 1, giorno, 12));
  const giornoSettimana = (d.getUTCDay() + 6) % 7; // 0 = lunedì, 6 = domenica
  d.setUTCDate(d.getUTCDate() - giornoSettimana);
  return d.toISOString().slice(0, 10);
}

export function domenicaSettimana(data: string): string {
  return sommaGiorni(lunediSettimana(data), 6);
}

export function formattaIntervalloItaliano(inizio: string, fine: string): string {
  const formatta = (data: string) => {
    const [anno, mese, giorno] = data.split('-').map(Number);
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(
      new Date(Date.UTC(anno, mese - 1, giorno, 12))
    );
  };
  return `${formatta(inizio)} – ${formatta(fine)}`;
}

export function formattaDataBreve(data: string): string {
  const [anno, mese, giorno] = data.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(Date.UTC(anno, mese - 1, giorno, 12))
  );
}

// Tutte le date da `inizio` a `fine` (incluse), in ordine.
export function giorniInRange(inizio: string, fine: string): string[] {
  const giorni: string[] = [];
  let corrente = inizio;
  while (corrente <= fine) {
    giorni.push(corrente);
    corrente = sommaGiorni(corrente, 1);
  }
  return giorni;
}
