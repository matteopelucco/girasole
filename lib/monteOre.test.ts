import { describe, expect, it } from 'vitest';
import {
  controlloSettimanaOreLavoro,
  descrizioneEffettoMonteOre,
  movimentoEliminabile,
  notaMovimentoSettimanale,
  notaMovimentoStraordinarioResiduo,
  saldiPerUtente,
  saldoMonteOre,
  riepilogoSettimanaDaDifferenze,
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
  // Netto pieno (specs/19): variazioneMonteOre = ore dovute − ore
  // ordinarie erogate − ore straordinarie erogate. Positiva = aumenta
  // il monte ore, negativa = lo scala, zero = nessuna variazione.
  it('ordinario ed extra insieme superano il dovuto: scala il monte ore', () => {
    const giorni = [
      { data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 7, oreStraordinarie: 2 }, // lunedì, previsto 7
      { data: '2026-09-01', stato: 'lavorativo', oreOrdinarie: 7, oreStraordinarie: 1 }, // martedì, previsto 7
    ];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 14,
      oreOrdinarieErogate: 14,
      oreStraordinarieErogate: 3,
      variazioneMonteOre: -3,
    });
  });

  it('ordinario sotto al dovuto, nessuno straordinario: aumenta interamente il monte ore', () => {
    const giorni = [
      { data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 5, oreStraordinarie: 0 }, // lunedì, previsto 7
      { data: '2026-09-04', stato: 'lavorativo', oreOrdinarie: 2, oreStraordinarie: 0 }, // venerdì, previsto 4
    ];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 11,
      oreOrdinarieErogate: 7,
      oreStraordinarieErogate: 0,
      variazioneMonteOre: 4,
    });
  });

  it('lo straordinario copre solo in parte il dovuto mancante: resta un aumento', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 5, oreStraordinarie: 1 }]; // previsto 7
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 7,
      oreOrdinarieErogate: 5,
      oreStraordinarieErogate: 1,
      variazioneMonteOre: 1,
    });
  });

  it('lo straordinario copre oltre il dovuto mancante: scala il monte ore', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 5, oreStraordinarie: 5 }]; // previsto 7
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 7,
      oreOrdinarieErogate: 5,
      oreStraordinarieErogate: 5,
      variazioneMonteOre: -3,
    });
  });

  it('un giorno con più ore ordinarie del previsto scala il monte ore, non lo azzera soltanto', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 9, oreStraordinarie: 0 }]; // previsto 7
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toMatchObject({ variazioneMonteOre: -2 });
  });

  it('esclude i giorni di malattia dal calcolo', () => {
    const giorni = [{ data: '2026-08-31', stato: 'malattia', oreOrdinarie: 0, oreStraordinarie: 0 }];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 0,
      oreOrdinarieErogate: 0,
      oreStraordinarieErogate: 0,
      variazioneMonteOre: 0,
    });
  });

  it('esclude i giorni di assenza dal calcolo', () => {
    const giorni = [{ data: '2026-08-31', stato: 'assenza', oreOrdinarie: 0, oreStraordinarie: 0 }];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toMatchObject({ oreDovute: 0, variazioneMonteOre: 0 });
  });

  it.each(['chiusura', 'ferie'])('esclude i giorni di %s dal calcolo (neutri, non alterano il monte ore)', (stato) => {
    const giorni = [
      { data: '2026-08-31', stato, oreOrdinarie: 0, oreStraordinarie: 0 },
      { data: '2026-09-01', stato: 'lavorativo', oreOrdinarie: 7, oreStraordinarie: 0 },
    ];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 7,
      oreOrdinarieErogate: 7,
      oreStraordinarieErogate: 0,
      variazioneMonteOre: 0,
    });
  });

  it('un weekend (previsto 0) scala interamente il monte ore', () => {
    const sabato = [{ data: '2026-09-05', stato: 'lavorativo', oreOrdinarie: 3, oreStraordinarie: 3 }];
    expect(controlloSettimanaOreLavoro(sabato, profilo)).toEqual({
      oreDovute: 0,
      oreOrdinarieErogate: 3,
      oreStraordinarieErogate: 3,
      variazioneMonteOre: -6,
    });
  });

  it('senza profilo orario assegnato le ore dovute sono sempre zero, ogni ora erogata scala il monte ore', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: 0, oreStraordinarie: 2 }];
    expect(controlloSettimanaOreLavoro(giorni, null)).toEqual({
      oreDovute: 0,
      oreOrdinarieErogate: 0,
      oreStraordinarieErogate: 2,
      variazioneMonteOre: -2,
    });
  });

  it('funziona anche con valori stringa (numeric via PostgREST)', () => {
    const giorni = [{ data: '2026-08-31', stato: 'lavorativo', oreOrdinarie: '5.5', oreStraordinarie: '1.5' }];
    expect(controlloSettimanaOreLavoro(giorni, profilo)).toEqual({
      oreDovute: 7,
      oreOrdinarieErogate: 5.5,
      oreStraordinarieErogate: 1.5,
      variazioneMonteOre: 0,
    });
  });
});

