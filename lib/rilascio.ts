// Girasole — logica pura per i rilasci automatici (issue #32, A31).
//
// Un merge su main che cambia la `version` di package.json produce un tag
// `vX.Y.Z` e una GitHub Release, le cui note sono generate dai messaggi di
// commit convenzionali. Nessun I/O qui dentro (niente git, niente fs): la
// parte che legge git e scrive i file vive in `scripts/rilascio.mts`, non
// testato unitariamente (vedi CLAUDE.md, "Unit (Vitest) — solo logica pura").

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * Versione semver letta dal testo di un package.json, oppure `null` se il
 * contenuto manca, non è JSON, non ha un campo `version` stringa o non è
 * semver. Mai eccezioni: nel dubbio non si rilascia.
 */
export function leggiVersione(contenutoPackageJson: string | undefined): string | null {
  if (contenutoPackageJson === undefined) {
    return null;
  }
  try {
    const json: unknown = JSON.parse(contenutoPackageJson);
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      return null;
    }
    const versione = (json as Record<string, unknown>).version;
    return typeof versione === 'string' && SEMVER.test(versione) ? versione : null;
  } catch {
    return null;
  }
}

/**
 * Nome del tag da creare (`v<versione>`), oppure `null` se non va creato
 * nulla. Si tagga quando la versione corrente è valida e (è diversa dalla
 * precedente oppure `forza`). Con versione precedente illeggibile si
 * rilascia comunque: il workflow è idempotente (se il tag/release esiste
 * già, non fa nulla), quindi il caso peggiore è un no-op, mentre non
 * rilasciare lascerebbe un buco silenzioso.
 */
export function decidiTag(
  versionePrecedente: string | null,
  versioneCorrente: string | null,
  forza: boolean
): string | null {
  if (versioneCorrente === null) {
    return null;
  }
  if (forza || versionePrecedente !== versioneCorrente) {
    return `v${versioneCorrente}`;
  }
  return null;
}

export interface CommitConvenzionale {
  tipo: string;
  ambito: string | null;
  breaking: boolean;
  descrizione: string;
}

const TIPI_NOTI = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore'];
const RE_COMMIT = /^([A-Za-z]+)(?:\(([^)]*)\))?(!)?:\s+(\S.*)$/;

/**
 * Interpreta la riga d'oggetto di un commit nel formato Conventional
 * Commits (`tipo(ambito)!: descrizione`). `null` se non è conforme o il tipo
 * non è tra quelli del progetto (vedi docs/sviluppo-dettagli.md, Workflow).
 * Il suffisso `(#123)` dei squash-merge resta nella descrizione: GitHub lo
 * trasforma in link alla PR nelle note.
 */
export function parseCommitConvenzionale(subject: string): CommitConvenzionale | null {
  const m = RE_COMMIT.exec(subject.trim());
  if (!m) {
    return null;
  }
  const tipo = m[1].toLowerCase();
  if (!TIPI_NOTI.includes(tipo)) {
    return null;
  }
  const ambito = m[2] && m[2].trim() !== '' ? m[2].trim() : null;
  return { tipo, ambito, breaking: m[3] === '!', descrizione: m[4].trim() };
}

const TITOLI_SEZIONE: Array<[string, string]> = [
  ['feat', 'Nuove funzionalità'],
  ['fix', 'Correzioni'],
  ['perf', 'Prestazioni'],
  ['refactor', 'Refactoring'],
  ['docs', 'Documentazione'],
  ['test', 'Test'],
  ['build', 'Build'],
  ['ci', 'CI'],
  ['chore', 'Manutenzione'],
];
const TITOLO_BREAKING = 'Breaking changes';
const TITOLO_ALTRO = 'Altro';

function riga(c: CommitConvenzionale): string {
  return c.ambito ? `- **${c.ambito}**: ${c.descrizione}` : `- ${c.descrizione}`;
}

/**
 * Note di rilascio in Markdown, raggruppate per tipo di commit in ordine
 * fisso (breaking change in cima, poi feat, fix, ...; i messaggi non
 * convenzionali in coda sotto "Altro", tali e quali). Righe vuote e commit
 * di merge ("Merge ...") sono ignorati.
 */
export function generaNoteRilascio(subjects: string[]): string {
  const breaking: string[] = [];
  const perTipo = new Map<string, string[]>();
  const altro: string[] = [];

  for (const grezzo of subjects) {
    const subject = grezzo.trim();
    if (subject === '' || /^Merge /.test(subject)) {
      continue;
    }
    const c = parseCommitConvenzionale(subject);
    if (c === null) {
      altro.push(`- ${subject}`);
    } else if (c.breaking) {
      breaking.push(riga(c));
    } else {
      perTipo.set(c.tipo, [...(perTipo.get(c.tipo) ?? []), riga(c)]);
    }
  }

  const sezioni: string[] = [];
  const aggiungi = (titolo: string, righe: string[]): void => {
    if (righe.length > 0) {
      sezioni.push(`### ${titolo}\n${righe.join('\n')}\n`);
    }
  };
  aggiungi(TITOLO_BREAKING, breaking);
  for (const [tipo, titolo] of TITOLI_SEZIONE) {
    aggiungi(titolo, perTipo.get(tipo) ?? []);
  }
  aggiungi(TITOLO_ALTRO, altro);

  return sezioni.length > 0 ? sezioni.join('\n') : 'Nessuna modifica rilevante.\n';
}
