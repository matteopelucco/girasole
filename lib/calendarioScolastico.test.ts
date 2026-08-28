import { describe, expect, it } from 'vitest';
import { isGiornoChiuso, messaggioChiusura, trovaChiusura, type GiornoChiusura } from './calendarioScolastico';

const VACANZE_NATALE: GiornoChiusura = {
  id: '1',
  dataInizio: '2026-12-23',
  dataFine: '2027-01-06',
  nota: 'Vacanze di Natale',
};
const PONTE_SENZA_NOTA: GiornoChiusura = {
  id: '2',
  dataInizio: '2026-11-02',
  dataFine: '2026-11-02',
  nota: null,
};

describe('trovaChiusura', () => {
  it('trova la chiusura che copre la data', () => {
    expect(trovaChiusura('2026-12-25', [VACANZE_NATALE])).toEqual(VACANZE_NATALE);
  });

  it('include gli estremi dell\'intervallo', () => {
    expect(trovaChiusura('2026-12-23', [VACANZE_NATALE])).toEqual(VACANZE_NATALE);
    expect(trovaChiusura('2027-01-06', [VACANZE_NATALE])).toEqual(VACANZE_NATALE);
  });

  it('restituisce null se nessuna chiusura copre la data', () => {
    expect(trovaChiusura('2026-12-22', [VACANZE_NATALE])).toBeNull();
    expect(trovaChiusura('2027-01-07', [VACANZE_NATALE])).toBeNull();
  });

  it('funziona con un intervallo di un solo giorno', () => {
    expect(trovaChiusura('2026-11-02', [PONTE_SENZA_NOTA])).toEqual(PONTE_SENZA_NOTA);
    expect(trovaChiusura('2026-11-01', [PONTE_SENZA_NOTA])).toBeNull();
  });

  it('restituisce null con un elenco vuoto', () => {
    expect(trovaChiusura('2026-12-25', [])).toBeNull();
  });
});

describe('isGiornoChiuso', () => {
  it('è vero dentro un giorno di chiusura registrato', () => {
    expect(isGiornoChiuso('2026-12-25', [VACANZE_NATALE])).toBe(true);
  });

  it('è vero di sabato/domenica anche senza nessuna chiusura registrata', () => {
    expect(isGiornoChiuso('2026-08-29', [])).toBe(true); // sabato
    expect(isGiornoChiuso('2026-08-30', [])).toBe(true); // domenica
  });

  it('è falso un giorno feriale fuori da ogni chiusura', () => {
    expect(isGiornoChiuso('2026-08-28', [VACANZE_NATALE])).toBe(false);
  });

  it('un weekend dentro un intervallo di chiusura resta chiuso (nessuna doppia negazione)', () => {
    // 2026-12-26 è un sabato, comunque dentro VACANZE_NATALE.
    expect(isGiornoChiuso('2026-12-26', [VACANZE_NATALE])).toBe(true);
  });
});

describe('messaggioChiusura', () => {
  it('mostra la nota quando presente', () => {
    expect(messaggioChiusura('2026-12-25', [VACANZE_NATALE])).toBe(
      'Giorno di chiusura scolastica: Vacanze di Natale.'
    );
  });

  it('mostra un messaggio generico quando la nota è assente', () => {
    expect(messaggioChiusura('2026-11-02', [PONTE_SENZA_NOTA])).toBe('Giorno di chiusura scolastica.');
  });

  it('mostra il messaggio di weekend quando non c\'è una chiusura registrata', () => {
    expect(messaggioChiusura('2026-08-29', [])).toBe(
      "L'asilo è chiuso: sabato e domenica non è possibile registrare presenze o pasti."
    );
  });

  it('preferisce la chiusura registrata al messaggio di weekend generico se entrambi si applicano', () => {
    expect(messaggioChiusura('2026-12-26', [VACANZE_NATALE])).toBe(
      'Giorno di chiusura scolastica: Vacanze di Natale.'
    );
  });

  it('restituisce null per un giorno feriale scrivibile', () => {
    expect(messaggioChiusura('2026-08-28', [VACANZE_NATALE])).toBeNull();
  });
});
