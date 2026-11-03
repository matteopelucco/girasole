// Helper e2e per il gettone e le scritte di copertura del pre/post-asilo nella
// card di "Presenze e pasti" (specs/13, scenari GET-01..GET-15; issue #399).
//
// Attesi dall'implementazione (nomi da rispettare):
//   * nella sezione "Presenza" della card, per ogni voce ATTIVA, una scritta con
//     `data-testid="copertura-pre-asilo"` / `"copertura-post-asilo"` e testo
//     esattamente "Già pagato con l'abbonamento" oppure "Da addebitare nella
//     prossima retta";
//   * il gettone, solo per le voci da addebitare, con
//     `data-testid="gettone-pre-asilo"` / `"gettone-post-asilo"`, `aria-hidden="true"`
//     (decorativo) e `data-animato="true"` finché è animato, `"false"` da fermo; l'animazione
//     è solo CSS (`animation-name` diverso da `none`, `animation-iteration-count: 1`),
//     e `animation-name: none` con `prefers-reduced-motion: reduce`;
//   * l'avviso di GET-12 con `data-testid="avviso-gettone-fuori-retta"` e testo
//     "Questo gettone non entrerà più in retta: l'admin lo gestirà con crediti e debiti.".
//
// I dati sono del bambino fixture (e2e/fixture-bambino.ts): costi scritti a mano
// e retta inviata inserita nel DB di test con il login admin (RLS come l'app);
// spariscono con il bambino (ON DELETE CASCADE).
import { expect, type Locator, type Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BambinoFixture } from './fixture-bambino';
import { scriviCostiInModoEsplicito, type CostiBambino } from './fixture-prezzi';

export type Voce = 'pre' | 'post';

export const TESTO_COPERTO = "Già pagato con l'abbonamento";
export const TESTO_DA_ADDEBITARE = 'Da addebitare nella prossima retta';
export const TESTO_AVVISO_FUORI_RETTA =
  "Questo gettone non entrerà più in retta: l'admin lo gestirà con crediti e debiti.";

const SUFFISSO: Record<Voce, string> = { pre: 'pre-asilo', post: 'post-asilo' };

export function scrittaCopertura(card: Locator, voce: Voce): Locator {
  return card.getByTestId(`copertura-${SUFFISSO[voce]}`);
}

export function gettone(card: Locator, voce: Voce): Locator {
  return card.getByTestId(`gettone-${SUFFISSO[voce]}`);
}

export function avvisoGettoneFuoriRetta(card: Locator): Locator {
  return card.getByTestId('avviso-gettone-fuori-retta');
}

// Nome dell'animazione CSS calcolata ('none' = nessuna animazione).
export async function nomeAnimazione(elemento: Locator): Promise<string> {
  return elemento.evaluate((el) => getComputedStyle(el).animationName);
}

// Conta gli avvii di animazione per testid del gettone, da prima di un'azione:
// `animationstart` risale fino al documento, quindi il conteggio resiste anche
// se React ricrea l'elemento. Da chiamare PRIMA di cliccare.
export async function contaAvviiGettoni(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __avviiGettoni?: Record<string, number> };
    w.__avviiGettoni = {};
    document.addEventListener(
      'animationstart',
      (e) => {
        const id = (e.target as HTMLElement | null)?.getAttribute?.('data-testid');
        if (id && id.startsWith('gettone-')) {
          w.__avviiGettoni![id] = (w.__avviiGettoni![id] ?? 0) + 1;
        }
      },
      true
    );
  });
}

export async function avviiGettone(page: Page, voce: Voce): Promise<number> {
  return page.evaluate(
    (id) => (window as unknown as { __avviiGettoni?: Record<string, number> }).__avviiGettoni?.[id] ?? 0,
    `gettone-${SUFFISSO[voce]}`
  );
}

// Nessun importo in euro nella card (GET-07).
export async function nessunImporto(card: Locator): Promise<void> {
  await expect(card).not.toContainText(/€|\beuro\b|\d+[.,]\d{2}/i);
}

// --- Dati ---------------------------------------------------------------

// Costi del bambino con abbonamento pre/post sì/no (gettoni e prezzi noti).
export async function impostaAbbonamenti(
  db: SupabaseClient,
  bambino: BambinoFixture,
  abbonamenti: { pre: boolean; post: boolean }
): Promise<void> {
  const costi: CostiBambino = {
    prezzo_mensile: 160,
    prezzo_buono_pasto: 6,
    prezzo_marca_da_bollo: 2,
    pre_asilo_richiesto: abbonamenti.pre,
    prezzo_pre_asilo: 70,
    post_asilo_richiesto: abbonamenti.post,
    prezzo_post_asilo: 70,
    gettone_pre_asilo: 7,
    gettone_post_asilo: 7,
    email_promemoria: null,
  };
  await scriviCostiInModoEsplicito(db, bambino.id, costi);
}

// Retta del mese già inviata, con i costi pre/post-asilo addebitati.
export async function inserisciRettaInviata(
  db: SupabaseClient,
  bambino: BambinoFixture,
  mese: string,
  voci: { costoPreAsilo: number; costoPostAsilo: number } = { costoPreAsilo: 0, costoPostAsilo: 0 }
): Promise<void> {
  const { error } = await db.from('comunicazioni_retta').insert({
    bambino_id: bambino.id,
    mese,
    retta_mensile: 160,
    costo_pasti: 0,
    conguaglio_pasti: 0,
    costo_pre_asilo: voci.costoPreAsilo,
    costo_post_asilo: voci.costoPostAsilo,
    costi_extra: 0,
    totale: 160 + voci.costoPreAsilo + voci.costoPostAsilo,
    email_destinatario: 'e2e-gettone@example.com',
    inviata_da_nome: 'E2E',
  });
  if (error) throw new Error(`Inserimento della retta inviata di prova non riuscito: ${error.message}`);
}

// Presenza già registrata su una data (anche passata) con pre/post-asilo.
export async function inserisciPresenzaConAsilo(
  db: SupabaseClient,
  bambino: BambinoFixture,
  data: string,
  asilo: { pre: boolean; post: boolean }
): Promise<void> {
  const { error } = await db
    .from('presenze')
    .insert({ bambino_id: bambino.id, data, stato: 'presente', pre_asilo: asilo.pre, post_asilo: asilo.post });
  if (error) throw new Error(`Inserimento della presenza di prova non riuscito: ${error.message}`);
}
