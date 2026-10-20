import { describe, expect, it } from 'vitest';
import {
  descrizioneMeseRojac,
  hrefReportRojac,
  MESE_PARTENZA_ROJAC,
  meseRojacConta,
  mesiRojacDaAvvisare,
  mesiRojacDaControllare,
  mesiRojacMancanti,
} from './allarmeRojac';
import type { GiornoChiusura } from './calendarioScolastico';

const chiusura = (dataInizio: string, dataFine: string): GiornoChiusura => ({
  id: `${dataInizio}_${dataFine}`,
  dataInizio,
  dataFine,
  nota: null,
});

describe('mesiRojacDaControllare', () => {
  it('il mese di partenza è quello del rilascio', () => {
    expect(MESE_PARTENZA_ROJAC).toBe('2026-10');
  });

  it('nel mese di partenza non scatta niente, nemmeno l\'ultimo giorno', () => {
    expect(mesiRojacDaControllare('2026-10-20')).toEqual([]);
    expect(mesiRojacDaControllare('2026-10-31')).toEqual([]);
  });

  it('dal primo giorno del mese dopo il mese di partenza è da controllare', () => {
    expect(mesiRojacDaControllare('2026-11-01')).toEqual(['2026-10']);
    expect(mesiRojacDaControllare('2026-11-30')).toEqual(['2026-10']);
  });

  it('il mese corrente non è mai incluso, quelli conclusi sì, dal più vecchio', () => {
    expect(mesiRojacDaControllare('2027-01-02')).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('attraversa il cambio di anno', () => {
    expect(mesiRojacDaControllare('2027-02-10')).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
  });

  it('prima del mese di partenza non c\'è niente da controllare', () => {
    expect(mesiRojacDaControllare('2026-09-15')).toEqual([]);
    expect(mesiRojacDaControllare('2025-12-01')).toEqual([]);
  });

  it('accetta un mese di partenza diverso (parametro)', () => {
    expect(mesiRojacDaControllare('2026-03-05', '2026-01')).toEqual(['2026-01', '2026-02']);
  });
});

describe('meseRojacConta', () => {
  it('conta se ha almeno un giorno di scuola aperto', () => {
    expect(meseRojacConta({ haPastiComunicati: false, mese: '2026-11', chiusure: [] })).toBe(true);
  });

  it('conta se ha pasti comunicati anche se è interamente chiuso', () => {
    const chiusure = [chiusura('2026-08-01', '2026-08-31')];
    expect(meseRojacConta({ haPastiComunicati: true, mese: '2026-08', chiusure })).toBe(true);
  });

  it('non conta senza pasti e senza giorni di scuola aperti', () => {
    const chiusure = [chiusura('2026-08-01', '2026-08-31')];
    expect(meseRojacConta({ haPastiComunicati: false, mese: '2026-08', chiusure })).toBe(false);
  });
});

describe('mesiRojacMancanti', () => {
  const base = { mesiDaControllare: ['2026-10', '2026-11', '2026-12'], chiusure: [] as GiornoChiusura[] };

  it('elenca i mesi senza invio, dal più vecchio', () => {
    expect(mesiRojacMancanti({ ...base, mesiInviati: [], mesiConPastiComunicati: [] })).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
  });

  it('un mese con una riga nel registro non è mancante', () => {
    expect(mesiRojacMancanti({ ...base, mesiInviati: ['2026-11'], mesiConPastiComunicati: [] })).toEqual([
      '2026-10',
      '2026-12',
    ]);
  });

  it('più invii dello stesso mese non cambiano nulla', () => {
    expect(
      mesiRojacMancanti({ ...base, mesiInviati: ['2026-10', '2026-10', '2026-11', '2026-12'], mesiConPastiComunicati: [] })
    ).toEqual([]);
  });

  it('un mese interamente chiuso e senza pasti non conta', () => {
    const chiusure = [chiusura('2026-12-01', '2026-12-31')];
    expect(mesiRojacMancanti({ ...base, chiusure, mesiInviati: [], mesiConPastiComunicati: [] })).toEqual([
      '2026-10',
      '2026-11',
    ]);
  });

  it('un mese interamente chiuso ma con pasti comunicati conta', () => {
    const chiusure = [chiusura('2026-12-01', '2026-12-31')];
    expect(
      mesiRojacMancanti({ ...base, chiusure, mesiInviati: ['2026-10', '2026-11'], mesiConPastiComunicati: ['2026-12'] })
    ).toEqual(['2026-12']);
  });

  it('nessun mese da controllare, nessun mese mancante', () => {
    expect(mesiRojacMancanti({ ...base, mesiDaControllare: [], mesiInviati: [], mesiConPastiComunicati: [] })).toEqual(
      []
    );
  });
});

describe('mesiRojacDaAvvisare', () => {
  it('tutti i mesi mancanti se nessuno è stato avvisato', () => {
    expect(mesiRojacDaAvvisare(['2026-10', '2026-11'], [])).toEqual(['2026-10', '2026-11']);
  });

  it('esclude i mesi già avvisati: una sola email per mese', () => {
    expect(mesiRojacDaAvvisare(['2026-10', '2026-11'], ['2026-10'])).toEqual(['2026-11']);
  });

  it('nessun mese da avvisare se sono già stati avvisati tutti', () => {
    expect(mesiRojacDaAvvisare(['2026-10'], ['2026-10', '2026-09'])).toEqual([]);
  });

  it('un mese avvisato ma ora non più mancante (invio registrato) non compare', () => {
    expect(mesiRojacDaAvvisare([], ['2026-10'])).toEqual([]);
  });
});

describe('testi e link', () => {
  it('il link porta al Report mensile del mese', () => {
    expect(hrefReportRojac('2026-10')).toBe('/dashboard/report?tipo=mensile&periodo=2026-10');
  });

  it('descrive il mese in italiano', () => {
    expect(descrizioneMeseRojac('2026-10')).toBe('ottobre 2026');
  });
});
