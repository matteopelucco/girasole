import { describe, expect, it } from 'vitest';
import { VTIMEZONE_ROMA } from './calendarioFusoRoma.mjs';
import { estraiBlocchiEvento } from './calendarioIcalMotore.mjs';
import {
  ErroreCalendario,
  MAX_ITERAZIONI_TOTALI,
  MESSAGGIO_INDIRIZZO_NON_VALIDO,
  analizzaFeedIcal,
  espandiEventiIcal,
  finestraSincronizzazione,
  problemaCalendario,
  problemaSincronizzazione,
  unisciProblemi,
  validaIndirizzoIcal,
} from './calendarioIcal';

// Finestra larga per i test sugli eventi: tutto il 2026 e il 2027.
const DA = new Date('2026-01-01T00:00:00Z');
const A = new Date('2028-01-01T00:00:00Z');

function evento(...righe: string[]): string {
  return ['BEGIN:VEVENT', 'DTSTAMP:20260101T000000Z', ...righe, 'END:VEVENT'].join('\r\n');
}

function feed(eventi: string[], conFuso = true): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Test//IT',
    ...(conFuso ? [VTIMEZONE_ROMA] : []),
    ...eventi,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

const espandi = (eventi: string[], conFuso = true, da = DA, a = A) => espandiEventiIcal(feed(eventi, conFuso), da, a);

describe('validaIndirizzoIcal', () => {
  const buono = 'https://calendar.google.com/calendar/ical/prova%40example.com/private-prova/basic.ics';

  it('accetta un indirizzo di Google Calendar e lo restituisce così com\'è', () => {
    expect(validaIndirizzoIcal(buono)).toEqual({ ok: true, indirizzo: buono });
    expect(validaIndirizzoIcal(`  ${buono}\n`)).toEqual({ ok: true, indirizzo: buono });
  });

  it('accetta il vecchio formato su www.google.com', () => {
    const vecchio = 'https://www.google.com/calendar/ical/prova/private-prova/basic.ics';
    expect(validaIndirizzoIcal(vecchio)).toEqual({ ok: true, indirizzo: vecchio });
  });

  it('il campo vuoto significa sincronizzazione disattivata', () => {
    expect(validaIndirizzoIcal('')).toEqual({ ok: true, indirizzo: null });
    expect(validaIndirizzoIcal('   ')).toEqual({ ok: true, indirizzo: null });
  });

  it.each([
    ['http invece di https', 'http://calendar.google.com/calendar/ical/x/private-y/basic.ics'],
    ['host non di Google', 'https://example.com/calendar/ical/x/private-y/basic.ics'],
    ['host che inizia come Google', 'https://calendar.google.com.example.com/calendar/ical/x/basic.ics'],
    ['sottodominio inventato', 'https://evil.calendar.google.com/calendar/ical/x/basic.ics'],
    ['non finisce con .ics', 'https://calendar.google.com/calendar/ical/x/private-y/basic.txt'],
    ['credenziali nell\'indirizzo', 'https://utente:pw@calendar.google.com/calendar/ical/x/basic.ics'],
    ['porta esplicita', 'https://calendar.google.com:8443/calendar/ical/x/basic.ics'],
    ['frammento', 'https://calendar.google.com/calendar/ical/x/basic.ics#a'],
    ['spazi dentro', 'https://calendar.google.com/calendar/ical/x y/basic.ics'],
    ['non è un indirizzo', 'non-un-indirizzo.ics'],
    ['troppo lungo', `https://calendar.google.com/${'a'.repeat(2100)}.ics`],
    ['.ics solo nella query', 'https://calendar.google.com/calendar/ical/x/basic?f=a.ics'],
  ])('rifiuta: %s', (_nome, valore) => {
    const esito = validaIndirizzoIcal(valore);
    expect(esito).toEqual({ ok: false, messaggio: MESSAGGIO_INDIRIZZO_NON_VALIDO });
  });

  it('il messaggio d\'errore non riporta l\'indirizzo digitato', () => {
    const digitato = 'https://segreto.example.com/chiave-molto-segreta.ics';
    const esito = validaIndirizzoIcal(digitato);
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.messaggio.includes('segreto')).toBe(false);
  });

  describe('origine di prova (solo e2e)', () => {
    const origine = 'http://127.0.0.1:4318';
    const prova = `${origine}/calendar/ical/prova/private-prova/basic.ics`;

    it('accetta l\'indirizzo di prova solo se l\'ambiente lo consente', () => {
      expect(validaIndirizzoIcal(prova, { CALENDARIO_ICAL_PROVA_ORIGINE: origine })).toEqual({ ok: true, indirizzo: prova });
      expect(validaIndirizzoIcal(prova, {}).ok).toBe(false);
    });

    it('la ignora su Vercel, in qualunque ambiente', () => {
      expect(validaIndirizzoIcal(prova, { CALENDARIO_ICAL_PROVA_ORIGINE: origine, VERCEL: '1' }).ok).toBe(false);
      expect(validaIndirizzoIcal(prova, { CALENDARIO_ICAL_PROVA_ORIGINE: origine, VERCEL: '1', VERCEL_ENV: 'preview' }).ok).toBe(false);
    });

    it('la ignora in produzione', () => {
      expect(validaIndirizzoIcal(prova, { CALENDARIO_ICAL_PROVA_ORIGINE: origine, VERCEL_ENV: 'production' }).ok).toBe(false);
    });

    it('accetta solo origini locali di prova e solo quella configurata', () => {
      expect(validaIndirizzoIcal('http://10.0.0.1:4318/x.ics', { CALENDARIO_ICAL_PROVA_ORIGINE: 'http://10.0.0.1:4318' }).ok).toBe(false);
      expect(validaIndirizzoIcal('http://127.0.0.1:9999/x.ics', { CALENDARIO_ICAL_PROVA_ORIGINE: origine }).ok).toBe(false);
      expect(validaIndirizzoIcal(`${origine}/x.txt`, { CALENDARIO_ICAL_PROVA_ORIGINE: origine }).ok).toBe(false);
    });
  });
});

