import { describe, expect, it } from 'vitest';
import { percorsoGiornata, riepilogoGiornata, titoloRiepilogoSezione } from './giornata';

describe('percorsoGiornata', () => {
  it('senza data: la schermata unica, alla data odierna decisa dalla pagina', () => {
    expect(percorsoGiornata()).toBe('/dashboard/giornata');
    expect(percorsoGiornata(null)).toBe('/dashboard/giornata');
    expect(percorsoGiornata('')).toBe('/dashboard/giornata');
  });

  it('con data: la mantiene nella query string', () => {
    expect(percorsoGiornata('2026-09-28')).toBe('/dashboard/giornata?data=2026-09-28');
  });

  it('codifica un valore anomalo invece di iniettarlo nell\'indirizzo', () => {
    expect(percorsoGiornata('2026-09-28&x=1')).toBe('/dashboard/giornata?data=2026-09-28%26x%3D1');
  });
});

describe('riepilogoGiornata', () => {
  it('nessun bambino: tutti zero', () => {
    expect(riepilogoGiornata([])).toEqual({
      presenti: 0,
      totale: 0,
      preAsilo: 0,
      postAsilo: 0,
      pastiSi: 0,
      pastiApplicabili: 0,
    });
  });

  it('conta presenti (inclusi pre/post-asilo), pre-asilo, post-asilo su tutti i bambini', () => {
    const r = riepilogoGiornata([
      { stato: 'presente', preAsilo: true, postAsilo: false },
      { stato: 'presente', preAsilo: true, postAsilo: true },
      { stato: 'assente' },
      {},
    ]);
    expect(r.presenti).toBe(2);
    expect(r.totale).toBe(4);
    expect(r.preAsilo).toBe(2);
    expect(r.postAsilo).toBe(1);
  });

  it('i pasti "sì" e gli applicabili escludono assenti e malati; chi non ha presenza resta applicabile', () => {
    const r = riepilogoGiornata([
      { stato: 'presente', mangiato: 'si' },
      { stato: 'presente', mangiato: 'no' },
      { mangiato: 'si' },
      { stato: 'assente', mangiato: 'si' },
      { stato: 'malattia' },
    ]);
    expect(r.pastiSi).toBe(2);
    expect(r.pastiApplicabili).toBe(3);
    expect(r.totale).toBe(5);
  });
});

describe('titoloRiepilogoSezione', () => {
  it('"Sezione {nome}" per una sezione vera, senza prefisso per "Senza sezione"', () => {
    expect(titoloRiepilogoSezione('Girasoli')).toBe('Sezione Girasoli');
    expect(titoloRiepilogoSezione('Senza sezione')).toBe('Senza sezione');
  });
});
