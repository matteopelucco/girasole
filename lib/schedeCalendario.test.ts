import { describe, expect, it } from 'vitest';
import { schedaDaParametri } from './schede';
import { SCHEDE_CALENDARIO } from './schedeCalendario';

describe('schede della pagina Calendario attività', () => {
  it('ha "Calendario attività" (senza parametri) e poi "Giorni di chiusura", sulla stessa pagina', () => {
    expect(SCHEDE_CALENDARIO.map((s) => [s.etichetta, s.href])).toEqual([
      ['Calendario attività', '/dashboard/calendario'],
      ['Giorni di chiusura', '/dashboard/calendario?scheda=chiusure'],
    ]);
  });

  it('parte da "Calendario attività" senza parametro o con un valore sconosciuto', () => {
    expect(schedaDaParametri({}, SCHEDE_CALENDARIO)).toBe('attivita');
    expect(schedaDaParametri({ scheda: 'boh' }, SCHEDE_CALENDARIO)).toBe('attivita');
    // Le schede di altre pagine non valgono qui.
    expect(schedaDaParametri({ scheda: 'azioni' }, SCHEDE_CALENDARIO)).toBe('attivita');
  });

  it('sceglie "Giorni di chiusura" con ?scheda=chiusure', () => {
    expect(schedaDaParametri({ scheda: 'chiusure' }, SCHEDE_CALENDARIO)).toBe('chiusure');
    expect(schedaDaParametri({ scheda: ['chiusure', 'attivita'] }, SCHEDE_CALENDARIO)).toBe('chiusure');
  });
});
