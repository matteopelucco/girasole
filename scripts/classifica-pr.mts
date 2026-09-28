#!/usr/bin/env -S node --experimental-strip-types
// Girasole — wrapper I/O per lib/pr-classificazione.ts (issue #98).
//
// Riusato da entrambi i workflow (`.github/workflows/ci.yml` e
// `.github/workflows/claude-board.yml`): un'unica logica di
// classificazione, non due copie divergenti. Fa git diff/git show (I/O),
// per questo NON è testato unitariamente — la logica pura che usa
// (`eNonCodiceCI`/`eNonCodiceReview`) lo è, in `lib/pr-classificazione.test.ts`.
//
// Node 22+ esegue nativamente i file .ts con sintassi "erasable" (solo
// tipi/interfacce, niente enum con valori/namespace): nessuna dipendenza
// nuova (niente ts-node/tsx). Lo shebang conta solo se il file viene
// eseguito direttamente (`./scripts/classifica-pr.mts`): i workflow lo
// invocano con `node ...`, dove lo shebang è solo testo, per questo
// passano `--experimental-strip-types` esplicitamente sulla riga di
// comando (di default dalla 22.18 in poi, ma non affidarsi a questo
// silenziosamente). Import relativi con estensione `.ts` esplicita
// (richiesto dalla risoluzione ESM nativa di Node, non da bundler/tsc).
//
// Nel dubbio è codice: se gli SHA mancano o `git diff` fallisce, la PR è
// classificata "codice" (CI completa, review eseguita) e lo step non
// fallisce — un errore di git non deve bloccare il check obbligatorio né
// far saltare controlli (vedi classificaPR in lib/pr-classificazione.ts).
//
// Uso:
//   node --experimental-strip-types scripts/classifica-pr.mts <baseSha> <headSha>
// Con GITHUB_OUTPUT nell'ambiente (workflow GitHub Actions), scrive anche
// lì `is-non-codice-ci` e `is-non-codice-review` (true/false); altrimenti
// stampa solo un riepilogo leggibile su stdout (uso locale/manuale).

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { classificaPR, type FileCambiatoPR } from '../lib/pr-classificazione.ts';

const FILE_VERSIONAMENTO = new Set(['package.json', 'package-lock.json']);

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
}

function contenutoFileACommit(sha: string, percorso: string): string | undefined {
  try {
    return git(['show', `${sha}:${percorso}`]);
  } catch {
    // File assente in quel commit (creato o cancellato dalla PR): non è
    // un bump di versione valido, eSoloBumpDiVersione tratterà
    // contenutoBase/contenutoHead mancante come "codice".
    return undefined;
  }
}

// null se l'elenco non si può ottenere (git diff fallito): classificaPR
// lo tratta come "codice".
function elencaFileCambiati(baseSha: string, headSha: string): FileCambiatoPR[] | null {
  let diff: string;
  try {
    diff = git(['diff', '--name-only', `${baseSha}...${headSha}`]);
  } catch (errore) {
    console.warn(
      `::warning::git diff ${baseSha}...${headSha} fallito, PR classificata come codice (issue #98): ${String(errore)}`
    );
    return null;
  }
  const nomiGrezzi = diff
    .split('\n')
    .map((riga) => riga.trim())
    .filter((riga) => riga.length > 0);

  return nomiGrezzi.map((path) => {
    if (!FILE_VERSIONAMENTO.has(path)) {
      return { path };
    }
    return {
      path,
      contenutoBase: contenutoFileACommit(baseSha, path),
      contenutoHead: contenutoFileACommit(headSha, path),
    };
  });
}

function main(): void {
  const [baseSha, headSha] = process.argv.slice(2);
  let file: FileCambiatoPR[] | null = null;
  if (!baseSha || !headSha) {
    console.warn(
      '::warning::SHA di base/head mancanti, PR classificata come codice (issue #98). Uso: node --experimental-strip-types scripts/classifica-pr.mts <baseSha> <headSha>'
    );
  } else {
    file = elencaFileCambiati(baseSha, headSha);
  }
  const { nonCodiceCI, nonCodiceReview } = classificaPR(file);

  if (file) {
    console.log(`File cambiati (${file.length}):`);
    for (const f of file) {
      console.log(`  - ${f.path}`);
    }
  }
  console.log(`is-non-codice-ci: ${nonCodiceCI}`);
  console.log(`is-non-codice-review: ${nonCodiceReview}`);

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    appendFileSync(githubOutput, `is-non-codice-ci=${nonCodiceCI}\n`);
    appendFileSync(githubOutput, `is-non-codice-review=${nonCodiceReview}\n`);
  }
}

main();
