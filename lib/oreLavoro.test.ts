import { describe, expect, it } from 'vitest';
import {
  notaGiornoChiusoOreLavoro,
  oreOrdinariePreviste,
  totaliSettimanaOreLavoro,
  validaGiornoOreLavoro,
  type InputGiornoOreLavoro,
} from './oreLavoro';
import type { GiornoChiusura } from './calendarioScolastico';

// Tutte funzioni pure (nessun I/O): specs/18 - report-ore-lavoro.md.

describe('oreOrdinariePreviste', () => {
  const profilo = {
    ore_lunedi: 7,
    ore_martedi: 7,
    ore_mercoledi: 7,
    ore_giovedi: 7,
    ore_venerdi: 4,
  };

  it('restituisce le ore del giorno della settimana corrispondente', () => {
    expect(oreOrdinariePreviste(profilo, '2026-08-31')).toBe(7); // lunedì
    expect(oreOrdinariePreviste(profilo, '2026-09-04')).toBe(4); // venerdì
  });

  it('restituisce 0 senza profilo assegnato', () => {
    expect(oreOrdinariePreviste(null, '2026-08-31')).toBe(0);
    expect(oreOrdinariePreviste(undefined, '2026-08-31')).toBe(0);
  });

  it('funziona anche con valori stringa (numeric via PostgREST)', () => {
    const profiloStringa = { ...profilo, ore_lunedi: '7.50' };
    expect(oreOrdinariePreviste(profiloStringa, '2026-08-31')).toBe(7.5);
  });
});

function inputBase(sovrascrizioni: Partial<InputGiornoOreLavoro> = {}): InputGiornoOreLavoro {
  return {
    data: '2026-08-31',
    stato: 'lavorativo',
    oreOrdinarie: 7,
    oreStraordinarie: 0,
    motivoStraordinario: '',
    codiceMalattia: '',
    notaAssenza: '',
    ...sovrascrizioni,
  };
}

describe('validaGiornoOreLavoro', () => {
  it('un giorno lavorativo normale è valido', () => {
    const esito = validaGiornoOreLavoro(inputBase());
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno).toEqual({
        data: '2026-08-31',
        stato: 'lavorativo',
        oreOrdinarie: 7,
        oreStraordinarie: 0,
        motivoStraordinario: null,
        codiceMalattia: null,
        notaAssenza: null,
      });
    }
  });

  it('ore straordinarie con motivo sono valide', () => {
    const esito = validaGiornoOreLavoro(
      inputBase({ oreStraordinarie: 2, motivoStraordinario: 'Riunione genitori' })
    );
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno.oreStraordinarie).toBe(2);
      expect(esito.giorno.motivoStraordinario).toBe('Riunione genitori');
    }
  });

  it('ore straordinarie senza motivo sono rifiutate', () => {
    const esito = validaGiornoOreLavoro(inputBase({ oreStraordinarie: 2 }));
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errore).toContain('motivo');
  });

  it('un motivo tutto spazi conta come mancante', () => {
    const esito = validaGiornoOreLavoro(inputBase({ oreStraordinarie: 1, motivoStraordinario: '   ' }));
    expect(esito.ok).toBe(false);
  });

  it('malattia con codice è valida e azzera le ore', () => {
    const esito = validaGiornoOreLavoro(
      inputBase({ stato: 'malattia', oreOrdinarie: 7, codiceMalattia: 'ABC123' })
    );
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno.stato).toBe('malattia');
      expect(esito.giorno.oreOrdinarie).toBe(0);
      expect(esito.giorno.oreStraordinarie).toBe(0);
      expect(esito.giorno.codiceMalattia).toBe('ABC123');
    }
  });

  it('malattia senza codice è rifiutata', () => {
    const esito = validaGiornoOreLavoro(inputBase({ stato: 'malattia' }));
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errore).toContain('codice malattia');
  });

  it('assenza con nota è valida e azzera le ore', () => {
    const esito = validaGiornoOreLavoro(
      inputBase({ stato: 'assenza', oreOrdinarie: 7, notaAssenza: 'Visita medica' })
    );
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno.stato).toBe('assenza');
      expect(esito.giorno.oreOrdinarie).toBe(0);
      expect(esito.giorno.notaAssenza).toBe('Visita medica');
    }
  });

  it('assenza senza nota è rifiutata', () => {
    const esito = validaGiornoOreLavoro(inputBase({ stato: 'assenza' }));
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errore).toContain('nota giustificativa');
  });

  it('uno stato sconosciuto viene trattato come lavorativo', () => {
    const esito = validaGiornoOreLavoro(inputBase({ stato: 'boh' }));
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.giorno.stato).toBe('lavorativo');
  });

  it('ore negative vengono riportate a zero', () => {
    const esito = validaGiornoOreLavoro(inputBase({ oreOrdinarie: -3, oreStraordinarie: -1 }));
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giorno.oreOrdinarie).toBe(0);
      expect(esito.giorno.oreStraordinarie).toBe(0);
    }
  });
});

