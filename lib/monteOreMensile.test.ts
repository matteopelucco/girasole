import { describe, expect, it } from 'vitest';
import { calcoloMensileMonteOre, meseDiMovimento } from './monteOreMensile';

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
