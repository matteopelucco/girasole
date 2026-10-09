import { describe, expect, it } from 'vitest';
import {
  GIORNO_ALLARME_RETTE,
  allarmeRetteDaControllare,
  bambiniRetteNonComunicate,
  chiaveAllarmeRette,
  descrizioneBambinoRetta,
  htmlAllarmeRetteNonComunicate,
  meseInteramenteChiuso,
  type BambinoRetta,
} from './allarmeRette';
import type { GiornoChiusura } from './calendarioScolastico';

// Solo le funzioni pure di questo modulo (nessun I/O): la data è sempre
// passata dall'esterno (specs/07, allarme "rette non comunicate").
// calcolaRetteNonComunicate fa query Supabase ed è coperta solo da e2e.

const chiusuraAgosto: GiornoChiusura = {
  id: 'c1',
  dataInizio: '2026-08-01',
  dataFine: '2026-08-31',
  nota: 'Ferie estive',
};

describe('GIORNO_ALLARME_RETTE', () => {
  it('è il giorno 3', () => {
    expect(GIORNO_ALLARME_RETTE).toBe(3);
  });
});

describe('meseInteramenteChiuso', () => {
  it('vero se tutto il mese è coperto da una chiusura', () => {
    expect(meseInteramenteChiuso('2026-08', [chiusuraAgosto])).toBe(true);
  });

  it('falso senza chiusure', () => {
    expect(meseInteramenteChiuso('2026-10', [])).toBe(false);
  });

  it('falso se resta anche un solo giorno feriale aperto', () => {
    const quasiTutto: GiornoChiusura = { ...chiusuraAgosto, dataFine: '2026-08-30' };
    // 31 agosto 2026 è un lunedì.
    expect(meseInteramenteChiuso('2026-08', [quasiTutto])).toBe(false);
  });

  it('vero se restano aperti solo i weekend', () => {
    // Dal lunedì 3 al venerdì 28 agosto chiuso: restano solo sabati e domeniche, più lun 31 che qui è chiuso.
    const feriali: GiornoChiusura = { ...chiusuraAgosto, dataInizio: '2026-08-03' };
    expect(meseInteramenteChiuso('2026-08', [feriali])).toBe(true);
  });
});

describe('allarmeRetteDaControllare', () => {
  it('falso il giorno 1 e il giorno 2', () => {
    expect(allarmeRetteDaControllare('2026-10-01', [])).toBe(false);
    expect(allarmeRetteDaControllare('2026-10-02', [])).toBe(false);
  });

  it('vero dal giorno 3 incluso', () => {
    expect(allarmeRetteDaControllare('2026-10-03', [])).toBe(true);
    expect(allarmeRetteDaControllare('2026-10-04', [])).toBe(true);
  });

  it('vero a fine mese', () => {
    expect(allarmeRetteDaControllare('2026-10-31', [])).toBe(true);
  });

  it('falso nei mesi di chiusura totale anche dopo il giorno 3', () => {
    expect(allarmeRetteDaControllare('2026-08-10', [chiusuraAgosto])).toBe(false);
  });

  it('una chiusura parziale non spegne l\'allarme', () => {
    const settimana: GiornoChiusura = { id: 'c2', dataInizio: '2026-10-05', dataFine: '2026-10-09', nota: null };
    expect(allarmeRetteDaControllare('2026-10-10', [settimana])).toBe(true);
  });
});

describe('chiaveAllarmeRette', () => {
  it('è il mese YYYY-MM della data', () => {
    expect(chiaveAllarmeRette('2026-10-03')).toBe('2026-10');
    expect(chiaveAllarmeRette('2027-01-31')).toBe('2027-01');
  });

  it('cambia con il mese, quindi un nuovo mese riparte da zero', () => {
    expect(chiaveAllarmeRette('2026-10-31')).not.toBe(chiaveAllarmeRette('2026-11-03'));
  });
});

const sezioni = [
  { id: 's1', nome: 'Girasoli' },
  { id: 's2', nome: 'Margherite' },
];

const bambini = [
  { id: 'b1', nome: 'Anna', cognome: 'Verdi', sezione_id: 's2' },
  { id: 'b2', nome: 'Carlo', cognome: 'Bianchi', sezione_id: 's1' },
  { id: 'b3', nome: 'Dora', cognome: 'Rossi', sezione_id: null },
  { id: 'b4', nome: 'Elia', cognome: 'Neri', sezione_id: 's1' },
];

