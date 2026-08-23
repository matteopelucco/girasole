import { describe, expect, it } from 'vitest';
import { oggi } from './date';
import { assicuraScrivibile, puoScrivereData } from './auth';

describe('puoScrivereData', () => {
  it("l'admin può scrivere su qualunque data", () => {
    expect(puoScrivereData('admin', '2020-01-01')).toBe(true);
    expect(puoScrivereData('admin', oggi())).toBe(true);
  });

  it('la maestra può scrivere solo sulla data odierna', () => {
    expect(puoScrivereData('maestra', oggi())).toBe(true);
    expect(puoScrivereData('maestra', '2020-01-01')).toBe(false);
  });

  it('nessun altro ruolo può scrivere', () => {
    expect(puoScrivereData('genitore', oggi())).toBe(false);
    expect(puoScrivereData(null, oggi())).toBe(false);
    expect(puoScrivereData(undefined, oggi())).toBe(false);
  });
});

describe('assicuraScrivibile', () => {
  it('non lancia per l\'admin su qualunque data', () => {
    expect(() => assicuraScrivibile('admin', '2020-01-01')).not.toThrow();
  });

  it('non lancia per la maestra sulla data odierna', () => {
    expect(() => assicuraScrivibile('maestra', oggi())).not.toThrow();
  });

  it('lancia per la maestra su una data diversa da oggi', () => {
    expect(() => assicuraScrivibile('maestra', '2020-01-01')).toThrow(
      'Le maestre possono modificare solo i dati della giornata odierna.'
    );
  });
});
