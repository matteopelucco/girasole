import { describe, expect, it } from 'vitest';
import {
  dopoOrarioAllarmePresenzePasti,
  dopoSogliaVenerdiSera,
  settimanaDiRiferimentoOre,
  allarmePersonalePresenzePastiAttivo,
  sezioniIncompleteDa,
  statoPersonaleDa,
  allarmiDipendentiDa,
  type DatiPersonale,
  type PresenzeOggi,
  type StatoPersonaleGiorno,
} from './allarmi';

// Solo le funzioni pure di questo modulo (nessun I/O) — vedi CLAUDE.md,
// criterio unit test: calcolaStatoOperativoGiorno/leggiPresenzeOggi/
// leggiDatiPersonale/settimanaConfermata/utentiConSettimanaNonConfermata
// fanno query Supabase, coperte solo da e2e.

// Un istante alle 10:00 Europe/Rome corrisponde a 09:00 UTC in inverno
// (CET, UTC+1) e 08:00 UTC in estate (CEST, UTC+2).
describe('dopoOrarioAllarmePresenzePasti', () => {
  it('vero esattamente alle 10:00 (inverno, CET)', () => {
    expect(dopoOrarioAllarmePresenzePasti(new Date('2026-01-15T09:00:00Z'))).toBe(true);
  });

  it('falso un minuto prima delle 10:00 (inverno, CET)', () => {
    expect(dopoOrarioAllarmePresenzePasti(new Date('2026-01-15T08:59:00Z'))).toBe(false);
  });

  it('vero dopo le 10:00 in estate (CEST, UTC+2)', () => {
    expect(dopoOrarioAllarmePresenzePasti(new Date('2026-07-15T08:00:00Z'))).toBe(true);
  });

  it('falso prima delle 10:00 in estate (CEST, UTC+2)', () => {
    expect(dopoOrarioAllarmePresenzePasti(new Date('2026-07-15T07:59:00Z'))).toBe(false);
  });

  it('vero nel tardo pomeriggio', () => {
    expect(dopoOrarioAllarmePresenzePasti(new Date('2026-01-15T18:00:00Z'))).toBe(true);
  });
});

// 2026-08-28 è un venerdì; 2026-08-29 sabato; 2026-08-30 domenica;
// 2026-08-31 lunedì. Alle 18:00 Europe/Rome in agosto (CEST) sono le
// 16:00 UTC.
describe('dopoSogliaVenerdiSera', () => {
  it('falso venerdì prima delle 18:00', () => {
    expect(dopoSogliaVenerdiSera(new Date('2026-08-28T15:59:00Z'))).toBe(false);
  });

  it('vero venerdì esattamente alle 18:00', () => {
    expect(dopoSogliaVenerdiSera(new Date('2026-08-28T16:00:00Z'))).toBe(true);
  });

  it('vero venerdì sera tardi', () => {
    expect(dopoSogliaVenerdiSera(new Date('2026-08-28T21:30:00Z'))).toBe(true);
  });

  it('vero tutto il sabato', () => {
    expect(dopoSogliaVenerdiSera(new Date('2026-08-29T08:00:00Z'))).toBe(true);
  });

  it('vero tutta la domenica', () => {
    expect(dopoSogliaVenerdiSera(new Date('2026-08-30T20:00:00Z'))).toBe(true);
  });

  it('falso lunedì mattina (nuova settimana, prima del venerdì successivo)', () => {
    expect(dopoSogliaVenerdiSera(new Date('2026-08-31T08:00:00Z'))).toBe(false);
  });

  it('falso mercoledì', () => {
    expect(dopoSogliaVenerdiSera(new Date('2026-09-02T10:00:00Z'))).toBe(false);
  });
});

