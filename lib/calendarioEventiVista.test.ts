import { describe, expect, it } from 'vitest';
import {
  costruisciVistaEventi,
  dataRoma,
  descriviOrario,
  intervalloGiorniEvento,
  oraRoma,
  type EventoRiga,
} from './calendarioEventiVista';

function evento(parziale: Partial<EventoRiga> & Pick<EventoRiga, 'inizio' | 'fine'>): EventoRiga {
  return {
    id: parziale.id ?? `${parziale.inizio}`,
    titolo: parziale.titolo ?? 'Evento',
    descrizione: parziale.descrizione ?? null,
    luogo: parziale.luogo ?? null,
    tutto_il_giorno: false,
    ...parziale,
  };
}

// Mezzanotte Europe/Rome di ottobre (CEST, UTC+2) e di gennaio (CET, UTC+1).
const MEZZANOTTE_OTT = (giorno: number) => `2026-10-${String(giorno - 1).padStart(2, '0')}T22:00:00Z`;

describe('dataRoma / oraRoma', () => {
  it('usa il fuso Europe/Rome con l\'ora legale (UTC+2)', () => {
    expect(dataRoma('2026-10-14T22:30:00Z')).toBe('2026-10-15');
    expect(oraRoma('2026-10-14T22:30:00Z')).toBe('00:30');
  });

  it('usa il fuso Europe/Rome con l\'ora solare (UTC+1)', () => {
    expect(dataRoma('2026-12-31T23:30:00Z')).toBe('2027-01-01');
    expect(oraRoma('2026-12-31T08:05:00Z')).toBe('09:05');
  });

  it('mostra la mezzanotte come 00:00, mai 24:00', () => {
    expect(oraRoma(MEZZANOTTE_OTT(20))).toBe('00:00');
  });
});

describe('intervalloGiorniEvento', () => {
  it('evento con orario nello stesso giorno', () => {
    const e = evento({ inizio: '2026-10-20T08:00:00Z', fine: '2026-10-20T09:00:00Z' });
    expect(intervalloGiorniEvento(e)).toEqual({ primo: '2026-10-20', ultimo: '2026-10-20' });
  });

  it('un evento di tutto il giorno ha la fine esclusa: l\'ultimo giorno è quello prima', () => {
    const e = evento({ inizio: MEZZANOTTE_OTT(20), fine: MEZZANOTTE_OTT(21), tutto_il_giorno: true });
    expect(intervalloGiorniEvento(e)).toEqual({ primo: '2026-10-20', ultimo: '2026-10-20' });
  });

  it('un evento di tutto il giorno su tre giorni', () => {
    const e = evento({ inizio: MEZZANOTTE_OTT(20), fine: MEZZANOTTE_OTT(23), tutto_il_giorno: true });
    expect(intervalloGiorniEvento(e)).toEqual({ primo: '2026-10-20', ultimo: '2026-10-22' });
  });

  it('un evento con orario che finisce a mezzanotte in punto finisce il giorno prima', () => {
    const e = evento({ inizio: '2026-10-20T18:00:00Z', fine: MEZZANOTTE_OTT(21) });
    expect(intervalloGiorniEvento(e)).toEqual({ primo: '2026-10-20', ultimo: '2026-10-20' });
  });

  it('un evento con orario a cavallo della mezzanotte occupa due giorni', () => {
    const e = evento({ inizio: '2026-10-20T20:00:00Z', fine: '2026-10-21T07:00:00Z' });
    expect(intervalloGiorniEvento(e)).toEqual({ primo: '2026-10-20', ultimo: '2026-10-21' });
  });

  it('un evento di durata zero resta nel suo giorno', () => {
    const e = evento({ inizio: '2026-10-20T08:00:00Z', fine: '2026-10-20T08:00:00Z' });
    expect(intervalloGiorniEvento(e)).toEqual({ primo: '2026-10-20', ultimo: '2026-10-20' });
  });

  it('un evento che comincia a mezzanotte e finisce a mezzanotte (24 ore) non va prima dell\'inizio', () => {
    const e = evento({ inizio: MEZZANOTTE_OTT(20), fine: MEZZANOTTE_OTT(20) });
    expect(intervalloGiorniEvento(e)).toEqual({ primo: '2026-10-20', ultimo: '2026-10-20' });
  });
});

