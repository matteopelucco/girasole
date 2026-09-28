// Requisito: specs/06 - controllo-consistenza.md
//
// ATTENZIONE: questi test scrivono davvero in presenze/pasti sul
// progetto Supabase di test — vedi la nota in 13-segna-presenza.spec.ts.
// I test sono in sequenza (mode: 'serial'): segnano deliberatamente
// prima il pasto "sì" e solo dopo correggono la presenza in "assente"
// sullo stesso bambino/giorno — lo stesso ordine di eventi reale che il
// requisito intercetta (vedi specs/06, "Perché il controllo serve
// comunque").
import { test, expect } from '@playwright/test';
import {
  apriGiornata,
  cardBambini,
  clickEAttendiAzione,
  colonnaPasto,
  colonnaPresenza,
  dataOggiRoma,
  hasCredenziali,
  nomeBambinoCard,
  nessunaViolazioneA11yGrave,
  primaCardConPulsante,
  statoAutenticazione,
} from './helpers';

// Stessa formattazione di lib/date.ts:formattaDataItaliana, per
// individuare nel drill-down mensile la riga del giorno odierno senza
// dipendere dall'ordine/quantità di righe accumulate da run precedenti
// della suite (che non ripulisce i dati creati).
function dataOggiFormattata(): string {
  const [anno, mese, giorno] = dataOggiRoma().split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(anno, mese - 1, giorno, 12)));
}

// Schermata unica "Presenze e pasti" (specs/10): presenza e pasto dello
// stesso bambino sono nella stessa card, colonne "Presenza" e "Pasto".
let nomeBambino: string | undefined;

test.describe('06 — Controllo di consistenza dei dati', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.describe.configure({ mode: 'serial' });
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
    });

    test('nessun warning su un bambino con pasto "sì" coerente', async ({ page }) => {
      await apriGiornata(page, dataOggiRoma());

      const primaCard = primaCardConPulsante(page, 'Pasto', 'Sì');
      test.skip((await primaCard.count()) === 0, 'nessun bambino selezionabile per il pasto');

      nomeBambino = (await nomeBambinoCard(primaCard).textContent())?.trim();

      // Base coerente: presente con pasto "sì".
      await clickEAttendiAzione(page, colonnaPresenza(primaCard).getByRole('button', { name: 'Presente' }));
      await clickEAttendiAzione(page, colonnaPasto(primaCard).getByRole('button', { name: 'Sì' }));
      await expect(colonnaPasto(primaCard).getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);
      await expect(primaCard.getByText('Inconsistenza')).toHaveCount(0);

      await nessunaViolazioneA11yGrave(page);
    });

    test('segnare "assente" sullo stesso bambino crea l\'incoerenza e mostra il warning nella sua card', async ({
      page,
    }) => {
      test.skip(!nomeBambino, 'test precedente saltato (nessun bambino disponibile)');

      await apriGiornata(page, dataOggiRoma());
      const card = cardBambini(page).filter({ hasText: nomeBambino! }).first();
      const presenza = colonnaPresenza(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Assente' }).isDisabled(),
        'Assente bloccato (pasto già comunicato a Rojac): incoerenza non più raggiungibile per la maestra'
      );
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Assente' }));
      await expect(presenza.getByRole('button', { name: 'Assente' })).toHaveClass(/bg-stone-600/);

      // Una sola card per bambino (specs/10): il warning è nella sua
      // intestazione, e la colonna Pasto mostra l'etichetta "Assente".
      await expect(card.getByText('Inconsistenza')).toBeVisible();
      await expect(colonnaPasto(card).getByText('🚫 Assente')).toBeVisible();
      await nessunaViolazioneA11yGrave(page);
    });

    test('il warning compare nel report a schermo (giornaliero)', async ({ page }) => {
      test.skip(!nomeBambino, 'test precedente saltato (nessun bambino disponibile)');

      await page.goto(`/dashboard/report?tipo=giornaliero&periodo=${dataOggiRoma()}`);
      const riga = page.locator('tr', { hasText: nomeBambino! }).first();
      test.skip((await riga.count()) === 0, 'bambino non visibile nel report per questo account');

      await expect(riga.getByText('Inconsistenza')).toBeVisible();
    });

    test('il warning compare nel drill-down del giorno specifico (report mensile)', async ({ page }) => {
      test.skip(!nomeBambino, 'test precedente saltato (nessun bambino disponibile)');

      await page.goto('/dashboard/report?tipo=mensile');
      const link = page.locator('a', { hasText: nomeBambino! }).first();
      test.skip((await link.count()) === 0, 'bambino non visibile nel report per questo account');

      await link.click();
      await page.waitForURL(/\/dashboard\/report\/bambino\/.+/);

      const rigaOggi = page.locator('tr', { hasText: dataOggiFormattata() });
      await expect(rigaOggi.getByText('Assente')).toBeVisible();
      await expect(rigaOggi.getByText('Sì')).toBeVisible();
      await expect(rigaOggi.getByText('Inconsistenza')).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });
  });
});
