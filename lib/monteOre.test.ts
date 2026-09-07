import { describe, expect, it } from 'vitest';
import {
  controlloSettimanaOreLavoro,
  notaMovimentoSettimanale,
  notaMovimentoStraordinarioResiduo,
  saldiPerUtente,
  saldoMonteOre,
} from './monteOre';

// Tutte funzioni pure (nessun I/O): specs/19 - monte-ore.md.

const profilo = {
  ore_lunedi: 7,
  ore_martedi: 7,
  ore_mercoledi: 7,
  ore_giovedi: 7,
  ore_venerdi: 4,
};

describe('controlloSettimanaOreLavoro', () => {
  it('senza carenza, tutto lo straordinario erogato è residuo', () => {
    const giorni = [
      { data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 7, oreStraordinarie: 2 }, // lunedì, previsto 7
      { data: '2026-09-01', stato: 'lavorativo', oreOrdinarie: 7, oreStraordinarie: 1 }, // martedì, previsto 7
    ];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 14,
      oreOrdinarieErogate: 14,
      oreStraordinarieErogate: 3,
      carenza: 0,
      carenzaResidua: 0,
      straordinarioResiduo: 3,
    });
  });

  it('carenza senza straordinario: aumenta interamente il monte ore, nessuno straordinario residuo', () => {
    const giorni = [
      { data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 5, oreStraordinarie: 0 }, // lunedì, previsto 7
      { data: '2026-09-04', stato: 'lavorativo', oreOrdinarie: 2, oreStraordinarie: 0 }, // venerdì, previsto 4
    ];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 11,
      oreOrdinarieErogate: 7,
      oreStraordinarieErogate: 0,
      carenza: 4,
      carenzaResidua: 4,
      straordinarioResiduo: 0,
    });
  });

  it('lo straordinario copre parzialmente la carenza: resta carenza residua, nessuno straordinario residuo', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 5, oreStraordinarie: 1 }]; // previsto 7
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 7,
      oreOrdinarieErogate: 5,
      oreStraordinarieErogate: 1,
      carenza: 2,
      carenzaResidua: 1,
      straordinarioResiduo: 0,
    });
  });

  it('lo straordinario copre interamente la carenza: resta uno straordinario residuo', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 5, oreStraordinarie: 5 }]; // previsto 7
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 7,
      oreOrdinarieErogate: 5,
      oreStraordinarieErogate: 5,
      carenza: 2,
      carenzaResidua: 0,
      straordinarioResiduo: 3,
    });
  });

  it('un giorno con più ore ordinarie del previsto non produce carenza negativa', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 9, oreStraordinarie: 0 }];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toMatchObject({ carenza: 0, carenzaResidua: 0, straordinarioResiduo: 0 });
  });

  it('esclude i giorni di malattia dal calcolo', () => {
    const giorni = [{ data: '2026-08-31', stato: 'malattia', oreOrdinarie: 0, oreStraordinarie: 0 }];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 0,
      oreOrdinarieErogate: 0,
      oreStraordinarieErogate: 0,
      carenza: 0,
      carenzaResidua: 0,
      straordinarioResiduo: 0,
    });
  });

  it('esclude i giorni di assenza dal calcolo', () => {
    const giorni = [{ data: '2026-08-31', stato: 'assenza', oreOrdinarie: 0, oreStraordinarie: 0 }];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toMatchObject({ oreDovute: 0, straordinarioResiduo: 0 });
  });

  it('un weekend (previsto 0) produce solo straordinario residuo, mai carenza', () => {
    const sabato = [{ data: '2026-09-05', stato: 'lavorativo', oreOrdinarie: 3, oreStraordinarie: 3 }];
    expect(controlloSettimanaOreLavoro(sabato, profilo)).toEqual({
      oreDovute: 0,
      oreOrdinarieErogate: 3,
      oreStraordinarieErogate: 3,
      carenza: 0,
      carenzaResidua: 0,
      straordinarioResiduo: 3,
    });
  });

  it('senza profilo orario assegnato le ore dovute e la carenza sono sempre zero', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 0, oreStraordinarie: 2 }];
    expect(controlloSettimanaOreLavoro(giorni, null)).toEqual({
      oreDovute: 0,
      oreOrdinarieErogate: 0,
      oreStraordinarieErogate: 2,
      carenza: 0,
      carenzaResidua: 0,
      straordinarioResiduo: 2,
    });
  });

  it('funziona anche con valori stringa (numeric via PostgREST)', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: '5.5', oreStraordinarie: '1.5' }];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 7,
      oreOrdinarieErogate: 5.5,
      oreStraordinarieErogate: 1.5,
      carenza: 1.5,
      carenzaResidua: 0,
      straordinarioResiduo: 0,
    });
  });
});

describe('notaMovimentoSettimanale', () => {
  it('descrive dovute/erogate/carenza residua in italiano', () => {
    expect(
      notaMovimentoSettimanale({
        oreDovute: 7,
        oreOrdinarieErogate: 5,
        oreStraordinarieErogate: 1,
        carenza: 2,
        carenzaResidua: 1,
        straordinarioResiduo: 0,
      })
    ).toBe(
      "Calcolo automatico: 7h dovute, 5h ordinarie erogate, 1h di carenza residua dopo la copertura dallo straordinario."
    );
  });
});

describe('notaMovimentoStraordinarioResiduo', () => {
  it('descrive lo scalo dello straordinario residuo in italiano', () => {
    expect(notaMovimentoStraordinarioResiduo(3)).toBe(
      "Straordinario residuo scalato dal monte ore su decisione dell'admin: 3h."
    );
  });
});

describe('saldoMonteOre', () => {
  it('somma le variazioni, positive e negative', () => {
    expect(saldoMonteOre([{ variazione: 3 }, { variazione: -1.5 }, { variazione: 2 }])).toBe(3.5);
  });

  it('nessun movimento: saldo zero', () => {
    expect(saldoMonteOre([])).toBe(0);
  });

  it('funziona anche con valori stringa (numeric via PostgREST)', () => {
    expect(saldoMonteOre([{ variazione: '2.50' }, { variazione: '-0.50' }])).toBe(2);
  });
});

describe('saldiPerUtente', () => {
  it('raggruppa il saldo per ciascun utente', () => {
    const movimenti = [
      { utente_id: 'a', variazione: 3 },
      { utente_id: 'b', variazione: -1 },
      { utente_id: 'a', variazione: -2 },
    ];
    const saldi = saldiPerUtente(movimenti);
    expect(saldi.get('a')).toBe(1);
    expect(saldi.get('b')).toBe(-1);
  });

  it('un elenco vuoto produce una mappa vuota', () => {
    expect(saldiPerUtente([]).size).toBe(0);
  });
});
