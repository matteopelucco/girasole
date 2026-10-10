import { describe, expect, it } from 'vitest';
import { componiAllarmi, testoNumeroAllarmi, type InputElencoAllarmi } from './elencoAllarmi';

// Solo logica pura (nessun I/O): il caricamento dei dati da Supabase sta in
// lib/allarmiDati.ts ed è coperto da e2e (specs/07 - allarmi.md).

// 2026-01-15 è un giovedì; 10:00 a Roma (CET) sono le 09:00 UTC.
const DOPO_LE_10 = new Date('2026-01-15T09:30:00Z');
const PRIMA_DELLE_10 = new Date('2026-01-15T08:00:00Z');

const base: InputElencoAllarmi = {
  oggi: '2026-01-15',
  adesso: DOPO_LE_10,
  giornoAttivo: true,
  statoPersonale: { sezioniPresenzeIncomplete: [], pastiNonConfermati: false },
  settimanaOreNonConfermata: null,
  personale: [],
  retteNonComunicate: [],
};

const SETTIMANA = { inizio: '2026-01-05', fine: '2026-01-11' };

describe('componiAllarmi', () => {
  it('elenco vuoto se non ci sono allarmi', () => {
    expect(componiAllarmi(base)).toEqual([]);
  });

  it('un solo allarme presenze/pasti con un link per sezione e uno per i pasti', () => {
    const elenco = componiAllarmi({
      ...base,
      statoPersonale: {
        sezioniPresenzeIncomplete: [
          { id: 's1', nome: 'Sole' },
          { id: 's2', nome: 'Luna' },
        ],
        pastiNonConfermati: true,
      },
    });
    expect(elenco).toHaveLength(1);
    expect(elenco[0].id).toBe('presenze-pasti');
    expect(elenco[0].voci).toEqual([
      { testo: 'Presenze — Sole', href: '/dashboard/giornata?data=2026-01-15' },
      { testo: 'Presenze — Luna', href: '/dashboard/giornata?data=2026-01-15' },
      { testo: 'Comunicare i pasti a Rojac', href: '/dashboard/giornata?data=2026-01-15#comunicazione-rojac' },
    ]);
  });

  it('niente allarme presenze/pasti prima delle 10:00', () => {
    const elenco = componiAllarmi({
      ...base,
      adesso: PRIMA_DELLE_10,
      statoPersonale: { sezioniPresenzeIncomplete: [{ id: 's1', nome: 'Sole' }], pastiNonConfermati: true },
    });
    expect(elenco).toEqual([]);
  });

  it('niente allarme presenze/pasti in un giorno di chiusura', () => {
    const elenco = componiAllarmi({
      ...base,
      giornoAttivo: false,
      statoPersonale: { sezioniPresenzeIncomplete: [], pastiNonConfermati: true },
    });
    expect(elenco).toEqual([]);
  });

  it('allarme settimana ore con intervallo e link alla settimana', () => {
    const elenco = componiAllarmi({ ...base, settimanaOreNonConfermata: SETTIMANA });
    expect(elenco).toHaveLength(1);
    expect(elenco[0].id).toBe('settimana-ore');
    expect(elenco[0].voci).toHaveLength(1);
    expect(elenco[0].voci[0].href).toBe('/dashboard/ore-lavoro?settimana=2026-01-05');
    expect(elenco[0].voci[0].testo).toContain('Settimana');
  });

  it('una voce per ogni membro del personale in allarme, senza link', () => {
    const elenco = componiAllarmi({
      ...base,
      personale: [
        {
          utenteId: 'u1',
          nome: 'Anna',
          cognome: 'Rossi',
          sezioniPresenzeIncomplete: ['Sole'],
          pastiNonConfermati: true,
          settimanaOreNonConfermata: SETTIMANA,
        },
        {
          utenteId: 'u2',
          nome: 'Bruna',
          cognome: 'Verdi',
          sezioniPresenzeIncomplete: [],
          pastiNonConfermati: false,
          settimanaOreNonConfermata: SETTIMANA,
        },
      ],
    });
    expect(elenco.map((a) => a.id)).toEqual(['personale-u1', 'personale-u2']);
    expect(elenco[0].titolo).toBe('Anna Rossi');
    expect(elenco[0].voci.map((v) => v.testo)).toEqual([
      'presenze non segnate (Sole)',
      'pasti non comunicati',
      expect.stringContaining('non confermata'),
    ]);
    for (const allarme of elenco) {
      expect(allarme.voci.every((v) => v.href === undefined)).toBe(true);
    }
  });

  it('ordine: prima i miei allarmi, poi il personale', () => {
    const elenco = componiAllarmi({
      ...base,
      statoPersonale: { sezioniPresenzeIncomplete: [], pastiNonConfermati: true },
      settimanaOreNonConfermata: SETTIMANA,
      personale: [
        {
          utenteId: 'u1',
          nome: 'Anna',
          cognome: 'Rossi',
          sezioniPresenzeIncomplete: [],
          pastiNonConfermati: false,
          settimanaOreNonConfermata: SETTIMANA,
        },
      ],
    });
    expect(elenco.map((a) => a.id)).toEqual(['presenze-pasti', 'settimana-ore', 'personale-u1']);
    expect(elenco.map((a) => a.tipo)).toEqual(['proprio', 'proprio', 'personale']);
  });

  it('rette non comunicate: un solo allarme con il numero, i nomi e il link alla tabella Rette', () => {
    const elenco = componiAllarmi({
      ...base,
      retteNonComunicate: [
        { id: 'b1', nome: 'Anna', cognome: 'Verdi', sezione: 'Sole' },
        { id: 'b2', nome: 'Carlo', cognome: 'Bianchi', sezione: null },
      ],
    });
    expect(elenco).toHaveLength(1);
    expect(elenco[0].id).toBe('rette-non-comunicate');
    expect(elenco[0].tipo).toBe('proprio');
    expect(elenco[0].voci).toEqual([
      { testo: 'Mancano 2 comunicazioni: vai su Rette per inviarle', href: '/admin/rette' },
      { testo: 'Anna Verdi (Sole)' },
      { testo: 'Carlo Bianchi (Senza sezione)' },
    ]);
  });

  it('rette non comunicate: singolare per un solo bambino', () => {
    const elenco = componiAllarmi({
      ...base,
      retteNonComunicate: [{ id: 'b1', nome: 'Anna', cognome: 'Verdi', sezione: 'Sole' }],
    });
    expect(elenco[0].voci[0].testo).toBe('Manca 1 comunicazione: vai su Rette per inviarle');
  });

  it('rette non comunicate: nessun allarme se non manca nessuno', () => {
    expect(componiAllarmi({ ...base, retteNonComunicate: [] })).toEqual([]);
  });

  it('rette non comunicate: vengono dopo gli altri allarmi propri e prima del personale', () => {
    const elenco = componiAllarmi({
      ...base,
      settimanaOreNonConfermata: SETTIMANA,
      retteNonComunicate: [{ id: 'b1', nome: 'Anna', cognome: 'Verdi', sezione: null }],
      personale: [
        {
          utenteId: 'u1',
          nome: 'Anna',
          cognome: 'Rossi',
          sezioniPresenzeIncomplete: [],
          pastiNonConfermati: false,
          settimanaOreNonConfermata: SETTIMANA,
        },
      ],
    });
    expect(elenco.map((a) => a.id)).toEqual(['settimana-ore', 'rette-non-comunicate', 'personale-u1']);
  });
});

describe('testoNumeroAllarmi', () => {
  it('singolare per uno', () => {
    expect(testoNumeroAllarmi(1)).toBe('1 allarme');
  });
  it('plurale per più di uno', () => {
    expect(testoNumeroAllarmi(3)).toBe('3 allarmi');
  });
  it('nessun allarme per zero', () => {
    expect(testoNumeroAllarmi(0)).toBe('Nessun allarme');
  });
});