describe('finestraSincronizzazione', () => {
  it('va da 30 giorni prima a 12 mesi dopo', () => {
    const { da, a } = finestraSincronizzazione(new Date('2026-10-17T10:00:00Z'));
    expect(da.toISOString()).toBe('2026-09-17T10:00:00.000Z');
    expect(a.toISOString()).toBe('2027-10-17T10:00:00.000Z');
  });
});

describe('problemaCalendario e unisciProblemi', () => {
  it('compone una frase fissa per ogni motivo', () => {
    expect(problemaCalendario('non_raggiungibile')).toBe('Calendario non sincronizzato: servizio non raggiungibile.');
    expect(problemaCalendario('feed_non_valido')).toBe('Calendario non sincronizzato: feed non valido.');
  });

  it('solo una sincronizzazione fallita è un problema', () => {
    expect(problemaSincronizzazione({ stato: 'disattivata' })).toBeNull();
    expect(problemaSincronizzazione({ stato: 'ok', inseriti: 1, aggiornati: 0, rimossi: 0, totale: 1 })).toBeNull();
    expect(problemaSincronizzazione({ stato: 'errore', motivo: 'risposta_non_valida' })).toBe(
      'Calendario non sincronizzato: risposta non valida.'
    );
  });

  it('unisce i problemi presenti e ignora gli altri', () => {
    expect(unisciProblemi(null, undefined)).toBeNull();
    expect(unisciProblemi('A.', null)).toBe('A.');
    expect(unisciProblemi('A.', 'B.')).toBe('A. B.');
  });
});

