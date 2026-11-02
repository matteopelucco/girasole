// Prezzi predefiniti dell'asilo e importi in euro (specs/62 sezione "Prezzi",
// specs/55 "Costi", issue #396). Logica pura, nessun I/O.
//
// SOLDI: gli importi si leggono dal testo senza mai passare da `Number()` o
// da `parseFloat()`: il testo viene letto con una regola precisa
// (cifre, separatore decimale, al massimo due decimali) e convertito in
// CENTESIMI interi esatti. Ciò che non rispetta la regola è rifiutato: mai
// arrotondato, mai trasformato in 0.

export const MESSAGGIO_IMPORTO_NON_VALIDO = 'Inserisci un importo tra 0 e 9999,99 con al massimo due decimali';

export type RisultatoImporto = { ok: true; centesimi: number; valore: number } | { ok: false; errore: string };

// Da 1 a 4 cifre intere (max 9999), poi, facoltativo, "," o "." seguito da 1 o 2
// cifre. Niente segni, niente migliaia, niente esponenti, niente simboli.
const FORMATO_IMPORTO = /^([0-9]{1,4})(?:[.,]([0-9]{1,2}))?$/;

const NON_VALIDO: RisultatoImporto = { ok: false, errore: MESSAGGIO_IMPORTO_NON_VALIDO };

const MAX_CENTESIMI = 999999;

// Importo obbligatorio (sezione "Prezzi"): il vuoto è rifiutato.
export function parseImporto(testo: string): RisultatoImporto {
  const corrispondenza = FORMATO_IMPORTO.exec(testo.trim());
  if (!corrispondenza) return NON_VALIDO;
  const euro = Number(corrispondenza[1]);
  const decimali = (corrispondenza[2] ?? '').padEnd(2, '0');
  const centesimi = euro * 100 + Number(decimali);
  if (!Number.isInteger(centesimi) || centesimi < 0 || centesimi > MAX_CENTESIMI) return NON_VALIDO;
  return { ok: true, centesimi, valore: centesimi / 100 };
}

// Importo facoltativo (scheda Costi, COS-05): il vuoto vale 0 ("nessun importo
// previsto"); qualunque altra cosa non valida è comunque rifiutata.
export function parseImportoOpzionale(testo: string): RisultatoImporto {
  if (testo.trim() === '') return { ok: true, centesimi: 0, valore: 0 };
  return parseImporto(testo);
}

// Due decimali con la virgola, senza migliaia e senza "€" (es. 160 -> "160,00").
// Si lavora sui centesimi interi, non sul testo di un numero in virgola mobile.
export function formattaImporto(valore: number): string {
  const centesimi = Math.round(valore * 100);
  const euro = Math.trunc(centesimi / 100);
  const resto = String(Math.abs(centesimi % 100)).padStart(2, '0');
  return `${euro},${resto}`;
}

export type TipoSezione = 'materna' | 'primavera';

export const ETICHETTA_TIPO_SEZIONE: Record<TipoSezione, string> = {
  materna: 'Materna',
  primavera: 'Primavera',
};

// Il valore di un campo "Tipo": '' = "Nessuno" (nessun tipo). Qualunque altro
// testo che non sia un tipo noto non è valido.
export function leggiTipoSezione(
  testo: unknown
): { ok: true; tipo: TipoSezione | null } | { ok: false } {
  if (testo === null || testo === undefined || testo === '') return { ok: true, tipo: null };
  if (testo === 'materna' || testo === 'primavera') return { ok: true, tipo: testo };
  return { ok: false };
}

// Retta mensile predefinita secondo il tipo della sezione; null se manca il tipo
// (nessuna retta predefinita: mai 0).
export function rettaPerTipo(
  tipo: TipoSezione | null | undefined,
  prezzi: { rettaMaterna: number; rettaPrimavera: number }
): number | null {
  if (tipo === 'materna') return prezzi.rettaMaterna;
  if (tipo === 'primavera') return prezzi.rettaPrimavera;
  return null;
}

// I campi della sezione "Prezzi" (specs/62): nome della colonna nel database,
// etichetta nel form. Fonte unica per form, azione e lettura.
export const CAMPI_PREZZI = [
  { colonna: 'retta_materna', etichetta: 'Retta Materna (€)' },
  { colonna: 'retta_primavera', etichetta: 'Retta Primavera (€)' },
  { colonna: 'buono_pasto', etichetta: 'Buono pasto (€)' },
  { colonna: 'marca_da_bollo', etichetta: 'Marca da bollo (€)' },
  { colonna: 'abbonamento_pre_asilo', etichetta: 'Abbonamento pre-asilo (€)' },
  { colonna: 'abbonamento_post_asilo', etichetta: 'Abbonamento post-asilo (€)' },
  { colonna: 'gettone_pre_asilo', etichetta: 'Gettone pre-asilo (€)' },
  { colonna: 'gettone_post_asilo', etichetta: 'Gettone post-asilo (€)' },
] as const;

export type ColonnaPrezzo = (typeof CAMPI_PREZZI)[number]['colonna'];

// Prezzi in euro, come nelle colonne del database.
export type Prezzi = Record<ColonnaPrezzo, number>;

export const MESSAGGIO_CONCORRENZA = 'I prezzi sono stati modificati da un altro utente: ricarica la pagina e riprova';