describe('totaliSettimanaOreLavoro', () => {
  it('somma ore ordinarie e straordinarie di tutti i giorni', () => {
    const giorni = [
      { oreOrdinarie: 7, oreStraordinarie: 0 },
      { oreOrdinarie: 7, oreStraordinarie: 1.5 },
      { oreOrdinarie: 7, oreStraordinarie: 0 },
      { oreOrdinarie: 7, oreStraordinarie: 0 },
      { oreOrdinarie: 4, oreStraordinarie: 0 },
    ];
    expect(totaliSettimanaOreLavoro(giorni)).toEqual({ ordinarie: 32, straordinarie: 1.5, totale: 33.5 });
  });

  it('un giorno di malattia/assenza (ore a zero) non altera il totale', () => {
    const giorni = [
      { oreOrdinarie: 7, oreStraordinarie: 0 },
      { oreOrdinarie: 0, oreStraordinarie: 0 }, // malattia
      { oreOrdinarie: 7, oreStraordinarie: 0 },
    ];
    expect(totaliSettimanaOreLavoro(giorni)).toEqual({ ordinarie: 14, straordinarie: 0, totale: 14 });
  });

  it('nessun giorno dà totale zero', () => {
    expect(totaliSettimanaOreLavoro([])).toEqual({ ordinarie: 0, straordinarie: 0, totale: 0 });
  });
});

describe('notaGiornoChiusoOreLavoro', () => {
  it('null per un giorno feriale normale', () => {
    expect(notaGiornoChiusoOreLavoro('2026-08-31', [])).toBeNull(); // lunedì
  });

  it('un sabato: nota generica "(weekend)", nessun blocco menzionato', () => {
    const nota = notaGiornoChiusoOreLavoro('2026-09-05', []); // sabato
    expect(nota).toContain('weekend');
    expect(nota).toContain('puoi comunque registrare le ore');
  });

  it('un giorno di chiusura registrata senza nota', () => {
    const chiusure: GiornoChiusura[] = [
      { id: '1', dataInizio: '2026-12-23', dataFine: '2026-12-31', nota: null },
    ];
    const nota = notaGiornoChiusoOreLavoro('2026-12-27', chiusure);
    expect(nota).toContain('Giorno di chiusura scolastica');
    expect(nota).toContain('puoi comunque registrare le ore');
  });

  it('un giorno di chiusura registrata con nota la include', () => {
    const chiusure: GiornoChiusura[] = [
      { id: '1', dataInizio: '2026-12-23', dataFine: '2026-12-31', nota: 'Vacanze di Natale' },
    ];
    const nota = notaGiornoChiusoOreLavoro('2026-12-27', chiusure);
    expect(nota).toContain('Vacanze di Natale');
  });
});
