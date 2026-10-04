// Requisito: specs/13 - segna-presenza.md
//
// ATTENZIONE: questi test scrivono davvero in `presenze` sul progetto
// Supabase puntato da NEXT_PUBLIC_SUPABASE_URL (di test in locale, quello
// configurato nei secret in CI) — mai contro un progetto di produzione.
//
// Ogni test lavora su un bambino creato apposta (fixture `bambino`,
// e2e/fixture-bambino.ts, issue #228) e poi eliminato: niente dipendenza
// dai bambini del seed né dallo stato lasciato da altri test, quindi nessun
// "ripristino a presente" a fine test.
//
// La presenza si segna dalla sezione "Presenza" della card di ogni
// bambino nella schermata unica "Presenze e pasti" (specs/10): ogni
// interazione è ristretta a quella sezione (e alla sezione "Nota" in
// fondo alla card, issue #110), per non confondersi con i pulsanti della
// sezione "Pasto".
import type { Page } from '@playwright/test';
import { test, expect, cardBambino, type BambinoFixture } from './fixture-bambino';
import {
  apriGiornata,
  clickEAttendiAzione,
  colonnaPasto,
  colonnaPresenza,
  dataUltimoGiornoApertoPrimaDiOggi,
  dataOggiRoma,
  hasCredenziali,
  segnaAssenteOMalattia,
  sezioneNota,
  statoAutenticazione,
} from './helpers';

// Card del bambino fixture, saltando il test se in questo giorno la
// colonna "Presenza" non ha il pulsante richiesto (giorno di chiusura:
// weekend o calendario, specs/53: la card c'è ma senza pulsanti).
async function cardSegnabile(page: Page, bambino: BambinoFixture, pulsante: string) {
  const card = cardBambino(page, bambino);
  await expect(card).toBeVisible();
  test.skip(
    (await colonnaPresenza(card).getByRole('button', { name: pulsante, exact: true }).count()) === 0,
    'nessun pulsante di presenza (giorno di chiusura)'
  );
  return card;
}

// Come cardSegnabile, per i test sul pasto: salta se i pulsanti Sì/No non
// ci sono (es. pasti già comunicati a Rojac per oggi).
async function cardConPasto(page: Page, bambino: BambinoFixture, pulsante: 'Sì' | 'No') {
  const card = cardBambino(page, bambino);
  await expect(card).toBeVisible();
  test.skip(
    (await colonnaPasto(card).getByRole('button', { name: pulsante, exact: true }).count()) === 0,
    'nessun pulsante Sì/No disponibile (es. pasti già comunicati)'
  );
  return card;
}

