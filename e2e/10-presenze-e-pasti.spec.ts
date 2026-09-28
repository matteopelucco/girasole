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
  intestazioneCard,
  nessunaViolazioneA11yGrave,
  nomeBambinoCard,
  primaCardConPulsante,
  sezioneNota,
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

// Colori di sfondo dell'intestazione (Tailwind 3: pink-100, sky-100,
// stone-100), come calcolati dal browser.
const SFONDO_FEMMINA = 'rgb(252, 231, 243)';
const SFONDO_MASCHIO = 'rgb(224, 242, 254)';
const SFONDO_NEUTRO = 'rgb(245, 245, 244)';

async function sfondo(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).backgroundColor);
}

async function riquadro(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('elemento non visibile');
  return box;
}

// Una sola colonna a qualunque larghezza (issue #110): Presenza, poi
// Pasto, poi Nota, una sotto l'altra e tutte dentro la card.
async function sezioniUnaSottoLAltra(card: Locator) {
  const boxPresenza = await riquadro(colonnaPresenza(card));
  const boxPasto = await riquadro(colonnaPasto(card));
  const boxNota = await riquadro(sezioneNota(card));
  expect(boxPasto.y).toBeGreaterThanOrEqual(boxPresenza.y + boxPresenza.height - 1);
  expect(boxNota.y).toBeGreaterThanOrEqual(boxPasto.y + boxPasto.height - 1);
  const boxCard = await riquadro(card);
  expect(boxNota.y + boxNota.height).toBeLessThanOrEqual(boxCard.y + boxCard.height + 1);
}

