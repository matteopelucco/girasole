import { describe, expect, it } from 'vitest';
import { rigaComunicazione, totalePasti } from './comunicazionePasti';

describe('rigaComunicazione', () => {
  it('formatta la riga nel formato "{data}_{ora}: {numero} pasti ({chi})"', () => {
    expect(
      rigaComunicazione({
        comunicatoAt: '2026-08-26T15:30:00Z',
        numeroPasti: 12,
        comunicatoDaNome: 'Maria Rossi',
      })
    ).toBe('26/08/2026_17:30: 12 pasti (Maria Rossi)');
  });

  it('gestisce zero pasti comunicati', () => {
    expect(
      rigaComunicazione({
        comunicatoAt: '2026-01-15T10:05:00Z',
        numeroPasti: 0,
        comunicatoDaNome: 'Luca Verdi',
      })
    ).toBe('15/01/2026_11:05: 0 pasti (Luca Verdi)');
  });
});

describe('totalePasti', () => {
  it('somma i pasti di più comunicazioni', () => {
    expect(
      totalePasti([{ numeroPasti: 12 }, { numeroPasti: 8 }, { numeroPasti: 15 }])
    ).toBe(35);
  });

  it('restituisce 0 per un elenco vuoto', () => {
    expect(totalePasti([])).toBe(0);
  });
});
