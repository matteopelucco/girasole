// Feed iCal FINTO per i test di specs/64 - calendario-eventi.md.
//
// Mai il calendario reale: il test avvia in locale un piccolo server HTTP
// (origine `CALENDARIO_ICAL_PROVA_ORIGINE`, impostata da playwright.config.ts
// anche per il server dell'app) che serve un calendario costruito qui, con
// eventi di prova inventati e date relative a oggi (sempre nella finestra
// della sincronizzazione). L'indirizzo che il test salva è quello di questo
// server: non è un indirizzo Google e non contiene nessun segreto.
import http from 'node:http';
import { VTIMEZONE_ROMA } from '../lib/calendarioFusoRoma.mjs';
import { dataFraGiorni, dataProssimoGiornoFeriale } from './helpers';

export type RispostaFeed = { stato: number; corpo: string };

export const PERCORSO_FEED_FINTO = '/calendar/ical/girasole-prova/private-prova/basic.ics';

export function origineFeedFinto(): string | undefined {
  return process.env.CALENDARIO_ICAL_PROVA_ORIGINE;
}

export function indirizzoFeedFinto(): string {
  return `${origineFeedFinto()}${PERCORSO_FEED_FINTO}`;
}

const compatta = (data: string) => data.replaceAll('-', '');

function evento(righe: string[]): string {
  return ['BEGIN:VEVENT', 'DTSTAMP:20260101T000000Z', ...righe, 'END:VEVENT'].join('\r\n');
}

function calendario(eventi: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Girasole//Prova//IT', VTIMEZONE_ROMA, ...eventi, 'END:VCALENDAR', ''].join(
    '\r\n'
  );
}

export const FEED_VUOTO = calendario([]);

// Versione 1: 9 eventi nella finestra (1 con orario, 1 di tutto il giorno, 1
// settimanale in 6 occorrenze, 1 che verrà annullato).
export function feedIniziale(): string {
  return calendario([
    evento([
      'UID:prova-singolo@girasole.test',
      `DTSTART;TZID=Europe/Rome:${compatta(dataFraGiorni(7))}T100000`,
      `DTEND;TZID=Europe/Rome:${compatta(dataFraGiorni(7))}T110000`,
      'SUMMARY:Evento di prova con orario',
      'LOCATION:Salone',
    ]),
    evento([
      'UID:prova-giornata@girasole.test',
      `DTSTART;VALUE=DATE:${compatta(dataFraGiorni(10))}`,
      `DTEND;VALUE=DATE:${compatta(dataFraGiorni(11))}`,
      'SUMMARY:Evento di prova di tutto il giorno',
    ]),
    evento([
      'UID:prova-settimanale@girasole.test',
      `DTSTART;TZID=Europe/Rome:${compatta(dataFraGiorni(3))}T090000`,
      `DTEND;TZID=Europe/Rome:${compatta(dataFraGiorni(3))}T094500`,
      'RRULE:FREQ=WEEKLY;COUNT=6',
      'SUMMARY:Evento di prova settimanale',
    ]),
    evento([
      'UID:prova-da-togliere@girasole.test',
      `DTSTART;TZID=Europe/Rome:${compatta(dataFraGiorni(14))}T160000`,
      `DTEND;TZID=Europe/Rome:${compatta(dataFraGiorni(14))}T170000`,
      'SUMMARY:Evento di prova da annullare',
    ]),
  ]);
}

