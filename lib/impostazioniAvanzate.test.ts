import { describe, expect, it } from 'vitest';
import { AZIONI_AVANZATE } from './impostazioniAvanzate';

describe('AZIONI_AVANZATE', () => {
  it('include "Reset giornata" verso /admin/reset-giornata', () => {
    const reset = AZIONI_AVANZATE.find((a) => a.href === '/admin/reset-giornata');
    expect(reset?.titolo).toBe('Reset giornata');
    expect(reset?.descrizione.length).toBeGreaterThan(0);
  });

  it('ha titolo, descrizione e href admin non vuoti e href univoci', () => {
    for (const a of AZIONI_AVANZATE) {
      expect(a.titolo).not.toBe('');
      expect(a.descrizione).not.toBe('');
      expect(a.href.startsWith('/admin/')).toBe(true);
    }
    expect(new Set(AZIONI_AVANZATE.map((a) => a.href)).size).toBe(AZIONI_AVANZATE.length);
  });
});
