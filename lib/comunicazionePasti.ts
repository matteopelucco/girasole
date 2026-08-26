import { formattaDataOraItaliana } from '@/lib/date';

// Log delle comunicazioni pasti a Rojac (specs/16 -
// comunicazione-pasti-rojac.md): funzioni pure, nessun I/O — chi chiama
// (la pagina Report, il job notturno di specs/52) ha già eseguito la
// query su `pasti_comunicati` e passa solo le righe. Condivisa tra i
// due, per non duplicare il formato del log in più punti (CLAUDE.md,
// jscpd). Una comunicazione è per l'intero asilo (una al giorno), non
// per singola classe: nessun raggruppamento per sezione qui.
export type ComunicazionePasto = {
  comunicatoAt: string;
  numeroPasti: number;
  comunicatoDaNome: string;
};

// Una riga del log, nel formato richiesto: "{data}_{ora}: {numero}
// pasti ({chi})". Stesso formato a schermo e nei PDF via email.
export function rigaComunicazione(c: ComunicazionePasto): string {
  return `${formattaDataOraItaliana(c.comunicatoAt)}: ${c.numeroPasti} pasti (${c.comunicatoDaNome})`;
}

export function totalePasti(comunicazioni: Pick<ComunicazionePasto, 'numeroPasti'>[]): number {
  return comunicazioni.reduce((totale, c) => totale + c.numeroPasti, 0);
}
