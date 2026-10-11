import { describe, expect, it } from 'vitest';
import {
  costruisciControlliRiepilogo,
  formattaOraRoma,
  htmlRiepilogoAllarmi,
  oggettoRiepilogoAllarmi,
  riepilogoDaSistemare,
  type InputRiepilogo,
} from './riepilogoAllarmi';

// Solo logica pura (specs/07, "Email di riepilogo"): l'ora e i dati arrivano
// sempre dall'esterno. Tutti i dati sono fittizi.

// 2026-10-12 10:30 a Roma (CEST = UTC+2).
const ORA_10_30 = new Date('2026-10-12T08:30:00Z');
const ORA_11_45 = new Date('2026-10-12T09:45:00Z');

function input(parziale: Partial<InputRiepilogo> = {}): InputRiepilogo {
  return {
    oggi: '2026-10-12',
    giornoAttivo: true,
    dopoOrario: true,
    oraRiepilogo: ORA_10_30,
    giornata: {
      ora: ORA_10_30,
      stato: { nessunDatoAtteso: false, presenzeIncomplete: false, pastiNonConfermati: false },
    },
    rette: { ora: ORA_11_45, mancanti: [] },
    ore: { ora: ORA_11_45, intervallo: 'dal 05/10 al 11/10', utenti: [] },
    ...parziale,
  };
}

function controllo(controlli: ReturnType<typeof costruisciControlliRiepilogo>, id: string) {
  const c = controlli.find((x) => x.id === id);
  if (!c) throw new Error(`controllo ${id} assente`);
  return c;
}

describe('formattaOraRoma', () => {
  it('mostra HH:MM nel fuso Europe/Rome (ora legale)', () => {
    expect(formattaOraRoma(ORA_10_30)).toBe('10:30');
  });

  it('mostra HH:MM nel fuso Europe/Rome (ora solare)', () => {
    expect(formattaOraRoma(new Date('2026-12-01T08:05:00Z'))).toBe('09:05');
  });
});