describe('espandiEventiIcal: eventi singoli', () => {
  it('un evento con orario, in estate (ora legale, UTC+2)', () => {
    const [e] = espandi([
      evento(
        'UID:singolo@test',
        'DTSTART;TZID=Europe/Rome:20260707T100000',
        'DTEND;TZID=Europe/Rome:20260707T113000',
        'SUMMARY:Festa',
        'LOCATION:Salone',
        'DESCRIPTION:Portare il cappello\\, grazie\\nA presto'
      ),
    ]);
    expect(e).toEqual({
      id_esterno: 'singolo@test',
      titolo: 'Festa',
      descrizione: 'Portare il cappello, grazie\nA presto',
      luogo: 'Salone',
      inizio: '2026-07-07T08:00:00.000Z',
      fine: '2026-07-07T09:30:00.000Z',
      tutto_il_giorno: false,
    });
  });

  it('un evento con orario, in inverno (ora solare, UTC+1)', () => {
    const [e] = espandi([
      evento('UID:inverno@test', 'DTSTART;TZID=Europe/Rome:20261210T100000', 'DTEND;TZID=Europe/Rome:20261210T110000', 'SUMMARY:Natale'),
    ]);
    expect(e.inizio).toBe('2026-12-10T09:00:00.000Z');
    expect(e.fine).toBe('2026-12-10T10:00:00.000Z');
  });

  it('un evento in UTC (Z) resta lo stesso istante', () => {
    const [e] = espandi([evento('UID:utc@test', 'DTSTART:20260715T080000Z', 'DTEND:20260715T090000Z', 'SUMMARY:UTC')]);
    expect(e.inizio).toBe('2026-07-15T08:00:00.000Z');
    expect(e.fine).toBe('2026-07-15T09:00:00.000Z');
  });

  it('un orario senza fuso è l\'ora di Roma', () => {
    const [e] = espandi([evento('UID:fluttuante@test', 'DTSTART:20260715T100000', 'DTEND:20260715T110000', 'SUMMARY:Fluttuante')]);
    expect(e.inizio).toBe('2026-07-15T08:00:00.000Z');
  });

  it('usa Europe/Rome anche se il feed non ne include la definizione', () => {
    const [estate, inverno] = espandi(
      [
        evento('UID:a@test', 'DTSTART;TZID=Europe/Rome:20260707T100000', 'DTEND;TZID=Europe/Rome:20260707T110000', 'SUMMARY:A'),
        evento('UID:b@test', 'DTSTART;TZID=Europe/Rome:20261210T100000', 'DTEND;TZID=Europe/Rome:20261210T110000', 'SUMMARY:B'),
      ],
      false
    );
    expect(estate.inizio).toBe('2026-07-07T08:00:00.000Z');
    expect(inverno.inizio).toBe('2026-12-10T09:00:00.000Z');
  });

  it('senza fine, un evento con orario finisce quando inizia', () => {
    const [e] = espandi([evento('UID:senzafine@test', 'DTSTART;TZID=Europe/Rome:20260707T100000', 'SUMMARY:Senza fine')]);
    expect(e.fine).toBe(e.inizio);
  });

  it('la durata (DURATION) vale come fine', () => {
    const [e] = espandi([evento('UID:durata@test', 'DTSTART;TZID=Europe/Rome:20260707T100000', 'DURATION:PT2H', 'SUMMARY:Durata')]);
    expect(e.fine).toBe('2026-07-07T10:00:00.000Z');
  });

  it('un evento di tutto il giorno va da mezzanotte di Roma a mezzanotte del giorno dopo l\'ultimo', () => {
    const [estate, inverno] = espandi([
      evento('UID:gg-estate@test', 'DTSTART;VALUE=DATE:20260710', 'DTEND;VALUE=DATE:20260711', 'SUMMARY:Giornata estate'),
      evento('UID:gg-inverno@test', 'DTSTART;VALUE=DATE:20261101', 'DTEND;VALUE=DATE:20261103', 'SUMMARY:Due giorni inverno'),
    ]);
    expect(estate).toMatchObject({ tutto_il_giorno: true, inizio: '2026-07-09T22:00:00.000Z', fine: '2026-07-10T22:00:00.000Z' });
    expect(inverno).toMatchObject({ tutto_il_giorno: true, inizio: '2026-10-31T23:00:00.000Z', fine: '2026-11-02T23:00:00.000Z' });
  });

  it('un evento di tutto il giorno senza fine dura quel giorno', () => {
    const [e] = espandi([evento('UID:ggsenzafine@test', 'DTSTART;VALUE=DATE:20260710', 'SUMMARY:Un giorno')]);
    expect(e).toMatchObject({ inizio: '2026-07-09T22:00:00.000Z', fine: '2026-07-10T22:00:00.000Z' });
  });

  it('un evento annullato non compare', () => {
    const eventi = espandi([
      evento('UID:annullato@test', 'DTSTART;TZID=Europe/Rome:20260707T100000', 'DTEND;TZID=Europe/Rome:20260707T110000', 'STATUS:CANCELLED', 'SUMMARY:Annullato'),
      evento('UID:valido@test', 'DTSTART;TZID=Europe/Rome:20260708T100000', 'DTEND;TZID=Europe/Rome:20260708T110000', 'STATUS:CONFIRMED', 'SUMMARY:Valido'),
    ]);
    expect(eventi.map((e) => e.id_esterno)).toEqual(['valido@test']);
  });

  it('un titolo mancante diventa "(senza titolo)" e i testi lunghi sono accorciati', () => {
    const [vuoto, lungo] = espandi([
      evento('UID:vuoto@test', 'DTSTART;TZID=Europe/Rome:20260707T100000', 'DTEND;TZID=Europe/Rome:20260707T110000'),
      evento(
        'UID:lungo@test',
        'DTSTART;TZID=Europe/Rome:20260708T100000',
        'DTEND;TZID=Europe/Rome:20260708T110000',
        `SUMMARY:${'T'.repeat(400)}`,
        `DESCRIPTION:${'D'.repeat(6000)}`,
        `LOCATION:${'L'.repeat(600)}`
      ),
    ]);
    expect(vuoto.titolo).toBe('(senza titolo)');
    expect(vuoto.descrizione).toBeNull();
    expect(vuoto.luogo).toBeNull();
    expect(lungo.titolo).toHaveLength(300);
    expect(lungo.descrizione).toHaveLength(5000);
    expect(lungo.luogo).toHaveLength(500);
  });

  it('un evento senza UID o senza data di inizio si salta, gli altri restano', () => {
    const eventi = espandi([
      evento('DTSTART;TZID=Europe/Rome:20260707T100000', 'SUMMARY:Senza UID'),
      evento('UID:senzadata@test', 'SUMMARY:Senza data'),
      evento('UID:buono@test', 'DTSTART;TZID=Europe/Rome:20260708T100000', 'DTEND;TZID=Europe/Rome:20260708T110000', 'SUMMARY:Buono'),
    ]);
    expect(eventi.map((e) => e.id_esterno)).toEqual(['buono@test']);
  });
});

