import { describe, expect, it } from 'vitest';
import { risolviPeriodoReport } from './report';

describe('risolviPeriodoReport — mensile', () => {
  it('risolve un mese esplicito', () => {
    const periodo = risolviPeriodoReport('mensile', '2026-02');
    expect(periodo).toMatchObject({
      inizio: '2026-02-01',
      fine: '2026-02-28',
      etichettaPeriodo: 'febbraio 2026',
      periodoPrecedente: '2026-01',
      periodoSuccessivo: '2026-03',
      periodoAttuale: '2026-02',
    });
  });

  it('ignora un parametro periodo malformato e usa il mese corrente', () => {
    const periodo = risolviPeriodoReport('mensile', 'non-una-data');
    expect(periodo.periodoAttuale).toMatch(/^\d{4}-\d{2}$/);
  });

  it('attraversa il cambio di anno navigando a dicembre/gennaio', () => {
    expect(risolviPeriodoReport('mensile', '2026-12').periodoSuccessivo).toBe('2027-01');
    expect(risolviPeriodoReport('mensile', '2027-01').periodoPrecedente).toBe('2026-12');
  });
});

describe('risolviPeriodoReport — settimanale', () => {
  it('risolve la settimana (lun-dom) a partire da un\'ancora', () => {
    // 2026-08-20 è un giovedì della settimana 17-23 agosto 2026.
    const periodo = risolviPeriodoReport('settimanale', '2026-08-20');
    expect(periodo).toMatchObject({
      inizio: '2026-08-17',
      fine: '2026-08-23',
      etichettaPeriodo: '17 ago – 23 ago',
      periodoPrecedente: '2026-08-10',
      periodoSuccessivo: '2026-08-24',
      periodoAttuale: '2026-08-17',
    });
  });

  it('ignora un\'ancora malformata e usa la settimana corrente', () => {
    const periodo = risolviPeriodoReport('settimanale', 'non-una-data');
    expect(periodo.periodoAttuale).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('risolviPeriodoReport — giornaliero', () => {
  it('risolve un singolo giorno esplicito', () => {
    const periodo = risolviPeriodoReport('giornaliero', '2026-08-23');
    expect(periodo).toMatchObject({
      inizio: '2026-08-23',
      fine: '2026-08-23',
      etichettaPeriodo: 'domenica 23 agosto 2026',
      periodoPrecedente: '2026-08-22',
      periodoSuccessivo: '2026-08-24',
      periodoAttuale: '2026-08-23',
    });
  });

  it('ignora un giorno malformato e usa oggi', () => {
    const periodo = risolviPeriodoReport('giornaliero', undefined);
    expect(periodo.periodoAttuale).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
