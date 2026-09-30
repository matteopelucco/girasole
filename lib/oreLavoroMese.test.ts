import { describe, expect, it } from 'vitest';
import {
  meseOreLavoroRichiesto,
  righeMeseOreLavoro,
  riepilogoMeseOreLavoro,
  settimaneDelMese,
  type GiornoSalvatoOreLavoro,
} from './oreLavoroMese';
import type { GiornoChiusura } from './calendarioScolastico';

// Tutte funzioni pure (nessun I/O): specs/18 - report-ore-lavoro.md,
// vista mensile dell'admin.

const OGGI = '2026-09-16'; // mercoledì

const profilo = {
  ore_lunedi: 7,
  ore_martedi: 7,
  ore_mercoledi: 7,
  ore_giovedi: 7,
  ore_venerdi: 4,
};

function salvato(sovrascrizioni: Partial<GiornoSalvatoOreLavoro> & { data: string }): GiornoSalvatoOreLavoro {
  return {
    stato: 'lavorativo',
    ore_ordinarie: 7,
    ore_straordinarie: 0,
    motivo_straordinario: null,
    codice_malattia: null,
    nota_assenza: null,
    ...sovrascrizioni,
  };
}

describe('meseOreLavoroRichiesto', () => {
  it('accetta un mese valido passato o corrente', () => {
    expect(meseOreLavoroRichiesto('2026-08', OGGI)).toBe('2026-08');
    expect(meseOreLavoroRichiesto('2026-09', OGGI)).toBe('2026-09');
  });

  it('un mese futuro diventa il mese corrente', () => {
    expect(meseOreLavoroRichiesto('2026-10', OGGI)).toBe('2026-09');
    expect(meseOreLavoroRichiesto('2099-01', OGGI)).toBe('2026-09');
  });

  it('un valore assente o non valido diventa il mese corrente', () => {
    expect(meseOreLavoroRichiesto(undefined, OGGI)).toBe('2026-09');
    expect(meseOreLavoroRichiesto('', OGGI)).toBe('2026-09');
    expect(meseOreLavoroRichiesto('2026-13', OGGI)).toBe('2026-09');
    expect(meseOreLavoroRichiesto('settembre', OGGI)).toBe('2026-09');
    expect(meseOreLavoroRichiesto('2026-9', OGGI)).toBe('2026-09');
  });
});

