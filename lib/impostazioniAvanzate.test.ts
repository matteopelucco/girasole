import { describe, expect, it } from 'vitest';
import { SOTTOSEZIONI_IMPOSTAZIONI } from './impostazioniAvanzate';

describe('SOTTOSEZIONI_IMPOSTAZIONI', () => {
  it('elenca, in questo ordine, Reset giornata, Parametri di funzionamento, Azioni e Utenti', () => {
    expect(SOTTOSEZIONI_IMPOSTAZIONI.map((s) => [s.titolo, s.href])).toEqual([
      ['Reset giornata', '/admin/reset-giornata'],
      ['Parametri di funzionamento', '/admin/parametri-funzionamento'],
      ['Azioni', '/admin/cron-job'],
      ['Utenti', '/admin/maestre'],
    ]);
  });

  it('ha titolo, descrizione, icona e href admin non vuoti e href univoci', () => {
    for (const s of SOTTOSEZIONI_IMPOSTAZIONI) {
      expect(s.titolo).not.toBe('');
      expect(s.descrizione).not.toBe('');
      expect(s.icona).not.toBe('');
      expect(s.href.startsWith('/admin/')).toBe(true);
    }
    expect(new Set(SOTTOSEZIONI_IMPOSTAZIONI.map((s) => s.href)).size).toBe(SOTTOSEZIONI_IMPOSTAZIONI.length);
  });
});
