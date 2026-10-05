// Requisito: specs/10 - presenze-e-pasti.md
//
// ATTENZIONE: alcuni test scrivono davvero in `presenze` sul progetto
// Supabase di test (vedi la nota in 13-segna-presenza.spec.ts).
//
// Dati propri (issue #229): ogni test lavora su un bambino creato apposta
// (fixture `bambino`, e2e/fixture-bambino.ts) ed eliminato a fine test, non
// sulla "prima card" del seed: nessun ripristino a "presente" e nessuna
// dipendenza dallo stato lasciato da altri test.
import type { Locator, Page } from '@playwright/test';
import {
  test,
  expect,
  cardBambino,
  cardConPulsante,
  creaBambinoFixture,
  eliminaBambinoFixture,
  type BambinoFixture,
} from './fixture-bambino';
import {
  apriGiornata,
  clickEAttendiAzione,
  colonnaPasto,
  colonnaPresenza,
  dataIeriRoma,
  dataOggiRoma,
  giornoDiChiusura,
  hasCredenziali,
  intestazioneCard,
  nessunaViolazioneA11yGrave,
  nomeBambinoCard,
  segnaAssenteOMalattia,
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

    test('ogni bambino ha una card con intestazione, sezione presenza, sezione pasto e nota', async ({
      page,
      bambino,
    }) => {
      await apriGiornata(page, dataOggiRoma());
      await expect(page.getByRole('heading', { name: 'Presenze e pasti', exact: true })).toBeVisible();

      const card = await cardConPulsante(
        page,
        bambino,
        'Pasto',
        'Sì',
        'nessun pulsante Sì/No disponibile (es. pasti già comunicati)'
      );

      // Il nome è il titolo della card, dentro l'intestazione.
      await expect(intestazioneCard(card).getByRole('heading', { level: 3 })).not.toBeEmpty();
      const presenza = colonnaPresenza(card);
      for (const nome of ['Presente', 'Assente', 'Malattia', 'Pre-asilo', 'Post-asilo']) {
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

    test('i pulsanti della sezione Presenza hanno un ordine fisso', async ({ page, bambino }) => {
      await apriGiornata(page, dataOggiRoma());
      const card = await cardConPulsante(
        page,
        bambino,
        'Presenza',
        'Pre-asilo',
        'nessun pulsante di presenza modificabile (giorno di chiusura)'
      );

      const presenza = colonnaPresenza(card);
      const box = async (nome: string) =>
        riquadro(presenza.getByRole('button', { name: nome, exact: true }));
      const [presente, assente, malattia, pre, post] = [
        await box('Presente'),
        await box('Assente'),
        await box('Malattia'),
        await box('Pre-asilo'),
        await box('Post-asilo'),
      ];
      const separatore = await riquadro(presenza.getByRole('separator'));

      // Presente, Assente, Malattia: stessa riga, da sinistra a destra.
      expect(Math.abs(assente.y - presente.y)).toBeLessThan(2);
      expect(Math.abs(malattia.y - presente.y)).toBeLessThan(2);
      expect(assente.x).toBeGreaterThan(presente.x);
      expect(malattia.x).toBeGreaterThan(assente.x);
      // Separatore sotto gli stati esclusivi.
      expect(separatore.y).toBeGreaterThanOrEqual(presente.y + presente.height - 1);
      // Pre-asilo e Post-asilo affiancati sotto il separatore.
      expect(pre.y).toBeGreaterThanOrEqual(separatore.y + separatore.height - 1);
      expect(Math.abs(post.y - pre.y)).toBeLessThan(2);
      expect(post.x).toBeGreaterThan(pre.x);

      await nessunaViolazioneA11yGrave(page);
    });

    test('la comunicazione pasti a Rojac sta nella card del riepilogo giornaliero', async ({ page, bambino }) => {
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();

      // Il div più interno che contiene il titolo è la card stessa.
      const titoloRiepilogo = page.getByRole('heading', { name: 'Riepilogo giornaliero', exact: true });
      const cardRiepilogo = page.locator('div', { has: titoloRiepilogo }).last();
      const titoloRojac = page.getByRole('heading', { name: 'Comunicazione pasti a Rojac', exact: true });
      await expect(titoloRojac).toHaveCount(1);
      await expect(cardRiepilogo.getByRole('heading', { name: 'Comunicazione pasti a Rojac', exact: true })).toBeVisible();

      // Sotto gli specchietti del riepilogo, non sopra.
      const yPasti = (await riquadro(cardRiepilogo.getByText(/^Pasti: \d+\/\d+$/))).y;
      expect((await riquadro(titoloRojac)).y).toBeGreaterThan(yPasti);

      await nessunaViolazioneA11yGrave(page);
    });

    test("ogni gruppo di bambini ha un'intestazione di sezione che non è una card", async ({ page, bambino }) => {
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();

      const titoloSezione = page.getByRole('heading', { name: /^Sezione / }).first();
      await expect(titoloSezione).toBeVisible();
      const intestazione = titoloSezione.locator('..');

      // Niente bordo, ombra né sfondo da card.
      const stile = await intestazione.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bordo: s.borderTopWidth, ombra: s.boxShadow, sfondo: s.backgroundColor };
      });
      expect(stile).toEqual({ bordo: '0px', ombra: 'none', sfondo: 'rgba(0, 0, 0, 0)' });

      // Riassunto testuale sotto il titolo.
      await expect(intestazione.getByText(/^Presenti: \d+\/\d+$/)).toBeVisible();
      await expect(intestazione.getByText(/^Pre-asilo: \d+$/)).toBeVisible();
      await expect(intestazione.getByText(/^Post-asilo: \d+$/)).toBeVisible();
      await expect(intestazione.getByText(/^Pasti: \d+\/\d+$/)).toBeVisible();

      await nessunaViolazioneA11yGrave(page);
    });

    test("l'intestazione mostra l'avatar del bambino in base al sesso", async ({ page, adminDb }) => {
      test.skip(adminDb === null, 'richiede E2E_ADMIN_EMAIL/PASSWORD (fixture bambino)');

      // Tre bambini creati apposta (femmina, maschio, senza sesso), non
      // quelli del seed: il controllo è sul legame avatar ↔ colore.
      const creati: BambinoFixture[] = [];
      try {
        for (const sesso of ['F', 'M', null] as const) {
          creati.push(await creaBambinoFixture(adminDb!, { sesso }));
        }
        const [bambinaF, bambinoM, bambinoSenzaSesso] = creati;

        await apriGiornata(page, dataOggiRoma());
        const avatar = (card: Locator, nome: string) => card.locator('header').getByRole('img', { name: nome, exact: true });
        const femmina = cardBambino(page, bambinaF);
        const maschio = cardBambino(page, bambinoM);
        const senzaSesso = cardBambino(page, bambinoSenzaSesso);
        await expect(femmina).toBeVisible();
        await expect(maschio).toBeVisible();
        await expect(senzaSesso).toBeVisible();

        await expect(avatar(femmina, 'Bambina')).toBeVisible();
        await expect(avatar(maschio, 'Bambino')).toBeVisible();
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
      } finally {
        // Si prova a eliminarli tutti anche se uno fallisce.
        const esiti = await Promise.allSettled(creati.map((b) => eliminaBambinoFixture(adminDb!, b.id)));
        const fallito = esiti.find((e) => e.status === 'rejected');
        if (fallito) throw (fallito as PromiseRejectedResult).reason;
      }
    });

    test('lo stato selezionato è evidenziato con un segno di spunta', async ({ page, bambino }) => {
      await apriGiornata(page, dataOggiRoma());
      const card = await cardConPulsante(page, bambino, 'Presenza', 'Presente', 'nessun bambino segnabile oggi');
      const presenza = colonnaPresenza(card);

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

    test('un cambio di presenza si vede subito nella sezione pasto della stessa card', async ({
      page,
      bambino,
    }) => {
      await apriGiornata(page, dataOggiRoma());
      const stessaCard = await cardConPulsante(
        page,
        bambino,
        'Pasto',
        'Sì',
        'nessun pulsante Sì/No disponibile (es. pasti già comunicati)'
      );
      const presenza = colonnaPresenza(stessaCard);
      test.skip(
        await presenza.getByRole('button', { name: 'Assente' }).isDisabled(),
        'Assente bloccato (pasto già comunicato a Rojac)'
      );

      await segnaAssenteOMalattia(page, presenza, 'Assente');

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

    test("su telefono le sezioni sono una sotto l'altra", async ({ page, bambino }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();
      await nessunOverflowOrizzontale(page);
      test.skip(await giornoDiChiusura(page), 'giorno di chiusura (specs/53)');

      const card = cardBambino(page, bambino);
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

    test("anche su uno schermo molto stretto non c'è scorrimento orizzontale", async ({ page, bambino }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();
      await nessunOverflowOrizzontale(page);
      test.skip(await giornoDiChiusura(page), 'giorno di chiusura (specs/53)');

      await sezioniUnaSottoLAltra(cardBambino(page, bambino));
    });
  });

  test.describe('come maestra, su tablet (768px)', () => {
    test.use({ viewport: { width: 768, height: 1024 }, storageState: statoAutenticazione('maestra') });

    test("anche su tablet e computer le sezioni sono una sotto l'altra", async ({ page, bambino }) => {
      test.skip(!hasCredenziali('maestra'), 'richiede E2E_MAESTRA_EMAIL/PASSWORD');
      await apriGiornata(page, dataOggiRoma());
      await expect(cardBambino(page, bambino)).toBeVisible();
      await nessunOverflowOrizzontale(page);
      test.skip(await giornoDiChiusura(page), 'giorno di chiusura (specs/53)');

      await sezioniUnaSottoLAltra(cardBambino(page, bambino));
    });
  });

  test.describe('come assistente', () => {
    test.use({ storageState: statoAutenticazione('assistente') });

    test.beforeEach(async () => {
      test.skip(!hasCredenziali('assistente'), 'richiede E2E_ASSISTENTE_EMAIL/PASSWORD');
    });

    test("l'assistente vede solo la sezione presenza, nessun dato pasto", async ({ page, bambino }) => {
      await apriGiornata(page, dataOggiRoma());
      const card = cardBambino(page, bambino);
      await expect(card).toBeVisible();
      test.skip(await giornoDiChiusura(page), 'giorno di chiusura (specs/53)');

      await expect(colonnaPresenza(card)).toBeVisible();
      await expect(sezioneNota(card)).toBeVisible();
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
