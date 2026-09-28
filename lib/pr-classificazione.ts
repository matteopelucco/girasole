// Girasole — logica pura di classificazione "non codice" di una PR.
//
// Perché esiste (issue #98): saltare gli step pesanti della CI (build,
// reset del DB di test, e2e) e la review Claude su PR che toccano solo
// documentazione/spec/bump di versione, senza intaccare la sicurezza del
// resto (RLS, codice applicativo). Nessun I/O qui dentro (niente git,
// niente filesystem): la parte che legge i file cambiati e il contenuto
// di package.json/package-lock.json a due commit diversi vive nel
// wrapper `scripts/classifica-pr.ts`, non testato unitariamente (vedi
// CLAUDE.md, "Unit (Vitest) — solo logica pura").
//
// Due criteri distinti, non uno solo (vedi PR per la motivazione):
//   - `eNonCodiceCI`: allow-list più ampia, include `specs/**` — usata per
//     decidere se saltare gli step pesanti della CI (build/reset DB/e2e).
//     Uno scenario e2e nuovo in una PR "solo specs" verrebbe comunque
//     rilevato a mano più avanti (nessun codice cambiato da verificare
//     con la build o l'e2e, che infatti non cambierebbero risultato).
//   - `eNonCodiceReview`: allow-list più stretta, ESCLUDE `specs/**` — usata
//     per decidere se saltare la review Claude. Garantisce che ogni
//     modifica a `specs/` (compreso un nuovo `## Scenario:`) riceva
//     sempre una review, che è il meccanismo che verifica la coerenza
//     "specs ↔ e2e non divergono" (vedi CLAUDE.md).

export interface FileCambiatoPR {
  /** Percorso del file nel repo, relativo alla root (es. "docs/foo.md"). */
  path: string;
  /**
   * Contenuto testuale del file lato base (prima della PR), solo per
   * package.json/package-lock.json: serve a verificare che l'unica
   * differenza sia il campo "version". Per tutti gli altri file non è
   * necessario (ignorato se presente).
   */
  contenutoBase?: string;
  /** Come `contenutoBase`, ma lato head (con la PR applicata). */
  contenutoHead?: string;
}

const PREFISSO_DOCS = 'docs/';
const PREFISSO_SPECS = 'specs/';
const FILE_NON_CODICE_ESATTI = new Set(['TASKS.md', 'README.md', 'CHANGELOG.md']);
const FILE_VERSIONAMENTO = new Set(['package.json', 'package-lock.json']);

function normalizzaPercorso(percorso: string): string {
  return percorso.replace(/\\/g, '/').replace(/^\.\//, '');
}

type OggettoJson = Record<string, unknown>;

function eOggetto(valore: unknown): valore is OggettoJson {
  return typeof valore === 'object' && valore !== null && !Array.isArray(valore);
}

/**
 * Toglie i campi "version" che cambiano ad ogni bump (root, e per
 * package-lock.json anche `packages[""].version`) da una copia
 * dell'oggetto, per poterlo confrontare ignorando solo quel campo.
 */
function stripCampiVersione(oggetto: OggettoJson): OggettoJson {
  const clone: OggettoJson = { ...oggetto };
  delete clone.version;
  if (eOggetto(clone.packages)) {
    const packagesClone: OggettoJson = { ...clone.packages };
    const radice = packagesClone[''];
    if (eOggetto(radice)) {
      packagesClone[''] = stripCampiVersione(radice);
    }
    clone.packages = packagesClone;
  }
  return clone;
}

/**
 * true solo se le due stringhe sono JSON validi e l'unica differenza
 * strutturale è il campo "version" (root, e per package-lock.json anche
 * `packages[""].version`). Nel dubbio (JSON non parsabile, contenuti
 * mancanti) restituisce false: si preferisce trattare il file come
 * "codice" piuttosto che sbagliare per eccesso di fiducia.
 */
export function eSoloBumpDiVersione(
  contenutoBase: string | undefined,
  contenutoHead: string | undefined
): boolean {
  if (contenutoBase === undefined || contenutoHead === undefined) {
    return false;
  }
  try {
    const base: unknown = JSON.parse(contenutoBase);
    const head: unknown = JSON.parse(contenutoHead);
    if (!eOggetto(base) || !eOggetto(head)) {
      return false;
    }
    return JSON.stringify(stripCampiVersione(base)) === JSON.stringify(stripCampiVersione(head));
  } catch {
    return false;
  }
}

function eNonCodice(file: FileCambiatoPR, includiSpecs: boolean): boolean {
  const percorso = normalizzaPercorso(file.path);
  if (percorso.startsWith(PREFISSO_DOCS)) {
    return true;
  }
  if (includiSpecs && percorso.startsWith(PREFISSO_SPECS)) {
    return true;
  }
  if (FILE_NON_CODICE_ESATTI.has(percorso)) {
    return true;
  }
  if (FILE_VERSIONAMENTO.has(percorso)) {
    return eSoloBumpDiVersione(file.contenutoBase, file.contenutoHead);
  }
  return false;
}

/**
 * true se TUTTI i file cambiati rientrano nell'allow-list "non codice"
 * ai fini della CI (build/reset DB/e2e possono essere saltati): include
 * `specs/**`. Una lista vuota è trattata come "codice" (false): nel
 * dubbio, meglio eseguire la suite completa che saltarla per errore.
 */
export function eNonCodiceCI(file: FileCambiatoPR[]): boolean {
  return file.length > 0 && file.every((f) => eNonCodice(f, true));
}

/**
 * Come `eNonCodiceCI`, ma ai fini della review Claude: allow-list più
 * stretta, ESCLUDE `specs/**` (ogni modifica alle spec riceve sempre una
 * review, vedi commento in testa al file).
 */
export function eNonCodiceReview(file: FileCambiatoPR[]): boolean {
  return file.length > 0 && file.every((f) => eNonCodice(f, false));
}
