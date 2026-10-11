// Requisito: specs/52 - report-email-automatico.md
//
// ATTENZIONE: questi test invocano davvero la route del cron, che (se
// RESEND_API_KEY è configurata) invia email reali via Resend e scrive
// nelle tabelle report_giornalieri_inviati/report_periodici_inviati sul
// progetto Supabase puntato da NEXT_PUBLIC_SUPABASE_URL — mai contro un
// progetto di produzione.
//
// I due scenari "riepilogo delle ore di lavoro del personale nel corpo
// dell'email" e "PDF mensile delle ore del personale in allegato" non
// hanno un'asserzione e2e dedicata sul CONTENUTO: la route non espone
// in nessun modo il corpo HTML o gli allegati generati (l'email esce
// via Resend, nessun endpoint di debug la restituisce), quindi non c'è
// nulla da ispezionare da Playwright oltre al JSON di risposta già
// verificato sotto. Sono comunque coperti indirettamente: se
// lib/reportOreLavoro.ts o lib/pdfOreLavoro.ts sollevassero un errore,
// la chiamata alla route fallirebbe (risposta non `ok`, o
// `risultati.mensile` mai a "inviato"), facendo fallire i test
// sottostanti. Il calcolo delle ore/monte ore in sé è coperto da unit
// test puri (lib/monteOre.test.ts, lib/oreLavoro.test.ts).
import { test, expect } from '@playwright/test';

test.describe('52 — Report email automatico', () => {
  test('senza il secret corretto la route rifiuta la richiesta', async ({ request }) => {
    test.skip(!process.env.CRON_SECRET, 'richiede CRON_SECRET configurato per avere qualcosa da verificare');

    const risposta = await request.get('/api/cron/report-presenze', {
      headers: { Authorization: 'Bearer secret-sbagliato' },
    });
    expect(risposta.status()).toBe(401);
  });

  test('il job invocato due volte per lo stesso giorno non reinvia i report già inviati (idempotenza per tipo)', async ({
    request,
  }) => {
    test.skip(
      !process.env.CRON_SECRET || !process.env.RESEND_API_KEY,
      'richiede CRON_SECRET e RESEND_API_KEY configurate per invocare davvero la route del cron'
    );

    const intestazioni = { Authorization: `Bearer ${process.env.CRON_SECRET}` };

    const primaChiamata = await request.get('/api/cron/report-presenze', { headers: intestazioni });
    expect(primaChiamata.ok()).toBe(true);
    const primoCorpo = await primaChiamata.json();
    expect(primoCorpo.risultati.giornaliero).toMatch(/^(inviato|gia_inviato)$/);

    const secondaChiamata = await request.get('/api/cron/report-presenze', { headers: intestazioni });
    expect(secondaChiamata.ok()).toBe(true);
    const secondoCorpo = await secondaChiamata.json();

    // Qualunque cosa la prima chiamata abbia effettivamente inviato (può
    // darsi fosse già tutto inviato da un'esecuzione precedente della
    // suite), la seconda chiamata per lo stesso giorno deve trovare tutto
    // già inviato: nessun tipo può ripassare da "gia_inviato" a "inviato".
    for (const tipo of ['giornaliero', 'settimanale', 'mensile'] as const) {
      if (primoCorpo.risultati[tipo] === 'inviato' || primoCorpo.risultati[tipo] === 'gia_inviato') {
        expect(secondoCorpo.risultati[tipo]).toBe('gia_inviato');
      }
    }
  });

  // Gli scenari sul CONTENUTO della mail (report giornaliero con stato e
  // nota, corpo con descrizione/data di invio/anomalie, anomalie nei dati,
  // anomalia nella produzione di un report) non sono ispezionabili da
  // Playwright: il corpo esce via Resend. Il contenuto è coperto da unit
  // test puri (lib/reportNotturno.test.ts, lib/report.test.ts,
  // lib/reportPresenze.test.ts, lib/pdfReport.test.ts); qui si verifica
  // ciò che la risposta del job espone: nomi degli allegati, numero di
  // anomalie ed esito per report.

  test('report giornaliero con stato di presenza e nota: il giornaliero inviato risulta tra gli allegati', async ({
    request,
  }) => {
    test.skip(
      !process.env.CRON_SECRET || !process.env.RESEND_API_KEY,
      'richiede CRON_SECRET e RESEND_API_KEY configurate per invocare davvero la route del cron'
    );
    const risposta = await request.get('/api/cron/report-presenze', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(risposta.ok()).toBe(true);
    const corpo = await risposta.json();
    expect(Array.isArray(corpo.allegati)).toBe(true);
    if (corpo.risultati.giornaliero === 'inviato') {
      expect(corpo.allegati.some((nome: string) => /^report-giornaliero-\d{4}-\d{2}-\d{2}\.pdf$/.test(nome))).toBe(true);
    } else {
      expect(corpo.allegati).toEqual([]);
    }
  });

  test('corpo della mail con descrizione, data di invio e anomalie: la risposta riporta il numero di anomalie', async ({
    request,
  }) => {
    test.skip(
      !process.env.CRON_SECRET || !process.env.RESEND_API_KEY,
      'richiede CRON_SECRET e RESEND_API_KEY configurate per invocare davvero la route del cron'
    );
    const risposta = await request.get('/api/cron/report-presenze', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(risposta.ok()).toBe(true);
    const corpo = await risposta.json();
    expect(Number.isInteger(corpo.anomalie)).toBe(true);
    expect(corpo.anomalie).toBeGreaterThanOrEqual(0);
  });

  test('anomalie nei dati: nessun nome di bambino nella risposta del job (solo il conteggio)', async ({ request }) => {
    test.skip(
      !process.env.CRON_SECRET || !process.env.RESEND_API_KEY,
      'richiede CRON_SECRET e RESEND_API_KEY configurate per invocare davvero la route del cron'
    );
    const risposta = await request.get('/api/cron/report-presenze', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const corpo = await risposta.json();
    // Le anomalie con i nomi vanno solo nella mail allo staff, non in una risposta HTTP.
    expect(typeof corpo.anomalie).toBe('number');
    expect(Object.keys(corpo).sort()).toEqual(['allegati', 'anomalie', 'data', 'ok', 'risultati']);
  });

  test('anomalia nella produzione di un report: in condizioni normali nessun report risulta in errore', async ({
    request,
  }) => {
    test.skip(
      !process.env.CRON_SECRET || !process.env.RESEND_API_KEY,
      'richiede CRON_SECRET e RESEND_API_KEY configurate per invocare davvero la route del cron'
    );
    const risposta = await request.get('/api/cron/report-presenze', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const corpo = await risposta.json();
    for (const tipo of ['giornaliero', 'settimanale', 'mensile'] as const) {
      expect(corpo.risultati[tipo]).toMatch(/^(inviato|gia_inviato|saltato)$/);
    }
  });
});
