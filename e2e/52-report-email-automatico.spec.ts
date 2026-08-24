// Requisito: specs/52 - report-email-automatico.md
//
// ATTENZIONE: questi test invocano davvero la route del cron, che (se
// RESEND_API_KEY è configurata) invia email reali via Resend e scrive
// nelle tabelle report_giornalieri_inviati/report_periodici_inviati sul
// progetto Supabase puntato da NEXT_PUBLIC_SUPABASE_URL — mai contro un
// progetto di produzione.
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
});
