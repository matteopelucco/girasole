import { PERCORSO_CRON_JOB } from './cronEsecuzioni';

// Schede della pagina "Azioni" (specs/63 - cron-job.md, issue #325). La scheda
// attiva sta nell'indirizzo (`?scheda=azioni`), così la pagina si disegna sul
// server e vale anche con "ricarica" e con il link diretto.
export type IdScheda = 'cron-job' | 'azioni';

export type Scheda = { id: IdScheda; etichetta: string; href: string };

export const SCHEDA_INIZIALE: IdScheda = 'cron-job';

// Nell'ordine in cui compaiono. "Cron Job" è quella iniziale: il suo indirizzo
// è la pagina senza parametri (anche "Carica altri" non porta `scheda`).
export const SCHEDE: Scheda[] = [
  { id: 'cron-job', etichetta: 'Cron Job', href: PERCORSO_CRON_JOB },
  {
    id: 'azioni',
    etichetta: 'Azioni',
    href: `${PERCORSO_CRON_JOB}?scheda=azioni`,
  },
];

// Identificativi per collegare le schede al pannello (ARIA).
export const ID_PANNELLO_SCHEDE = 'pannello-schede';

export function idTabScheda(id: IdScheda): string {
  return `scheda-${id}`;
}

// Scheda scelta dai parametri dell'indirizzo; un valore assente o sconosciuto
// dà la scheda iniziale.
export function schedaDaParametri(parametri: Record<string, string | string[] | undefined>): IdScheda {
  const grezzo = parametri.scheda;
  const valore = Array.isArray(grezzo) ? grezzo[0] : grezzo;
  return valore === 'azioni' ? 'azioni' : SCHEDA_INIZIALE;
}

// Indice della scheda raggiunta con un tasto (frecce sinistra/destra circolari,
// Home, Fine); null per qualunque altro tasto.
export function indiceDaTasto(tasto: string, corrente: number, quante: number): number | null {
  switch (tasto) {
    case 'ArrowRight':
      return (corrente + 1) % quante;
    case 'ArrowLeft':
      return (corrente - 1 + quante) % quante;
    case 'Home':
      return 0;
    case 'End':
      return quante - 1;
    default:
      return null;
  }
}
