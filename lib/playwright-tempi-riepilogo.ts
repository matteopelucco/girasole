// Girasole — logica pura: dal report JSON di Playwright ai tempi della suite
// e2e, per progetto e per file (issue #419).
//
// Perché esiste: per capire dove va il tempo della CI serve la durata di ogni
// file, che il reporter `github` non mostra. Il tempo sommato di un progetto a
// un solo processo (es. `chromium-rette`) è anche la durata reale di quella
// catena; per un progetto in parallelo è il lavoro totale, non l'attesa.
//
// Nessun I/O: la lettura del file e la scrittura su stdout vivono in
// `scripts/riepilogo-tempi-e2e.mts`. Il report è trattato come `unknown`: lo
// step di CI è solo informativo e non deve mai far lanciare eccezioni.

export interface TempoProgetto {
  nome: string;
  test: number;
  durataMs: number;
}

export interface TempoFile extends TempoProgetto {
  progetto: string;
}

export interface TempiSuite {
  /** Durata reale del giro (`stats.duration`), se presente nel report. */
  durataTotaleMs: number | null;
  progetti: TempoProgetto[];
  file: TempoFile[];
}

const MASSIMO_FILE = 15;
const PROGETTO_NON_INDICATO = '(senza progetto)';
const FILE_NON_INDICATO = '(file sconosciuto)';

type Oggetto = Record<string, unknown>;

function eOggetto(valore: unknown): valore is Oggetto {
  return typeof valore === 'object' && valore !== null && !Array.isArray(valore);
}

function lista(valore: unknown): unknown[] {
  return Array.isArray(valore) ? valore : [];
}

function testo(valore: unknown, ripiego: string): string {
  return typeof valore === 'string' && valore.length > 0 ? valore : ripiego;
}

function numero(valore: unknown): number {
  return typeof valore === 'number' && Number.isFinite(valore) ? valore : 0;
}

function perDurataDecrescente<T extends { durataMs: number }>(a: T, b: T): number {
  return b.durataMs - a.durataMs;
}

export function calcolaTempi(report: unknown): TempiSuite | null {
  if (!eOggetto(report) || !Array.isArray(report.suites)) return null;

  const progetti = new Map<string, TempoProgetto>();
  const file = new Map<string, TempoFile>();

  const aggiungi = (nomeFile: string, nomeProgetto: string, durataMs: number) => {
    const progetto = progetti.get(nomeProgetto) ?? { nome: nomeProgetto, test: 0, durataMs: 0 };
    progetto.test += 1;
    progetto.durataMs += durataMs;
    progetti.set(nomeProgetto, progetto);

    const chiave = `${nomeProgetto}\n${nomeFile}`;
    const voce = file.get(chiave) ?? { nome: nomeFile, progetto: nomeProgetto, test: 0, durataMs: 0 };
    voce.test += 1;
    voce.durataMs += durataMs;
    file.set(chiave, voce);
  };

  const visita = (suite: unknown, fileSuite: string) => {
    if (!eOggetto(suite)) return;
    const nomeFile = testo(suite.file, fileSuite);
    for (const spec of lista(suite.specs)) {
      if (!eOggetto(spec)) continue;
      for (const test of lista(spec.tests)) {
        if (!eOggetto(test)) continue;
        // Tutti i tentativi: anche un retry occupa tempo della CI.
        const durataMs = lista(test.results).reduce<number>(
          (somma, risultato) => somma + (eOggetto(risultato) ? numero(risultato.duration) : 0),
          0,
        );
        aggiungi(testo(spec.file, nomeFile), testo(test.projectName, PROGETTO_NON_INDICATO), durataMs);
      }
    }
    for (const figlia of lista(suite.suites)) visita(figlia, nomeFile);
  };

  for (const suite of report.suites) visita(suite, FILE_NON_INDICATO);
  if (progetti.size === 0) return null;

  const stats = eOggetto(report.stats) ? report.stats : {};
  return {
    durataTotaleMs: typeof stats.duration === 'number' ? stats.duration : null,
    progetti: [...progetti.values()].sort(perDurataDecrescente),
    file: [...file.values()].sort(perDurataDecrescente),
  };
}

function minuti(durataMs: number): string {
  return `${(durataMs / 60_000).toFixed(1).replace('.', ',')} min`;
}

export function riepilogoTempiMarkdown(report: unknown): string {
  const tempi = calcolaTempi(report);
  if (!tempi) return '### Tempi dei test e2e\n\nTempi non disponibili: report di Playwright assente o non leggibile.\n';

  const righe = ['### Tempi dei test e2e', ''];
  if (tempi.durataTotaleMs !== null) righe.push(`Durata totale: ${minuti(tempi.durataTotaleMs)}`, '');
  righe.push('| Progetto | Test | Tempo sommato |', '| --- | --- | --- |');
  for (const p of tempi.progetti) righe.push(`| ${p.nome} | ${p.test} | ${minuti(p.durataMs)} |`);
  righe.push('', `File più lenti (al massimo ${MASSIMO_FILE}):`, '');
  righe.push('| File | Progetto | Test | Tempo sommato |', '| --- | --- | --- | --- |');
  for (const f of tempi.file.slice(0, MASSIMO_FILE)) {
    righe.push(`| ${f.nome} | ${f.progetto} | ${f.test} | ${minuti(f.durataMs)} |`);
  }
  return `${righe.join('\n')}\n`;
}