test.describe('10 — Presenze e pasti (schermata unica)', () => {
  test.describe('come maestra', () => {
    test.use({ storageState: statoAutenticazione('maestra') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
    });

    test('ogni bambino ha una card con intestazione, sezione presenza, sezione pasto e nota', async ({ page }) => {
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');
      await expect(page.getByRole('heading', { name: 'Presenze e pasti', exact: true })).toBeVisible();

      const card = primaCardConPulsante(page, 'Pasto', 'Sì');
      test.skip((await card.count()) === 0, 'nessun bambino con Sì/No disponibili (es. pasti già comunicati)');

      // Il nome è il titolo della card, dentro l'intestazione.
      await expect(intestazioneCard(card).getByRole('heading', { level: 3 })).not.toBeEmpty();
      const presenza = colonnaPresenza(card);
      for (const nome of ['Presente', 'Pre-asilo', 'Post-asilo', 'Assente', 'Malattia']) {
        await expect(presenza.getByRole('button', { name: nome, exact: true })).toBeVisible();
      }

      const pasto = colonnaPasto(card);
      for (const nome of ['Sì', 'No']) {
        await expect(pasto.getByRole('button', { name: nome, exact: true })).toBeVisible();
      }
      // Una sola nota per card (issue #109), nella sezione "Nota" in
      // fondo (issue #110).
      const nota = sezioneNota(card);
      await expect(nota.getByLabel('Nota (opzionale)')).toBeVisible();
      await expect(nota.getByRole('button', { name: 'Salva nota', exact: true })).toBeVisible();
      await expect(card.getByLabel('Nota (opzionale)')).toHaveCount(1);

      // Anche da computer (viewport di default, 1280px): una colonna.
      await sezioniUnaSottoLAltra(card);

      await nessunaViolazioneA11yGrave(page);
    });

    test("l'intestazione mostra l'avatar del bambino in base al sesso", async ({ page }) => {
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      // Il seed (supabase/seed.sql) ha nella sezione di test almeno una
      // femmina, un maschio e un bambino senza sesso: il controllo è sul
      // legame avatar ↔ colore, non su nomi precisi.
      const cards = cardBambini(page);
      const avatar = (nome: string) => page.locator('header').getByRole('img', { name: nome, exact: true });
      const femmina = cards.filter({ has: avatar('Bambina') }).first();
      const maschio = cards.filter({ has: avatar('Bambino') }).first();
      const senzaSesso = cards.filter({ hasNot: avatar('Bambina') }).filter({ hasNot: avatar('Bambino') }).first();

      test.skip(
        (await femmina.count()) === 0 || (await maschio.count()) === 0 || (await senzaSesso.count()) === 0,
        'servono una femmina, un maschio e un bambino senza sesso visibili (seed di test)'
      );

      expect(await sfondo(intestazioneCard(femmina))).toBe(SFONDO_FEMMINA);
      expect(await sfondo(intestazioneCard(maschio))).toBe(SFONDO_MASCHIO);
      expect(await sfondo(intestazioneCard(senzaSesso))).toBe(SFONDO_NEUTRO);
      // Anche il bambino senza sesso ha un avatar (neutro, decorativo):
      // l'unico SVG dell'intestazione (il warning di incoerenza è testo).
      await expect(intestazioneCard(senzaSesso).locator('svg')).toHaveCount(1);
      await expect(intestazioneCard(senzaSesso).getByRole('img')).toHaveCount(0);
      await expect(nomeBambinoCard(senzaSesso)).not.toBeEmpty();

      // Niente più scritte Femmina/Maschio (issue #108).
      await expect(page.locator('header').getByText(/^(Femmina|Maschio)$/)).toHaveCount(0);

      await nessunaViolazioneA11yGrave(page);
    });

    test('lo stato selezionato è evidenziato con un segno di spunta', async ({ page }) => {
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      const card = primaCardConPulsante(page, 'Presenza', 'Presente');
      test.skip((await card.count()) === 0, 'nessun bambino segnabile oggi');
      const idCard = await card.getAttribute('id');
      const presenza = colonnaPresenza(page.locator(`li#${idCard}`));

      const presente = presenza.getByRole('button', { name: 'Presente', exact: true });
      if ((await presente.getAttribute('aria-pressed')) !== 'true') {
        await clickEAttendiAzione(page, presente);
      }
      await expect(presente).toHaveAttribute('aria-pressed', 'true');
      await expect(presente).toContainText('✓');
      for (const nome of ['Assente', 'Malattia']) {
        const altro = presenza.getByRole('button', { name: nome, exact: true });
        if (await altro.isEnabled()) await expect(altro).toHaveAttribute('aria-pressed', 'false');
        await expect(altro).not.toContainText('✓');
      }
    });

    test('un cambio di presenza si vede subito nella sezione pasto della stessa card', async ({ page }) => {
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

  test.describe('come maestra, su telefono (375px)', () => {
    test.use({ viewport: { width: 375, height: 812 }, storageState: statoAutenticazione('maestra') });

    test("su telefono le sezioni sono una sotto l'altra", async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      const haBambini = await apriGiornata(page, dataOggiRoma());
      await nessunOverflowOrizzontale(page);
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      const card = cardBambini(page).first();
      await sezioniUnaSottoLAltra(card);

      const bottonePresente = colonnaPresenza(card).getByRole('button', { name: 'Presente' });
      if ((await bottonePresente.count()) > 0) {
        expect((await riquadro(bottonePresente)).height).toBeGreaterThanOrEqual(44);
      }

      await nessunaViolazioneA11yGrave(page);
    });
  });

  test.describe('come maestra, schermo molto stretto (340px)', () => {
    test.use({ viewport: { width: 340, height: 740 }, storageState: statoAutenticazione('maestra') });

    test("anche su uno schermo molto stretto non c'è scorrimento orizzontale", async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      const haBambini = await apriGiornata(page, dataOggiRoma());
      await nessunOverflowOrizzontale(page);
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      const card = cardBambini(page).first();
      await sezioniUnaSottoLAltra(card);
    });
  });

  test.describe('come maestra, su tablet (768px)', () => {
    test.use({ viewport: { width: 768, height: 1024 }, storageState: statoAutenticazione('maestra') });

    test("anche su tablet e computer le sezioni sono una sotto l'altra", async ({ page }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      const haBambini = await apriGiornata(page, dataOggiRoma());
      await nessunOverflowOrizzontale(page);
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      await sezioniUnaSottoLAltra(cardBambini(page).first());
    });
  });

  test.describe('come assistente', () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
    });

    test("l'assistente vede solo la sezione presenza, nessun dato pasto", async ({ page }) => {
      const haBambini = await apriGiornata(page, dataOggiRoma());
      test.skip(!haBambini, 'nessun bambino visibile per questo account');

      await expect(colonnaPresenza(cardBambini(page).first())).toBeVisible();
      await expect(sezioneNota(cardBambini(page).first())).toBeVisible();
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