describe('descriviOrario', () => {
  it('intervallo orario nello stesso giorno, in ora di Roma', () => {
    const e = evento({ inizio: '2026-10-20T08:00:00Z', fine: '2026-10-20T09:15:00Z' });
    expect(descriviOrario(e)).toEqual({ tutto: false, testo: '10:00 – 11:15', intervallo: null });
  });

  it('solo l\'ora di inizio se fine = inizio', () => {
    const e = evento({ inizio: '2026-10-20T08:00:00Z', fine: '2026-10-20T08:00:00Z' });
    expect(descriviOrario(e).testo).toBe('10:00');
  });

  it('di tutto il giorno: etichetta senza orario e nessun intervallo per un solo giorno', () => {
    const e = evento({ inizio: MEZZANOTTE_OTT(20), fine: MEZZANOTTE_OTT(21), tutto_il_giorno: true });
    expect(descriviOrario(e)).toEqual({ tutto: true, testo: 'Tutto il giorno', intervallo: null });
  });

  it('di tutto il giorno su più giorni: intervallo dei giorni', () => {
    const e = evento({ inizio: MEZZANOTTE_OTT(20), fine: MEZZANOTTE_OTT(23), tutto_il_giorno: true });
    expect(descriviOrario(e)).toEqual({ tutto: true, testo: 'Tutto il giorno', intervallo: '20 ott – 22 ott' });
  });

  it('con orario a cavallo della mezzanotte: inizio e fine con data e ora', () => {
    const e = evento({ inizio: '2026-10-20T20:00:00Z', fine: '2026-10-21T07:00:00Z' });
    expect(descriviOrario(e)).toEqual({
      tutto: false,
      testo: '20 ott, 22:00 – 21 ott, 09:00',
      intervallo: null,
    });
  });
});

