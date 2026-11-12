#!/usr/bin/env -S node --experimental-strip-types
// Girasole — wrapper I/O per lib/playwright-tempi-riepilogo.ts (issue #419).
//
// Legge il report JSON di Playwright e scrive su stdout il riepilogo Markdown
// dei tempi (per progetto e per file). I job e2e di `.github/workflows/ci.yml`
// ne appendono l'output a `$GITHUB_STEP_SUMMARY`. Informativo e mai bloccante:
// file assente o JSON non valido producono un messaggio ed exit code 0. Non
// legge né stampa variabili d'ambiente.
//
// Uso:
//   node --no-warnings --experimental-strip-types scripts/riepilogo-tempi-e2e.mts [percorso-report.json]
// Percorso predefinito: playwright-json/report.json (vedi playwright.config.ts).

import { readFileSync } from 'node:fs';
import { riepilogoTempiMarkdown } from '../lib/playwright-tempi-riepilogo.ts';

function leggiReport(percorso: string): unknown {
  try {
    return JSON.parse(readFileSync(percorso, 'utf8'));
  } catch {
    return undefined;
  }
}

process.stdout.write(riepilogoTempiMarkdown(leggiReport(process.argv[2] ?? 'playwright-json/report.json')));
