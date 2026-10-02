#!/usr/bin/env -S node --experimental-strip-types
// Girasole — wrapper I/O per lib/rilascio.ts (issue #32, A31).
//
// Chiamato da `.github/workflows/release.yml` a ogni push su main: decide se
// la versione di package.json è cambiata rispetto al commit precedente e, se
// sì, prepara nome del tag e note di rilascio (dai commit convenzionali).
// NON crea il tag né la release: lo fa il workflow con `gh release create`.
// Legge git (I/O), per questo non è testato unitariamente: la logica pura
// (`decidiTag`, `generaNoteRilascio`) lo è, in `lib/rilascio.test.ts`.
//
// Stesso schema di scripts/classifica-pr.mts: Node 22+ esegue il .mts con
// `--experimental-strip-types`, nessuna dipendenza nuova; import relativi con
// estensione `.ts` esplicita.
//
// Uso:
//   node --experimental-strip-types scripts/rilascio.mts <beforeSha> <sha> <fileNote> [--forza]
// Con GITHUB_OUTPUT nell'ambiente scrive `tag=<vX.Y.Z>` (vuoto = nessun
// rilascio da fare). Le note vanno in <fileNote>. Nessun input è
// interpolato in una shell: gli argomenti passano a `execFileSync`.
//
// Intervallo dei commit nelle note: dall'ultimo tag `v*` antenato di <sha>
// (così un merge senza bump di versione non "perde" le sue modifiche, che
// finiscono nella release successiva); se non esiste nessun tag (primo
// rilascio) da <beforeSha> a <sha>, cioè solo i commit di questo push.

import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { decidiTag, generaNoteRilascio, leggiVersione } from '../lib/rilascio.ts';

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
}

function packageJsonA(sha: string): string | undefined {
  if (/^0+$/.test(sha)) {
    return undefined;
  }
  try {
    return git(['show', `${sha}:package.json`]);
  } catch {
    return undefined;
  }
}

function eAntenato(tag: string, sha: string): boolean {
  try {
    git(['merge-base', '--is-ancestor', tag, sha]);
    return true;
  } catch {
    return false;
  }
}

function ultimoTagPrecedente(tagNuovo: string, sha: string): string | null {
  const tag = git(['tag', '--list', 'v*', '--sort=-v:refname'])
    .split('\n')
    .map((t) => t.trim())
    .filter((t) => t !== '' && t !== tagNuovo);
  return tag.find((t) => eAntenato(t, sha)) ?? null;
}

function oggettiCommit(intervallo: string): string[] {
  try {
    return git(['log', '--no-merges', '--format=%s', intervallo])
      .split('\n')
      .filter((r) => r.trim() !== '');
  } catch (errore) {
    console.warn(`::warning::git log ${intervallo} fallito, note vuote (issue #32): ${String(errore)}`);
    return [];
  }
}

function main(): void {
  const argomenti = process.argv.slice(2);
  const forza = argomenti.includes('--forza');
  const [beforeSha, sha, fileNote] = argomenti.filter((a) => !a.startsWith('--'));
  if (!beforeSha || !sha || !fileNote) {
    console.error(
      'Uso: node --experimental-strip-types scripts/rilascio.mts <beforeSha> <sha> <fileNote> [--forza]'
    );
    process.exit(1);
  }

  const versionePrima = leggiVersione(packageJsonA(beforeSha));
  const versioneDopo = leggiVersione(packageJsonA(sha));
  const tag = decidiTag(versionePrima, versioneDopo, forza);
  console.log(`versione prima: ${versionePrima ?? '(illeggibile)'}`);
  console.log(`versione dopo: ${versioneDopo ?? '(illeggibile)'}`);
  console.log(`tag: ${tag ?? '(nessun rilascio)'}`);

  if (tag !== null) {
    const precedente = ultimoTagPrecedente(tag, sha);
    const intervallo = precedente ? `${precedente}..${sha}` : `${beforeSha}..${sha}`;
    console.log(`commit nelle note: ${intervallo}`);
    // Con before tutto-zeri (nessun commit precedente) l'intervallo non è
    // valido: git log fallisce e le note restano vuote, il tag si crea lo stesso.
    writeFileSync(fileNote, generaNoteRilascio(oggettiCommit(intervallo)), 'utf8');
  }

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    appendFileSync(githubOutput, `tag=${tag ?? ''}\n`);
  }
}

main();
