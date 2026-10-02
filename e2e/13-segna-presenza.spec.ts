// Requisito: specs/13 - segna-presenza.md
//
// ATTENZIONE: questi test scrivono davvero in `presenze` sul progetto
// Supabase puntato da NEXT_PUBLIC_SUPABASE_URL (di test in locale, quello
// configurato nei secret in CI) — mai contro un progetto di produzione.
//
// La presenza si segna dalla sezione "Presenza" della card di ogni
// bambino nella schermata unica "Presenze e pasti" (specs/10): ogni
// interazione è ristretta a quella sezione (e alla sezione "Nota" in
// fondo alla card, issue #110), per non confondersi con i pulsanti della
// sezione "Pasto".
import { test, expect } from '@playwright/test';
import {
  apriGiornata,
  clickEAttendiAzione,
  colonnaPasto,
  colonnaPresenza,
  dataUltimoGiornoApertoPrimaDiOggi,
  dataOggiRoma,
  hasCredenziali,
  primaCardConPulsante,
  segnaAssenteOMalattia,
  sezioneNota,
  statoAutenticazione,
} from './helpers';

test.describe('13 — Segna presenza', () => {
  test.describe('come maestra, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');
    });

    test('riepilogo presenze della classe', async ({ page }) => {
      // Il riepilogo aggregato (in cima) e quello per sezione condividono
      // lo stesso formato di testo: .first() basta a verificare che compaia.
      await expect(page.getByText(/^Presenti: \d+\/\d+$/).first()).toBeVisible();
      await expect(page.getByRole('heading', { name: /^Sezione / }).first()).toBeVisible();
    });

    test('segnare un bambino presente evidenzia il pulsante corretto', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Presente');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');

      const bottonePresente = colonnaPresenza(card).getByRole('button', { name: 'Presente' });
      await bottonePresente.click();

      await expect(bottonePresente).toHaveClass(/bg-emerald-700/);
    });

    test("segnare un'assenza con nota", async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Assente');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
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

      // Riporto il bambino a "presente": gli altri test (stesso worker,
      // stessi bambini del seed) cercano la prima card con Sì/No
      // disponibili nella sezione Pasto.
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
    });

    test('salvare una nota senza cambiare lo stato', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Presente');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
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

    test('correggere uno stato in malattia: upsert, nota e tag nella card', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Presente');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
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

      // Ripristino (vedi il test sull'assenza sopra).
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
    });

    // Segnare Assente/Malattia con un pasto "sì" o un pre/post-asilo già
    // segnati: avviso, conferma, azzeramento (specs/13, issue #186).
    // Ogni test riporta il bambino a "presente" a fine corsa.
    test('Assente con pre-asilo attivo chiede conferma: Annulla non cambia nulla', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Pre-asilo');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
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

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
    });

    test('Assente con pasto "sì" chiede conferma e, confermando, azzera il pasto a "no"', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Pasto', 'Sì');
      test.skip((await card.count()) === 0, 'nessun bambino con Sì/No disponibili (es. pasti già comunicati)');
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

    test('Malattia con pasto "no" e nessun pre/post-asilo non chiede conferma', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Pasto', 'No');
      test.skip((await card.count()) === 0, 'nessun bambino con Sì/No disponibili (es. pasti già comunicati)');
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

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
    });

    test('non posso modificare una data diversa da oggi: sola lettura', async ({ page }) => {
      const haBambini = await apriGiornata(page, dataUltimoGiornoApertoPrimaDiOggi());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      await expect(page.getByText('Sola lettura: puoi modificare solo la data di oggi.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Presente' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Assente' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Malattia' })).toHaveCount(0);
    });

    test('riepilogo mostra i conteggi pre-asilo/post-asilo', async ({ page }) => {
      await expect(page.getByText(/^Pre-asilo: \d+$/).first()).toBeVisible();
      await expect(page.getByText(/^Post-asilo: \d+$/).first()).toBeVisible();
    });

    test("segnare pre-asilo forza presente e attiva l'indicatore", async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Pre-asilo');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
      const presenza = colonnaPresenza(card);

      // Base nota: "Presente" azzera pre/post-asilo, così il click sotto
      // attiva (e non disattiva) il toggle.
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      const bottonePreAsilo = presenza.getByRole('button', { name: 'Pre-asilo' });
      await clickEAttendiAzione(page, bottonePreAsilo);

      await expect(bottonePreAsilo).toHaveClass(/bg-sky-700/);
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
    });

    test('pre-asilo e post-asilo sono indipendenti e cumulabili', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Post-asilo');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
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

    test('ripremere pre-asilo lo disattiva, restando presente', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Pre-asilo');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
      const presenza = colonnaPresenza(card);

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      const bottonePreAsilo = presenza.getByRole('button', { name: 'Pre-asilo' });
      await clickEAttendiAzione(page, bottonePreAsilo);
      await expect(bottonePreAsilo).toHaveClass(/bg-sky-700/);

      await clickEAttendiAzione(page, bottonePreAsilo);
      await expect(bottonePreAsilo).not.toHaveClass(/bg-sky-700/);
      await expect(presenza.getByRole('button', { name: 'Presente' })).toHaveClass(/bg-emerald-700/);
    });

    test('segnare assente resetta pre-asilo e post-asilo', async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Pre-asilo');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');
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

      // Ripristino (vedi il test sull'assenza sopra).
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
    });
  });

  test.describe('come assistente, sulla data odierna', () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test.beforeEach(async ({ page }) => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');
    });

    test("l'assistente può segnare una presenza, come una maestra", async ({ page }) => {
      const card = primaCardConPulsante(page, 'Presenza', 'Presente');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');

      const bottonePresente = colonnaPresenza(card).getByRole('button', { name: 'Presente' });
      await bottonePresente.click();

      await expect(bottonePresente).toHaveClass(/bg-emerald-700/);
    });
  });

  test.describe("come admin, l'admin può modificare qualunque data", () => {
    test.use({ storageState: statoAutenticazione('admin') });

    test('i pulsanti restano attivi anche su una data diversa da oggi', async ({ page }) => {
      test.skip(!hasCredenziali('admin'), 'richiede E2E_ADMIN_EMAIL/PASSWORD');

      const haBambini = await apriGiornata(page, dataUltimoGiornoApertoPrimaDiOggi());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      const card = primaCardConPulsante(page, 'Presenza', 'Presente');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile');

      await expect(page.getByText('Sola lettura: puoi modificare solo la data di oggi.')).toHaveCount(0);
      const bottonePresente = colonnaPresenza(card).getByRole('button', { name: 'Presente' });
      await bottonePresente.click();
      await expect(bottonePresente).toHaveClass(/bg-emerald-700/);
    });
  });
});
