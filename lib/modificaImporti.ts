import { arrotonda, formattaImporto } from './comunicazioneRetta';
import { ETICHETTE_VOCI, type ComunicazioneImporti } from './pagamentiBambino';

// "Modifica importi" (specs/60, PAG-02..PAG-15; issue #421): logica pura della
// correzione delle voci di una retta già inviata. Nessun I/O: la scrittura è
// della funzione del DB `modifica_importi_comunicazione_retta` (migration
// 0074), che ripete gli stessi controlli.

export type ChiaveVoce =
  | 'retta_mensile'
  | 'marca_da_bollo'
  | 'costo_pasti'
  | 'conguaglio_pasti'
  | 'costo_pre_asilo'
  | 'costo_post_asilo'
  | 'gettoni_pre_asilo'
  | 'gettoni_post_asilo'
  | 'costi_extra'
  | 'credito_debito';

// Le dieci voci, nell'ordine di ETICHETTE_VOCI. Solo conguaglio pasti e
// credito/debito possono essere negativi.
export const VOCI_MODIFICABILI: readonly { chiave: ChiaveVoce; etichetta: string; negativa: boolean }[] = [
  { chiave: 'retta_mensile', etichetta: ETICHETTE_VOCI[0], negativa: false },
  { chiave: 'marca_da_bollo', etichetta: ETICHETTE_VOCI[1], negativa: false },
  { chiave: 'costo_pasti', etichetta: ETICHETTE_VOCI[2], negativa: false },
  { chiave: 'conguaglio_pasti', etichetta: ETICHETTE_VOCI[3], negativa: true },
  { chiave: 'costo_pre_asilo', etichetta: ETICHETTE_VOCI[4], negativa: false },
  { chiave: 'costo_post_asilo', etichetta: ETICHETTE_VOCI[5], negativa: false },
  { chiave: 'gettoni_pre_asilo', etichetta: ETICHETTE_VOCI[6], negativa: false },
  { chiave: 'gettoni_post_asilo', etichetta: ETICHETTE_VOCI[7], negativa: false },
  { chiave: 'costi_extra', etichetta: ETICHETTE_VOCI[8], negativa: false },
  { chiave: 'credito_debito', etichetta: ETICHETTE_VOCI[9], negativa: true },
];

export type ImportiVoci = Record<ChiaveVoce, number>;
export type NoteVoci = { note_costi_extra: string | null; nota_credito_debito: string | null };
export type ChiaveNota = keyof NoteVoci;

// Importo massimo (in valore assoluto) di una voce — il limite di
// `numeric(8, 2)` dei gettoni, ripetuto dalla funzione del DB — e lunghezza
// massima di motivo e note.
export const IMPORTO_VOCE_MAX = 999999.99;
export const MOTIVO_MODIFICA_MAX = 500;
export const NOTA_VOCE_MAX = 500;

const ETICHETTE_NOTE: Record<ChiaveNota, string> = {
  note_costi_extra: 'Nota costi extra',
  nota_credito_debito: 'Nota credito/debito',
};
const CHIAVI_NOTE = Object.keys(ETICHETTE_NOTE) as ChiaveNota[];

// Somma delle dieci voci, arrotondata al centesimo: è il totale di una retta
// (la stessa somma di `calcolaRiepilogoRetta`). Il server lo ricalcola sempre;
// quello mostrato nella finestra è solo un'anteprima.
export function sommaVoci(importi: ImportiVoci): number {
  return arrotonda(VOCI_MODIFICABILI.reduce((somma, voce) => somma + importi[voce.chiave], 0));
}

// Importi e note attuali di una comunicazione, come numeri e testi puliti.
export function valoriDaComunicazione(c: ComunicazioneImporti): ImportiVoci & NoteVoci {
  return {
    retta_mensile: Number(c.retta_mensile),
    marca_da_bollo: Number(c.marca_da_bollo),
    costo_pasti: Number(c.costo_pasti),
    conguaglio_pasti: Number(c.conguaglio_pasti),
    costo_pre_asilo: Number(c.costo_pre_asilo),
    costo_post_asilo: Number(c.costo_post_asilo),
    gettoni_pre_asilo: Number(c.gettoni_pre_asilo ?? 0),
    gettoni_post_asilo: Number(c.gettoni_post_asilo ?? 0),
    costi_extra: Number(c.costi_extra),
    credito_debito: Number(c.credito_debito),
    note_costi_extra: pulisciNota(c.note_costi_extra),
    nota_credito_debito: pulisciNota(c.nota_credito_debito),
  };
}

function pulisciNota(valore: string | null | undefined): string | null {
  return valore?.trim() || null;
}

// Importo scritto in un campo: numero con al massimo due decimali, con virgola
// o punto. Vuoto o non numerico = null (un errore per chi chiama).
export function leggiImportoScritto(testo: string): number | null {
  const pulito = testo.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(pulito)) return null;
  return arrotonda(Number(pulito));
}

// Anteprima del totale mentre si scrive: i campi non ancora validi valgono 0.
export function anteprimaTotale(testi: Record<ChiaveVoce, string>): number {
  const importi = {} as ImportiVoci;
  for (const voce of VOCI_MODIFICABILI) importi[voce.chiave] = leggiImportoScritto(testi[voce.chiave]) ?? 0;
  return sommaVoci(importi);
}

export type Differenza = { chiave: ChiaveVoce | ChiaveNota; etichetta: string; prima: string; dopo: string };

function euro(valore: number): string {
  return `${formattaImporto(valore)} €`;
}

function testoNota(valore: string | null): string {
  return pulisciNota(valore) ?? '(vuota)';
}

