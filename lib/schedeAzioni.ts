import { PERCORSO_CRON_JOB } from './cronEsecuzioni';
import type { Scheda } from './schede';

// Schede della pagina "Azioni" (specs/63 - cron-job.md, issue #325). La logica
// comune (scheda dall'indirizzo, tasti) è in `lib/schede.ts`.
export type IdScheda = 'cron-job' | 'azioni';

// Nell'ordine in cui compaiono. "Cron Job" è quella iniziale: il suo indirizzo
// è la pagina senza parametri (anche "Carica altri" non porta `scheda`).
export const SCHEDE: [Scheda<IdScheda>, ...Scheda<IdScheda>[]] = [
  { id: 'cron-job', etichetta: 'Cron Job', href: PERCORSO_CRON_JOB },
  {
    id: 'azioni',
    etichetta: 'Azioni',
    href: `${PERCORSO_CRON_JOB}?scheda=azioni`,
  },
];
