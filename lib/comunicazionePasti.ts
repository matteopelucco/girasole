import { formattaDataOraItaliana } from '@/lib/date';

// Log delle comunicazioni pasti a Rojac (specs/16 -
// comunicazione-pasti-rojac.md): funzioni pure, nessun I/O — chi chiama
// (la pagina Report, il job notturno di specs/52) ha già eseguito la
// query su `pasti_comunicati` e passa solo le righe. Condivisa tra i
// due, per non duplicare il formato del log in più punti (CLAUDE.md,
// jscpd).
export type ComunicazionePasto = {
  sezioneId: string;
  comunicatoAt: string;
  numeroPasti: number;
  comunicatoDaNome: string;
};

// Una riga del log, nel formato richiesto: "{data}_{ora}: {numero}
// pasti ({chi})". Stesso formato a schermo e nei PDF via email.
export function rigaComunicazione(c: Pick<ComunicazionePasto, 'comunicatoAt' | 'numeroPasti' | 'comunicatoDaNome'>): string {
  return `${formattaDataOraItaliana(c.comunicatoAt)}: ${c.numeroPasti} pasti (${c.comunicatoDaNome})`;
}

export function totalePasti(comunicazioni: Pick<ComunicazionePasto, 'numeroPasti'>[]): number {
  return comunicazioni.reduce((totale, c) => totale + c.numeroPasti, 0);
}

// Raggruppa le comunicazioni di un periodo per sezione, nell'ordine in
// cui compaiono in input (chi chiama le ha già ordinate per data se
// vuole un log cronologico).
export function raggruppaPerSezione(comunicazioni: ComunicazionePasto[]): Map<string, ComunicazionePasto[]> {
  const mappa = new Map<string, ComunicazionePasto[]>();
  for (const c of comunicazioni) {
    const lista = mappa.get(c.sezioneId) ?? [];
    lista.push(c);
    mappa.set(c.sezioneId, lista);
  }
  return mappa;
}