// Le sole voci (e note) cambiate tra prima e dopo, nell'ordine della tabella,
// con i valori già scritti per esteso ("12,50 €", note come testo).
export function differenzeModifica(prima: ImportiVoci & NoteVoci, dopo: ImportiVoci & NoteVoci): Differenza[] {
  const cambiate: Differenza[] = [];
  for (const voce of VOCI_MODIFICABILI) {
    if (arrotonda(prima[voce.chiave]) !== arrotonda(dopo[voce.chiave])) {
      cambiate.push({
        chiave: voce.chiave,
        etichetta: voce.etichetta,
        prima: euro(prima[voce.chiave]),
        dopo: euro(dopo[voce.chiave]),
      });
    }
  }
  for (const chiave of CHIAVI_NOTE) {
    if (pulisciNota(prima[chiave]) !== pulisciNota(dopo[chiave])) {
      cambiate.push({
        chiave,
        etichetta: ETICHETTE_NOTE[chiave],
        prima: testoNota(prima[chiave]),
        dopo: testoNota(dopo[chiave]),
      });
    }
  }
  return cambiate;
}

export type EsitoValidazioneModifica =
  | {
      ok: true;
      importi: ImportiVoci;
      note: NoteVoci;
      motivo: string;
      differenze: Differenza[];
      totale: number;
    }
  | { ok: false; messaggio: string };

// Controlla ciò che l'admin ha scritto nella finestra, con le stesse regole
// della funzione del DB (PAG-06): motivo obbligatorio, importi numerici con al
// massimo due decimali e non oltre il limite, negativi solo dove ammesso, e
// almeno un valore cambiato rispetto a quelli attuali.
export function validaModificaImporti(
  scritti: Record<ChiaveVoce, string>,
  noteScritte: NoteVoci,
  motivoScritto: string,
  attuali: ImportiVoci & NoteVoci
): EsitoValidazioneModifica {
  const motivo = motivoScritto.trim();
  if (!motivo) return { ok: false, messaggio: 'Scrivi il motivo della modifica.' };
  if ([...motivo].length > MOTIVO_MODIFICA_MAX) {
    return { ok: false, messaggio: `Il motivo può essere lungo al massimo ${MOTIVO_MODIFICA_MAX} caratteri.` };
  }

  const importi = {} as ImportiVoci;
  for (const voce of VOCI_MODIFICABILI) {
    const valore = leggiImportoScritto(scritti[voce.chiave] ?? '');
    if (valore === null) {
      return {
        ok: false,
        messaggio: `${voce.etichetta}: scrivi un importo in euro, con al massimo due decimali (per esempio 12,50).`,
      };
    }
    if (valore < 0 && !voce.negativa) {
      return { ok: false, messaggio: `${voce.etichetta}: l'importo non può essere negativo.` };
    }
    if (Math.abs(valore) > IMPORTO_VOCE_MAX) {
      return { ok: false, messaggio: `${voce.etichetta}: l'importo è troppo grande.` };
    }
    importi[voce.chiave] = valore;
  }

  const note: NoteVoci = {
    note_costi_extra: pulisciNota(noteScritte.note_costi_extra),
    nota_credito_debito: pulisciNota(noteScritte.nota_credito_debito),
  };
  for (const chiave of CHIAVI_NOTE) {
    if ([...(note[chiave] ?? '')].length > NOTA_VOCE_MAX) {
      return { ok: false, messaggio: `${ETICHETTE_NOTE[chiave]}: al massimo ${NOTA_VOCE_MAX} caratteri.` };
    }
  }

  const differenze = differenzeModifica(attuali, { ...importi, ...note });
  if (differenze.length === 0) {
    return { ok: false, messaggio: 'Non hai cambiato nessun valore: niente da salvare.' };
  }
  return { ok: true, importi, note, motivo, differenze, totale: sommaVoci(importi) };
}

// Pre-asilo e post-asilo che passano da 0 a un importo (o viceversa): i giorni
// del mese cambiano copertura (PAG-10). Restituisce le etichette interessate,
// vuoto se l'avviso non serve.
export function serviziConCoperturaCambiata(prima: ImportiVoci, dopo: ImportiVoci): string[] {
  const interessati: string[] = [];
  if (prima.costo_pre_asilo > 0 !== dopo.costo_pre_asilo > 0) interessati.push('Pre-asilo');
  if (prima.costo_post_asilo > 0 !== dopo.costo_post_asilo > 0) interessati.push('Post-asilo');
  return interessati;
}

// Una riga dello storico come arriva dal DB: `modifiche` è un oggetto
// {chiave: {prima, dopo}} con le sole voci cambiate (importi come numeri, note
// come testo o null).
export type ModificaStorico = {
  id: string;
  modificata_il: string;
  modificata_da_nome: string;
  motivo: string;
  totale_prima: number | string;
  totale_dopo: number | string;
  modifiche: Record<string, { prima: number | string | null; dopo: number | string | null }>;
};

// Le voci cambiate di una riga di storico, nell'ordine della tabella, con i
// valori scritti per esteso.
export function vociDelloStorico(modifiche: ModificaStorico['modifiche']): Differenza[] {
  const risultato: Differenza[] = [];
  for (const voce of VOCI_MODIFICABILI) {
    const m = modifiche[voce.chiave];
    if (m) {
      risultato.push({
        chiave: voce.chiave,
        etichetta: voce.etichetta,
        prima: euro(Number(m.prima)),
        dopo: euro(Number(m.dopo)),
      });
    }
  }
  for (const chiave of CHIAVI_NOTE) {
    const m = modifiche[chiave];
    if (m) {
      risultato.push({
        chiave,
        etichetta: ETICHETTE_NOTE[chiave],
        prima: testoNota(m.prima as string | null),
        dopo: testoNota(m.dopo as string | null),
      });
    }
  }
  return risultato;
}
