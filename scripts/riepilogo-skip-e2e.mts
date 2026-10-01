#!/usr/bin/env -S node --experimental-strip-types
// Girasole — wrapper I/O per lib/playwright-skip-riepilogo.ts (issue #176).
//
// Legge il report JSON di Playwright e scrive su stdout il riepilogo
// Markdown dei test saltati (file, titolo, motivo, conteggio per motivo).
// Il job `e2e` di `.github/workflows/ci.yml` ne appende l'output a
// `$GITHUB_STEP_SUMMARY`. Fa I/O (filesystem), per questo NON è testato
// unitariamente: la logica pura lo è, in `lib/playwright-skip-riepilogo.test.ts`.
//
// Informativo e mai bloccante: file assente, vuoto o JSON non valido
// producono un messaggio nel riepilogo e exit code 0. Non legge né stampa
// variabili d'ambiente.
//
// Uso:
//   node --no-warnings --experimental-strip-types scripts/riepilogo-skip-e2e.mts [percorso-report.json]
// Percorso predefinito: playwright-json/report.json (vedi playwright.config.ts).

import { readFileSync } from 'node:fs';
import { riepilogoSaltatiMarkdown } from '../lib/playwright-skip-riepilogo.ts';

const PERCORSO_PREDEFINITO = 'playwright-json/report.json';

function leggiReport(percorso: string): unknown {
  try {
    return JSON.parse(readFileSync(percorso, 'utf8'));
  } catch {
    // Assente, illeggibile o non-JSON: riepilogoSaltatiMarkdown(undefined)
    // lo segnala senza far fallire lo step.
    return undefined;
  }
}

const percorso = process.argv[2] ?? PERCORSO_PREDEFINITO;
process.stdout.write(riepilogoSaltatiMarkdown(leggiReport(percorso)));
