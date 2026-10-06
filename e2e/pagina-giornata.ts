// Helper e2e per la schermata "Presenze e pasti" (giornata), issue #249 (#173 a).
//
// PERCHÉ. I selettori di questa pagina erano ripetuti in 10, 12, 13, 14, 16,
// 06 e 57: se cambia un'etichetta, una classe di stato o la struttura della
// card, si corregge qui, in una riga, non in decine di test.
//
// COME SI USA. `import { apriGiornata, cardBambino, ... } from './pagina-giornata'`.
// I selettori generici (login, a11y, `clickEAttendiAzione`, date) restano in
// `./helpers`; il bambino proprio del test (fixture) in `./fixture-bambino`.
// Questo modulo importa da `./helpers` (mai il contrario) e solo i TIPI da
// `./fixture-bambino` (che a sua volta importa `./helpers`): nessun ciclo.
//
// STRUTTURA (specs/10 - presenze-e-pasti.md): una card per bambino
// (<li id="bambino-<id>">) con un'intestazione (<header>, nome del bambino
// come titolo <h3>), una sezione "Presenza" e, per maestra/admin, una sezione
// "Pasto" (role="group" con nome accessibile) e in fondo una sezione "Nota"
// (issue #110). Ogni sezione ha i propri pulsanti: i test vanno sempre
// ristretti alla sezione giusta, altrimenti un getByRole sulla card intera
// trova elementi di sezioni diverse. Il selettore sull'id esclude anche gli
// altri <li> della pagina (es. l'elenco "Bambini senza presenza" del box
// Rojac).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { clickEAttendiAzione } from './helpers';
import type { BambinoFixture } from './fixture-bambino';

export const PERCORSO_GIORNATA = '/dashboard/giornata';

export const NOME_PAGINA_GIORNATA = 'Presenze e pasti';

// Classi Tailwind dei pulsanti "attivi" (lib/classiStato.ts): il test
// verifica lo stato selezionato da qui, così un cambio di colore si corregge
// in un punto solo.
export const CLASSE_ATTIVO = {
  presente: /bg-emerald-700/,
  assente: /bg-stone-600/,
  malattia: /bg-rose-600/,
  preAsilo: /bg-sky-700/,
  postAsilo: /bg-sky-700/,
  pastoSi: /bg-emerald-700/,
  pastoNo: /bg-rose-600/,
} as const;

export type StatoPresenza = 'Presente' | 'Assente' | 'Malattia' | 'Pre-asilo' | 'Post-asilo';
export type RispostaPasto = 'Sì' | 'No';
export type Colonna = 'Presenza' | 'Pasto';

// Motivi di salto predefiniti di cardConPulsante: la card c'è ma non ci sono
// i pulsanti (giorno di chiusura, specs/53; pasti già comunicati a Rojac,
// specs/16).
const MOTIVO_SKIP_PREDEFINITO: Record<Colonna, string> = {
  Presenza: 'nessun pulsante di presenza (giorno di chiusura)',
  Pasto: 'nessun pulsante Sì/No disponibile (es. pasti già comunicati, giorno di chiusura)',
};

// --- Card dei bambini -------------------------------------------------------

export function cardBambini(page: Page): Locator {
  return page.locator('li[id^="bambino-"]');
}

// La card del bambino fixture: il suo id (`bambino-<id>`) è univoco, a
// differenza di un filtro sul testo.
export function cardBambino(page: Page, bambino: BambinoFixture): Locator {
  return page.locator(`li#bambino-${bambino.id}`);
}

// Intestazione della card (sfondo e avatar per sesso, issue #106 e #108)
// e nome del bambino, titolo della card.
export function intestazioneCard(card: Locator): Locator {
  return card.locator('header');
}

export function nomeBambinoCard(card: Locator): Locator {
  return card.getByRole('heading', { level: 3 });
}

// Warning di incoerenza (presente/assente vs pasto, specs/06) nella card.
export function warningInconsistenza(contenitore: Page | Locator): Locator {
  return contenitore.getByText('Inconsistenza');
}

// --- Sezioni della card -----------------------------------------------------

export function colonnaPresenza(contenitore: Page | Locator): Locator {
  return contenitore.getByRole('group', { name: 'Presenza', exact: true });
}

export function colonnaPasto(contenitore: Page | Locator): Locator {
  return contenitore.getByRole('group', { name: 'Pasto', exact: true });
}

// Sezione "Nota" in fondo alla card (issue #110): campo "Nota
// (opzionale)" e "Salva nota" della presenza.
export function sezioneNota(contenitore: Page | Locator): Locator {
  return contenitore.getByRole('group', { name: 'Nota', exact: true });
}

