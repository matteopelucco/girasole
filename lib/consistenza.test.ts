import { describe, expect, it } from 'vitest';
import { bambiniConIncoerenze, bambiniConIncoerenzeDaRighe, inconsistenzeGiorno } from './consistenza';

describe('inconsistenzeGiorno', () => {
  it('nessun problema per una riga vuota (non segnato)', () => {
    expect(inconsistenzeGiorno({})).toEqual([]);
  });

  it('nessun problema per un bambino presente senza pasto', () => {
    expect(inconsistenzeGiorno({ stato: 'presente' })).toEqual([]);
  });

  it('nessun problema per un bambino presente con pasto sì', () => {
    expect(inconsistenzeGiorno({ stato: 'presente', mangiato: 'si' })).toEqual([]);
  });

  it('nessun problema per un bambino assente con pasto no', () => {
    expect(inconsistenzeGiorno({ stato: 'assente', mangiato: 'no' })).toEqual([]);
  });

  it('nessun problema per un bambino assente senza pasto segnato', () => {
    expect(inconsistenzeGiorno({ stato: 'assente' })).toEqual([]);
  });

  it('segnala pasto "sì" con presenza assente', () => {
    expect(inconsistenzeGiorno({ stato: 'assente', mangiato: 'si' })).toEqual([
      'Pasto segnato "sì" ma il bambino risulta assente.',
    ]);
  });

  it('segnala pasto "sì" con presenza malattia', () => {
    expect(inconsistenzeGiorno({ stato: 'malattia', mangiato: 'si' })).toEqual([
      'Pasto segnato "sì" ma il bambino risulta malato.',
    ]);
  });

  it('segnala pre-asilo senza presenza (stato non presente)', () => {
    expect(inconsistenzeGiorno({ stato: 'assente', preAsilo: true })).toEqual([
      'Pre-asilo segnato ma il bambino non risulta presente.',
    ]);
  });

  it('segnala pre-asilo senza alcuno stato segnato', () => {
    expect(inconsistenzeGiorno({ preAsilo: true })).toEqual([
      'Pre-asilo segnato ma il bambino non risulta presente.',
    ]);
  });

  it('segnala post-asilo senza presenza', () => {
    expect(inconsistenzeGiorno({ stato: 'malattia', postAsilo: true })).toEqual([
      'Post-asilo segnato ma il bambino non risulta presente.',
    ]);
  });

  it('nessun problema per pre-asilo e post-asilo con presenza', () => {
    expect(inconsistenzeGiorno({ stato: 'presente', preAsilo: true, postAsilo: true })).toEqual([]);
  });

  it('accumula più problemi sulla stessa riga', () => {
    const problemi = inconsistenzeGiorno({
      stato: 'assente',
      preAsilo: true,
      postAsilo: true,
      mangiato: 'si',
    });
    expect(problemi).toHaveLength(3);
  });
});

describe('bambiniConIncoerenze (blocco della comunicazione pasti a Rojac, specs/16)', () => {
  const anna = { id: 'a', nome: 'Anna', cognome: 'Rossi' };
  const luca = { id: 'b', nome: 'Luca', cognome: 'Bianchi' };

  it('nessun bambino incoerente: elenco vuoto', () => {
    expect(
      bambiniConIncoerenze([
        { ...anna, stato: 'presente', mangiato: 'si' },
        { ...luca, stato: 'assente', mangiato: 'no' },
      ])
    ).toEqual([]);
  });

  it('un bambino assente con pasto sì: elencato con il motivo, gli altri esclusi', () => {
    expect(
      bambiniConIncoerenze([
        { ...anna, stato: 'presente', mangiato: 'si' },
        { ...luca, stato: 'assente', mangiato: 'si' },
      ])
    ).toEqual([{ ...luca, problemi: ['Pasto segnato "sì" ma il bambino risulta assente.'] }]);
  });

  it('un bambino malato con pasto sì: elencato', () => {
    expect(bambiniConIncoerenze([{ ...anna, stato: 'malattia', mangiato: 'si' }])).toEqual([
      { ...anna, problemi: ['Pasto segnato "sì" ma il bambino risulta malato.'] },
    ]);
  });

  it('un bambino senza presenza e senza pasto non è un\'incoerenza (è una presenza mancante, altro controllo)', () => {
    expect(bambiniConIncoerenze([{ ...anna }])).toEqual([]);
  });

  it('nessun bambino: elenco vuoto', () => {
    expect(bambiniConIncoerenze([])).toEqual([]);
  });
});

describe('bambiniConIncoerenzeDaRighe (righe grezze della RPC bambini_incoerenti_asilo)', () => {
  const anna = { id: 'a', nome: 'Anna', cognome: 'Rossi' };
  const luca = { id: 'b', nome: 'Luca', cognome: 'Bianchi' };

  it('nessuna riga: elenco vuoto', () => {
    expect(bambiniConIncoerenzeDaRighe([])).toEqual([]);
  });

  it('colonne null (nessuna presenza o nessun pasto) non producono incoerenze', () => {
    expect(
      bambiniConIncoerenzeDaRighe([
        { ...anna, stato: null, pre_asilo: null, post_asilo: null, mangiato: 'si' },
        { ...luca, stato: 'presente', pre_asilo: false, post_asilo: false, mangiato: null },
      ])
    ).toEqual([]);
  });

  it('pasto sì con presenza assente: elencato con il motivo', () => {
    expect(
      bambiniConIncoerenzeDaRighe([
        { ...anna, stato: 'presente', pre_asilo: false, post_asilo: false, mangiato: 'si' },
        { ...luca, stato: 'assente', pre_asilo: false, post_asilo: false, mangiato: 'si' },
      ])
    ).toEqual([{ ...luca, problemi: ['Pasto segnato "sì" ma il bambino risulta assente.'] }]);
  });

  it('pasto sì con presenza in malattia: elencato con il motivo', () => {
    expect(
      bambiniConIncoerenzeDaRighe([{ ...anna, stato: 'malattia', pre_asilo: false, post_asilo: false, mangiato: 'si' }])
    ).toEqual([{ ...anna, problemi: ['Pasto segnato "sì" ma il bambino risulta malato.'] }]);
  });

  it('pre-asilo senza presenza (stato null) è incoerente come nel controllo per riga', () => {
    expect(
      bambiniConIncoerenzeDaRighe([{ ...anna, stato: null, pre_asilo: true, post_asilo: false, mangiato: null }])
    ).toEqual([{ ...anna, problemi: ['Pre-asilo segnato ma il bambino non risulta presente.'] }]);
  });
});
