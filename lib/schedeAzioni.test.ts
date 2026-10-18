import { describe, expect, it } from 'vitest';
import { SCHEDE, indiceDaTasto, schedaDaParametri } from './schedeAzioni';

describe('schedaDaParametri', () => {
  it('parte da "Cron Job" senza parametro o con un valore sconosciuto', () => {
    expect(schedaDaParametri({})).toBe('cron-job');
    expect(schedaDaParametri({ scheda: 'boh' })).toBe('cron-job');
    expect(schedaDaParametri({ scheda: undefined })).toBe('cron-job');
  });

  it('sceglie "Azioni" con ?scheda=azioni, anche se il parametro è ripetuto', () => {
    expect(schedaDaParametri({ scheda: 'azioni' })).toBe('azioni');
    expect(schedaDaParametri({ scheda: ['azioni', 'cron-job'] })).toBe('azioni');
  });
});

describe('SCHEDE', () => {
  it('ha "Cron Job" (senza parametri) e poi "Azioni", sulla stessa pagina', () => {
    expect(SCHEDE.map((s) => [s.etichetta, s.href])).toEqual([
      ['Cron Job', '/admin/cron-job'],
      ['Azioni', '/admin/cron-job?scheda=azioni'],
    ]);
  });
});

describe('indiceDaTasto', () => {
  it('muove di una scheda con le frecce, in modo circolare', () => {
    expect(indiceDaTasto('ArrowRight', 0, 2)).toBe(1);
    expect(indiceDaTasto('ArrowRight', 1, 2)).toBe(0);
    expect(indiceDaTasto('ArrowLeft', 1, 2)).toBe(0);
    expect(indiceDaTasto('ArrowLeft', 0, 2)).toBe(1);
  });

  it("Home e Fine vanno alla prima e all'ultima scheda", () => {
    expect(indiceDaTasto('Home', 1, 2)).toBe(0);
    expect(indiceDaTasto('End', 0, 2)).toBe(1);
  });

  it('ignora gli altri tasti', () => {
    expect(indiceDaTasto('Tab', 0, 2)).toBeNull();
    expect(indiceDaTasto('Enter', 0, 2)).toBeNull();
  });
});
