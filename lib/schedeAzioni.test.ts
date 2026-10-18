import { describe, expect, it } from 'vitest';
import { schedaDaParametri } from './schede';
import { SCHEDE } from './schedeAzioni';

describe('schede della pagina Azioni', () => {
  it('parte da "Cron Job" senza parametro o con un valore sconosciuto', () => {
    expect(schedaDaParametri({}, SCHEDE)).toBe('cron-job');
    expect(schedaDaParametri({ scheda: 'boh' }, SCHEDE)).toBe('cron-job');
    expect(schedaDaParametri({ scheda: undefined }, SCHEDE)).toBe('cron-job');
  });

  it('sceglie "Azioni" con ?scheda=azioni, anche se il parametro è ripetuto', () => {
    expect(schedaDaParametri({ scheda: 'azioni' }, SCHEDE)).toBe('azioni');
    expect(schedaDaParametri({ scheda: ['azioni', 'cron-job'] }, SCHEDE)).toBe('azioni');
  });

  it('ha "Cron Job" (senza parametri) e poi "Azioni", sulla stessa pagina', () => {
    expect(SCHEDE.map((s) => [s.etichetta, s.href])).toEqual([
      ['Cron Job', '/admin/cron-job'],
      ['Azioni', '/admin/cron-job?scheda=azioni'],
    ]);
  });
});
