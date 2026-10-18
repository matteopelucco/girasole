import type { Scheda } from './schede';

// Schede della pagina "Calendario attività" (specs/64, issue #328).
export const PERCORSO_CALENDARIO_ATTIVITA = '/dashboard/calendario';

export type IdSchedaCalendario = 'attivita' | 'chiusure';

// "Calendario attività" (gli eventi di Google) è la scheda iniziale: il suo
// indirizzo è la pagina senza parametri.
export const SCHEDE_CALENDARIO: [Scheda<IdSchedaCalendario>, ...Scheda<IdSchedaCalendario>[]] = [
  { id: 'attivita', etichetta: 'Calendario attività', href: PERCORSO_CALENDARIO_ATTIVITA },
  {
    id: 'chiusure',
    etichetta: 'Giorni di chiusura',
    href: `${PERCORSO_CALENDARIO_ATTIVITA}?scheda=chiusure`,
  },
];
