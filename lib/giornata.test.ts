import { describe, expect, it } from 'vitest';
import {
  percorsoGiornata,
  riepilogoGiornata,
  stileSesso,
  testoVoceRiepilogo,
  titoloRiepilogoSezione,
  vociRiepilogo,
} from './giornata';

describe('vociRiepilogo', () => {
  const r = { presenti: 15, totale: 16, preAsilo: 3, postAsilo: 1, pastiSi: 14, pastiApplicabili: 15 };

  it('sezione con pasti: denominatore dei pasti = bambini non assenti/malati', () => {
    expect(vociRiepilogo(r, { conPasti: true, aggregato: false }).map(testoVoceRiepilogo)).toEqual([
      'Presenti: 15/16',
      'Pre-asilo: 3',
      'Post-asilo: 1',
      'Pasti: 14/15',
    ]);
  });

  it('aggregato con pasti: denominatore dei pasti = tutti i bambini', () => {
    expect(vociRiepilogo(r, { conPasti: true, aggregato: true }).at(-1)).toEqual({
      etichetta: 'Pasti',
      numeratore: 14,
      denominatore: 16,
    });
  });

  it('senza pasti (assistente): nessuna voce Pasti', () => {
    const voci = vociRiepilogo(r, { conPasti: false, aggregato: true });
    expect(voci.map((v) => v.etichetta)).toEqual(['Presenti', 'Pre-asilo', 'Post-asilo']);
  });
});

describe('testoVoceRiepilogo', () => {
  it('con denominatore anche se zero', () => {
    expect(testoVoceRiepilogo({ etichetta: 'Pasti', numeratore: 0, denominatore: 0 })).toBe('Pasti: 0/0');
  });

  it('senza denominatore', () => {
    expect(testoVoceRiepilogo({ etichetta: 'Pre-asilo', numeratore: 0 })).toBe('Pre-asilo: 0');
  });
});

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

describe('stileSesso', () => {
  it('femmina: sfondo rosa tenue ed etichetta "Femmina"', () => {
    const stile = stileSesso('F');
    expect(stile.sesso).toBe('F');
    expect(stile.etichetta).toBe('Femmina');
    expect(stile.sfondoIntestazione).toBe('bg-pink-100');
    expect(stile.bordoCard).toBe('border-pink-200');
  });

  it('maschio: sfondo azzurro tenue ed etichetta "Maschio"', () => {
    const stile = stileSesso('M');
    expect(stile.sesso).toBe('M');
    expect(stile.etichetta).toBe('Maschio');
    expect(stile.sfondoIntestazione).toBe('bg-sky-100');
    expect(stile.bordoCard).toBe('border-sky-200');
  });

  it.each([null, undefined, '', 'X', 'f', 'm'])('sesso %j non compilato o inatteso: neutro, senza etichetta', (sesso) => {
    const stile = stileSesso(sesso);
    expect(stile.sesso).toBeNull();
    expect(stile.etichetta).toBeNull();
    expect(stile.sfondoIntestazione).toBe('bg-stone-50');
  });
});
