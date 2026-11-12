import { describe, expect, it } from 'vitest';
import {
  anteprimaTotale,
  differenzeModifica,
  leggiImportoScritto,
  serviziConCoperturaCambiata,
  sommaVoci,
  validaModificaImporti,
  valoriDaComunicazione,
  vociDelloStorico,
  type ChiaveVoce,
  type ImportiVoci,
  type NoteVoci,
} from './modificaImporti';

const ATTUALI: ImportiVoci & NoteVoci = {
  retta_mensile: 250,
  marca_da_bollo: 2,
  costo_pasti: 108,
  conguaglio_pasti: 0,
  costo_pre_asilo: 70,
  costo_post_asilo: 0,
  gettoni_pre_asilo: 0,
  gettoni_post_asilo: 0,
  costi_extra: 0,
  credito_debito: -20,
  note_costi_extra: null,
  nota_credito_debito: 'Rimborso',
};

function comeTesto(v: ImportiVoci): Record<ChiaveVoce, string> {
  const t = {} as Record<ChiaveVoce, string>;
  for (const k of Object.keys(v) as ChiaveVoce[]) t[k] = String(v[k]).replace('.', ',');
  return t;
}
const NOTE: NoteVoci = { note_costi_extra: null, nota_credito_debito: 'Rimborso' };

describe('sommaVoci', () => {
  it('somma le dieci voci con i negativi', () => {
    expect(sommaVoci(ATTUALI)).toBe(410);
  });
  it('arrotonda al centesimo senza errori di virgola mobile', () => {
    expect(sommaVoci({ ...ATTUALI, retta_mensile: 0.1, marca_da_bollo: 0.2, costo_pasti: 0, costo_pre_asilo: 0, credito_debito: 0 })).toBe(0.3);
  });
  it('può essere negativa (un credito grande)', () => {
    expect(sommaVoci({ ...ATTUALI, credito_debito: -1000 })).toBe(-570);
  });
});

describe('leggiImportoScritto', () => {
  it('accetta virgola, punto e negativi', () => {
    expect(leggiImportoScritto('12,5')).toBe(12.5);
    expect(leggiImportoScritto(' 12.50 ')).toBe(12.5);
    expect(leggiImportoScritto('-3')).toBe(-3);
  });
  it('rifiuta vuoto, testo, e più di due decimali', () => {
    expect(leggiImportoScritto('')).toBeNull();
    expect(leggiImportoScritto('abc')).toBeNull();
    expect(leggiImportoScritto('1,234')).toBeNull();
    expect(leggiImportoScritto('1e3')).toBeNull();
  });
});

describe('anteprimaTotale (PAG-04)', () => {
  it('porta i pasti da 108 a 100: il totale scende da 410 a 402', () => {
    expect(anteprimaTotale({ ...comeTesto(ATTUALI), costo_pasti: '100' })).toBe(402);
  });
  it('un campo non valido vale 0', () => {
    expect(anteprimaTotale({ ...comeTesto(ATTUALI), costo_pasti: 'x' })).toBe(302);
  });
});