describe('settimaneDelMese', () => {
  it('elenca i lunedì delle settimane che toccano il mese', () => {
    // 1 set 2026 è martedì: la prima settimana inizia lunedì 31 ago.
    expect(settimaneDelMese('2026-09')).toEqual(['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
  });

  it('un mese che inizia di lunedì parte da quel lunedì', () => {
    expect(settimaneDelMese('2026-06')[0]).toBe('2026-06-01');
  });
});

describe('righeMeseOreLavoro', () => {
  const righe = (salvati: GiornoSalvatoOreLavoro[] = [], chiusure: GiornoChiusura[] = []) =>
    righeMeseOreLavoro({ mese: '2026-09', oggiData: OGGI, salvati, profiloOrario: profilo, chiusure });

  it('una riga per ogni giorno del mese', () => {
    const r = righe();
    expect(r).toHaveLength(30);
    expect(r[0].data).toBe('2026-09-01');
    expect(r[29].data).toBe('2026-09-30');
  });

  it('un giorno non salvato è lavorativo con le ore previste e differenza 0', () => {
    const martedi = righe().find((x) => x.data === '2026-09-01')!;
    expect(martedi).toMatchObject({
      stato: 'lavorativo',
      orePreviste: 7,
      oreErogate: 7,
      differenza: 0,
      salvato: false,
    });
  });

  it('un weekend non salvato è "chiusura", neutro', () => {
    const sabato = righe().find((x) => x.data === '2026-09-05')!;
    expect(sabato).toMatchObject({ stato: 'chiusura', oreErogate: 0, differenza: 0, conteggiato: false });
  });

  it('un giorno di chiusura del calendario non salvato è "chiusura"', () => {
    const chiusure: GiornoChiusura[] = [{ id: '1', dataInizio: '2026-09-01', dataFine: '2026-09-01', nota: null }];
    expect(righe([], chiusure).find((x) => x.data === '2026-09-01')!.stato).toBe('chiusura');
  });

  it('un giorno salvato con straordinario mostra erogate, differenza e motivo', () => {
    const r = righe([
      salvato({ data: '2026-09-02', ore_ordinarie: 7, ore_straordinarie: 1.5, motivo_straordinario: 'Riunione' }),
    ]).find((x) => x.data === '2026-09-02')!;
    expect(r).toMatchObject({ oreErogate: 8.5, differenza: 1.5, dettaglio: 'Riunione', salvato: true });
  });

  it('un giorno salvato con meno ore mostra differenza negativa', () => {
    const r = righe([salvato({ data: '2026-09-03', ore_ordinarie: 5, motivo_straordinario: 'Uscita' })]).find(
      (x) => x.data === '2026-09-03'
    )!;
    expect(r).toMatchObject({ oreErogate: 5, differenza: -2 });
  });

  it('accetta valori numerici in forma di stringa (numeric via PostgREST)', () => {
    const r = righe([salvato({ data: '2026-09-02', ore_ordinarie: '7.00', ore_straordinarie: '1.50' })]).find(
      (x) => x.data === '2026-09-02'
    )!;
    expect(r.differenza).toBe(1.5);
  });

  it('malattia e assenza: ore erogate 0, dettaglio con codice/nota, non conteggiate', () => {
    const r = righe([
      salvato({ data: '2026-09-02', stato: 'malattia', ore_ordinarie: 0, codice_malattia: 'ABC123' }),
      salvato({ data: '2026-09-03', stato: 'assenza', ore_ordinarie: 0, nota_assenza: 'Visita' }),
    ]);
    const malattia = r.find((x) => x.data === '2026-09-02')!;
    const assenza = r.find((x) => x.data === '2026-09-03')!;
    expect(malattia).toMatchObject({ oreErogate: 0, differenza: 0, conteggiato: false });
    expect(malattia.dettaglio).toContain('ABC123');
    expect(assenza.dettaglio).toContain('Visita');
  });

  it('ferie salvate: neutre, non conteggiate', () => {
    const r = righe([salvato({ data: '2026-09-02', stato: 'ferie', ore_ordinarie: 0 })]).find(
      (x) => x.data === '2026-09-02'
    )!;
    expect(r).toMatchObject({ stato: 'ferie', differenza: 0, conteggiato: false });
  });

  it('i giorni futuri non sono conteggiati, quelli fino a oggi sì', () => {
    const r = righe();
    expect(r.find((x) => x.data === '2026-09-16')!.conteggiato).toBe(true); // oggi, mercoledì
    expect(r.find((x) => x.data === '2026-09-17')!.conteggiato).toBe(false); // domani
  });

  it('senza profilo orario le ore previste sono 0', () => {
    const r = righeMeseOreLavoro({
      mese: '2026-09',
      oggiData: OGGI,
      salvati: [],
      profiloOrario: null,
      chiusure: [],
    }).find((x) => x.data === '2026-09-02')!;
    expect(r).toMatchObject({ orePreviste: 0, oreErogate: 0, differenza: 0 });
  });
});

describe('riepilogoMeseOreLavoro', () => {
  it('somma previste e differenze dei soli giorni lavorativi già trascorsi', () => {
    const r = righeMeseOreLavoro({
      mese: '2026-09',
      oggiData: OGGI,
      salvati: [
        salvato({ data: '2026-09-02', ore_straordinarie: 1.5, motivo_straordinario: 'x' }),
        salvato({ data: '2026-09-03', ore_ordinarie: 5, motivo_straordinario: 'y' }),
        salvato({ data: '2026-09-04', stato: 'ferie', ore_ordinarie: 0 }),
      ],
      profiloOrario: profilo,
      chiusure: [],
    });
    const tot = riepilogoMeseOreLavoro(r);
    expect(tot.differenza).toBe(-0.5); // +1,5 − 2
    // Fino a mer 16 set, escluso ven 4 (ferie): lun 7,14 · mar 1,8,15 · mer 2,9,16 ·
    // gio 3,10 (7h ciascuno) + ven 11 (4h).
    expect(tot.orePreviste).toBe(7 * 2 + 7 * 3 + 7 * 3 + 7 * 2 + 4);
  });

  it('un mese passato conta tutti i giorni lavorativi', () => {
    const r = righeMeseOreLavoro({
      mese: '2026-08',
      oggiData: OGGI,
      salvati: [],
      profiloOrario: profilo,
      chiusure: [],
    });
    const tot = riepilogoMeseOreLavoro(r);
    expect(tot.differenza).toBe(0);
    // Agosto 2026: 21 giorni feriali, 4 venerdì (4h) e 17 altri (7h).
    expect(tot.orePreviste).toBe(17 * 7 + 4 * 4);
  });
});