describe('settimanaDiRiferimentoOre', () => {
  it('prima di venerdì 18:00 restituisce la settimana precedente', () => {
    // Mercoledì 2026-09-02, settimana corrente 31 ago - 6 set.
    expect(settimanaDiRiferimentoOre(new Date('2026-09-02T10:00:00Z'), '2026-09-02')).toEqual({
      inizio: '2026-08-24',
      fine: '2026-08-30',
    });
  });

  it('da venerdì 18:00 in poi restituisce la settimana corrente', () => {
    // Venerdì 2026-08-28 ore 19:30 Europe/Rome (17:30 UTC in CEST).
    expect(settimanaDiRiferimentoOre(new Date('2026-08-28T17:30:00Z'), '2026-08-28')).toEqual({
      inizio: '2026-08-24',
      fine: '2026-08-30',
    });
  });

  it('nel weekend resta la settimana corrente (quella appena finita di venerdì)', () => {
    // Domenica 2026-08-30.
    expect(settimanaDiRiferimentoOre(new Date('2026-08-30T10:00:00Z'), '2026-08-30')).toEqual({
      inizio: '2026-08-24',
      fine: '2026-08-30',
    });
  });
});

const DIECI_INVERNO = new Date('2026-01-15T09:00:00Z');
const MATTINA_PRESTO_INVERNO = new Date('2026-01-15T07:00:00Z');

function statoPersonale(sovrascrizioni: Partial<StatoPersonaleGiorno> = {}): StatoPersonaleGiorno {
  return { sezioniPresenzeIncomplete: [], pastiNonConfermati: false, ...sovrascrizioni };
}

const SEZIONE_GIRASOLI = { id: 'sez-1', nome: 'Girasoli' };

describe('allarmePersonalePresenzePastiAttivo', () => {
  it('falso prima delle 10:00, anche con sezioni incomplete', () => {
    expect(
      allarmePersonalePresenzePastiAttivo(
        MATTINA_PRESTO_INVERNO,
        true,
        statoPersonale({ sezioniPresenzeIncomplete: [SEZIONE_GIRASOLI] })
      )
    ).toBe(false);
  });

  it('falso se il giorno non è attivo, anche dopo le 10:00', () => {
    expect(
      allarmePersonalePresenzePastiAttivo(DIECI_INVERNO, false, statoPersonale({ pastiNonConfermati: true }))
    ).toBe(false);
  });

  it('falso dopo le 10:00 se non manca nulla (nessuna sezione, nessun pasto da confermare)', () => {
    expect(allarmePersonalePresenzePastiAttivo(DIECI_INVERNO, true, statoPersonale())).toBe(false);
  });

  it('vero dopo le 10:00 con almeno una sezione con presenze incomplete', () => {
    expect(
      allarmePersonalePresenzePastiAttivo(
        DIECI_INVERNO,
        true,
        statoPersonale({ sezioniPresenzeIncomplete: [SEZIONE_GIRASOLI] })
      )
    ).toBe(true);
  });

  it('vero dopo le 10:00 con pasti non confermati', () => {
    expect(allarmePersonalePresenzePastiAttivo(DIECI_INVERNO, true, statoPersonale({ pastiNonConfermati: true }))).toBe(
      true
    );
  });
});

describe('sezioniIncompleteDa', () => {
  const bambini = [
    { id: 'b1', sezione_id: 'sez-1' },
    { id: 'b2', sezione_id: 'sez-1' },
    { id: 'b3', sezione_id: 'sez-2' },
  ];

  it('nessuna sezione se tutti i bambini hanno la presenza', () => {
    expect(sezioniIncompleteDa(bambini, ['b1', 'b2', 'b3'])).toEqual(new Set());
  });

  it('la sezione di ogni bambino senza presenza, una volta sola', () => {
    expect(sezioniIncompleteDa(bambini, ['b3'])).toEqual(new Set(['sez-1']));
  });

  it('nessuna sezione se non ci sono bambini', () => {
    expect(sezioniIncompleteDa([], [])).toEqual(new Set());
  });
});

const SEZIONE_TULIPANI = { id: 'sez-2', nome: 'Tulipani' };

function presenzeOggi(sovrascrizioni: Partial<PresenzeOggi> = {}): PresenzeOggi {
  return {
    sezioni: [SEZIONE_GIRASOLI, SEZIONE_TULIPANI],
    idSezioniIncomplete: new Set(),
    pastiNonConfermati: false,
    ...sovrascrizioni,
  };
}