describe('validaModificaImporti (PAG-06)', () => {
  const valida = (scritti: Partial<Record<ChiaveVoce, string>>, motivo = 'Errore nei pasti', note = NOTE) =>
    validaModificaImporti({ ...comeTesto(ATTUALI), ...scritti }, note, motivo, ATTUALI);

  it('accetta una modifica valida e ricalcola il totale', () => {
    const esito = valida({ costo_pasti: '100' });
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.totale).toBe(402);
      expect(esito.differenze).toEqual([
        { chiave: 'costo_pasti', etichetta: 'Pasti', prima: '108,00 €', dopo: '100,00 €' },
      ]);
    }
  });
  it('rifiuta il motivo vuoto o di soli spazi', () => {
    expect(valida({ costo_pasti: '100' }, '   ').ok).toBe(false);
    expect(valida({ costo_pasti: '100' }, '').ok).toBe(false);
  });
  it('rifiuta importi non numerici, con tre decimali o troppo grandi', () => {
    expect(valida({ costo_pasti: 'abc' }).ok).toBe(false);
    expect(valida({ costo_pasti: '1,234' }).ok).toBe(false);
    expect(valida({ costo_pasti: '1000000' }).ok).toBe(false);
    expect(valida({ costo_pasti: '' }).ok).toBe(false);
  });
  it('rifiuta negativi tranne conguaglio pasti e credito/debito', () => {
    expect(valida({ retta_mensile: '-1' }).ok).toBe(false);
    expect(valida({ costi_extra: '-5' }).ok).toBe(false);
    expect(valida({ gettoni_pre_asilo: '-5' }).ok).toBe(false);
    expect(valida({ conguaglio_pasti: '-11' }).ok).toBe(true);
    expect(valida({ credito_debito: '-150' }).ok).toBe(true);
  });
  it('rifiuta quando non cambia nulla', () => {
    const esito = valida({});
    expect(esito.ok).toBe(false);
  });
  it('una nota cambiata conta come modifica', () => {
    const esito = valida({}, 'Nota corretta', { ...NOTE, note_costi_extra: 'Gita' });
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.differenze[0]).toMatchObject({ chiave: 'note_costi_extra', prima: '(vuota)', dopo: 'Gita' });
  });
  it('una nota di soli spazi equivale a nessuna nota', () => {
    expect(valida({}, 'x', { ...NOTE, note_costi_extra: '   ' }).ok).toBe(false);
  });
});

describe('differenzeModifica', () => {
  it('elenca le sole voci cambiate, nell\'ordine della tabella', () => {
    const d = differenzeModifica(ATTUALI, { ...ATTUALI, credito_debito: -50, retta_mensile: 260 });
    expect(d.map((x) => x.chiave)).toEqual(['retta_mensile', 'credito_debito']);
  });
});

describe('serviziConCoperturaCambiata (PAG-10)', () => {
  it('avvisa passando da importo a 0 e da 0 a importo, per pre e post', () => {
    expect(serviziConCoperturaCambiata(ATTUALI, { ...ATTUALI, costo_pre_asilo: 0 })).toEqual(['Pre-asilo']);
    expect(serviziConCoperturaCambiata(ATTUALI, { ...ATTUALI, costo_post_asilo: 30 })).toEqual(['Post-asilo']);
    expect(serviziConCoperturaCambiata(ATTUALI, { ...ATTUALI, costo_pre_asilo: 0, costo_post_asilo: 30 })).toEqual([
      'Pre-asilo',
      'Post-asilo',
    ]);
  });
  it('non avvisa se l\'importo resta maggiore di zero o resta zero', () => {
    expect(serviziConCoperturaCambiata(ATTUALI, { ...ATTUALI, costo_pre_asilo: 60 })).toEqual([]);
    expect(serviziConCoperturaCambiata(ATTUALI, { ...ATTUALI, costo_post_asilo: 0 })).toEqual([]);
  });
});

describe('vociDelloStorico', () => {
  it('scrive per esteso solo le voci cambiate, con le note', () => {
    const v = vociDelloStorico({
      costo_pasti: { prima: 108, dopo: '100.00' },
      nota_credito_debito: { prima: null, dopo: 'Corretto' },
    });
    expect(v).toEqual([
      { chiave: 'costo_pasti', etichetta: 'Pasti', prima: '108,00 €', dopo: '100,00 €' },
      { chiave: 'nota_credito_debito', etichetta: 'Nota credito/debito', prima: '(vuota)', dopo: 'Corretto' },
    ]);
  });
});

describe('valoriDaComunicazione', () => {
  it('legge i numeric come numeri e i gettoni assenti come 0', () => {
    const v = valoriDaComunicazione({
      retta_mensile: '250.00',
      marca_da_bollo: '2.00',
      costo_pasti: '0',
      conguaglio_pasti: '0',
      costo_pre_asilo: '0',
      costo_post_asilo: '0',
      costi_extra: '0',
      note_costi_extra: '  ',
      credito_debito: '-5.00',
      nota_credito_debito: 'x',
      totale: '247.00',
    });
    expect(v.retta_mensile).toBe(250);
    expect(v.gettoni_pre_asilo).toBe(0);
    expect(v.note_costi_extra).toBeNull();
    expect(v.credito_debito).toBe(-5);
  });
});
