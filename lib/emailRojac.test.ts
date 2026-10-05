import { describe, expect, it } from 'vitest';
import {
  PASTI_INSEGNANTI_AL_GIORNO,
  componiEmailRojac,
  giorniScuolaMese,
  meseInviabileRojac,
  riepilogoMensileRojac,
} from './emailRojac';

const chiusura = (dataInizio: string, dataFine: string) => ({ id: 'x', dataInizio, dataFine, nota: null });

// Specs/61 - email-pasti-rojac.md: funzioni pure, nessun I/O.
describe('giorniScuolaMese', () => {
  it('un mese passato intero senza chiusure: solo i giorni feriali (settembre 2026 = 22)', () => {
    expect(giorniScuolaMese('2026-09', [], '2026-10-05')).toBe(22);
  });

  it('esclude i giorni dentro una chiusura registrata', () => {
    // 2026-09-14 (lun) .. 2026-09-16 (mer) = 3 feriali chiusi
    expect(giorniScuolaMese('2026-09', [chiusura('2026-09-14', '2026-09-16')], '2026-10-05')).toBe(19);
  });

  it('non conta il weekend incluso in una chiusura due volte', () => {
    // chiusura venerdì 4 → lunedì 7 settembre 2026: chiusi 2 feriali (ven, lun)
    expect(giorniScuolaMese('2026-09', [chiusura('2026-09-04', '2026-09-07')], '2026-10-05')).toBe(20);
  });

  it('nel mese corrente conta solo fino a oggi compreso', () => {
    // 1-4 ottobre 2026: gio 1, ven 2 (sab 3 e dom 4 chiusi); oggi lun 5 conta
    expect(giorniScuolaMese('2026-10', [], '2026-10-05')).toBe(3);
  });

  it('oggi di sabato nel mese corrente non aggiunge giorni', () => {
    expect(giorniScuolaMese('2026-10', [], '2026-10-03')).toBe(2);
  });

  it('un mese futuro non ha giorni di scuola da contare', () => {
    expect(giorniScuolaMese('2026-11', [], '2026-10-05')).toBe(0);
  });

  it('un giorno di scuola conta anche senza comunicazione pasti: non dipende dai pasti', () => {
    expect(giorniScuolaMese('2020-01', [], '2026-10-05')).toBe(23);
  });
});

describe('meseInviabileRojac', () => {
  it('il mese corrente e quelli passati sì', () => {
    expect(meseInviabileRojac('2026-10', '2026-10')).toBe(true);
    expect(meseInviabileRojac('2026-09', '2026-10')).toBe(true);
  });

  it('un mese futuro no', () => {
    expect(meseInviabileRojac('2026-11', '2026-10')).toBe(false);
  });

  it('un formato non valido no', () => {
    expect(meseInviabileRojac('2026-10-01', '2026-10')).toBe(false);
    expect(meseInviabileRojac('ottobre', '2026-10')).toBe(false);
  });
});

describe('riepilogoMensileRojac', () => {
  it('i pasti insegnanti sono 2 per ogni giorno di scuola e il totale somma tutto', () => {
    expect(PASTI_INSEGNANTI_AL_GIORNO).toBe(2);
    const r = riepilogoMensileRojac({ mese: '2026-09', pastiBambini: 250, chiusure: [], oggiData: '2026-10-05' });
    expect(r).toEqual({
      mese: '2026-09',
      pastiBambini: 250,
      giorniScuola: 22,
      pastiInsegnanti: 44,
      totalePasti: 294,
    });
  });

  it('un mese senza pasti comunicati ha comunque i pasti insegnanti', () => {
    const r = riepilogoMensileRojac({ mese: '2020-01', pastiBambini: 0, chiusure: [], oggiData: '2026-10-05' });
    expect(r.pastiInsegnanti).toBe(46);
    expect(r.totalePasti).toBe(46);
  });
});

describe('componiEmailRojac', () => {
  const riepilogo = { mese: '2026-09', pastiBambini: 250, giorniScuola: 22, pastiInsegnanti: 44, totalePasti: 294 };

  it('sostituisce i segnaposto in oggetto e corpo, con il mese in italiano', () => {
    const { oggetto, html } = componiEmailRojac(
      {
        oggetto: 'Pasti {{mese}}',
        corpo: 'Bambini: {{pasti_bambini}}\nInsegnanti: {{pasti_insegnanti}} ({{giorni_scuola}} giorni)\nTotale: {{totale_pasti}}',
      },
      riepilogo
    );
    expect(oggetto).toBe('Pasti settembre 2026');
    expect(html).toBe('Bambini: 250<br>Insegnanti: 44 (22 giorni)<br>Totale: 294');
  });

  it('restituisce anche il corpo come testo semplice per l\'anteprima', () => {
    const { testo } = componiEmailRojac({ oggetto: 'x', corpo: 'Totale: {{totale_pasti}}\n<ok>' }, riepilogo);
    expect(testo).toBe('Totale: 294\n<ok>');
  });

  it('un segnaposto sconosciuto resta invariato', () => {
    const { html } = componiEmailRojac({ oggetto: 'x', corpo: 'Ciao {{nome}}' }, riepilogo);
    expect(html).toBe('Ciao {{nome}}');
  });

  it('escapa il markup del modello (testo, non HTML)', () => {
    const { html } = componiEmailRojac({ oggetto: 'x', corpo: '<b>Pasti</b> & altro' }, riepilogo);
    expect(html).toBe('&lt;b&gt;Pasti&lt;/b&gt; &amp; altro');
  });
});
