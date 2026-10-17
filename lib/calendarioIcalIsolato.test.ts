import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VTIMEZONE_ROMA } from './calendarioFusoRoma.mjs';
import { ErroreCalendario } from './calendarioIcal';
import { analizzaFeedIsolato, percorsoWorkerAnalisi } from './calendarioIcalIsolato';

// Prova che l'analisi isolata in un worker (specs/64, Regole) si può davvero
// terminare: con una regola che con ical.js non finisce mai, la chiamata
// termina comunque entro il tempo massimo e il processo principale resta libero.
// Usa il worker vero (lib/calendarioIcalWorker.mjs) per il caso felice e due
// worker di prova, in una cartella temporanea, per i casi che non terminano.

const DA = new Date('2026-09-17T00:00:00Z');
const A = new Date('2027-10-17T00:00:00Z');

function feed(regola: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Test//IT',
    VTIMEZONE_ROMA,
    'BEGIN:VEVENT',
    'DTSTAMP:20260101T000000Z',
    'UID:isolato@test',
    'DTSTART;TZID=Europe/Rome:20261001T100000',
    'DTEND;TZID=Europe/Rome:20261001T110000',
    `RRULE:${regola}`,
    'SUMMARY:Prova',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

let cartella: string;
let workerCheNonFinisce: string;
let workerIcalBloccato: string;

beforeAll(() => {
  cartella = mkdtempSync(path.join(os.tmpdir(), 'girasole-worker-'));
  workerCheNonFinisce = path.join(cartella, 'infinito.mjs');
  writeFileSync(workerCheNonFinisce, 'for (;;) {}\n');

  // Worker che salta le difese del motore e dà la regola a ical.js così com'è:
  // DAILY;BYDAY=1MO non termina mai (verificato sulla versione in uso).
  const icalUrl = pathToFileURL(createRequire(import.meta.url).resolve('ical.js').replace(/ical\.es5\.cjs$/, 'ical.js')).href;
  workerIcalBloccato = path.join(cartella, 'ical-bloccato.mjs');
  writeFileSync(
    workerIcalBloccato,
    [
      `import ICAL from ${JSON.stringify(icalUrl)};`,
      "import { workerData, parentPort } from 'node:worker_threads';",
      "const vevent = new ICAL.Component(ICAL.parse(workerData.testo)).getFirstSubcomponent('vevent');",
      'const evento = new ICAL.Event(vevent);',
      'const it = evento.iterator();',
      'let n = 0;',
      'while (it.next()) n++;',
      'parentPort.postMessage({ ok: true, risultato: { eventi: [], incompleta: false, n } });',
      '',
    ].join('\n')
  );
});

afterAll(() => {
  rmSync(cartella, { recursive: true, force: true });
});

describe('analizzaFeedIsolato', () => {
  it('il worker vero analizza un feed normale e ritorna gli eventi', async () => {
    const risultato = await analizzaFeedIsolato(feed('FREQ=WEEKLY;COUNT=3'), DA, A);
    expect(risultato.incompleta).toBe(false);
    expect(risultato.eventi).toHaveLength(3);
    expect(risultato.eventi[0].inizio).toBe('2026-10-01T08:00:00.000Z');
  });

  it('il worker vero salta una regola esclusa e risponde in fretta', async () => {
    const inizio = Date.now();
    const risultato = await analizzaFeedIsolato(feed('FREQ=DAILY;BYDAY=1MO'), DA, A);
    expect(risultato.eventi).toEqual([]);
    expect(Date.now() - inizio).toBeLessThan(5000);
  });

  it('un feed non valido dà "feed_non_valido", senza dettagli', async () => {
    await expect(analizzaFeedIsolato('non è un calendario', DA, A)).rejects.toMatchObject({ motivo: 'feed_non_valido' });
  });

  it('un worker che non finisce mai è terminato allo scadere del tempo ("analisi_lenta")', async () => {
    const inizio = Date.now();
    const errore = await analizzaFeedIsolato('x', DA, A, 700, workerCheNonFinisce).catch((e) => e);
    expect(errore).toBeInstanceOf(ErroreCalendario);
    expect(errore.motivo).toBe('analisi_lenta');
    expect(Date.now() - inizio).toBeLessThan(3000);
  });

  it('con ical.js su DAILY;BYDAY=1MO (non termina mai) la chiamata termina comunque entro il tempo massimo', async () => {
    const inizio = Date.now();
    const errore = await analizzaFeedIsolato(feed('FREQ=DAILY;BYDAY=1MO'), DA, A, 1500, workerIcalBloccato).catch((e) => e);
    expect(errore).toBeInstanceOf(ErroreCalendario);
    expect(errore.motivo).toBe('analisi_lenta');
    expect(Date.now() - inizio).toBeLessThan(4000);
  });

  it('il processo principale resta libero mentre il worker è bloccato', async () => {
    let battiti = 0;
    const timer = setInterval(() => battiti++, 50);
    await analizzaFeedIsolato('x', DA, A, 800, workerCheNonFinisce).catch(() => undefined);
    clearInterval(timer);
    expect(battiti).toBeGreaterThan(5);
  });

  it('un worker che non esiste è un errore ("imprevisto"), mai un ripiego nello stesso processo', async () => {
    const errore = await analizzaFeedIsolato(feed('FREQ=DAILY'), DA, A, 2000, path.join(cartella, 'non-esiste.mjs')).catch((e) => e);
    expect(errore).toBeInstanceOf(ErroreCalendario);
    expect(errore.motivo).toBe('imprevisto');
  });

  it('il worker vero si trova dove lo cerca l’app (lib/calendarioIcalWorker.mjs)', () => {
    expect(percorsoWorkerAnalisi().replace(/\\/g, '/')).toMatch(/\/lib\/calendarioIcalWorker\.mjs$/);
  });
});
