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
