import { describe, expect, it } from 'vitest';
import {
  annoScolasticoDelMese,
  annoScolasticoRichiesto,
  etichettaAnnoScolastico,
  mesiAnnoScolastico,
  totaleRichiesto,
  vociComunicazione,
  type ComunicazioneImporti,
} from './pagamentiBambino';

const base: ComunicazioneImporti = {
  retta_mensile: '250.00',
  marca_da_bollo: 2,
  costo_pasti: '66.00',
  conguaglio_pasti: '-11.00',
  costo_pre_asilo: 30,
  costo_post_asilo: 0,
  costi_extra: 15,
  note_costi_extra: 'Gita',
  credito_debito: '-5.00',
  nota_credito_debito: '  ',
  totale: '347.00',
};

describe('annoScolasticoDelMese', () => {
  it("da settembre a dicembre è l'anno che inizia quel settembre", () => {
    expect(annoScolasticoDelMese('2026-09')).toBe(2026);
    expect(annoScolasticoDelMese('2026-12')).toBe(2026);
  });

  it("da gennaio ad agosto è l'anno iniziato il settembre precedente", () => {
    expect(annoScolasticoDelMese('2027-01')).toBe(2026);
    expect(annoScolasticoDelMese('2027-06')).toBe(2026);
    expect(annoScolasticoDelMese('2027-07')).toBe(2026);
    expect(annoScolasticoDelMese('2027-08')).toBe(2026);
  });
});

describe('annoScolasticoRichiesto', () => {
  it("usa l'anno richiesto se valido e non oltre il riferimento", () => {
    expect(annoScolasticoRichiesto('2024', 2026)).toBe(2024);
    expect(annoScolasticoRichiesto('2026', 2026)).toBe(2026);
  });

  it('ricade sul riferimento se manca, non è valido o è nel futuro o assurdo', () => {
    for (const richiesto of [undefined, '', 'abc', '24', '20245', '2027', '1999', '2026-09']) {
      expect(annoScolasticoRichiesto(richiesto, 2026)).toBe(2026);
    }
  });
});

describe('mesiAnnoScolastico', () => {
  it('sono dieci, da settembre a giugno, in ordine', () => {
    expect(mesiAnnoScolastico(2026)).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
      '2027-05',
      '2027-06',
    ]);
  });
});

describe('etichettaAnnoScolastico', () => {
  it('scrive l\'anno scolastico come "AAAA/AAAA"', () => {
    expect(etichettaAnnoScolastico(2026)).toBe('2026/2027');
  });
});

describe('vociComunicazione', () => {
  it("restituisce le otto voci nell'ordine della tabella di Rette, con importi numerici", () => {
    const voci = vociComunicazione(base);
    expect(voci.map((v) => v.etichetta)).toEqual([
      'Retta mensile',
      'Marca da bollo',
      'Pasti',
      'Conguaglio pasti',
      'Pre-asilo',
      'Post-asilo',
      'Costi extra',
      'Credito/Debito',
    ]);
    expect(voci.map((v) => v.importo)).toEqual([250, 2, 66, -11, 30, 0, 15, -5]);
  });

  it('allega la nota solo a costi extra e credito/debito, ignorandola se vuota', () => {
    const voci = vociComunicazione(base);
    expect(voci.find((v) => v.etichetta === 'Costi extra')?.nota).toBe('Gita');
    expect(voci.find((v) => v.etichetta === 'Credito/Debito')?.nota).toBeNull();
    expect(voci.filter((v) => v.nota !== null).map((v) => v.etichetta)).toEqual(['Costi extra']);
  });
});

describe('totaleRichiesto', () => {
  it('somma i totali registrati (anche come stringhe) al centesimo', () => {
    expect(totaleRichiesto([{ totale: '250.10' }, { totale: 0.2 }, { totale: '-0.1' }])).toBe(250.2);
  });

  it('è 0 senza comunicazioni', () => {
    expect(totaleRichiesto([])).toBe(0);
  });
});