const costi = [
  { bambino_id: 'b1', email_promemoria: 'a@example.test' },
  { bambino_id: 'b2', email_promemoria: 'b@example.test' },
  { bambino_id: 'b3', email_promemoria: 'c@example.test' },
  { bambino_id: 'b4', email_promemoria: null },
];

describe('bambiniRetteNonComunicate', () => {
  it('elenca i bambini con email senza comunicazione, con la sezione, ordinati per cognome', () => {
    const risultato = bambiniRetteNonComunicate({ bambini, sezioni, costi, idComunicati: [] });
    expect(risultato).toEqual([
      { id: 'b2', nome: 'Carlo', cognome: 'Bianchi', sezione: 'Girasoli' },
      { id: 'b3', nome: 'Dora', cognome: 'Rossi', sezione: null },
      { id: 'b1', nome: 'Anna', cognome: 'Verdi', sezione: 'Margherite' },
    ]);
  });

  it('non conta chi ha già la comunicazione del mese', () => {
    const risultato = bambiniRetteNonComunicate({ bambini, sezioni, costi, idComunicati: ['b2', 'b3'] });
    expect(risultato.map((b) => b.id)).toEqual(['b1']);
  });

  it('è vuoto se tutti hanno la comunicazione: l\'allarme si spegne', () => {
    expect(bambiniRetteNonComunicate({ bambini, sezioni, costi, idComunicati: ['b1', 'b2', 'b3'] })).toEqual([]);
  });

  it('non conta un bambino senza email di promemoria (null, vuota o solo spazi)', () => {
    const senzaEmail = [
      { bambino_id: 'b1', email_promemoria: '' },
      { bambino_id: 'b2', email_promemoria: '   ' },
      { bambino_id: 'b3', email_promemoria: null },
    ];
    expect(bambiniRetteNonComunicate({ bambini, sezioni, costi: senzaEmail, idComunicati: [] })).toEqual([]);
  });

  it('non conta un bambino senza riga dei costi', () => {
    const risultato = bambiniRetteNonComunicate({ bambini, sezioni, costi: [costi[0]], idComunicati: [] });
    expect(risultato.map((b) => b.id)).toEqual(['b1']);
  });

  it('una sezione sconosciuta equivale a nessuna sezione', () => {
    const risultato = bambiniRetteNonComunicate({
      bambini: [{ id: 'b9', nome: 'Gino', cognome: 'Gialli', sezione_id: 'sconosciuta' }],
      sezioni,
      costi: [{ bambino_id: 'b9', email_promemoria: 'g@example.test' }],
      idComunicati: [],
    });
    expect(risultato[0].sezione).toBeNull();
  });
});

describe('descrizioneBambinoRetta', () => {
  it('mostra nome, cognome e sezione', () => {
    expect(descrizioneBambinoRetta({ id: 'b', nome: 'Anna', cognome: 'Verdi', sezione: 'Girasoli' })).toBe(
      'Anna Verdi (Girasoli)'
    );
  });

  it('senza sezione lo dice', () => {
    expect(descrizioneBambinoRetta({ id: 'b', nome: 'Anna', cognome: 'Verdi', sezione: null })).toBe(
      'Anna Verdi (Senza sezione)'
    );
  });
});

describe('htmlAllarmeRetteNonComunicate', () => {
  const elenco: BambinoRetta[] = [
    { id: 'b1', nome: 'Anna', cognome: 'Verdi', sezione: 'Girasoli' },
    { id: 'b2', nome: 'Carlo', cognome: 'Bianchi', sezione: null },
  ];

  it('dice il mese, quanti bambini mancano e chi sono', () => {
    const html = htmlAllarmeRetteNonComunicate('2026-10', elenco);
    expect(html).toContain('ottobre 2026');
    expect(html).toContain('2 bambini');
    expect(html).toContain('Anna Verdi (Girasoli)');
    expect(html).toContain('Carlo Bianchi (Senza sezione)');
  });

  it('usa il singolare per un solo bambino', () => {
    const html = htmlAllarmeRetteNonComunicate('2026-10', [elenco[0]]);
    expect(html).toContain('1 bambino');
    expect(html).not.toContain('1 bambini');
  });

  it('esegue l\'escape di nomi e sezioni (dati liberi)', () => {
    const html = htmlAllarmeRetteNonComunicate('2026-10', [
      { id: 'b1', nome: '<script>x</script>', cognome: 'O\'Neil & Co', sezione: '<b>S</b>' },
    ]);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });
});
