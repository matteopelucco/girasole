import { describe, expect, it } from 'vitest';
import {
  domenicaSettimana,
  formattaDataBreve,
  formattaDataItaliana,
  formattaIntervalloItaliano,
  formattaMeseItaliano,
  giorniInRange,
  lunediSettimana,
  meseDaData,
  mesePrecedente,
  meseSuccessivo,
  oggi,
  primoGiornoMese,
  sommaGiorni,
  ultimoGiornoMese,
} from './date';

describe('oggi', () => {
  it('restituisce una data in formato YYYY-MM-DD', () => {
    expect(oggi()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('sommaGiorni', () => {
  it('somma giorni dentro lo stesso mese', () => {
    expect(sommaGiorni('2026-03-10', 5)).toBe('2026-03-15');
  });

  it('sottrae giorni con n negativo', () => {
    expect(sommaGiorni('2026-03-10', -5)).toBe('2026-03-05');
  });

  it('attraversa un cambio di mese', () => {
    expect(sommaGiorni('2026-03-31', 1)).toBe('2026-04-01');
  });

  it('attraversa un cambio di anno', () => {
    expect(sommaGiorni('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('gestisce l\'anno bisestile', () => {
    expect(sommaGiorni('2024-02-28', 1)).toBe('2024-02-29');
    expect(sommaGiorni('2025-02-28', 1)).toBe('2025-03-01');
  });
});

describe('formattaDataItaliana', () => {
  it('formatta giorno della settimana, giorno, mese e anno per esteso', () => {
    // 2026-08-23 è una domenica.
    expect(formattaDataItaliana('2026-08-23')).toBe('domenica 23 agosto 2026');
  });
});

describe('meseDaData', () => {
  it('estrae "YYYY-MM" da una data completa', () => {
    expect(meseDaData('2026-08-23')).toBe('2026-08');
  });
});

describe('primoGiornoMese', () => {
  it('restituisce il giorno 01 del mese', () => {
    expect(primoGiornoMese('2026-08')).toBe('2026-08-01');
  });
});

describe('ultimoGiornoMese', () => {
  it('restituisce il 30 per un mese di 30 giorni', () => {
    expect(ultimoGiornoMese('2026-04')).toBe('2026-04-30');
  });

  it('restituisce il 31 per un mese di 31 giorni', () => {
    expect(ultimoGiornoMese('2026-08')).toBe('2026-08-31');
  });

  it('gestisce febbraio bisestile e non bisestile', () => {
    expect(ultimoGiornoMese('2024-02')).toBe('2024-02-29');
    expect(ultimoGiornoMese('2025-02')).toBe('2025-02-28');
  });

  it('gestisce dicembre (fine anno)', () => {
    expect(ultimoGiornoMese('2026-12')).toBe('2026-12-31');
  });
});

describe('meseSuccessivo', () => {
  it('passa al mese successivo nello stesso anno', () => {
    expect(meseSuccessivo('2026-08')).toBe('2026-09');
  });

  it('attraversa il cambio di anno', () => {
    expect(meseSuccessivo('2026-12')).toBe('2027-01');
  });
});

describe('mesePrecedente', () => {
  it('torna al mese precedente nello stesso anno', () => {
    expect(mesePrecedente('2026-08')).toBe('2026-07');
  });

  it('attraversa il cambio di anno', () => {
    expect(mesePrecedente('2026-01')).toBe('2025-12');
  });
});

describe('formattaMeseItaliano', () => {
  it('formatta mese e anno per esteso', () => {
    expect(formattaMeseItaliano('2026-08')).toBe('agosto 2026');
  });
});

describe('lunediSettimana / domenicaSettimana', () => {
  it('trova il lunedì di una settimana a partire da un giorno feriale', () => {
    // 2026-08-20 è un giovedì.
    expect(lunediSettimana('2026-08-20')).toBe('2026-08-17');
  });

  it('un lunedì è il lunedì di se stesso', () => {
    expect(lunediSettimana('2026-08-17')).toBe('2026-08-17');
  });

  it('una domenica appartiene alla settimana che inizia il lunedì precedente', () => {
    expect(lunediSettimana('2026-08-23')).toBe('2026-08-17');
  });

  it('domenicaSettimana restituisce la domenica della stessa settimana', () => {
    expect(domenicaSettimana('2026-08-20')).toBe('2026-08-23');
  });

  it('gestisce una settimana a cavallo tra due mesi', () => {
    expect(lunediSettimana('2026-09-01')).toBe('2026-08-31');
    expect(domenicaSettimana('2026-08-31')).toBe('2026-09-06');
  });
});

describe('formattaIntervalloItaliano', () => {
  it('formatta un intervallo di date brevi', () => {
    expect(formattaIntervalloItaliano('2026-08-17', '2026-08-23')).toBe('17 ago – 23 ago');
  });
});

describe('formattaDataBreve', () => {
  it('formatta una data breve con anno', () => {
    expect(formattaDataBreve('2026-08-23')).toBe('23 ago 2026');
  });
});

describe('giorniInRange', () => {
  it('elenca tutti i giorni inclusi tra inizio e fine', () => {
    expect(giorniInRange('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ]);
  });

  it('restituisce un solo giorno se inizio e fine coincidono', () => {
    expect(giorniInRange('2026-08-23', '2026-08-23')).toEqual(['2026-08-23']);
  });
});