describe('costruisciControlliRiepilogo', () => {
  it('riporta sempre tutti i controlli, nello stesso ordine', () => {
    const ids = costruisciControlliRiepilogo(input()).map((c) => c.id);
    expect(ids).toEqual(['appello', 'pasti-rojac', 'rette-genitori', 'mail-rojac-mensile', 'ore-lavoro']);
  });

  it('con tutto a posto: appello, pasti e ore sono ok, ciascuno con la propria ora', () => {
    const controlli = costruisciControlliRiepilogo(input());
    expect(controllo(controlli, 'appello')).toMatchObject({ stato: 'ok', ora: ORA_10_30 });
    expect(controllo(controlli, 'pasti-rojac')).toMatchObject({ stato: 'ok', ora: ORA_10_30 });
    expect(controllo(controlli, 'rette-genitori')).toMatchObject({ stato: 'ok', ora: ORA_11_45 });
    expect(controllo(controlli, 'ore-lavoro')).toMatchObject({ stato: 'ok', ora: ORA_11_45 });
    expect(riepilogoDaSistemare(controlli)).toBe(false);
  });

  it("appello incompleto: da sistemare con l'azione da fare", () => {
    const controlli = costruisciControlliRiepilogo(
      input({
        giornata: {
          ora: ORA_10_30,
          stato: { nessunDatoAtteso: false, presenzeIncomplete: true, pastiNonConfermati: false },
        },
      })
    );
    const appello = controllo(controlli, 'appello');
    expect(appello.stato).toBe('da_sistemare');
    expect(appello.azione).toMatch(/Presenze e pasti/);
    expect(controllo(controlli, 'pasti-rojac').stato).toBe('ok');
    expect(riepilogoDaSistemare(controlli)).toBe(true);
  });

  it('pasti non comunicati a Rojac: da sistemare', () => {
    const controlli = costruisciControlliRiepilogo(
      input({
        giornata: {
          ora: ORA_10_30,
          stato: { nessunDatoAtteso: false, presenzeIncomplete: false, pastiNonConfermati: true },
        },
      })
    );
    const pasti = controllo(controlli, 'pasti-rojac');
    expect(pasti.stato).toBe('da_sistemare');
    expect(pasti.azione).toMatch(/Rojac/);
    expect(controllo(controlli, 'appello').stato).toBe('ok');
  });

  it('prima delle 10:00 i controlli di giornata sono non applicabili, con il motivo', () => {
    const controlli = costruisciControlliRiepilogo(input({ dopoOrario: false, giornata: null }));
    for (const id of ['appello', 'pasti-rojac']) {
      const c = controllo(controlli, id);
      expect(c.stato).toBe('non_applicabile');
      expect(c.ora).toBe(ORA_10_30);
      expect(c.motivo).toMatch(/prima delle 10:00/);
    }
    expect(riepilogoDaSistemare(controlli)).toBe(false);
  });

  it('in un giorno di chiusura i controlli di giornata sono non applicabili, con il motivo', () => {
    const controlli = costruisciControlliRiepilogo(input({ giornoAttivo: false, giornata: null }));
    expect(controllo(controlli, 'appello')).toMatchObject({ stato: 'non_applicabile' });
    expect(controllo(controlli, 'appello').motivo).toMatch(/chiusura/);
    expect(controllo(controlli, 'pasti-rojac').stato).toBe('non_applicabile');
  });

  it('senza bambini attivi i controlli di giornata sono non applicabili', () => {
    const controlli = costruisciControlliRiepilogo(
      input({
        giornata: {
          ora: ORA_10_30,
          stato: { nessunDatoAtteso: true, presenzeIncomplete: false, pastiNonConfermati: false },
        },
      })
    );
    expect(controllo(controlli, 'appello').stato).toBe('non_applicabile');
    expect(controllo(controlli, 'appello').motivo).toMatch(/nessun bambino/);
    expect(controllo(controlli, 'pasti-rojac').stato).toBe('non_applicabile');
  });

  it('rette: dal giorno 3 elenca i bambini mancanti con nome, cognome e sezione', () => {
    const controlli = costruisciControlliRiepilogo(
      input({
        oggi: '2026-10-03',
        rette: {
          ora: ORA_11_45,
          mancanti: [
            { id: 'b1', nome: 'Anna', cognome: 'Rossi', sezione: 'Girasoli' },
            { id: 'b2', nome: 'Luca', cognome: 'Bianchi', sezione: null },
          ],
        },
      })
    );
    const rette = controllo(controlli, 'rette-genitori');
    expect(rette.stato).toBe('da_sistemare');
    expect(rette.dettaglio[0]).toMatch(/2 bambini/);
    expect(rette.dettaglio).toContain('Anna Rossi (Girasoli)');
    expect(rette.dettaglio).toContain('Luca Bianchi (Senza sezione)');
    expect(rette.azione).toMatch(/Rette/);
  });

  it('rette: con un solo bambino il testo è al singolare', () => {
    const controlli = costruisciControlliRiepilogo(
      input({
        oggi: '2026-10-05',
        rette: { ora: ORA_11_45, mancanti: [{ id: 'b1', nome: 'Anna', cognome: 'Rossi', sezione: 'Girasoli' }] },
      })
    );
    expect(controllo(controlli, 'rette-genitori').dettaglio[0]).toMatch(/1 bambino\b/);
  });

  it('rette: il giorno 3 scatta, il giorno 2 no (anche con bambini mancanti)', () => {
    const mancanti = [{ id: 'b1', nome: 'Anna', cognome: 'Rossi', sezione: 'Girasoli' }];
    const giorno2 = costruisciControlliRiepilogo(input({ oggi: '2026-10-02', rette: { ora: ORA_11_45, mancanti } }));
    expect(controllo(giorno2, 'rette-genitori').stato).toBe('non_applicabile');
    expect(controllo(giorno2, 'rette-genitori').motivo).toMatch(/giorno 3/);
    const giorno3 = costruisciControlliRiepilogo(input({ oggi: '2026-10-03', rette: { ora: ORA_11_45, mancanti } }));
    expect(controllo(giorno3, 'rette-genitori').stato).toBe('da_sistemare');
  });

  it('rette: dal giorno 3 ma senza mancanti è ok', () => {
    const controlli = costruisciControlliRiepilogo(input({ oggi: '2026-10-20' }));
    expect(controllo(controlli, 'rette-genitori').stato).toBe('ok');
  });

  it('mail mensile pasti a Rojac: sempre "non ancora controllato", senza ora e mai da sistemare', () => {
    const controlli = costruisciControlliRiepilogo(input());
    const rojac = controllo(controlli, 'mail-rojac-mensile');
    expect(rojac.stato).toBe('non_controllato');
    expect(rojac.ora).toBeNull();
    expect(riepilogoDaSistemare(controlli)).toBe(false);
  });

  it('ore di lavoro: elenca gli utenti con la settimana non confermata', () => {
    const controlli = costruisciControlliRiepilogo(
      input({
        ore: {
          ora: ORA_11_45,
          intervallo: 'dal 05/10 al 11/10',
          utenti: [
            { utenteId: 'u1', nome: 'Maria', cognome: 'Verdi', email: 'maria@example.test' },
            { utenteId: 'u2', nome: 'Sara', cognome: 'Neri', email: 'sara@example.test' },
          ],
        },
      })
    );
    const ore = controllo(controlli, 'ore-lavoro');
    expect(ore.stato).toBe('da_sistemare');
    expect(ore.dettaglio.join(' ')).toContain('Maria Verdi');
    expect(ore.dettaglio.join(' ')).toContain('Sara Neri');
    expect(ore.dettaglio.join(' ')).toContain('dal 05/10 al 11/10');
    expect(ore.azione).toMatch(/Ore di lavoro/);
  });
});

