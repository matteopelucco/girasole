import { arrotonda } from './comunicazioneRetta';

// Logica pura della vista "Pagamenti bambino" (specs/60 -
// pagamenti-bambino.md): anno scolastico, mesi da mostrare e voci che
// compongono l'importo richiesto. Nessun I/O. Gli importi NON sono mai
// ricalcolati: arrivano dalla comunicazione registrata
// (`comunicazioni_retta`, specs/56), cioè sono esattamente quelli della mail.

// Anno minimo raggiungibile navigando all'indietro: serve solo a scartare
// valori assurdi in query string.
export const ANNO_SCOLASTICO_MINIMO = 2000;

// Anno di inizio (settembre) dell'anno scolastico che contiene il mese
// "YYYY-MM": da settembre a dicembre è quello che inizia quel settembre, da
// gennaio ad agosto quello iniziato il settembre precedente.
export function annoScolasticoDelMese(mese: string): number {
  const [anno, m] = mese.split('-').map(Number);
  return m >= 9 ? anno : anno - 1;
}

// Anno scolastico da mostrare (anno di inizio): quello richiesto in query
// string se è un intero di 4 cifre tra ANNO_SCOLASTICO_MINIMO e l'anno di
// riferimento (mai oltre); altrimenti il riferimento.
export function annoScolasticoRichiesto(richiesto: string | undefined, riferimento: number): number {
  if (!richiesto || !/^\d{4}$/.test(richiesto)) return riferimento;
  const anno = Number(richiesto);
  if (anno < ANNO_SCOLASTICO_MINIMO || anno > riferimento) return riferimento;
  return anno;
}

// "2026/2027" per l'anno scolastico che inizia nel 2026.
export function etichettaAnnoScolastico(annoInizio: number): string {
  return `${annoInizio}/${annoInizio + 1}`;
}

// I dieci mesi con retta, da settembre a giugno, come "YYYY-MM".
export function mesiAnnoScolastico(annoInizio: number): string[] {
  const mesi: string[] = [];
  for (let m = 9; m <= 12; m++) mesi.push(`${annoInizio}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 6; m++) mesi.push(`${annoInizio + 1}-${String(m).padStart(2, '0')}`);
  return mesi;
}

// Una comunicazione registrata (colonne numeriche di `comunicazioni_retta`:
// numeric di Postgres, che PostgREST può restituire come numero o stringa).
export type ComunicazioneImporti = {
  retta_mensile: number | string;
  marca_da_bollo: number | string;
  costo_pasti: number | string;
  conguaglio_pasti: number | string;
  costo_pre_asilo: number | string;
  costo_post_asilo: number | string;
  costi_extra: number | string;
  note_costi_extra: string | null;
  credito_debito: number | string;
  nota_credito_debito: string | null;
  totale: number | string;
};

export type VoceImporto = { etichetta: string; importo: number; nota: string | null };

// Intestazioni delle colonne delle voci, nell'ordine della tabella di "Rette"
// (specs/56) — stessa sequenza usata da `vociComunicazione`.
export const ETICHETTE_VOCI = [
  'Retta mensile',
  'Marca da bollo',
  'Pasti',
  'Conguaglio pasti',
  'Pre-asilo',
  'Post-asilo',
  'Costi extra',
  'Credito/Debito',
] as const;

// Le voci che compongono l'importo di una comunicazione, nell'ordine di
// ETICHETTE_VOCI. Le note accompagnano solo costi extra e credito/debito.
export function vociComunicazione(c: ComunicazioneImporti): VoceImporto[] {
  const note: Record<string, string | null> = {
    'Costi extra': c.note_costi_extra,
    'Credito/Debito': c.nota_credito_debito,
  };
  const importi = [
    c.retta_mensile,
    c.marca_da_bollo,
    c.costo_pasti,
    c.conguaglio_pasti,
    c.costo_pre_asilo,
    c.costo_post_asilo,
    c.costi_extra,
    c.credito_debito,
  ];
  return ETICHETTE_VOCI.map((etichetta, i) => ({
    etichetta,
    importo: Number(importi[i]),
    nota: note[etichetta]?.trim() || null,
  }));
}

// Somma dei totali registrati (non delle voci: il totale comunicato è quello
// salvato al momento dell'invio). Arrotondata al centesimo.
export function totaleRichiesto(comunicazioni: Pick<ComunicazioneImporti, 'totale'>[]): number {
  return arrotonda(comunicazioni.reduce((somma, c) => somma + Number(c.totale), 0));
}
