// Girasole — logica pura: dal report JSON di Playwright al riepilogo dei
// test e2e saltati (issue #176, sotto-issue "a" di #27).
//
// Perché esiste: la CI riportava "N skipped" senza dire quali test né
// perché (il reporter `github` non li elenca). Il reporter `json` di
// Playwright, invece, per ogni test saltato porta l'annotazione
// `{ type: 'skip', description }` generata da `test.skip(cond, 'motivo')`.
// Questo modulo la trasforma in un elenco file/titolo/motivo e in un
// conteggio per motivo, da scrivere nel job summary di GitHub Actions.
//
// Nessun I/O (niente filesystem, niente process.env): la lettura del file
// JSON e la scrittura su stdout vivono in `scripts/riepilogo-skip-e2e.mts`.
// Il report è trattato come `unknown`: un file vuoto, troncato o con una
// forma inattesa (job scaduto, versione diversa di Playwright) non deve mai
// far lanciare eccezioni — lo step di CI è solo informativo.

export interface TestSaltato {
  /** File spec, relativo a `testDir` (es. "19-monte-ore.spec.ts"). */
  file: string;
  /** Titolo completo: describe annidati separati da " > ", poi il test. */
  titolo: string;
  /** Motivo dell'annotazione skip/fixme, o uno dei due motivi di ripiego. */
  motivo: string;
  /** Nome del progetto Playwright (es. "chromium"), se presente. */
  progetto: string;
}

export interface ConteggioMotivo {
  motivo: string;
  conteggio: number;
}

/** `test.skip()` senza descrizione. */
export const MOTIVO_NON_INDICATO = 'motivo non indicato (test.skip senza descrizione)';
/**
 * Test "skipped" senza alcuna annotazione: non è uno skip dichiarato nel
 * codice, ma un test non eseguito (dipendenza `setup` fallita, `maxFailures`
 * raggiunto, run interrotta).
 */
export const MOTIVO_NON_ESEGUITO = 'non eseguito (nessuna annotazione: setup fallito o maxFailures)';

const TIPI_ANNOTAZIONE_SALTO = new Set(['skip', 'fixme']);
const FILE_NON_INDICATO = '(file sconosciuto)';
const TITOLO_NON_INDICATO = '(senza titolo)';

type Oggetto = Record<string, unknown>;

function eOggetto(valore: unknown): valore is Oggetto {
  return typeof valore === 'object' && valore !== null && !Array.isArray(valore);
}

function lista(valore: unknown): unknown[] {
  return Array.isArray(valore) ? valore : [];
}

function testo(valore: unknown): string | undefined {
  return typeof valore === 'string' && valore.trim().length > 0 ? valore.trim() : undefined;
}

/** Le suite di primo livello sono i file: il loro titolo non entra nel titolo del test. */
function eTitoloDiFile(titolo: string, file: string | undefined): boolean {
  return titolo === file || /\.[cm]?[jt]sx?$/.test(titolo);
}

function statoDelTest(t: Oggetto): string | undefined {
  const diretto = testo(t.status);
  if (diretto) return diretto;
  const risultati = lista(t.results);
  const ultimo = risultati[risultati.length - 1];
  return eOggetto(ultimo) ? testo(ultimo.status) : undefined;
}

function motivoDelSalto(t: Oggetto): string {
  let hoAnnotazione = false;
  for (const a of lista(t.annotations)) {
    if (!eOggetto(a) || typeof a.type !== 'string' || !TIPI_ANNOTAZIONE_SALTO.has(a.type)) continue;
    hoAnnotazione = true;
    const descrizione = testo(a.description);
    if (descrizione) return descrizione;
  }
  return hoAnnotazione ? MOTIVO_NON_INDICATO : MOTIVO_NON_ESEGUITO;
}

function raccogli(suite: unknown, percorso: string[], fuori: TestSaltato[]): void {
  if (!eOggetto(suite)) return;
  const fileSuite = testo(suite.file);
  const titoloSuite = testo(suite.title);
  const percorsoSuite =
    titoloSuite && !eTitoloDiFile(titoloSuite, fileSuite) ? [...percorso, titoloSuite] : percorso;

  for (const spec of lista(suite.specs)) {
    if (!eOggetto(spec)) continue;
    const titoloSpec = testo(spec.title) ?? TITOLO_NON_INDICATO;
    const file = testo(spec.file) ?? fileSuite ?? FILE_NON_INDICATO;
    for (const t of lista(spec.tests)) {
      if (!eOggetto(t) || statoDelTest(t) !== 'skipped') continue;
      fuori.push({
        file,
        titolo: [...percorsoSuite, titoloSpec].join(' > '),
        motivo: motivoDelSalto(t),
        progetto: testo(t.projectName) ?? '',
      });
    }
  }
  for (const figlia of lista(suite.suites)) {
    raccogli(figlia, percorsoSuite, fuori);
  }
}

/** Tutti i test saltati del report, in ordine di apparizione. Mai eccezioni. */
export function estraiTestSaltati(report: unknown): TestSaltato[] {
  const saltati: TestSaltato[] = [];
  if (!eOggetto(report)) return saltati;
  for (const suite of lista(report.suites)) {
    raccogli(suite, [], saltati);
  }
  return saltati;
}

/** Conteggio per motivo, dal più frequente; a parità in ordine alfabetico. */
export function conteggioPerMotivo(saltati: TestSaltato[]): ConteggioMotivo[] {
  const mappa = new Map<string, number>();
  for (const s of saltati) {
    mappa.set(s.motivo, (mappa.get(s.motivo) ?? 0) + 1);
  }
  return [...mappa.entries()]
    .map(([motivo, conteggio]) => ({ motivo, conteggio }))
    .sort((a, b) => b.conteggio - a.conteggio || a.motivo.localeCompare(b.motivo));
}

function cella(valore: string): string {
  return valore.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

/** `true` se la forma è quella di un report Playwright (oggetto con `suites` array). */
function eReportValido(report: unknown): boolean {
  return eOggetto(report) && Array.isArray(report.suites);
}

/**
 * Riepilogo Markdown per `$GITHUB_STEP_SUMMARY`. Con un report assente o
 * illeggibile restituisce comunque un messaggio (mai eccezioni).
 */
export function riepilogoSaltatiMarkdown(report: unknown): string {
  const titolo = '## Test e2e saltati';
  if (!eReportValido(report)) {
    return `${titolo}\n\nReport JSON di Playwright non disponibile o non leggibile: nessun riepilogo (la e2e potrebbe essere stata interrotta prima di scriverlo).\n`;
  }
  const saltati = estraiTestSaltati(report);
  if (saltati.length === 0) {
    return `${titolo}\n\nNessun test saltato.\n`;
  }

  const righe: string[] = [titolo, '', `Totale: **${saltati.length}** test saltati.`, ''];
  righe.push('### Per motivo', '', '| Motivo | Test |', '| --- | ---: |');
  for (const { motivo, conteggio } of conteggioPerMotivo(saltati)) {
    righe.push(`| ${cella(motivo)} | ${conteggio} |`);
  }
  righe.push('', '### Dettaglio', '', '| File | Test | Motivo |', '| --- | --- | --- |');
  for (const s of saltati) {
    righe.push(`| ${cella(s.file)} | ${cella(s.titolo)} | ${cella(s.motivo)} |`);
  }
  return `${righe.join('\n')}\n`;
}