export function campoNota(card: Locator): Locator {
  return sezioneNota(card).getByLabel('Nota (opzionale)');
}

export function bottoneSalvaNota(card: Locator): Locator {
  return sezioneNota(card).getByRole('button', { name: 'Salva nota', exact: true });
}

// Pulsante di stato (Presente, Assente, Malattia, Pre-asilo, Post-asilo)
// della sezione "Presenza" della card.
export function bottonePresenza(card: Locator, stato: StatoPresenza): Locator {
  return colonnaPresenza(card).getByRole('button', { name: stato, exact: true });
}

// Pulsante Sì/No della sezione "Pasto" della card. "No" è cercato per nome
// esatto perché altrimenti combacerebbe con altre etichette che lo contengono
// (es. "Non ancora segnato"); "Sì" no, come nei test originali (così le
// asserzioni di assenza, con count 0, restano il più severe possibile).
export function bottonePasto(card: Locator, risposta: RispostaPasto): Locator {
  return colonnaPasto(card).getByRole('button', { name: risposta, exact: risposta === 'No' });
}

// Etichette al posto di Sì/No nella sezione "Pasto" per un bambino assente o
// malato (specs/10).
export function etichettaPastoAssente(card: Locator): Locator {
  return colonnaPasto(card).getByText('🚫 Assente');
}

export function etichettaPastoMalattia(card: Locator): Locator {
  return colonnaPasto(card).getByText('🤒 Malattia');
}

// Avviso "Conferma azzeramento" che Assente/Malattia mostrano se c'è un pasto
// "sì" o un pre/post-asilo già segnati (specs/13, issue #186).
export function avvisoConfermaAzzeramento(card: Locator): Locator {
  return colonnaPresenza(card).getByRole('group', { name: 'Conferma azzeramento' });
}

// Salta il test se Assente/Malattia è bloccato (pasto già comunicato a
// Rojac, specs/16): l'incoerenza o la correzione non è più raggiungibile.
// Da chiamare dentro un test.
export async function saltaSeStatoBloccato(
  card: Locator,
  stato: 'Assente' | 'Malattia'
): Promise<void> {
  test.skip(
    await bottonePresenza(card, stato).isDisabled(),
    `${stato} bloccat${stato === 'Assente' ? 'o' : 'a'} (pasto già comunicato a Rojac)`
  );
}

// Card del primo bambino la cui colonna indicata contiene il pulsante
// `nomePulsante` (es. la prima card con "Sì" ancora disponibile).
export function primaCardConPulsante(page: Page, colonna: Colonna, nomePulsante: string): Locator {
  return cardBambini(page)
    .filter({
      has: page
        .getByRole('group', { name: colonna, exact: true })
        .getByRole('button', { name: nomePulsante, exact: true }),
    })
    .first();
}

// Card del bambino fixture, ma salta il test se nella sua colonna `colonna`
// non c'è il pulsante `pulsante`: giorno di chiusura (specs/53, la card c'è
// ma senza pulsanti) o pasti già comunicati a Rojac (niente Sì/No). Prima di
// cercare i pulsanti aspetta la card, così un bambino che non compare fa
// fallire il test invece di saltarlo.
export async function cardConPulsante(
  page: Page,
  bambino: BambinoFixture,
  colonna: Colonna,
  pulsante: string,
  motivoSkip: string = MOTIVO_SKIP_PREDEFINITO[colonna]
): Promise<Locator> {
  const card = cardBambino(page, bambino);
  await expect(card).toBeVisible();
  const pulsanti = card
    .getByRole('group', { name: colonna, exact: true })
    .getByRole('button', { name: pulsante, exact: true });
  test.skip((await pulsanti.count()) === 0, motivoSkip);
  return card;
}

// --- Pagina -----------------------------------------------------------------

// Apre "Presenze e pasti" per la data indicata; ritorna false se
// l'account non vede nessun bambino (il test chiamante si salta).
export async function apriGiornata(page: Page, data: string): Promise<boolean> {
  await page.goto(`${PERCORSO_GIORNATA}?data=${data}`);
  return (await cardBambini(page).count()) > 0;
}

// Titolo (h1) della pagina "Presenze e pasti".
export function titoloGiornata(page: Page): Locator {
  return page.getByRole('heading', { name: NOME_PAGINA_GIORNATA, exact: true });
}

// Card/link "Presenze e pasti" nella dashboard (specs/12).
export function linkGiornata(page: Page): Locator {
  return page.getByRole('link', { name: NOME_PAGINA_GIORNATA });
}

