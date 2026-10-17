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
import { dataFraGiorni } from './helpers';

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
