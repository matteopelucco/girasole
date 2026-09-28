// Requisito: specs/10 - presenze-e-pasti.md
//
// ATTENZIONE: alcuni test scrivono davvero in `presenze` sul progetto
// Supabase di test (vedi la nota in 13-segna-presenza.spec.ts) e
// riportano il bambino a "presente" alla fine, per non condizionare gli
// altri file che girano nello stesso worker (progetto
// 'chromium-stato-condiviso' in playwright.config.ts).
import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  apriGiornata,
  cardBambini,
  clickEAttendiAzione,
  colonnaPasto,
  colonnaPresenza,
  dataIeriRoma,
  dataOggiRoma,
  hasCredenziali,
  nessunaViolazioneA11yGrave,
  primaCardConPulsante,
  statoAutenticazione,
} from './helpers';

// Verifica che la pagina non scorra in orizzontale. Se scorre, il
// messaggio dell'asserzione elenca gli elementi che sporgono oltre il
// bordo destro (tag, id/classi abbreviati, right e larghezza), così un
// fallimento in CI dice direttamente chi è il colpevole.
async function nessunOverflowOrizzontale(page: Page): Promise<void> {
  const esito = await page.evaluate(() => {
    const larghezza = document.documentElement.clientWidth;
    const scroll = document.documentElement.scrollWidth;
    const sporgenti: string[] = [];
    if (scroll > larghezza) {
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= larghezza + 0.5) continue;
        // Solo gli elementi più interni che sporgono: se un figlio sporge
        // già lui, il genitore è una conseguenza.
        const figlioSporge = Array.from(el.children).some(
          (f) => f.getBoundingClientRect().right > larghezza + 0.5
        );
        if (figlioSporge) continue;
        const id = el.id ? `#${el.id}` : '';
        const classi =
          typeof el.className === 'string' && el.className
            ? `.${el.className.trim().split(/\s+/).slice(0, 4).join('.')}`
            : '';
        const testo = (el.textContent ?? '').trim().slice(0, 40);
        sporgenti.push(
          `${el.tagName.toLowerCase()}${id}${classi} right=${Math.round(r.right)} width=${Math.round(r.width)} "${testo}"`
        );
        if (sporgenti.length >= 15) break;
      }
    }
    // Se la pagina si è solo "allargata" (nessun figlio sporge dal
    // genitore, sporgono header e main interi), il colpevole è di solito
    // una parola senza spazi più larga dello spazio disponibile: elenco
    // le parole più larghe, misurate col font reale del loro elemento.
    const paroleLarghe: string[] = [];
    if (scroll > larghezza) {
      const tela = document.createElement('canvas').getContext('2d');
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const viste = new Set<string>();
      for (let nodo = walker.nextNode(); nodo; nodo = walker.nextNode()) {
        const genitore = nodo.parentElement;
        if (!genitore || !tela) continue;
        tela.font = getComputedStyle(genitore).font;
        for (const parola of (nodo.textContent ?? '').split(/\s+/)) {
          if (parola.length < 12 || viste.has(parola)) continue;
          viste.add(parola);
          const w = tela.measureText(parola).width;
          if (w > larghezza * 0.6) {
            paroleLarghe.push(`${Math.round(w)}px "${parola}" in <${genitore.tagName.toLowerCase()}>`);
          }
        }
      }
    }
    sporgenti.push(...paroleLarghe.sort((x, y) => parseInt(y) - parseInt(x)).slice(0, 10).map((p) => `parola: ${p}`));
    return { larghezza, scroll, sporgenti };
  });
  expect(
    esito.scroll,
    `scorrimento orizzontale: scrollWidth ${esito.scroll} > clientWidth ${esito.larghezza}. Elementi che sporgono:\n${esito.sporgenti.join('\n')}`
  ).toBeLessThanOrEqual(esito.larghezza);
}

async function riquadro(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('elemento non visibile');
  return box;
}

