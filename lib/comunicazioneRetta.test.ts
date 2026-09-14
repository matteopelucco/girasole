import { describe, expect, it } from 'vitest';
import {
  calcolaRiepilogoRetta,
  formattaImporto,
  giorniAperturaMese,
  meseRettaRichiesto,
  sostituisciPlaceholder,
} from './comunicazioneRetta';

describe('meseRettaRichiesto', () => {
  it('senza richiesta usa il mese corrente', () => {
    expect(meseRettaRichiesto(undefined, '2026-09')).toBe('2026-09');
  });

  it('un formato non valido usa il mese corrente', () => {
    expect(meseRettaRichiesto('non-un-mese', '2026-09')).toBe('2026-09');
    expect(meseRettaRichiesto('2026-09-01', '2026-09')).toBe('2026-09');
  });

  it('un mese passato valido viene accettato', () => {
    expect(meseRettaRichiesto('2026-07', '2026-09')).toBe('2026-07');
  });

  it('il mese corrente richiesto esplicitamente viene accettato', () => {
    expect(meseRettaRichiesto('2026-09', '2026-09')).toBe('2026-09');
  });

  it('un mese futuro viene clampato al mese corrente', () => {
    expect(meseRettaRichiesto('2026-12', '2026-09')).toBe('2026-09');
  });
});

// giorniAperturaMese è pura (nessun I/O): copre weekend, giorni di
// chiusura registrati e mesi senza nessuna chiusura di specs/56 -
// comunicazione-retta-mensile.md.
describe('giorniAperturaMese', () => {
  it('settembre 2026 (22 giorni feriali) senza nessuna chiusura registrata', () => {
    expect(giorniAperturaMese('2026-09', [])).toBe(22);
  });

  it('sottrae un giorno di chiusura infrasettimanale registrato', () => {
    const chiusure = [{ id: '1', dataInizio: '2026-09-08', dataFine: '2026-09-08', nota: 'Festa' }];
    expect(giorniAperturaMese('2026-09', chiusure)).toBe(21);
  });

  it('un giorno di chiusura di weekend non sottrae nulla in più (già escluso)', () => {
    // Il 5 settembre 2026 è sabato.
    const chiusure = [{ id: '1', dataInizio: '2026-09-05', dataFine: '2026-09-05', nota: null }];
    expect(giorniAperturaMese('2026-09', chiusure)).toBe(22);
  });

  it('una chiusura di più giorni sottrae tutti i giorni feriali coperti', () => {
    // 24-31 dicembre 2026: include il weekend 26-27.
    const chiusure = [{ id: '1', dataInizio: '2026-12-24', dataFine: '2026-12-31', nota: 'Vacanze' }];
    // Dicembre 2026 ha 23 giorni feriali; la chiusura copre 24,25,28,29,30,31 (6 feriali).
    expect(giorniAperturaMese('2026-12', chiusure)).toBe(17);
  });
});

