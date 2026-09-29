#!/usr/bin/env -S node --experimental-strip-types
// Girasole — wrapper I/O per lib/claude-usage.ts (issue #119).
// Legge il file di output di claude-code-action e ne scrive il riepilogo di
// token/cache in $GITHUB_STEP_SUMMARY (o su stdout in locale). Espone solo
// contatori numerici: nessun contenuto della conversazione, nessun secret.
// Non fallisce mai: un riepilogo mancante non deve rendere rosso il job.
//
// Uso: node --experimental-strip-types scripts/riepilogo-token-claude.mts <titolo> [file]

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { estraiUsoClaude, formattaRiepilogoUso } from '../lib/claude-usage.ts';

const [titolo = 'Claude', argFile] = process.argv.slice(2);
const file = argFile || '/home/runner/work/_temp/claude-execution-output.json';

let markdown: string;
if (!file || !existsSync(file)) {
  markdown = `### Token Claude — ${titolo}\n\nFile di esecuzione non trovato: nessun dato.\n`;
} else {
  const uso = estraiUsoClaude(readFileSync(file, 'utf8'));
  markdown = uso
    ? formattaRiepilogoUso(titolo, uso)
    : `### Token Claude — ${titolo}\n\nNessun risultato leggibile nel file di esecuzione.\n`;
}

console.log(markdown);
const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) appendFileSync(summary, `${markdown}\n`);
