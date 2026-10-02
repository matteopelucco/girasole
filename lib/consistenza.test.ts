import { describe, expect, it } from 'vitest';
import { bambiniConIncoerenze, inconsistenzeGiorno } from './consistenza';

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