describe('espandiEventiIcal: finestra di tempo', () => {
  const singoli = [
    evento('UID:prima@test', 'DTSTART;TZID=Europe/Rome:20260301T100000', 'DTEND;TZID=Europe/Rome:20260301T110000', 'SUMMARY:Prima'),
    evento('UID:dentro@test', 'DTSTART;TZID=Europe/Rome:20260615T100000', 'DTEND;TZID=Europe/Rome:20260615T110000', 'SUMMARY:Dentro'),
    evento('UID:dopo@test', 'DTSTART;TZID=Europe/Rome:20261201T100000', 'DTEND;TZID=Europe/Rome:20261201T110000', 'SUMMARY:Dopo'),
  ];

  it('tiene solo gli eventi compresi tra le due date', () => {
    const eventi = espandi(singoli, true, new Date('2026-06-01T00:00:00Z'), new Date('2026-09-01T00:00:00Z'));
    expect(eventi.map((e) => e.id_esterno)).toEqual(['dentro@test']);
  });

  it('un evento iniziato prima ma ancora in corso a inizio finestra resta', () => {
    const lungo = evento('UID:lungo@test', 'DTSTART;VALUE=DATE:20260528', 'DTEND;VALUE=DATE:20260603', 'SUMMARY:Vacanza');
    const eventi = espandi([lungo], true, new Date('2026-06-01T00:00:00Z'), new Date('2026-09-01T00:00:00Z'));
    expect(eventi.map((e) => e.id_esterno)).toEqual(['lungo@test']);
  });

  it('l\'elenco è ordinato per inizio', () => {
    const eventi = espandi([...singoli].reverse());
    expect(eventi.map((e) => e.id_esterno)).toEqual(['prima@test', 'dentro@test', 'dopo@test']);
  });
});