describe('calcolaRiepilogoRetta', () => {
  const base = {
    prezzoMensile: 250,
    prezzoBuonoPasto: 5,
    giorniAperturaMeseCorrente: 20,
    giorniAssenzaMesePrecedente: 0,
    marcaDaBollo: 0,
    preAsiloRichiesto: false,
    prezzoPreAsilo: 0,
    postAsiloRichiesto: false,
    prezzoPostAsilo: 0,
    costiExtra: 0,
  };

  it('solo retta e pasti proiettati, nessun extra', () => {
    const riepilogo = calcolaRiepilogoRetta(base);
    expect(riepilogo).toEqual({
      rettaMensile: 250,
      costoPasti: 100,
      conguaglioPasti: 0,
      marcaDaBollo: 0,
      costoPreAsilo: 0,
      costoPostAsilo: 0,
      costiExtra: 0,
      totale: 350,
    });
  });

  it('la marca da bollo si somma al totale', () => {
    const riepilogo = calcolaRiepilogoRetta({ ...base, marcaDaBollo: 2 });
    expect(riepilogo.marcaDaBollo).toBe(2);
    expect(riepilogo.totale).toBe(352);
  });

  it('il conguaglio pasti è negativo, proporzionale ai giorni di assenza', () => {
    const riepilogo = calcolaRiepilogoRetta({ ...base, giorniAssenzaMesePrecedente: 4 });
    expect(riepilogo.conguaglioPasti).toBe(-20);
    expect(riepilogo.totale).toBe(330);
  });

  it('pre-asilo e post-asilo richiesti aggiungono il loro prezzo pieno', () => {
    const riepilogo = calcolaRiepilogoRetta({
      ...base,
      preAsiloRichiesto: true,
      prezzoPreAsilo: 30,
      postAsiloRichiesto: true,
      prezzoPostAsilo: 40,
    });
    expect(riepilogo.costoPreAsilo).toBe(30);
    expect(riepilogo.costoPostAsilo).toBe(40);
    expect(riepilogo.totale).toBe(420);
  });

  it('un prezzo pre-asilo impostato ma non richiesto non conta nel totale', () => {
    const riepilogo = calcolaRiepilogoRetta({ ...base, prezzoPreAsilo: 30, preAsiloRichiesto: false });
    expect(riepilogo.costoPreAsilo).toBe(0);
    expect(riepilogo.totale).toBe(350);
  });

  it('un costo extra si somma al totale', () => {
    const riepilogo = calcolaRiepilogoRetta({ ...base, costiExtra: 15.5 });
    expect(riepilogo.costiExtra).toBe(15.5);
    expect(riepilogo.totale).toBe(365.5);
  });

  it('il totale può risultare negativo se il conguaglio supera gli altri importi', () => {
    const riepilogo = calcolaRiepilogoRetta({
      prezzoMensile: 0,
      prezzoBuonoPasto: 5,
      giorniAperturaMeseCorrente: 0,
      giorniAssenzaMesePrecedente: 10,
      marcaDaBollo: 0,
      preAsiloRichiesto: false,
      prezzoPreAsilo: 0,
      postAsiloRichiesto: false,
      prezzoPostAsilo: 0,
      costiExtra: 0,
    });
    expect(riepilogo.totale).toBe(-50);
  });

  it('arrotonda a due decimali eventuali errori di somma in virgola mobile', () => {
    const riepilogo = calcolaRiepilogoRetta({ ...base, prezzoMensile: 0.1, costiExtra: 0.2 - 0.3 + 250 });
    expect(riepilogo.totale).toBe(350);
  });
});

describe('sostituisciPlaceholder', () => {
  it('sostituisce un placeholder singolo', () => {
    expect(sostituisciPlaceholder('Ciao {{nome}}!', { nome: 'Mario' })).toBe('Ciao Mario!');
  });

  it('sostituisce più occorrenze dello stesso placeholder', () => {
    expect(sostituisciPlaceholder('{{nome}} {{nome}}', { nome: 'Mario' })).toBe('Mario Mario');
  });

  it('sostituisce più placeholder diversi', () => {
    expect(sostituisciPlaceholder('{{nome}} {{cognome}}', { nome: 'Mario', cognome: 'Rossi' })).toBe(
      'Mario Rossi'
    );
  });

  it('lascia invariato un placeholder sconosciuto', () => {
    expect(sostituisciPlaceholder('Ciao {{sconosciuto}}', { nome: 'Mario' })).toBe('Ciao {{sconosciuto}}');
  });

  it('un testo senza placeholder resta invariato', () => {
    expect(sostituisciPlaceholder('Nessun placeholder qui', {})).toBe('Nessun placeholder qui');
  });
});

describe('formattaImporto', () => {
  it('formatta un importo intero con due decimali', () => {
    expect(formattaImporto(250)).toBe('250,00');
  });

  it('formatta zero', () => {
    expect(formattaImporto(0)).toBe('0,00');
  });

  it('formatta un importo negativo', () => {
    expect(formattaImporto(-20)).toBe('-20,00');
  });

  it('arrotonda a due decimali', () => {
    expect(formattaImporto(15.999)).toBe('16,00');
  });
});
