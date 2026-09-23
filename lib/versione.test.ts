import { describe, expect, it } from 'vitest';
import { formattaDataBuild } from './versione';

describe('formattaDataBuild', () => {
  it('converte un istante UTC nel fuso Europe/Rome (ora legale, UTC+2)', () => {
    // 23/09/2026 18:06:19 UTC → 20:06:19 a Roma (ora legale a settembre)
    expect(formattaDataBuild('a1b2c3d4e5f60000000000000000000000000000', '2026-09-23T18:06:19.000Z')).toBe(
      '2026-09-23 20:06:19 (a1b2c3d)',
    );
  });

  it('converte un istante UTC nel fuso Europe/Rome (ora solare, UTC+1)', () => {
    // 15/01/2026 10:00:00 UTC → 11:00:00 a Roma (ora solare a gennaio)
    expect(formattaDataBuild('deadbeef', '2026-01-15T10:00:00.000Z')).toBe('2026-01-15 11:00:00 (deadbee)');
  });

  it('abbrevia uno SHA esadecimale alle prime 7 cifre', () => {
    expect(formattaDataBuild('0123456789abcdef0123456789abcdef01234567', '2026-01-01T00:00:00.000Z')).toBe(
      '2026-01-01 01:00:00 (0123456)',
    );
  });

  it('non tronca uno SHA già corto (7 caratteri esadecimali)', () => {
    expect(formattaDataBuild('abc1234', '2026-01-01T00:00:00.000Z')).toBe('2026-01-01 01:00:00 (abc1234)');
  });

  it('lascia invariato un placeholder non esadecimale (sviluppo locale)', () => {
    expect(formattaDataBuild('sviluppo-locale', '2026-01-01T00:00:00.000Z')).toBe(
      '2026-01-01 01:00:00 (sviluppo-locale)',
    );
  });
});