describe('costruisciVistaEventi', () => {
  const OGGI = '2026-10-15';

  it('senza eventi: nessun mese', () => {
    expect(costruisciVistaEventi([], OGGI)).toEqual({ prossimi: [], passati: [] });
  });

  it('raggruppa per mese e per giorno, in ordine di data', () => {
    const righe = [
      evento({ id: 'b', titolo: 'B', inizio: '2026-11-03T08:00:00Z', fine: '2026-11-03T09:00:00Z' }),
      evento({ id: 'a2', titolo: 'A2', inizio: '2026-10-20T13:00:00Z', fine: '2026-10-20T14:00:00Z' }),
      evento({ id: 'a1', titolo: 'A1', inizio: '2026-10-20T08:00:00Z', fine: '2026-10-20T09:00:00Z' }),
      evento({ id: 'c', titolo: 'C', inizio: '2026-10-25T08:00:00Z', fine: '2026-10-25T09:00:00Z' }),
    ];
    const { prossimi, passati } = costruisciVistaEventi(righe, OGGI);

    expect(passati).toEqual([]);
    expect(prossimi.map((m) => m.chiave)).toEqual(['2026-10', '2026-11']);
    expect(prossimi[0].titolo).toBe('ottobre 2026');
    expect(prossimi[0].giorni.map((g) => g.data)).toEqual(['2026-10-20', '2026-10-25']);
    expect(prossimi[0].giorni[0].eventi.map((e) => e.id)).toEqual(['a1', 'a2']);
    expect(prossimi[0].giorni[0]).toMatchObject({ nomeGiorno: 'mar', numero: '20', eOggi: false });
    expect(prossimi[1].giorni[0].eventi.map((e) => e.id)).toEqual(['b']);
  });

  it('nello stesso giorno gli eventi di tutto il giorno vengono prima di quelli con orario', () => {
    const righe = [
      evento({ id: 'ora', inizio: '2026-10-20T06:00:00Z', fine: '2026-10-20T07:00:00Z' }),
      evento({ id: 'giorno', inizio: MEZZANOTTE_OTT(20), fine: MEZZANOTTE_OTT(21), tutto_il_giorno: true }),
    ];
    const { prossimi } = costruisciVistaEventi(righe, OGGI);
    expect(prossimi[0].giorni[0].eventi.map((e) => e.id)).toEqual(['giorno', 'ora']);
  });

  it('separa i passati (ultimo giorno prima di oggi), dal più recente, mese per mese', () => {
    const righe = [
      evento({ id: 'v1', inizio: '2026-09-20T08:00:00Z', fine: '2026-09-20T09:00:00Z' }),
      evento({ id: 'v2', inizio: '2026-10-10T08:00:00Z', fine: '2026-10-10T09:00:00Z' }),
      evento({ id: 'v3', inizio: '2026-10-12T08:00:00Z', fine: '2026-10-12T09:00:00Z' }),
      evento({ id: 'f', inizio: '2026-10-16T08:00:00Z', fine: '2026-10-16T09:00:00Z' }),
    ];
    const { prossimi, passati } = costruisciVistaEventi(righe, OGGI);

    expect(prossimi.flatMap((m) => m.giorni.flatMap((g) => g.eventi.map((e) => e.id)))).toEqual(['f']);
    expect(passati.map((m) => m.chiave)).toEqual(['2026-10', '2026-09']);
    expect(passati[0].giorni.map((g) => g.data)).toEqual(['2026-10-12', '2026-10-10']);
    expect(passati.flatMap((m) => m.giorni.flatMap((g) => g.eventi.map((e) => e.id)))).toEqual(['v3', 'v2', 'v1']);
  });

  it('un evento di oggi, anche se già finito, resta tra i prossimi e il giorno è "oggi"', () => {
    const righe = [evento({ id: 'o', inizio: '2026-10-15T05:00:00Z', fine: '2026-10-15T06:00:00Z' })];
    const { prossimi } = costruisciVistaEventi(righe, OGGI);
    expect(prossimi[0].giorni[0]).toMatchObject({ data: OGGI, eOggi: true });
  });

  it('un evento su più giorni compare una volta sola, nel giorno d\'inizio', () => {
    const righe = [evento({ id: 'm', inizio: MEZZANOTTE_OTT(20), fine: MEZZANOTTE_OTT(23), tutto_il_giorno: true })];
    const { prossimi } = costruisciVistaEventi(righe, OGGI);
    const giorni = prossimi.flatMap((m) => m.giorni);
    expect(giorni.map((g) => g.data)).toEqual(['2026-10-20']);
    expect(giorni[0].eventi[0]).toMatchObject({ id: 'm', multiGiorno: true, inCorso: false });
  });

  it('un evento su più giorni già cominciato sta sotto oggi, segnato "in corso"', () => {
    const righe = [evento({ id: 'm', inizio: MEZZANOTTE_OTT(14), fine: MEZZANOTTE_OTT(18), tutto_il_giorno: true })];
    const { prossimi, passati } = costruisciVistaEventi(righe, OGGI);
    expect(passati).toEqual([]);
    expect(prossimi[0].giorni[0]).toMatchObject({ data: OGGI, eOggi: true });
    expect(prossimi[0].giorni[0].eventi[0]).toMatchObject({ id: 'm', inCorso: true, multiGiorno: true });
  });

  it('un evento su più giorni concluso ieri è passato', () => {
    const righe = [evento({ id: 'm', inizio: MEZZANOTTE_OTT(12), fine: MEZZANOTTE_OTT(15), tutto_il_giorno: true })];
    const { prossimi, passati } = costruisciVistaEventi(righe, OGGI);
    expect(prossimi).toEqual([]);
    expect(passati[0].giorni[0].data).toBe('2026-10-12');
  });

  it('titolo vuoto: segnaposto; luogo e descrizione vuoti diventano null; testo non alterato', () => {
    const righe = [
      evento({
        id: 'x',
        titolo: '   ',
        luogo: '  ',
        descrizione: '<b>ciao</b>\njavascript:alert(1)',
        inizio: '2026-10-20T08:00:00Z',
        fine: '2026-10-20T09:00:00Z',
      }),
    ];
    const { prossimi } = costruisciVistaEventi(righe, OGGI);
    expect(prossimi[0].giorni[0].eventi[0]).toMatchObject({
      titolo: '(Senza titolo)',
      luogo: null,
      descrizione: '<b>ciao</b>\njavascript:alert(1)',
    });
  });
});