describe('espandiEventiIcal: eventi ripetuti', () => {
  it('settimanale: una riga per occorrenza, sempre alle 10:00 di Roma anche a cavallo dell\'ora solare', () => {
    // Il 25/10/2026 si torna all'ora solare: 10:00 Roma = 08:00Z fino al 20/10, 09:00Z dal 27/10.
    const eventi = espandi([
      evento(
        'UID:sett@test',
        'DTSTART;TZID=Europe/Rome:20261013T100000',
        'DTEND;TZID=Europe/Rome:20261013T113000',
        'RRULE:FREQ=WEEKLY;COUNT=4',
        'SUMMARY:Riunione'
      ),
    ]);
    expect(eventi.map((e) => e.inizio)).toEqual([
      '2026-10-13T08:00:00.000Z',
      '2026-10-20T08:00:00.000Z',
      '2026-10-27T09:00:00.000Z',
      '2026-11-03T09:00:00.000Z',
    ]);
    expect(eventi.every((e) => e.titolo === 'Riunione')).toBe(true);
    expect(new Set(eventi.map((e) => e.id_esterno)).size).toBe(4);
    expect(eventi.every((e) => e.id_esterno.startsWith('sett@test#'))).toBe(true);
  });

  it('le date escluse (EXDATE) non compaiono', () => {
    const eventi = espandi([
      evento(
        'UID:ex@test',
        'DTSTART;TZID=Europe/Rome:20261006T100000',
        'DTEND;TZID=Europe/Rome:20261006T110000',
        'RRULE:FREQ=WEEKLY;COUNT=4',
        'EXDATE;TZID=Europe/Rome:20261020T100000',
        'SUMMARY:Con eccezione'
      ),
    ]);
    expect(eventi.map((e) => e.inizio.slice(0, 10))).toEqual(['2026-10-06', '2026-10-13', '2026-10-27']);
  });

  it('mensile con data di fine (UNTIL)', () => {
    const eventi = espandi([
      evento(
        'UID:mens@test',
        'DTSTART;TZID=Europe/Rome:20260115T160000',
        'DTEND;TZID=Europe/Rome:20260115T170000',
        'RRULE:FREQ=MONTHLY;UNTIL=20260515T000000Z',
        'SUMMARY:Colloqui'
      ),
    ]);
    expect(eventi.map((e) => e.inizio.slice(0, 10))).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
  });

  it('una ripetizione senza fine è limitata alla finestra', () => {
    const eventi = espandi(
      [
        evento(
          'UID:giornaliero@test',
          'DTSTART;TZID=Europe/Rome:20260101T080000',
          'DTEND;TZID=Europe/Rome:20260101T090000',
          'RRULE:FREQ=DAILY',
          'SUMMARY:Ogni giorno'
        ),
      ],
      true,
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-11T00:00:00Z')
    );
    expect(eventi).toHaveLength(10);
    expect(eventi[0].inizio).toBe('2026-06-01T06:00:00.000Z');
    expect(eventi[9].inizio).toBe('2026-06-10T06:00:00.000Z');
  });

  it('ripetuto di tutto il giorno', () => {
    const eventi = espandi([
      evento('UID:ggrip@test', 'DTSTART;VALUE=DATE:20260706', 'DTEND;VALUE=DATE:20260707', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:Giorno fisso'),
    ]);
    expect(eventi).toHaveLength(3);
    expect(eventi.every((e) => e.tutto_il_giorno)).toBe(true);
    expect(eventi[0]).toMatchObject({ inizio: '2026-07-05T22:00:00.000Z', fine: '2026-07-06T22:00:00.000Z' });
    expect(eventi[1].inizio).toBe('2026-07-12T22:00:00.000Z');
  });

  it('un\'occorrenza spostata (RECURRENCE-ID) sostituisce l\'originale e mantiene lo stesso id', () => {
    const serie = evento(
      'UID:spost@test',
      'DTSTART;TZID=Europe/Rome:20261006T100000',
      'DTEND;TZID=Europe/Rome:20261006T110000',
      'RRULE:FREQ=WEEKLY;COUNT=3',
      'SUMMARY:Lezione'
    );
    const prima = espandi([serie]);
    const spostata = evento(
      'UID:spost@test',
      'RECURRENCE-ID;TZID=Europe/Rome:20261013T100000',
      'DTSTART;TZID=Europe/Rome:20261014T150000',
      'DTEND;TZID=Europe/Rome:20261014T160000',
      'SUMMARY:Lezione spostata'
    );
    const dopo = espandi([serie, spostata]);

    expect(dopo).toHaveLength(3);
    const modificata = dopo.find((e) => e.titolo === 'Lezione spostata')!;
    expect(modificata.inizio).toBe('2026-10-14T13:00:00.000Z');
    expect(modificata.fine).toBe('2026-10-14T14:00:00.000Z');
    // Stesso id dell'occorrenza originale del 13/10: la riga si aggiorna, non si duplica.
    expect(modificata.id_esterno).toBe(prima[1].id_esterno);
    expect(dopo.filter((e) => e.inizio.startsWith('2026-10-13'))).toHaveLength(0);
  });

  it('un\'occorrenza annullata (RECURRENCE-ID con STATUS:CANCELLED) sparisce, le altre restano', () => {
    const eventi = espandi([
      evento(
        'UID:ann@test',
        'DTSTART;TZID=Europe/Rome:20261006T100000',
        'DTEND;TZID=Europe/Rome:20261006T110000',
        'RRULE:FREQ=WEEKLY;COUNT=3',
        'SUMMARY:Lezione'
      ),
      evento(
        'UID:ann@test',
        'RECURRENCE-ID;TZID=Europe/Rome:20261013T100000',
        'DTSTART;TZID=Europe/Rome:20261013T100000',
        'DTEND;TZID=Europe/Rome:20261013T110000',
        'STATUS:CANCELLED',
        'SUMMARY:Lezione'
      ),
    ]);
    expect(eventi.map((e) => e.inizio.slice(0, 10))).toEqual(['2026-10-06', '2026-10-20']);
  });

  it('una serie intera annullata non compare', () => {
    const eventi = espandi([
      evento(
        'UID:serieann@test',
        'DTSTART;TZID=Europe/Rome:20261006T100000',
        'DTEND;TZID=Europe/Rome:20261006T110000',
        'RRULE:FREQ=WEEKLY;COUNT=3',
        'STATUS:CANCELLED',
        'SUMMARY:Serie'
      ),
    ]);
    expect(eventi).toEqual([]);
  });

  it('un\'occorrenza modificata senza la serie nel feed è un evento a sé', () => {
    const eventi = espandi([
      evento(
        'UID:orfana@test',
        'RECURRENCE-ID;TZID=Europe/Rome:20261013T100000',
        'DTSTART;TZID=Europe/Rome:20261014T150000',
        'DTEND;TZID=Europe/Rome:20261014T160000',
        'SUMMARY:Orfana'
      ),
    ]);
    expect(eventi).toHaveLength(1);
    expect(eventi[0].titolo).toBe('Orfana');
    expect(eventi[0].id_esterno.startsWith('orfana@test#')).toBe(true);
  });
});

describe('espandiEventiIcal: idempotenza e feed non validi', () => {
  it('lo stesso feed dà sempre lo stesso risultato (anche con fusi registrati più volte)', () => {
    const testo = feed([
      evento('UID:x@test', 'DTSTART;TZID=Europe/Rome:20261006T100000', 'DTEND;TZID=Europe/Rome:20261006T110000', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:X'),
      evento('UID:y@test', 'DTSTART;VALUE=DATE:20261110', 'SUMMARY:Y'),
    ]);
    expect(espandiEventiIcal(testo, DA, A)).toEqual(espandiEventiIcal(testo, DA, A));
  });

  it('un calendario vuoto non ha eventi', () => {
    expect(espandi([])).toEqual([]);
  });

  it.each([
    ['testo qualunque', 'questo non è un calendario'],
    ['vuoto', ''],
    ['HTML', '<html><body>Accedi</body></html>'],
  ])('un feed non valido (%s) lancia ErroreCalendario("feed_non_valido")', (_nome, testo) => {
    let errore: unknown;
    try {
      espandiEventiIcal(testo, DA, A);
    } catch (e) {
      errore = e;
    }
    expect(errore).toBeInstanceOf(ErroreCalendario);
    expect((errore as ErroreCalendario).motivo).toBe('feed_non_valido');
  });
});

describe('espandiEventiIcal: regole di ripetizione pericolose o malformate', () => {
  const sano = evento('UID:sano@test', 'DTSTART;TZID=Europe/Rome:20260707T100000', 'DTEND;TZID=Europe/Rome:20260707T110000', 'SUMMARY:Sano');
  const serie = (uid: string, regola: string) =>
    evento(
      `UID:${uid}@test`,
      'DTSTART;TZID=Europe/Rome:20260105T100000',
      'DTEND;TZID=Europe/Rome:20260105T110000',
      `RRULE:${regola}`,
      `SUMMARY:${uid}`
    );
  const soloSani = (eventi: { id_esterno: string }[]) => eventi.map((e) => e.id_esterno);

  it('una regola impossibile (30 febbraio) non blocca l\'analisi: la serie si salta in meno di 1 secondo', () => {
    const inizio = Date.now();
    const eventi = espandi([serie('impossibile', 'FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30'), sano]);
    expect(Date.now() - inizio).toBeLessThan(1000);
    expect(soloSani(eventi)).toEqual(['sano@test']);
  });

  it.each([
    ['ogni secondo', 'FREQ=SECONDLY;COUNT=3'],
    ['ogni minuto', 'FREQ=MINUTELY;COUNT=3'],
    ['ogni ora', 'FREQ=HOURLY;COUNT=3'],
  ])('una ripetizione %s è saltata', (_nome, regola) => {
    expect(soloSani(espandi([serie('fitta', regola), sano]))).toEqual(['sano@test']);
  });

  it.each([
    ['DAILY con BYMONTHDAY', 'FREQ=DAILY;BYMONTHDAY=15;COUNT=3'],
    ['DAILY con BYYEARDAY', 'FREQ=DAILY;BYYEARDAY=100;COUNT=3'],
    ['WEEKLY con BYWEEKNO', 'FREQ=WEEKLY;BYWEEKNO=10;COUNT=3'],
    ['WEEKLY con BYSETPOS', 'FREQ=WEEKLY;BYDAY=MO,TU;BYSETPOS=1;COUNT=3'],
  ])('%s è saltata', (_nome, regola) => {
    expect(soloSani(espandi([serie('esclusa', regola), sano]))).toEqual(['sano@test']);
  });

  it('le frequenze ammesse (giornaliera, settimanale, mensile, annuale) restano espanse', () => {
    for (const regola of ['FREQ=DAILY;COUNT=3', 'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=3', 'FREQ=MONTHLY;BYMONTHDAY=5;COUNT=3', 'FREQ=YEARLY;COUNT=2']) {
      expect(espandi([serie('ok', regola)]).length).toBeGreaterThan(0);
    }
  });

  it('una regola malformata salta solo quella serie, non tutto il feed', () => {
    for (const regola of ['FREQ=DAILY;BYMONTH=13;COUNT=3', 'FREQ=MONTHLY;BYMONTHDAY=99;COUNT=3', 'FREQ=FOO', 'FREQ=WEEKLY;BYMONTH=2;BYDAY=MO;BYHOUR=25']) {
      expect(soloSani(espandi([serie('rotta', regola), sano]))).toEqual(['sano@test']);
    }
  });

  it('un feed con intestazione illeggibile resta un feed non valido', () => {
    expect(() => espandiEventiIcal(`BEGIN:VCALENDAR
QUALCOSA
`, DA, A)).toThrow(ErroreCalendario);
  });

  it('il tetto sulle iterazioni complessive ferma l analisi di un feed enorme e la segnala come incompleta', () => {
    // 40 serie giornaliere iniziate nel 2012: dalla finestra le separano migliaia di occorrenze ciascuna.
    const molte = Array.from({ length: 40 }, (_, i) =>
      evento(
        `UID:antica${i}@test`,
        'DTSTART;TZID=Europe/Rome:20120105T100000',
        'DTEND;TZID=Europe/Rome:20120105T110000',
        'RRULE:FREQ=DAILY',
        `SUMMARY:Antica ${i}`
      )
    );
    const testo = feed(molte);
    const inizio = Date.now();
    const { eventi, incompleta } = analizzaFeedIcal(testo, new Date('2026-06-01T00:00:00Z'), new Date('2026-06-11T00:00:00Z'));
    expect(Date.now() - inizio).toBeLessThan(10_000);
    expect(incompleta).toBe(true);
    expect(eventi.length).toBeLessThan(40 * 10);
    expect(MAX_ITERAZIONI_TOTALI).toBe(50_000);
    // espandiEventiIcal, usata per sostituire gli eventi salvati, non accetta un elenco parziale.
    expect(() => espandiEventiIcal(testo, new Date('2026-06-01T00:00:00Z'), new Date('2026-06-11T00:00:00Z'))).toThrow(
      expect.objectContaining({ motivo: 'analisi_incompleta' })
    );
  }, 30_000);

  it('non salva più di 5000 eventi, si ferma appena li raggiunge e lo segnala', () => {
    const fitte = Array.from({ length: 10 }, (_, i) => serie(`fitta${i}`, 'FREQ=DAILY'));
    const { eventi, incompleta } = analizzaFeedIcal(feed(fitte), new Date('2026-01-01T00:00:00Z'), new Date('2027-12-31T00:00:00Z'));
    expect(eventi).toHaveLength(5000);
    expect(incompleta).toBe(true);
  });

  it('il budget di tempo ferma l analisi prima di una nuova serie e la segnala come incompleta', () => {
    const molte = Array.from({ length: 30 }, (_, i) => serie(`serie${i}`, 'FREQ=DAILY;COUNT=400'));
    const { incompleta } = analizzaFeedIcal(feed(molte), DA, A, { budgetMs: 0 });
    expect(incompleta).toBe(true);
  });

  it('un feed normale non è mai incompleto', () => {
    expect(analizzaFeedIcal(feed([sano, serie('s', 'FREQ=WEEKLY;COUNT=5')]), DA, A).incompleta).toBe(false);
  });
});

// Casi della review di sicurezza: regole che con ical.js non terminano (o ci
// mettono troppo). Ognuna deve finire in fretta; le regole escluse non danno
// eventi, gli altri eventi del feed restano.
describe('espandiEventiIcal: casi ostili della review', () => {
  const sano = evento('UID:sano@test', 'DTSTART;TZID=Europe/Rome:20260707T100000', 'DTEND;TZID=Europe/Rome:20260707T110000', 'SUMMARY:Sano');
  // Inizio di giovedì 1/10/2026.
  const serie = (uid: string, regola: string, inizio = '20261001T090000Z') =>
    evento(`UID:${uid}@test`, `DTSTART:${inizio}`, 'DTEND:20261001T100000Z', ...regola.split('|').map((r) => `RRULE:${r}`), `SUMMARY:${uid}`);
  const ids = (eventi: { id_esterno: string }[]) => eventi.map((e) => e.id_esterno);

  it.each([
    ['DAILY con BYDAY numerato (1MO)', 'FREQ=DAILY;BYDAY=1MO'],
    ['DAILY con BYDAY numerato negativo (-1FR)', 'FREQ=DAILY;BYDAY=-1FR'],
    ['WEEKLY con BYDAY numerato', 'FREQ=WEEKLY;BYDAY=1MO'],
    ['DAILY con INTERVAL=7 e BYDAY=MO partendo da un giovedì', 'FREQ=DAILY;INTERVAL=7;BYDAY=MO'],
    ['DAILY con INTERVAL=146097 e BYMONTH=2', 'FREQ=DAILY;INTERVAL=146097;BYMONTH=2'],
    ['WEEKLY con INTERVAL e BYMONTH', 'FREQ=WEEKLY;INTERVAL=20871;BYMONTH=2'],
    ['INTERVAL=1000000000', 'FREQ=DAILY;INTERVAL=1000000000'],
    ['WEEKLY con INTERVAL=99999999999', 'FREQ=WEEKLY;INTERVAL=99999999999'],
    ['YEARLY con BYSETPOS impossibile', 'FREQ=YEARLY;BYMONTH=2;BYDAY=MO;BYSETPOS=9'],
    ['due RRULE, una esclusa', 'FREQ=DAILY;BYDAY=1MO|FREQ=DAILY'],
  ])('%s: la serie si salta in meno di 1 secondo, il resto resta', (_nome, regola) => {
    const inizio = Date.now();
    const { eventi, incompleta } = analizzaFeedIcal(feed([serie('ostile', regola), sano]), DA, A);
    expect(Date.now() - inizio).toBeLessThan(1000);
    expect(ids(eventi)).toEqual(['sano@test']);
    expect(incompleta).toBe(false);
  });

  it('venti serie YEARLY con BYSETPOS impossibile finiscono in meno di 1 secondo', () => {
    const molte = Array.from({ length: 20 }, (_, i) => serie(`y${i}`, 'FREQ=YEARLY;BYMONTH=2;BYDAY=MO;BYSETPOS=9'));
    const inizio = Date.now();
    const { eventi } = analizzaFeedIcal(feed([...molte, sano]), DA, A);
    expect(Date.now() - inizio).toBeLessThan(1000);
    expect(ids(eventi)).toEqual(['sano@test']);
  });

  it('un BYDAY semplice con INTERVAL ragionevole resta espanso', () => {
    expect(analizzaFeedIcal(feed([serie('ok1', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=4')]), DA, A).eventi.length).toBeGreaterThan(0);
    expect(analizzaFeedIcal(feed([serie('ok2', 'FREQ=DAILY;INTERVAL=1000;COUNT=3')]), DA, A).eventi.length).toBeGreaterThan(0);
    expect(analizzaFeedIcal(feed([serie('ok3', 'FREQ=DAILY;BYDAY=MO,TU;COUNT=4')]), DA, A).eventi.length).toBeGreaterThan(0);
  });

  it('un INTERVAL oltre 1000 si salta', () => {
    expect(analizzaFeedIcal(feed([serie('lungo', 'FREQ=DAILY;INTERVAL=1001;COUNT=3')]), DA, A).eventi).toEqual([]);
  });

  it('un milione di BEGIN:VEVENT senza END non rallenta l analisi (estrazione lineare)', () => {
    const aCapo = String.fromCharCode(10);
    const testo = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT'.concat(aCapo).repeat(80_000) + 'END:VCALENDAR', ''].join(aCapo);
    expect(testo.length).toBeGreaterThan(1_000_000);
    const inizio = Date.now();
    expect(() => espandiEventiIcal(testo, DA, A)).toThrow(ErroreCalendario);
    expect(Date.now() - inizio).toBeLessThan(1000);
  });

  it('l estrazione dei blocchi trova gli eventi con fine riga mista e ignora un BEGIN senza END', () => {
    const lf = String.fromCharCode(10);
    const crlf = String.fromCharCode(13, 10);
    const { blocchi, intestazione } = estraiBlocchiEvento(
      ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a', 'END:VEVENT'].join(lf) + lf +
        ['BEGIN:VEVENT', 'UID:b', 'END:VEVENT'].join(crlf) + crlf +
        ['BEGIN:VEVENT', 'UID:c', 'END:VCALENDAR', ''].join(lf)
    );
    expect(blocchi).toHaveLength(2);
    expect(intestazione.startsWith('BEGIN:VCALENDAR')).toBe(true);
  });
});
