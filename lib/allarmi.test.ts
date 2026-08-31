import { describe, expect, it } from 'vitest';
import {
  dopoMezzogiorno,
  allarmeMezzogiornoAttivo,
  descrizioneStatoOperativo,
  type StatoOperativoGiorno,
} from './allarmi';

// Solo le funzioni pure di questo modulo (nessun I/O) — vedi CLAUDE.md,
// criterio unit test: calcolaStatoOperativoGiorno/
// settimanaPrecedenteConfermata/utentiConSettimanaNonConfermata fanno
// query Supabase, coperte solo da e2e.

// Un istante alle 12:00 Europe/Rome corrisponde a 11:00 UTC in inverno
// (CET, UTC+1) e 10:00 UTC in estate (CEST, UTC+2).
describe('dopoMezzogiorno', () => {
  it('vero esattamente a mezzogiorno (inverno, CET)', () => {
    expect(dopoMezzogiorno(new Date('2026-01-15T11:00:00Z'))).toBe(true);
  });

  it('falso un minuto prima di mezzogiorno (inverno, CET)', () => {
    expect(dopoMezzogiorno(new Date('2026-01-15T10:59:00Z'))).toBe(false);
  });

  it('vero dopo mezzogiorno in estate (CEST, UTC+2)', () => {
    expect(dopoMezzogiorno(new Date('2026-07-15T10:00:00Z'))).toBe(true);
  });

  it('falso prima di mezzogiorno in estate (CEST, UTC+2)', () => {
    expect(dopoMezzogiorno(new Date('2026-07-15T09:59:00Z'))).toBe(false);
  });

  it('vero nel tardo pomeriggio', () => {
    expect(dopoMezzogiorno(new Date('2026-01-15T18:00:00Z'))).toBe(true);
  });
});

function stato(sovrascrizioni: Partial<StatoOperativoGiorno> = {}): StatoOperativoGiorno {
  return { nessunDatoAtteso: false, presenzeIncomplete: false, pastiNonConfermati: false, ...sovrascrizioni };
}

const MEZZOGIORNO_INVERNO = new Date('2026-01-15T11:00:00Z');
const MATTINA_INVERNO = new Date('2026-01-15T09:00:00Z');

describe('allarmeMezzogiornoAttivo', () => {
  it('falso prima di mezzogiorno, anche con presenze/pasti mancanti', () => {
    expect(allarmeMezzogiornoAttivo(MATTINA_INVERNO, true, stato({ presenzeIncomplete: true }))).toBe(false);
  });

  it('falso se il giorno non è attivo (chiuso), anche dopo mezzogiorno', () => {
    expect(allarmeMezzogiornoAttivo(MEZZOGIORNO_INVERNO, false, stato({ presenzeIncomplete: true }))).toBe(false);
  });

  it('falso se non ci sono classi/bambini attivi', () => {
    expect(allarmeMezzogiornoAttivo(MEZZOGIORNO_INVERNO, true, stato({ nessunDatoAtteso: true }))).toBe(false);
  });

  it('falso dopo mezzogiorno se tutto è completo', () => {
    expect(allarmeMezzogiornoAttivo(MEZZOGIORNO_INVERNO, true, stato())).toBe(false);
  });

  it('vero dopo mezzogiorno con presenze incomplete', () => {
    expect(allarmeMezzogiornoAttivo(MEZZOGIORNO_INVERNO, true, stato({ presenzeIncomplete: true }))).toBe(true);
  });

  it('vero dopo mezzogiorno con pasti non confermati', () => {
    expect(allarmeMezzogiornoAttivo(MEZZOGIORNO_INVERNO, true, stato({ pastiNonConfermati: true }))).toBe(true);
  });

  it('vero dopo mezzogiorno con entrambi mancanti', () => {
    expect(
      allarmeMezzogiornoAttivo(MEZZOGIORNO_INVERNO, true, stato({ presenzeIncomplete: true, pastiNonConfermati: true }))
    ).toBe(true);
  });
});

describe('descrizioneStatoOperativo', () => {
  it('stringa vuota se tutto è a posto', () => {
    expect(descrizioneStatoOperativo(stato())).toBe('');
  });

  it('menziona solo le presenze se solo quelle mancano', () => {
    const descrizione = descrizioneStatoOperativo(stato({ presenzeIncomplete: true }));
    expect(descrizione).toContain('presenze');
    expect(descrizione).not.toContain('pasti');
  });

  it('menziona solo i pasti se solo quelli mancano', () => {
    const descrizione = descrizioneStatoOperativo(stato({ pastiNonConfermati: true }));
    expect(descrizione).toContain('pasti');
    expect(descrizione).not.toContain('presenze');
  });

  it('menziona entrambi se entrambi mancano', () => {
    const descrizione = descrizioneStatoOperativo(stato({ presenzeIncomplete: true, pastiNonConfermati: true }));
    expect(descrizione).toContain('presenze');
    expect(descrizione).toContain('pasti');
  });
});
