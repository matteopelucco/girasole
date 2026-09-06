import { describe, expect, it } from 'vitest';
import {
  calcolaEsuberoCarenza,
  notaMovimentoSettimanale,
  saldiPerUtente,
  saldoMonteOre,
  variazioneMonteOre,
} from './monteOre';

// Tutte funzioni pure (nessun I/O): specs/19 - monte-ore.md.

const profilo = {
  ore_lunedi: 7,
  ore_martedi: 7,
  ore_mercoledi: 7,
  ore_giovedi: 7,
  ore_venerdi: 4,
};

describe('calcolaEsuberoCarenza', () => {
  it('somma le ore straordinarie dei giorni lavorativi come esubero', () => {
    const giorni = [
      { data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 7, oreStraordinarie: 2 }, // lunedì
      { data: '2026-09-01', stato: 'lavorativo', oreOrdinarie: 7, oreStraordinarie: 1 }, // martedì
    ];
    expect(calcolaEsuberoCarenza(giorni, profilo)).toEqual({ esubero: 3, carenza: 0 });
  });

  it('somma la differenza fra ore previste ed erogate come carenza', () => {
    const giorni = [
      { data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 5, oreStraordinarie: 0 }, // lunedì, previsto 7
      { data: '2026-09-04', stato: 'lavorativo', oreOrdinarie: 2, oreStraordinarie: 0 }, // venerdì, previsto 4
    ];
    expect(calcolaEsuberoCarenza(giorni, profilo)).toEqual({ esubero: 0, carenza: 4 });
  });

  it('un giorno con più ore ordinarie del previsto non produce carenza negativa', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 9, oreStraordinarie: 0 }];
    expect(calcolaEsuberoCarenza(giorni, profilo)).toEqual({ esubero: 0, carenza: 0 });
  });

  it('esclude i giorni di malattia dal calcolo', () => {
    const giorni = [{ data: '2026-08-31', stato: 'malattia', oreOrdinarie: 0, oreStraordinarie: 0 }];
    expect(calcolaEsuberoCarenza(giorni, profilo)).toEqual({ esubero: 0, carenza: 0 });
  });

  it('esclude i giorni di assenza dal calcolo', () => {
    const giorni = [{ data: '2026-08-31', stato: 'assenza', oreOrdinarie: 0, oreStraordinarie: 0 }];
    expect(calcolaEsuberoCarenza(giorni, profilo)).toEqual({ esubero: 0, carenza: 0 });
  });

  it('un weekend (previsto 0) può produrre esubero ma mai carenza', () => {
    const sabato = [{ data: '2026-09-05', stato: 'lavorativo', oreOrdinarie: 3, oreStraordinarie: 3 }];
    expect(calcolaEsuberoCarenza(sabato, profilo)).toEqual({ esubero: 3, carenza: 0 });
  });

  it('senza profilo orario assegnato la carenza è sempre zero', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 0, oreStraordinarie: 2 }];
    expect(calcolaEsuberoCarenza(giorni, null)).toEqual({ esubero: 2, carenza: 0 });
  });

  it('funziona anche con valori stringa (numeric via PostgREST)', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: '5.5', oreStraordinarie: '1.5' }];
    expect(calcolaEsuberoCarenza(giorni, profilo)).toEqual({ esubero: 1.5, carenza: 1.5 });
  });
});

describe('variazioneMonteOre', () => {
  it('esubero maggiore della carenza: variazione negativa (il monte ore scala)', () => {
    expect(variazioneMonteOre(5, 2)).toBe(-3);
  });

  it('carenza maggiore dell\'esubero: variazione positiva (il monte ore aumenta)', () => {
    expect(variazioneMonteOre(1, 4)).toBe(3);
  });

  it('esubero e carenza uguali: nessuna variazione', () => {
    expect(variazioneMonteOre(2, 2)).toBe(0);
  });
});

describe('notaMovimentoSettimanale', () => {
  it('descrive esubero e carenza in italiano', () => {
    expect(notaMovimentoSettimanale(3, 1)).toBe(
      'Calcolo automatico: 3h di straordinario, 1h di carenza rispetto al profilo orario.'
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
