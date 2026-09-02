import { describe, expect, it } from 'vitest';
import {
  dopoOrarioAllarmePresenzePasti,
  dopoSogliaVenerdiSera,
  settimanaDiRiferimentoOre,
  allarmeAsiloAttivo,
  allarmePersonalePresenzePastiAttivo,
  descrizioneStatoOperativo,
  type StatoOperativoGiorno,
  type StatoPersonaleGiorno,
} from './allarmi';

// Solo le funzioni pure di questo modulo (nessun I/O) — vedi CLAUDE.md,
// criterio unit test: calcolaStatoOperativoGiorno/
// calcolaStatoPersonaleGiorno/settimanaConfermata/
// utentiConSettimanaNonConfermata/allarmiPerDipendenti fanno query
// Supabase, coperte solo da e2e.

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

function statoAsilo(sovrascrizioni: Partial<StatoOperativoGiorno> = {}): StatoOperativoGiorno {
  return { nessunDatoAtteso: false, presenzeIncomplete: false, pastiNonConfermati: false, ...sovrascrizioni };
}

const DIECI_INVERNO = new Date('2026-01-15T09:00:00Z');
const MATTINA_PRESTO_INVERNO = new Date('2026-01-15T07:00:00Z');

describe('allarmeAsiloAttivo', () => {
  it('falso prima delle 10:00, anche con presenze/pasti mancanti', () => {
    expect(allarmeAsiloAttivo(MATTINA_PRESTO_INVERNO, true, statoAsilo({ presenzeIncomplete: true }))).toBe(false);
  });

  it('falso se il giorno non è attivo (chiuso), anche dopo le 10:00', () => {
    expect(allarmeAsiloAttivo(DIECI_INVERNO, false, statoAsilo({ presenzeIncomplete: true }))).toBe(false);
  });

  it('falso se non ci sono classi/bambini attivi', () => {
    expect(allarmeAsiloAttivo(DIECI_INVERNO, true, statoAsilo({ nessunDatoAtteso: true }))).toBe(false);
  });

  it('falso dopo le 10:00 se tutto è completo', () => {
    expect(allarmeAsiloAttivo(DIECI_INVERNO, true, statoAsilo())).toBe(false);
  });

  it('vero dopo le 10:00 con presenze incomplete', () => {
    expect(allarmeAsiloAttivo(DIECI_INVERNO, true, statoAsilo({ presenzeIncomplete: true }))).toBe(true);
  });

  it('vero dopo le 10:00 con pasti non confermati', () => {
    expect(allarmeAsiloAttivo(DIECI_INVERNO, true, statoAsilo({ pastiNonConfermati: true }))).toBe(true);
  });
});

describe('descrizioneStatoOperativo', () => {
  it('stringa vuota se tutto è a posto', () => {
    expect(descrizioneStatoOperativo(statoAsilo())).toBe('');
  });

  it('menziona solo le presenze se solo quelle mancano', () => {
    const descrizione = descrizioneStatoOperativo(statoAsilo({ presenzeIncomplete: true }));
    expect(descrizione).toContain('presenze');
    expect(descrizione).not.toContain('pasti');
  });

  it('menziona solo i pasti se solo quelli mancano', () => {
    const descrizione = descrizioneStatoOperativo(statoAsilo({ pastiNonConfermati: true }));
    expect(descrizione).toContain('pasti');
    expect(descrizione).not.toContain('presenze');
  });

  it('menziona entrambi se entrambi mancano', () => {
    const descrizione = descrizioneStatoOperativo(statoAsilo({ presenzeIncomplete: true, pastiNonConfermati: true }));
    expect(descrizione).toContain('presenze');
    expect(descrizione).toContain('pasti');
  });
});

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