test.describe('10 — Presenze e pasti (schermata unica)', () => {
  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
    });

    test('ogni bambino ha una card con la presenza a sinistra e il pasto a destra', async ({ page }) => {
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');
      await expect(page.getByRole('heading', { name: 'Presenze e pasti', exact: true })).toBeVisible();

      const card = primaCardConPulsante(page, 'Pasto', 'Sì');
      test.skip((await card.count()) === 0, 'nessun bambino con Sì/No disponibili (es. pasti già comunicati)');

      await expect(card.locator('span.font-medium').first()).not.toBeEmpty();
      const presenza = colonnaPresenza(card);
      for (const nome of ['Presente', 'Pre-asilo', 'Post-asilo', 'Assente', 'Malattia', 'Salva nota']) {
        await expect(presenza.getByRole('button', { name: nome, exact: true })).toBeVisible();
      }
      await expect(presenza.getByPlaceholder('Nota (opzionale)')).toBeVisible();

      const pasto = colonnaPasto(card);
      for (const nome of ['Sì', 'No', 'Salva nota']) {
        await expect(pasto.getByRole('button', { name: nome, exact: true })).toBeVisible();
      }
      await expect(pasto.getByPlaceholder('Nota (opzionale)')).toBeVisible();

      const boxPresenza = await riquadro(presenza);
      const boxPasto = await riquadro(pasto);
      expect(boxPasto.x).toBeGreaterThan(boxPresenza.x + boxPresenza.width - 1);

      await nessunaViolazioneA11yGrave(page);
    });

    test('un cambio di presenza si vede subito nella colonna pasto della stessa card', async ({ page }) => {
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      const card = primaCardConPulsante(page, 'Pasto', 'Sì');
      test.skip((await card.count()) === 0, 'nessun bambino con Sì/No disponibili (es. pasti già comunicati)');
      const idCard = await card.getAttribute('id');
      const stessaCard = page.locator(`li#${idCard}`);
      const presenza = colonnaPresenza(stessaCard);
      test.skip(
        await presenza.getByRole('button', { name: 'Assente' }).isDisabled(),
        'Assente bloccato (pasto già comunicato a Rojac)'
      );

      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Assente' }));

      const pasto = colonnaPasto(stessaCard);
      await expect(pasto.getByText('🚫 Assente')).toBeVisible();
      await expect(pasto.getByRole('button', { name: 'Sì' })).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe('/dashboard/giornata');

      // Ripristino: il bambino torna presente, con Sì/No di nuovo disponibili.
      await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Presente' }));
      await expect(pasto.getByRole('button', { name: 'Sì' })).toBeVisible();
    });

    test('le vecchie pagine Presenze e Pasti portano alla schermata unica, per la stessa data', async ({ page }) => {
      const ieri = dataIeriRoma();
      await page.goto(`/dashboard/presenze?data=${ieri}`);
      await page.waitForURL(`/dashboard/giornata?data=${ieri}`);
      await expect(page.getByRole('heading', { name: 'Presenze e pasti', exact: true })).toBeVisible();

      await page.goto(`/dashboard/pasti?data=${ieri}`);
      await page.waitForURL(`/dashboard/giornata?data=${ieri}`);

      // Senza data: la schermata unica, alla data odierna.
      await page.goto('/dashboard/presenze');
      await page.waitForURL(/\/dashboard\/giornata$/);
      await expect(page.getByRole('heading', { name: 'Presenze e pasti', exact: true })).toBeVisible();
    });
  });

  test.describe('come maestra, a larghezza mobile (375px)', () => {
    test.use({ viewport: { width: 375, height: 812 }, storageState: statoAutenticazione('maestra') });

    test('nessuno scorrimento orizzontale, pasto a destra della presenza, pulsanti alti almeno 32px', async ({
      page,
    }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      const haBambini = await apriGiornata(page, dataOggiRoma());
      await nessunOverflowOrizzontale(page);
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      const card = cardBambini(page).first();
      const presenza = colonnaPresenza(card);
      const pasto = colonnaPasto(card);
      const boxPresenza = await riquadro(presenza);
      const boxPasto = await riquadro(pasto);
      expect(boxPasto.x).toBeGreaterThan(boxPresenza.x + boxPresenza.width - 1);
      expect(Math.abs(boxPasto.y - boxPresenza.y)).toBeLessThan(4);

      const bottonePresente = presenza.getByRole('button', { name: 'Presente' });
      if ((await bottonePresente.count()) > 0) {
        expect((await riquadro(bottonePresente)).height).toBeGreaterThanOrEqual(32);
      }

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('come maestra, sotto i 360px', () => {
    test.use({ viewport: { width: 340, height: 740 }, storageState: statoAutenticazione('maestra') });

    test('il pasto va sotto la presenza, nella stessa card, senza scorrimento orizzontale', async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      const haBambini = await apriGiornata(page, dataOggiRoma());
      await nessunOverflowOrizzontale(page);
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      const card = cardBambini(page).first();
      const boxPresenza = await riquadro(colonnaPresenza(card));
      const boxPasto = await riquadro(colonnaPasto(card));
      expect(boxPasto.y).toBeGreaterThanOrEqual(boxPresenza.y + boxPresenza.height - 1);
      const boxCard = await riquadro(card);
      expect(boxPasto.y + boxPasto.height).toBeLessThanOrEqual(boxCard.y + boxCard.height + 1);
    });
  });

  test.describe('come assistente', () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
    });

    test("l'assistente vede solo la colonna presenza, nessun dato pasto", async ({ page }) => {
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      await expect(colonnaPresenza(cardBambini(page).first())).toBeVisible();
      await expect(colonnaPasto(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sì', exact: true })).toHaveCount(0);
      await expect(page.getByText(/^Pasti: \d+\/\d+$/)).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Comunicazione pasti a Rojac' })).toHaveCount(0);
      // Nemmeno nel payload della pagina (HTML + dati RSC incorporati).
      const html = await page.content();
      expect(html).not.toContain('nota_pasto');
      expect(html).not.toContain('Pasti:');

      await nessunaViolazioneA11yGrave(page);
    });

    test("anche per l'assistente il vecchio indirizzo /dashboard/pasti porta alla schermata unica, senza dati pasto", async ({
      page,
    }) => {
      await page.goto(`/dashboard/pasti?data=${dataOggiRoma()}`);
      await page.waitForURL(`/dashboard/giornata?data=${dataOggiRoma()}`);
      await expect(colonnaPasto(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sì', exact: true })).toHaveCount(0);
    });
  });
});