describe('descrizioneEffettoMonteOre', () => {
  it('variazione positiva: aumento', () => {
    expect(descrizioneEffettoMonteOre(3)).toBe('3h in più sul monte ore');
  });

  it('variazione negativa: riduzione, valore assoluto', () => {
    expect(descrizioneEffettoMonteOre(-4.5)).toBe('4.5h in meno sul monte ore');
  });

  it('variazione zero: nessun effetto', () => {
    expect(descrizioneEffettoMonteOre(0)).toBe('nessuna variazione del monte ore');
  });
});

describe('notaMovimentoSettimanale', () => {
  it('descrive dovute/erogate/effetto in italiano, aumento', () => {
    expect(
      notaMovimentoSettimanale({
        oreDovute: 7,
        oreOrdinarieErogate: 5,
        oreStraordinarieErogate: 1,
        variazioneMonteOre: 1,
      })
    ).toBe('Calcolo automatico: 7h dovute, 5h ordinarie erogate, 1h straordinarie erogate — 1h in più sul monte ore.');
  });

  it('descrive dovute/erogate/effetto in italiano, riduzione', () => {
    expect(
      notaMovimentoSettimanale({
        oreDovute: 7,
        oreOrdinarieErogate: 8,
        oreStraordinarieErogate: 3,
        variazioneMonteOre: -4,
      })
    ).toBe(
      'Calcolo automatico: 7h dovute, 8h ordinarie erogate, 3h straordinarie erogate — 4h in meno sul monte ore.'
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

describe('movimentoEliminabile', () => {
  it('un movimento manuale (precarico) è eliminabile', () => {
    expect(movimentoEliminabile('precarico')).toBe(true);
  });

  it('un movimento automatico settimanale non è eliminabile', () => {
    expect(movimentoEliminabile('settimanale')).toBe(false);
  });

  it('un movimento di straordinario residuo non è eliminabile', () => {
    expect(movimentoEliminabile('straordinario_residuo')).toBe(false);
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

describe('riepilogoSettimanaDaDifferenze', () => {
  // Settimana dello screenshot di #144: previste 7/7/4/7/7 = 32h.
  const settimana = [
    { stato: 'lavorativo', orePreviste: 7, differenza: 0.5 },
    { stato: 'lavorativo', orePreviste: 7, differenza: 0 },
    { stato: 'lavorativo', orePreviste: 4, differenza: 4.5 },
    { stato: 'lavorativo', orePreviste: 7, differenza: 0 },
    { stato: 'lavorativo', orePreviste: 7, differenza: 0 },
  ];

  it('previste = somma delle previste, differenza = somma delle differenze (+5h)', () => {
    expect(riepilogoSettimanaDaDifferenze(settimana)).toEqual({
      orePreviste: 32,
      differenza: 5,
      variazioneMonteOre: -5,
    });
  });

  it('una differenza in meno aumenta subito il monte ore', () => {
    const r = riepilogoSettimanaDaDifferenze([{ stato: 'lavorativo', orePreviste: 7, differenza: -2 }]);
    expect(r).toEqual({ orePreviste: 7, differenza: -2, variazioneMonteOre: 2 });
  });

  it('somma le differenze dei giorni di una settimana corretta dopo la conferma (#151)', () => {
    const profiloOre = [7, 7, 4, 7, 7, 0, 0];
    const differenze = [0.5, 2.5, 2, 0, -3, 0, 0];
    const giorni = profiloOre.map((orePreviste, i) => ({ stato: 'lavorativo', orePreviste, differenza: differenze[i] }));
    expect(riepilogoSettimanaDaDifferenze(giorni)).toEqual({ orePreviste: 32, differenza: 2, variazioneMonteOre: -2 });
  });

  it('zero: nessuna variazione, senza -0', () => {
    const r = riepilogoSettimanaDaDifferenze([{ stato: 'lavorativo', orePreviste: 7, differenza: 0 }]);
    expect(Object.is(r.variazioneMonteOre, 0)).toBe(true);
  });

  it('esclude gli stati non lavorativi (malattia, assenza, chiusura, ferie)', () => {
    const giorni = ['malattia', 'assenza', 'chiusura', 'ferie'].map((stato) => ({
      stato,
      orePreviste: 7,
      differenza: 3,
    }));
    expect(riepilogoSettimanaDaDifferenze(giorni)).toEqual({ orePreviste: 0, differenza: 0, variazioneMonteOre: 0 });
  });

  it('una differenza non valida (null) conta come zero', () => {
    const r = riepilogoSettimanaDaDifferenze([{ stato: 'lavorativo', orePreviste: 7, differenza: null }]);
    expect(r).toEqual({ orePreviste: 7, differenza: 0, variazioneMonteOre: 0 });
  });

  it('ripulisce i residui della virgola mobile', () => {
    const r = riepilogoSettimanaDaDifferenze([
      { stato: 'lavorativo', orePreviste: 7, differenza: 0.1 },
      { stato: 'lavorativo', orePreviste: 7, differenza: 0.2 },
    ]);
    expect(r.differenza).toBe(0.3);
  });
});