// Versione 2: l'evento con orario è spostato (stesso UID, altro giorno e
// orario) e quello "da togliere" è annullato in Google: restano 8 eventi.
export function feedAggiornato(): string {
  return calendario([
    evento([
      'UID:prova-singolo@girasole.test',
      `DTSTART;TZID=Europe/Rome:${compatta(dataFraGiorni(8))}T150000`,
      `DTEND;TZID=Europe/Rome:${compatta(dataFraGiorni(8))}T160000`,
      'SUMMARY:Evento di prova con orario',
      'LOCATION:Salone',
      'SEQUENCE:1',
    ]),
    evento([
      'UID:prova-giornata@girasole.test',
      `DTSTART;VALUE=DATE:${compatta(dataFraGiorni(10))}`,
      `DTEND;VALUE=DATE:${compatta(dataFraGiorni(11))}`,
      'SUMMARY:Evento di prova di tutto il giorno',
    ]),
    evento([
      'UID:prova-settimanale@girasole.test',
      `DTSTART;TZID=Europe/Rome:${compatta(dataFraGiorni(3))}T090000`,
      `DTEND;TZID=Europe/Rome:${compatta(dataFraGiorni(3))}T094500`,
      'RRULE:FREQ=WEEKLY;COUNT=6',
      'SUMMARY:Evento di prova settimanale',
    ]),
    evento([
      'UID:prova-da-togliere@girasole.test',
      `DTSTART;TZID=Europe/Rome:${compatta(dataFraGiorni(14))}T160000`,
      `DTEND;TZID=Europe/Rome:${compatta(dataFraGiorni(14))}T170000`,
      'SUMMARY:Evento di prova da annullare',
      'STATUS:CANCELLED',
    ]),
  ]);
}

// Versione 2 più una ripetizione ostile: con ical.js "ogni giorno, ma solo il
// primo lunedì" non termina mai. L'app la salta (o, se non ci riuscisse, ferma
// l'analisi dopo il tempo massimo): gli 8 eventi di prova restano.
export function feedConRegolaOstile(): string {
  const ostile = evento([
    'UID:prova-ostile@girasole.test',
    `DTSTART;TZID=Europe/Rome:${compatta(dataFraGiorni(2))}T080000`,
    `DTEND;TZID=Europe/Rome:${compatta(dataFraGiorni(2))}T090000`,
    'RRULE:FREQ=DAILY;BYDAY=1MO',
    'SUMMARY:Evento di prova ostile',
  ]);
  return feedAggiornato().replace('END:VCALENDAR', `${ostile}
END:VCALENDAR`);
}

// Titoli degli eventi di feedPerPagina(): la pagina "Calendario" (specs/64) li
// mostra e i test li cercano per titolo. Il prefisso li distingue dagli altri
// eventi di prova.
export const TITOLO_CON_ORARIO = 'Prova calendario: evento con orario';
export const TITOLO_TUTTO_IL_GIORNO = 'Prova calendario: evento di tutto il giorno';
export const TITOLO_PIU_GIORNI = 'Prova calendario: evento su più giorni';
export const TITOLO_IN_CORSO = 'Prova calendario: evento già cominciato';
export const TITOLO_PASSATO = 'Prova calendario: evento passato';
export const TITOLO_HTML = '<img src=x onerror=alert(1)> Prova calendario: titolo con HTML';
export const TITOLO_CHIUSO = 'Prova calendario: Chiuso';
export const LUOGO_CON_ORARIO = 'Salone di prova';
export const DESCRIZIONE_PRIMA_RIGA = 'Portare il cambio di prova.';
export const DESCRIZIONE_SECONDA_RIGA = 'Grazie e a presto.';
export const DESCRIZIONE_CON_LINK = 'Dettagli su https://example.com/prova e javascript:alert(1)';

// Giorni (rispetto a oggi) degli eventi di feedPerPagina().
export const GIORNI_CON_ORARIO = 7;
export const GIORNI_TUTTO_IL_GIORNO = 10;
export const GIORNI_PIU_GIORNI = { primo: 20, ultimo: 22 };
export const GIORNI_PASSATO = -5;
export const GIORNI_HTML = 12;