test.describe('13 — Segna presenza', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    // `bambino` è nei parametri anche quando il test non lo usa: così la
    // fixture è creata prima di aprire la pagina, che deve già mostrarlo.
    test.beforeEach(async ({ page, bambino }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();
    });

    test('riepilogo presenze della classe', async ({ page }) => {
      // Il riepilogo aggregato (in cima) e quello per sezione condividono
      // lo stesso formato di testo: .first() basta a verificare che compaia.
      await expect(page.getByText(/^Presenti: \d+\/\d+$/).first()).toBeVisible();
      await expect(page.getByRole('heading', { name: /^Sezione / }).first()).toBeVisible();
    });

    test('segnare un bambino presente evidenzia il pulsante corretto', async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Presente');

      const bottonePresente = colonnaPresenza(card).getByRole('button', { name: 'Presente' });
      await clickEAttendiAzione(page, bottonePresente);

      await expect(bottonePresente).toHaveClass(/bg-emerald-700/);
    });

    test("segnare un'assenza con nota", async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Assente');
      const presenza = colonnaPresenza(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Assente' }).isDisabled(),
        'Assente bloccato (pasto già comunicato a Rojac)'
      );

      await sezioneNota(card).getByLabel('Nota (opzionale)').fill('influenza, rientra lunedì');
      const bottoneAssente = presenza.getByRole('button', { name: 'Assente' });
      await segnaAssenteOMalattia(page, presenza, 'Assente');

      await expect(bottoneAssente).toHaveClass(/bg-stone-600/);
      // Bug reale trovato durante un test con un'insegnante: il
      // pulsante selezionato appariva come uno spazio bianco perché
      // lib/classiStato.ts non era incluso nel content di Tailwind
      // (tailwind.config.ts). Verifico il colore di sfondo REALE, non
      // solo il nome classe.
      await expect(bottoneAssente).toHaveCSS('background-color', 'rgb(87, 83, 78)');
      await expect(sezioneNota(card).getByLabel('Nota (opzionale)')).toHaveValue('influenza, rientra lunedì');

      // La nota deve restare salvata anche dopo un ricaricamento.
      await page.reload();
      await expect(sezioneNota(card).getByLabel('Nota (opzionale)')).toHaveValue('influenza, rientra lunedì');
    });

    test('salvare una nota senza cambiare lo stato', async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Presente');
      const presenza = colonnaPresenza(card);

      // Serve uno stato già segnato: "Salva nota" richiede un record di
      // presenza esistente. Aspetto la fine di ciascun salvataggio: il
      // reload annullerebbe il salvataggio della nota (issue #70).
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);

      await sezioneNota(card).getByLabel('Nota (opzionale)').fill('entra alle 9:03');
      await clickEAttendiAzione(page, sezioneNota(card).getByRole('button', { name: 'Salva nota' }));

      // Lo stato non cambia: resta "presente".
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);

      await page.reload();
      await expect(sezioneNota(card).getByLabel('Nota (opzionale)')).toHaveValue('entra alle 9:03');
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
    });

    test('correggere uno stato in malattia: upsert, nota e tag nella card', async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Presente');
      const presenza = colonnaPresenza(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Malattia' }).isDisabled(),
        'Malattia bloccata (pasto già comunicato a Rojac)'
      );

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);

      // Ricarico e correggo in malattia: se l'upsert funziona resta un
      // solo record (nessun duplicato, nessuno stato "fantasma").
      await page.reload();
      await sezioneNota(card).getByLabel('Nota (opzionale)').fill('febbre alta');
      const bottoneMalattia = presenza.getByRole('button', { name: 'Malattia' });
      await segnaAssenteOMalattia(page, presenza, 'Malattia');

      await expect(bottoneMalattia).toHaveClass(/bg-rose-600/);
      await expect(presenza.getByRole('button', { name: 'Presente' })).not.toHaveClass(/bg-emerald-700/);
      // Il tag compare nell'intestazione della card (una sola card per
      // bambino, specs/10) e la sezione Pasto della stessa card mostra
      // l'etichetta al posto dei pulsanti Sì/No.
      await expect(card.getByText('🤒 Malattia').first()).toBeVisible();
      if ((await colonnaPasto(card).count()) > 0) {
        await expect(colonnaPasto(card).getByRole('button', { name: 'Sì' })).toHaveCount(0);
      }
    });

    // Segnare Assente/Malattia con un pasto "sì" o un pre/post-asilo già
    // segnati: avviso, conferma, azzeramento (specs/13, issue #186).
    test('Assente con pre-asilo attivo chiede conferma: Annulla non cambia nulla', async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Pre-asilo');
      const presenza = colonnaPresenza(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Assente' }).isDisabled(),
        'Assente bloccato (pasto già comunicato a Rojac)'
      );

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Pre-asilo' }));
      await expect(presenza.getByRole('button', { name: 'Pre-asilo' })).toHaveClass(/bg-sky-700/);

      await presenza.getByRole('button', { name: 'Assente' }).click();
      const avviso = presenza.getByRole('group', { name: 'Conferma azzeramento' });
      await expect(avviso).toContainText('il pre-asilo');
      await expect(avviso.getByRole('button', { name: 'Conferma e azzera' })).toBeVisible();

      await avviso.getByRole('button', { name: 'Annulla' }).click();
      await expect(avviso).toHaveCount(0);
      await expect(presenza.getByRole('button', { name: 'Pre-asilo' })).toHaveClass(/bg-sky-700/);
      await page.reload();
      await expect(presenza.getByRole('button', { name: 'Pre-asilo' })).toHaveClass(/bg-sky-700/);
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
    });

    test('Assente con pasto "sì" chiede conferma e, confermando, azzera il pasto a "no"', async ({
      page,
      bambino,
    }) => {
      const card = await cardConPasto(page, bambino, 'Sì');
      const presenza = colonnaPresenza(card);
      const pasto = colonnaPasto(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Assente' }).isDisabled(),
        'Assente bloccato (pasto già comunicato a Rojac)'
      );

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await clickEAttendiAzione(page, pasto.getByRole('button', { name: 'Sì' }));
      await expect(pasto.getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);

      await presenza.getByRole('button', { name: 'Assente' }).click();
      const avviso = presenza.getByRole('group', { name: 'Conferma azzeramento' });
      await expect(avviso).toContainText('il pasto');
      // Finché non si conferma non cambia nulla.
      await expect(pasto.getByRole('button', { name: 'Sì' })).toHaveClass(/bg-emerald-700/);

      await sezioneNota(card).getByLabel('Nota (opzionale)').fill('influenza');
      await clickEAttendiAzione(page, avviso.getByRole('button', { name: 'Conferma e azzera' }));

      await expect(presenza.getByRole('button', { name: 'Assente' })).toHaveClass(/bg-stone-600/);
      await expect(pasto.getByText('🚫 Assente')).toBeVisible();
      // Il bambino non è più in incoerenza (pasto azzerato) e la nota è salvata.
      await expect(card.getByText('Inconsistenza')).toHaveCount(0);
      await expect(sezioneNota(card).getByLabel('Nota (opzionale)')).toHaveValue('influenza');

      // Tornato presente, il pasto è "no" (azzerato), non più "sì".
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await expect(pasto.getByRole('button', { name: 'No', exact: true })).toHaveClass(/bg-rose-600/);
      await expect(pasto.getByRole('button', { name: 'Sì' })).not.toHaveClass(/bg-emerald-700/);
    });

    test('Malattia con pasto "no" e nessun pre/post-asilo non chiede conferma', async ({ page, bambino }) => {
      const card = await cardConPasto(page, bambino, 'No');
      const presenza = colonnaPresenza(card);
      const pasto = colonnaPasto(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Malattia' }).isDisabled(),
        'Malattia bloccata (pasto già comunicato a Rojac)'
      );

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await clickEAttendiAzione(page, pasto.getByRole('button', { name: 'No', exact: true }));
      await expect(pasto.getByRole('button', { name: 'No', exact: true })).toHaveClass(/bg-rose-600/);

      const bottoneMalattia = presenza.getByRole('button', { name: 'Malattia' });
      await expect(bottoneMalattia).not.toHaveAttribute('aria-expanded');
      await clickEAttendiAzione(page, bottoneMalattia);
      await expect(bottoneMalattia).toHaveClass(/bg-rose-600/);
      await expect(presenza.getByRole('group', { name: 'Conferma azzeramento' })).toHaveCount(0);
    });

    test('non posso modificare una data diversa da oggi: sola lettura', async ({ page, bambino }) => {
      await apriGiornata(page, dataUltimoGiornoApertoPrimaDiOggi());
      await expect(cardBambino(page, bambino)).toBeVisible();

      await expect(page.getByText('Sola lettura: puoi modificare solo la data di oggi.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Presente' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Assente' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Malattia' })).toHaveCount(0);
    });

    test('riepilogo mostra i conteggi pre-asilo/post-asilo', async ({ page }) => {
      await expect(page.getByText(/^Pre-asilo: \d+$/).first()).toBeVisible();
      await expect(page.getByText(/^Post-asilo: \d+$/).first()).toBeVisible();
    });

    test("segnare pre-asilo forza presente e attiva l'indicatore", async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Pre-asilo');
      const presenza = colonnaPresenza(card);

      // Base nota: "Presente" azzera pre/post-asilo, così il click sotto
      // attiva (e non disattiva) il toggle.
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      const bottonePreAsilo = presenza.getByRole('button', { name: 'Pre-asilo' });
      await clickEAttendiAzione(page, bottonePreAsilo);

      await expect(bottonePreAsilo).toHaveClass(/bg-sky-700/);
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
    });

    test('pre-asilo e post-asilo sono indipendenti e cumulabili', async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Post-asilo');
      const presenza = colonnaPresenza(card);

      // Riparte da una base nota (nessun pre/post-asilo attivo): un
      // secondo click su un toggle già attivo lo disattiverebbe.
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Pre-asilo' }));
      const bottonePostAsilo = presenza.getByRole('button', { name: 'Post-asilo' });
      await clickEAttendiAzione(page, bottonePostAsilo);

      await expect(presenza.getByRole('button', { name: 'Pre-asilo' })).toHaveClass(/bg-sky-700/);
      await expect(bottonePostAsilo).toHaveClass(/bg-sky-700/);
    });

    test('ripremere pre-asilo lo disattiva, restando presente', async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Pre-asilo');
      const presenza = colonnaPresenza(card);

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      const bottonePreAsilo = presenza.getByRole('button', { name: 'Pre-asilo' });
      await clickEAttendiAzione(page, bottonePreAsilo);
      await expect(bottonePreAsilo).toHaveClass(/bg-sky-700/);

      await clickEAttendiAzione(page, bottonePreAsilo);
      await expect(bottonePreAsilo).not.toHaveClass(/bg-sky-700/);
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
    });

    test('segnare assente resetta pre-asilo e post-asilo', async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Pre-asilo');
      const presenza = colonnaPresenza(card);
      test.skip(
        await presenza.getByRole('button', { name: 'Assente' }).isDisabled(),
        'Assente bloccato (pasto già comunicato a Rojac)'
      );

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Pre-asilo' }));
      await expect(presenza.getByRole('button', { name: 'Pre-asilo' })).toHaveClass(/bg-sky-700/);

      // Con pre-asilo attivo, Assente chiede prima conferma (specs/13,
      // issue #186) e alla conferma azzera il pre/post-asilo.
      await segnaAssenteOMalattia(page, presenza, 'Assente');
      await expect(presenza.getByRole('button', { name: 'Pre-asilo' })).not.toHaveClass(/bg-sky-700/);
      await expect(presenza.getByRole('button', { name: 'Post-asilo' })).not.toHaveClass(/bg-sky-700/);
    });

    test('i dati di presenza manomessi dal client non vengono usati', async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Pre-asilo');
      const presenza = colonnaPresenza(card);

      // Base nota: presente, senza pre-asilo né post-asilo.
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
      await page.reload();

      // Falsifico la riga attuale inviata dal browser (argomento legato con
      // .bind() alla Server Action): post-asilo già attivo. Senza la
      // rilettura dal database l'azione scriverebbe pre-asilo E post-asilo.
      // Il corpo multipart contiene anche i campi nascosti `$ACTION_n:1` di
      // OGNI pulsante del form (fallback senza JavaScript): gli argomenti
      // realmente usati dalla chiamata sono solo nella parte `name="0"`, in
      // fondo, ed è lì (e solo lì) che si manomette.
      let manomessa = false;
      await page.route('**/*', async (route) => {
        const richiesta = route.request();
        const corpo = richiesta.postData();
        const vero = '"postAsilo":false';
        // Stessa lunghezza dell'originale (spazio finale, JSON valido): il
        // Content-Length della richiesta resta corretto.
        const falso = '"postAsilo":true ';
        const inizioArgomenti = corpo === null ? -1 : corpo.indexOf('name="0"');
        if (
          richiesta.method() === 'POST' &&
          richiesta.headers()['next-action'] !== undefined &&
          corpo !== null &&
          inizioArgomenti >= 0 &&
          corpo.indexOf(vero, inizioArgomenti) >= 0
        ) {
          manomessa = true;
          const prima = corpo.slice(0, inizioArgomenti);
          const argomenti = corpo.slice(inizioArgomenti).replace(vero, falso);
          await route.continue({ postData: prima + argomenti });
          return;
        }
        await route.continue();
      });

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Pre-asilo' }));
      expect(manomessa, 'la richiesta della Server Action doveva essere manomessa').toBe(true);
      await page.unroute('**/*');

      // L'azione è stata rifiutata: compare la schermata di errore (app/error.tsx).
      // In produzione Next.js omette il messaggio reale e lascia il codice
      // errore (digest); in sviluppo si vede il messaggio italiano
      // (MESSAGGIO_DATI_CAMBIATI di lib/presenza.ts).
      await expect(page.getByRole('heading', { name: 'Qualcosa è andato storto' })).toBeVisible();
      await expect(page.getByText(/I dati di questo bambino sono cambiati|Codice errore:/).first()).toBeVisible();

      // Nulla è stato scritto: il bambino resta presente, senza pre/post-asilo.
      await page.reload();
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
      await expect(presenza.getByRole('button', { name: 'Pre-asilo' })).not.toHaveClass(/bg-sky-700/);
      await expect(presenza.getByRole('button', { name: 'Post-asilo' })).not.toHaveClass(/bg-sky-700/);
    });
  });

  test.describe('come assistente, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test.beforeEach(async ({ page, bambino }) => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();
    });

    test("l'assistente può segnare una presenza, come una maestra", async ({ page, bambino }) => {
      const card = await cardSegnabile(page, bambino, 'Presente');

      const bottonePresente = colonnaPresenza(card).getByRole('button', { name: 'Presente' });
      await clickEAttendiAzione(page, bottonePresente);

      await expect(bottonePresente).toHaveClass(/bg-emerald-700/);
    });
  });

  test.describe("come admin, l'admin può modificare qualunque data", () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('i pulsanti restano attivi anche su una data diversa da oggi', async ({ page, bambino }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      await apriGiornata(page, dataUltimoGiornoApertoPrimaDiOggi());
      const card = await cardSegnabile(page, bambino, 'Presente');

      await expect(page.getByText('Sola lettura: puoi modificare solo la data di oggi.')).toHaveCount(0);
      const bottonePresente = colonnaPresenza(card).getByRole('button', { name: 'Presente' });
      await clickEAttendiAzione(page, bottonePresente);
      await expect(bottonePresente).toHaveClass(/bg-emerald-700/);
    });
  });
});
