import { describe, expect, it } from 'vitest';
import {
  calcoloMensileMonteOre,
  meseDiCompetenza,
  meseDiMovimento,
  notaConfermaMese,
  nuovaVariazioneConferma,
  parteNonConfermata,
  puoConfermareMese,
} from './monteOreMensile';

// Tutte funzioni pure (nessun I/O): specs/19 - monte-ore.md, "calcolo
// mese per mese".

describe('meseDiMovimento', () => {
  it('usa il mese della data di registrazione nel fuso Europe/Rome', () => {
    expect(meseDiMovimento('2026-09-15T10:00:00Z')).toBe('2026-09');
    // 30 set 22:30 UTC = 1 ott 00:30 a Roma (CEST).
    expect(meseDiMovimento('2026-09-30T22:30:00Z')).toBe('2026-10');
  });
});

describe('calcoloMensileMonteOre', () => {
  it('senza ore né movimenti non ci sono righe', () => {
    expect(calcoloMensileMonteOre({ mesi: [], movimenti: [], meseCorrente: '2026-09' })).toEqual([]);
  });

  it('una riga per mese con previste, differenza, movimenti e saldo progressivo', () => {
    const righe = calcoloMensileMonteOre({
      mesi: [
        { mese: '2026-08', orePreviste: 140, differenza: 3 },
        { mese: '2026-09', orePreviste: 100, differenza: -2 },
      ],
      movimenti: [
        { variazione: -3, created_at: '2026-08-31T10:00:00Z' },
        { variazione: '1.50', created_at: '2026-09-10T10:00:00Z' },
      ],
      meseCorrente: '2026-09',
    });
    expect(righe).toEqual([
      { mese: '2026-08', orePreviste: 140, differenza: 3, movimenti: -3, saldo: -3 },
      { mese: '2026-09', orePreviste: 100, differenza: -2, movimenti: 1.5, saldo: -1.5 },
    ]);
  });

  it('il saldo non dipende dalla differenza: solo dai movimenti', () => {
    const righe = calcoloMensileMonteOre({
      mesi: [{ mese: '2026-09', orePreviste: 100, differenza: 10 }],
      movimenti: [],
      meseCorrente: '2026-09',
    });
    expect(righe[0].saldo).toBe(0);
  });

  it('riempie i mesi senza dati tra il primo e quello corrente', () => {
    const righe = calcoloMensileMonteOre({
      mesi: [{ mese: '2026-07', orePreviste: 10, differenza: 0 }],
      movimenti: [{ variazione: 5, created_at: '2026-07-02T10:00:00Z' }],
      meseCorrente: '2026-09',
    });
    expect(righe.map((r) => r.mese)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(righe[2]).toEqual({ mese: '2026-09', orePreviste: 0, differenza: 0, movimenti: 0, saldo: 5 });
  });

  it('un movimento in un mese senza ore crea comunque la riga', () => {
    const righe = calcoloMensileMonteOre({
      mesi: [{ mese: '2026-09', orePreviste: 100, differenza: 0 }],
      movimenti: [{ variazione: 8, created_at: '2026-06-15T10:00:00Z' }],
      meseCorrente: '2026-09',
    });
    expect(righe[0]).toMatchObject({ mese: '2026-06', movimenti: 8, saldo: 8 });
    expect(righe).toHaveLength(4);
  });

  it('ripulisce i residui della virgola mobile', () => {
    const righe = calcoloMensileMonteOre({
      mesi: [{ mese: '2026-09', orePreviste: 0, differenza: 0 }],
      movimenti: [
        { variazione: 0.1, created_at: '2026-09-01T10:00:00Z' },
        { variazione: 0.2, created_at: '2026-09-02T10:00:00Z' },
      ],
      meseCorrente: '2026-09',
    });
    expect(righe[0].movimenti).toBe(0.3);
    expect(righe[0].saldo).toBe(0.3);
  });
});

// --- Conferma del mese e mese di competenza (specs/19, MOR-01..MOR-10) ------
//
// API in lib/monteOreMensile.ts (pure, nessun I/O):
//   meseDiCompetenza({ created_at, mese_competenza? }): string  // 'AAAA-MM'
//   calcoloMensileMonteOre: i movimenti accettano anche `mese_competenza`
//     ('AAAA-MM-01' | null | assente) e contano nel mese di competenza.
//   parteNonConfermata({ differenza, movimenti }): number
//   puoConfermareMese({ mese, differenza, movimenti }, meseCorrente): boolean
//   nuovaVariazioneConferma(variazioneEsistente: number|string|null, parte): number
//   notaConfermaMese(mese: 'AAAA-MM', parte: number): string

describe('MOR-09: meseDiCompetenza', () => {
  it('usa il mese di competenza quando e\' valorizzato (data AAAA-MM-01)', () => {
    expect(meseDiCompetenza({ created_at: '2026-11-02T10:00:00Z', mese_competenza: '2026-10-01' })).toBe('2026-10');
  });

  it('senza competenza vale il mese della data di registrazione, nel fuso Europe/Rome', () => {
    expect(meseDiCompetenza({ created_at: '2026-09-15T10:00:00Z' })).toBe('2026-09');
    expect(meseDiCompetenza({ created_at: '2026-09-15T10:00:00Z', mese_competenza: null })).toBe('2026-09');
    // 30 set 22:30 UTC = 1 ott 00:30 a Roma.
    expect(meseDiCompetenza({ created_at: '2026-09-30T22:30:00Z', mese_competenza: null })).toBe('2026-10');
  });
});

describe('MOR-02, MOR-08, MOR-09: calcoloMensileMonteOre con mese di competenza', () => {
  const mesi = [
    { mese: '2026-10', orePreviste: 150, differenza: 14.5 },
    { mese: '2026-11', orePreviste: 20, differenza: 0 },
  ];

  it('un movimento registrato a novembre con competenza ottobre conta in ottobre', () => {
    const righe = calcoloMensileMonteOre({
      mesi,
      movimenti: [{ variazione: 14.5, created_at: '2026-11-02T10:00:00Z', mese_competenza: '2026-10-01' }],
      meseCorrente: '2026-11',
    });
    expect(righe).toEqual([
      { mese: '2026-10', orePreviste: 150, differenza: 14.5, movimenti: 14.5, saldo: 14.5 },
      { mese: '2026-11', orePreviste: 20, differenza: 0, movimenti: 0, saldo: 14.5 },
    ]);
  });

  it('i saldi a fine mese successivi sono cumulati per competenza', () => {
    const righe = calcoloMensileMonteOre({
      mesi,
      movimenti: [
        { variazione: 2, created_at: '2026-10-03T10:00:00Z', mese_competenza: '2026-10-01' },
        { variazione: 14.5, created_at: '2026-11-02T10:00:00Z', mese_competenza: '2026-10-01' },
        { variazione: -1, created_at: '2026-11-03T10:00:00Z', mese_competenza: '2026-11-01' },
      ],
      meseCorrente: '2026-11',
    });
    expect(righe.map((r) => [r.mese, r.movimenti, r.saldo])).toEqual([
      ['2026-10', 16.5, 16.5],
      ['2026-11', -1, 15.5],
    ]);
  });

  it('movimenti senza competenza valgono il mese di registrazione: calcolo identico a prima', () => {
    const conCompetenzaVuota = calcoloMensileMonteOre({
      mesi,
      movimenti: [
        { variazione: 3, created_at: '2026-10-03T10:00:00Z', mese_competenza: null },
        { variazione: 1, created_at: '2026-11-02T10:00:00Z' },
      ],
      meseCorrente: '2026-11',
    });
    const senzaCampo = calcoloMensileMonteOre({
      mesi,
      movimenti: [
        { variazione: 3, created_at: '2026-10-03T10:00:00Z' },
        { variazione: 1, created_at: '2026-11-02T10:00:00Z' },
      ],
      meseCorrente: '2026-11',
    });
    expect(conCompetenzaVuota).toEqual(senzaCampo);
    expect(conCompetenzaVuota.map((r) => r.movimenti)).toEqual([3, 1]);
  });

  it('un movimento con competenza in un mese senza ore crea comunque la riga di quel mese', () => {
    const righe = calcoloMensileMonteOre({
      mesi: [{ mese: '2026-11', orePreviste: 20, differenza: 0 }],
      movimenti: [{ variazione: 4, created_at: '2026-11-02T10:00:00Z', mese_competenza: '2026-09-01' }],
      meseCorrente: '2026-11',
    });
    expect(righe.map((r) => r.mese)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(righe[0]).toMatchObject({ movimenti: 4, saldo: 4 });
  });
});

describe('MOR-01, MOR-07: parteNonConfermata', () => {
  it('senza movimenti di competenza e\' tutta la differenza', () => {
    expect(parteNonConfermata({ differenza: 14.5, movimenti: 0 })).toBe(14.5);
    expect(parteNonConfermata({ differenza: -6, movimenti: 0 })).toBe(-6);
  });

  it('differenza meno la somma dei movimenti di competenza di qualunque tipo', () => {
    // Confermato +14,5 poi la differenza sale a +16,5: restano +2h.
    expect(parteNonConfermata({ differenza: 16.5, movimenti: 14.5 })).toBe(2);
    // La differenza scende a +12: -2,5h non confermate.
    expect(parteNonConfermata({ differenza: 12, movimenti: 14.5 })).toBe(-2.5);
  });

  it('MOR-08: un movimento manuale con competenza quel mese copre la differenza', () => {
    expect(parteNonConfermata({ differenza: 14.5, movimenti: 14.5 })).toBe(0);
  });

  it('arrotonda a 2 decimali e non restituisce mai -0', () => {
    expect(parteNonConfermata({ differenza: 0.3, movimenti: 0.1 + 0.2 })).toBe(0);
    expect(Object.is(parteNonConfermata({ differenza: 0, movimenti: 0 }), 0)).toBe(true);
    expect(parteNonConfermata({ differenza: 0.3, movimenti: 0.1 })).toBe(0.2);
  });
});

describe('MOR-01, MOR-04: puoConfermareMese', () => {
  const riga = { mese: '2026-10', differenza: 14.5, movimenti: 0 };

  it('mese chiuso con parte non confermata diversa da zero: si', () => {
    expect(puoConfermareMese(riga, '2026-11')).toBe(true);
    expect(puoConfermareMese({ ...riga, differenza: -6 }, '2026-11')).toBe(true);
    expect(puoConfermareMese({ ...riga, differenza: 16.5, movimenti: 14.5 }, '2026-11')).toBe(true);
  });

  it('mese in corso o futuro: no', () => {
    expect(puoConfermareMese(riga, '2026-10')).toBe(false);
    expect(puoConfermareMese(riga, '2026-09')).toBe(false);
  });

  it('parte non confermata zero (differenza zero o gia\' coperta): no', () => {
    expect(puoConfermareMese({ ...riga, differenza: 0 }, '2026-11')).toBe(false);
    expect(puoConfermareMese({ ...riga, movimenti: 14.5 }, '2026-11')).toBe(false);
  });
});

describe('MOR-06, MOR-07: nuovaVariazioneConferma', () => {
  it('senza conferma esistente la variazione e\' la parte non confermata', () => {
    expect(nuovaVariazioneConferma(null, 14.5)).toBe(14.5);
    expect(nuovaVariazioneConferma(null, -6)).toBe(-6);
  });

  it('con conferma esistente la parte si somma alla sua variazione (una sola conferma per mese)', () => {
    expect(nuovaVariazioneConferma(14.5, 2)).toBe(16.5);
    expect(nuovaVariazioneConferma('14.50', -2.5)).toBe(12);
    expect(nuovaVariazioneConferma(0.1, 0.2)).toBe(0.3);
  });
});

describe('MOR-02, MOR-03: notaConfermaMese', () => {
  it('nota automatica non vuota con mese e anno', () => {
    expect(notaConfermaMese('2026-10', 14.5)).toMatch(/^Conferma differenza ore di ottobre 2026/);
  });

  it('per una parte negativa dice "da recuperare", non solo il segno', () => {
    expect(notaConfermaMese('2026-09', -6)).toContain('settembre 2026');
    expect(notaConfermaMese('2026-09', -6)).toContain('da recuperare');
  });
});

// MOR-06 (doppio click / due admin) e il rifiuto di un non admin o di un mese
// non chiuso (MOR-04, lato server) non si provano in e2e: indice unico
// parziale e RLS sono in supabase/tests/database/monte_ore_conferma_mese.test.sql;
// "il valore lo calcola il server una volta sola" e' nelle funzioni pure qui sopra.