// Feed per i test della pagina "Calendario": un evento con orario (10:00-11:00,
// con luogo e descrizione su due righe), uno di tutto il giorno, uno di tre
// giorni, uno già cominciato (da ieri a dopodomani), uno concluso, uno con
// codice HTML nel titolo e un indirizzo web nella descrizione, e uno
// intitolato "Chiuso" in un giorno feriale (resta un evento, specs/64).
export function feedPerPagina(): string {
  return calendario([
    evento([
      'UID:pagina-orario@girasole.test',
      `DTSTART;TZID=Europe/Rome:${compatta(dataFraGiorni(GIORNI_CON_ORARIO))}T100000`,
      `DTEND;TZID=Europe/Rome:${compatta(dataFraGiorni(GIORNI_CON_ORARIO))}T110000`,
      `SUMMARY:${TITOLO_CON_ORARIO}`,
      `LOCATION:${LUOGO_CON_ORARIO}`,
      `DESCRIPTION:${DESCRIZIONE_PRIMA_RIGA}\\n${DESCRIZIONE_SECONDA_RIGA}`,
    ]),
    evento([
      'UID:pagina-giornata@girasole.test',
      `DTSTART;VALUE=DATE:${compatta(dataFraGiorni(GIORNI_TUTTO_IL_GIORNO))}`,
      `DTEND;VALUE=DATE:${compatta(dataFraGiorni(GIORNI_TUTTO_IL_GIORNO + 1))}`,
      `SUMMARY:${TITOLO_TUTTO_IL_GIORNO}`,
    ]),
    evento([
      'UID:pagina-piu-giorni@girasole.test',
      `DTSTART;VALUE=DATE:${compatta(dataFraGiorni(GIORNI_PIU_GIORNI.primo))}`,
      `DTEND;VALUE=DATE:${compatta(dataFraGiorni(GIORNI_PIU_GIORNI.ultimo + 1))}`,
      `SUMMARY:${TITOLO_PIU_GIORNI}`,
    ]),
    evento([
      'UID:pagina-in-corso@girasole.test',
      `DTSTART;VALUE=DATE:${compatta(dataFraGiorni(-1))}`,
      `DTEND;VALUE=DATE:${compatta(dataFraGiorni(3))}`,
      `SUMMARY:${TITOLO_IN_CORSO}`,
    ]),
    evento([
      'UID:pagina-passato@girasole.test',
      `DTSTART;TZID=Europe/Rome:${compatta(dataFraGiorni(GIORNI_PASSATO))}T100000`,
      `DTEND;TZID=Europe/Rome:${compatta(dataFraGiorni(GIORNI_PASSATO))}T110000`,
      `SUMMARY:${TITOLO_PASSATO}`,
    ]),
    evento([
      'UID:pagina-html@girasole.test',
      `DTSTART;TZID=Europe/Rome:${compatta(dataFraGiorni(GIORNI_HTML))}T090000`,
      `DTEND;TZID=Europe/Rome:${compatta(dataFraGiorni(GIORNI_HTML))}T100000`,
      `SUMMARY:${TITOLO_HTML}`,
      `DESCRIPTION:${DESCRIZIONE_CON_LINK}`,
    ]),
    evento([
      'UID:pagina-chiuso@girasole.test',
      `DTSTART;VALUE=DATE:${compatta(dataProssimoGiornoFeriale())}`,
      `DTEND;VALUE=DATE:${compatta(dataGiornoDopo(dataProssimoGiornoFeriale()))}`,
      `SUMMARY:${TITOLO_CHIUSO}`,
    ]),
  ]);
}

function dataGiornoDopo(data: string): string {
  const [anno, mese, giorno] = data.split('-').map(Number);
  return new Date(Date.UTC(anno, mese - 1, giorno + 1, 12)).toISOString().slice(0, 10);
}

export type FeedFinto = {
  imposta(risposta: RispostaFeed): void;
  chiudi(): Promise<void>;
};

// Avvia il server del feed finto sulla porta di CALENDARIO_ICAL_PROVA_ORIGINE.
// Risponde solo al percorso PERCORSO_FEED_FINTO, con la risposta impostata.
export async function avviaFeedFinto(iniziale: RispostaFeed): Promise<FeedFinto> {
  let corrente = iniziale;
  const porta = Number(new URL(origineFeedFinto()!).port);
  const server = http.createServer((richiesta, risposta) => {
    if (richiesta.url !== PERCORSO_FEED_FINTO) {
      risposta.writeHead(404).end();
      return;
    }
    risposta.writeHead(corrente.stato, { 'Content-Type': 'text/calendar; charset=utf-8' }).end(corrente.corpo);
  });
  await new Promise<void>((risolvi, rifiuta) => {
    server.once('error', rifiuta);
    server.listen(porta, '127.0.0.1', () => risolvi());
  });
  return {
    imposta: (risposta) => {
      corrente = risposta;
    },
    chiudi: () => new Promise<void>((risolvi) => server.close(() => risolvi())),
  };
}
