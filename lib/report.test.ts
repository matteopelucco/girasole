import { describe, expect, it } from 'vitest';
import { aggregaConteggiPresenzePasti, risolviPeriodoReport } from './report';

describe('risolviPeriodoReport — mensile', () => {
  it('risolve un mese esplicito', () => {
    const periodo = risolviPeriodoReport('mensile', '2026-02');
    expect(periodo).toMatchObject({
      inizio: '2026-02-01',
      fine: '2026-02-28',
      etichettaPeriodo: 'febbraio 2026',
      periodoPrecedente: '2026-01',
      periodoSuccessivo: '2026-03',
      periodoAttuale: '2026-02',
    });
  });

  it('ignora un parametro periodo malformato e usa il mese corrente', () => {
    const periodo = risolviPeriodoReport('mensile', 'non-una-data');
    expect(periodo.periodoAttuale).toMatch(/^\d{4}-\d{2}$/);
  });

  it('attraversa il cambio di anno navigando a dicembre/gennaio', () => {
    expect(risolviPeriodoReport('mensile', '2026-12').periodoSuccessivo).toBe('2027-01');
    expect(risolviPeriodoReport('mensile', '2027-01').periodoPrecedente).toBe('2026-12');
  });
});

describe('risolviPeriodoReport — settimanale', () => {
  it('risolve la settimana (lun-dom) a partire da un\'ancora', () => {
    // 2026-08-20 è un giovedì della settimana 17-23 agosto 2026.
    const periodo = risolviPeriodoReport('settimanale', '2026-08-20');
    expect(periodo).toMatchObject({
      inizio: '2026-08-17',
      fine: '2026-08-23',
      etichettaPeriodo: '17 ago – 23 ago',
      periodoPrecedente: '2026-08-10',
      periodoSuccessivo: '2026-08-24',
      periodoAttuale: '2026-08-17',
    });
  });

  it('ignora un\'ancora malformata e usa la settimana corrente', () => {
    const periodo = risolviPeriodoReport('settimanale', 'non-una-data');
    expect(periodo.periodoAttuale).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('risolviPeriodoReport — giornaliero', () => {
  it('risolve un singolo giorno esplicito', () => {
    const periodo = risolviPeriodoReport('giornaliero', '2026-08-23');
    expect(periodo).toMatchObject({
      inizio: '2026-08-23',
      fine: '2026-08-23',
      etichettaPeriodo: 'domenica 23 agosto 2026',
      periodoPrecedente: '2026-08-22',
      periodoSuccessivo: '2026-08-24',
      periodoAttuale: '2026-08-23',
    });
  });

  it('ignora un giorno malformato e usa oggi', () => {
    const periodo = risolviPeriodoReport('giornaliero', undefined);
    expect(periodo.periodoAttuale).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('aggregaConteggiPresenzePasti', () => {
  const bambini = [
    { id: 'b1', nome: 'Anna', cognome: 'Bianchi' },
    { id: 'b2', nome: 'Marco', cognome: 'Verdi' },
  ];

  it('conta solo lo stato "presente", non "assente"/"malattia"', () => {
    const presenze = [
      { bambino_id: 'b1', data: '2026-08-01', stato: 'presente' },
      { bambino_id: 'b1', data: '2026-08-02', stato: 'assente' },
      { bambino_id: 'b2', data: '2026-08-01', stato: 'malattia' },
    ];
    const righe = aggregaConteggiPresenzePasti(bambini, presenze, []);
    expect(righe.find((r) => r.id === 'b1')?.presenze).toBe(1);
    expect(righe.find((r) => r.id === 'b2')?.presenze).toBe(0);
  });

  it('conta pre-asilo e post-asilo separatamente, solo quando veri', () => {
    const presenze = [
      { bambino_id: 'b1', data: '2026-08-01', stato: 'presente', pre_asilo: true, post_asilo: false },
      { bambino_id: 'b1', data: '2026-08-02', stato: 'presente', pre_asilo: true, post_asilo: true },
      { bambino_id: 'b1', data: '2026-08-03', stato: 'presente', pre_asilo: false, post_asilo: false },
    ];
    const righe = aggregaConteggiPresenzePasti(bambini, presenze, []);
    const riga = righe.find((r) => r.id === 'b1')!;
    expect(riga.presenze).toBe(3);
    expect(riga.preAsilo).toBe(2);
    expect(riga.postAsilo).toBe(1);
  });

  it('conta solo i pasti "si", non "no"', () => {
    const pasti = [
      { bambino_id: 'b1', data: '2026-08-01', mangiato: 'si' },
      { bambino_id: 'b1', data: '2026-08-02', mangiato: 'no' },
      { bambino_id: 'b2', data: '2026-08-01', mangiato: 'si' },
    ];
    const righe = aggregaConteggiPresenzePasti(bambini, [], pasti);
    expect(righe.find((r) => r.id === 'b1')?.pasti).toBe(1);
    expect(righe.find((r) => r.id === 'b2')?.pasti).toBe(1);
  });

  it('un bambino senza nessun record ha tutti i conteggi a zero e nessuna inconsistenza', () => {
    const righe = aggregaConteggiPresenzePasti(bambini, [], []);
    expect(righe).toEqual([
      {
        id: 'b1',
        nome: 'Anna',
        cognome: 'Bianchi',
        presenze: 0,
        preAsilo: 0,
        postAsilo: 0,
        pasti: 0,
        inconsistenze: [],
      },
      {
        id: 'b2',
        nome: 'Marco',
        cognome: 'Verdi',
        presenze: 0,
        preAsilo: 0,
        postAsilo: 0,
        pasti: 0,
        inconsistenze: [],
      },
    ]);
  });

  it('segnala un giorno con pasto "sì" e presenza assente, senza confondere altri giorni coerenti', () => {
    const presenze = [
      { bambino_id: 'b1', data: '2026-08-01', stato: 'presente' },
      { bambino_id: 'b1', data: '2026-08-02', stato: 'assente' },
    ];
    const pasti = [
      { bambino_id: 'b1', data: '2026-08-01', mangiato: 'si' },
      { bambino_id: 'b1', data: '2026-08-02', mangiato: 'si' },
    ];
    const righe = aggregaConteggiPresenzePasti(bambini, presenze, pasti);
    const riga = righe.find((r) => r.id === 'b1')!;
    expect(riga.inconsistenze).toEqual(['Pasto segnato "sì" ma il bambino risulta assente.']);
  });

  it('non duplica lo stesso messaggio di inconsistenza se ricorre su più giorni', () => {
    const presenze = [
      { bambino_id: 'b1', data: '2026-08-01', stato: 'assente' },
      { bambino_id: 'b1', data: '2026-08-02', stato: 'assente' },
    ];
    const pasti = [
      { bambino_id: 'b1', data: '2026-08-01', mangiato: 'si' },
      { bambino_id: 'b1', data: '2026-08-02', mangiato: 'si' },
    ];
    const righe = aggregaConteggiPresenzePasti(bambini, presenze, pasti);
    expect(righe.find((r) => r.id === 'b1')?.inconsistenze).toHaveLength(1);
  });

  it('mantiene l\'ordine e la lista dei bambini passati in input', () => {
    const righe = aggregaConteggiPresenzePasti(bambini, [], []);
    expect(righe.map((r) => r.id)).toEqual(['b1', 'b2']);
  });
});