// Intestazione di un gruppo di bambini ("Sezione ...").
export function titoloSezione(page: Page): Locator {
  return page.getByRole('heading', { name: /^Sezione / });
}

// Riquadro "Riepilogo giornaliero" in cima alla pagina: il div più interno
// che contiene il titolo è la card stessa.
export function riepilogoGiornaliero(page: Page): Locator {
  const titolo = page.getByRole('heading', { name: 'Riepilogo giornaliero', exact: true });
  return page.locator('div', { has: titolo }).last();
}

// Conteggi del riepilogo, nel riquadro aggregato o in un'intestazione di
// sezione ("Presenti: 3/5", "Pre-asilo: 1", "Post-asilo: 0", "Pasti: 2/5").
// Il riepilogo aggregato e quello per sezione hanno lo stesso formato: su
// tutta la pagina `.first()` basta a verificare che compaia.
const REGEX_RIEPILOGO = {
  Presenti: /^Presenti: \d+\/\d+$/,
  'Pre-asilo': /^Pre-asilo: \d+$/,
  'Post-asilo': /^Post-asilo: \d+$/,
  Pasti: /^Pasti: \d+\/\d+$/,
} as const;

export function conteggioRiepilogo(
  contenitore: Page | Locator,
  voce: keyof typeof REGEX_RIEPILOGO
): Locator {
  return contenitore.getByText(REGEX_RIEPILOGO[voce]);
}

// Banner "Sola lettura" (data diversa da oggi, per maestra e assistente).
export function avvisoSolaLettura(page: Page): Locator {
  return page.getByText('Sola lettura: puoi modificare solo la data di oggi.');
}

// Vero se la pagina corrente (Presenze e pasti, ore di lavoro...) mostra
// l'avviso di chiusura scolastica (specs/53): "L'asilo è chiuso..." per
// sabato/domenica, "Giorno di chiusura scolastica..." per un giorno
// registrato in `giorni_chiusura` (lib/calendarioScolastico.ts:
// messaggioChiusura). In un giorno chiuso le card dei bambini ci sono
// ancora ma senza i pulsanti di presenza/pasto: apriGiornata() ritorna true
// comunque (i test di specs/53 ne dipendono), quindi i test che si aspettano
// un giorno scrivibile usano questa funzione per saltarsi invece di fallire
// il sabato. Da chiamare dopo apriGiornata(): la pagina è renderizzata dal
// server, l'avviso è già nel DOM.
export async function giornoDiChiusura(page: Page): Promise<boolean> {
  const avviso = page.getByText(/L'asilo è chiuso|Giorno di chiusura scolastica/);
  return (await avviso.count()) > 0;
}

// --- Comunicazione pasti a Rojac (specs/16) ---------------------------------
// Solo selettori: i test NON premono mai la conferma finale (irreversibile).

export function titoloComunicazioneRojac(page: Page): Locator {
  return page.getByRole('heading', { name: 'Comunicazione pasti a Rojac', exact: true });
}

// Banner "Pasti comunicati a Rojac il ...": presente solo se oggi la
// comunicazione è già avvenuta.
export function bannerPastiComunicati(page: Page): Locator {
  return page.getByText('Pasti comunicati a Rojac il', { exact: false });
}

// Pulsante che APRE il riquadro di conferma (non conferma nulla).
export function bottoneConfermaPasti(page: Page): Locator {
  return page.getByRole('button', { name: 'Conferma pasti' });
}

// --- Azioni -----------------------------------------------------------------

// Segna Assente o Malattia nella sezione "Presenza" `presenza` di una card
// (specs/13). Se il bambino ha un pasto "sì" o un pre/post-asilo già
// segnati, il pulsante non salva subito ma apre l'avviso di conferma
// (`aria-expanded` presente, issue #186): in quel caso conferma con
// "Conferma e azzera". Gli altri test condividono lo stesso stato dei
// bambini, quindi non sanno a priori se serva la conferma. Attende la
// risposta della Server Action, come clickEAttendiAzione.
export async function segnaAssenteOMalattia(
  page: Page,
  presenza: Locator,
  stato: 'Assente' | 'Malattia'
): Promise<void> {
  const bottone = presenza.getByRole('button', { name: stato });
  if ((await bottone.getAttribute('aria-expanded')) === null) {
    await clickEAttendiAzione(page, bottone);
    return;
  }
  await bottone.click();
  await clickEAttendiAzione(page, presenza.getByRole('button', { name: 'Conferma e azzera' }));
}