describe('statoPersonaleDa', () => {
  it('solo le sezioni con presenze incomplete, nell\'ordine delle sezioni', () => {
    expect(statoPersonaleDa(presenzeOggi({ idSezioniIncomplete: new Set(['sez-2', 'sez-1']) }))).toEqual({
      sezioniPresenzeIncomplete: [SEZIONE_GIRASOLI, SEZIONE_TULIPANI],
      pastiNonConfermati: false,
    });
  });

  it('riporta i pasti non confermati', () => {
    expect(statoPersonaleDa(presenzeOggi({ pastiNonConfermati: true }))).toEqual({
      sezioniPresenzeIncomplete: [],
      pastiNonConfermati: true,
    });
  });
});

const SETTIMANA = { inizio: '2026-01-12', fine: '2026-01-18' };

function datiPersonale(sovrascrizioni: Partial<DatiPersonale> = {}): DatiPersonale {
  return {
    dipendenti: [
      { id: 'm1', nome: 'Anna', cognome: 'Rossi', ruolo: 'maestra', abilitato_ore_lavoro: true },
      { id: 'a1', nome: 'Bea', cognome: 'Verdi', ruolo: 'assistente', abilitato_ore_lavoro: false },
    ],
    assegnazioni: [
      { maestraId: 'm1', sezione: { ...SEZIONE_GIRASOLI, attiva: true } },
      { maestraId: 'a1', sezione: { ...SEZIONE_TULIPANI, attiva: true } },
    ],
    idSettimanaConfermata: new Set(['m1']),
    ...sovrascrizioni,
  };
}

describe('allarmiDipendentiDa', () => {
  it('nessuna riga se nessuno è in allarme', () => {
    expect(allarmiDipendentiDa(datiPersonale(), presenzeOggi(), SETTIMANA)).toEqual([]);
  });

  it('presenze incomplete solo nelle sezioni attive di ciascuno', () => {
    const dati = datiPersonale({
      assegnazioni: [
        { maestraId: 'm1', sezione: { ...SEZIONE_GIRASOLI, attiva: true } },
        { maestraId: 'a1', sezione: { ...SEZIONE_TULIPANI, attiva: false } },
      ],
    });
    expect(
      allarmiDipendentiDa(dati, presenzeOggi({ idSezioniIncomplete: new Set(['sez-1', 'sez-2']) }), SETTIMANA)
    ).toEqual([
      {
        utenteId: 'm1',
        nome: 'Anna',
        cognome: 'Rossi',
        sezioniPresenzeIncomplete: ['Girasoli'],
        pastiNonConfermati: false,
        settimanaOreNonConfermata: null,
      },
    ]);
  });

  it('pasti non comunicati solo per chi ha sezioni e non è assistente', () => {
    const dati = datiPersonale({
      dipendenti: [
        ...datiPersonale().dipendenti,
        { id: 'm2', nome: 'Carla', cognome: 'Bianchi', ruolo: 'maestra', abilitato_ore_lavoro: false },
      ],
    });
    expect(allarmiDipendentiDa(dati, presenzeOggi({ pastiNonConfermati: true }), SETTIMANA)).toEqual([
      {
        utenteId: 'm1',
        nome: 'Anna',
        cognome: 'Rossi',
        sezioniPresenzeIncomplete: [],
        pastiNonConfermati: true,
        settimanaOreNonConfermata: null,
      },
    ]);
  });

  it('senza dati di presenze (prima delle 10:00 o giorno chiuso) conta solo la settimana ore', () => {
    const dati = datiPersonale({ idSettimanaConfermata: new Set() });
    expect(allarmiDipendentiDa(dati, null, SETTIMANA)).toEqual([
      {
        utenteId: 'm1',
        nome: 'Anna',
        cognome: 'Rossi',
        sezioniPresenzeIncomplete: [],
        pastiNonConfermati: false,
        settimanaOreNonConfermata: SETTIMANA,
      },
    ]);
  });
});