describe('oggettoRiepilogoAllarmi', () => {
  it('indica quanti controlli sono da sistemare e la data', () => {
    const controlli = costruisciControlliRiepilogo(
      input({
        giornata: {
          ora: ORA_10_30,
          stato: { nessunDatoAtteso: false, presenzeIncomplete: true, pastiNonConfermati: true },
        },
      })
    );
    expect(oggettoRiepilogoAllarmi(controlli, '2026-10-12')).toBe('Allarmi: 2 controlli da sistemare — lunedì 12 ottobre 2026');
  });

  it('al singolare con un solo controllo', () => {
    const controlli = costruisciControlliRiepilogo(
      input({
        giornata: {
          ora: ORA_10_30,
          stato: { nessunDatoAtteso: false, presenzeIncomplete: true, pastiNonConfermati: false },
        },
      })
    );
    expect(oggettoRiepilogoAllarmi(controlli, '2026-10-12')).toBe('Allarmi: 1 controllo da sistemare — lunedì 12 ottobre 2026');
  });
});

describe('htmlRiepilogoAllarmi', () => {
  it('riporta tutti i controlli con ora e stato, anche quelli a posto', () => {
    const controlli = costruisciControlliRiepilogo(
      input({
        giornata: {
          ora: ORA_10_30,
          stato: { nessunDatoAtteso: false, presenzeIncomplete: true, pastiNonConfermati: false },
        },
      })
    );
    const html = htmlRiepilogoAllarmi(controlli, '2026-10-12');
    expect(html).toContain('Appello');
    expect(html).toContain('Pasti a Rojac');
    expect(html).toContain('Rette ai genitori');
    expect(html).toContain('Mail mensile dei pasti a Rojac');
    expect(html).toContain('Ore di lavoro');
    expect(html).toContain('10:30');
    expect(html).toContain('11:45');
    expect(html).toContain('DA SISTEMARE');
    expect(html).toContain('OK');
    expect(html).toContain('NON ANCORA CONTROLLATO');
    expect(html).toContain('Cosa fare');
  });

  it('prima delle 10:00 spiega perché i controlli di giornata non sono stati fatti', () => {
    const controlli = costruisciControlliRiepilogo(input({ dopoOrario: false, giornata: null }));
    const html = htmlRiepilogoAllarmi(controlli, '2026-10-12');
    expect(html).toContain('NON APPLICABILE OGGI');
    expect(html).toContain('prima delle 10:00');
  });

  it("esegue l'escape dei dati liberi (nomi, sezioni)", () => {
    const controlli = costruisciControlliRiepilogo(
      input({
        oggi: '2026-10-20',
        rette: {
          ora: ORA_11_45,
          mancanti: [{ id: 'b1', nome: '<b>Anna</b>', cognome: 'Rossi', sezione: '<i>X</i>' }],
        },
        ore: {
          ora: ORA_11_45,
          intervallo: 'dal 05/10 al 11/10',
          utenti: [{ utenteId: 'u1', nome: '<script>', cognome: 'Verdi', email: 'a&b@example.test' }],
        },
      })
    );
    const html = htmlRiepilogoAllarmi(controlli, '2026-10-20');
    expect(html).not.toContain('<b>Anna</b>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<i>X</i>');
    expect(html).toContain('&lt;b&gt;Anna&lt;/b&gt;');
    expect(html).toContain('a&amp;b@example.test');
  });
});
