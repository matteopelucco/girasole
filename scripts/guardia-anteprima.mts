#!/usr/bin/env -S node --experimental-strip-types
// Girasole — wrapper I/O per lib/guardiaAnteprima.ts (issue #267).
//
// Lo lancia il job `guardia` di `.github/workflows/anteprima-fumo.yml` PRIMA
// di qualunque cosa che usi i secret E2E_*. Legge i dati dell'evento
// `deployment_status` dalle variabili d'ambiente (mai interpolati nello
// script del workflow), chiede alla logica pura se può partire e:
//   - se sì, scrive `url=<origine dell'anteprima>` in $GITHUB_OUTPUT;
//   - se no, stampa un `::error::` con il motivo e esce con codice 1.
// Nessun secret passa di qui. La logica è in lib/guardiaAnteprima.ts (unit
// test); questo file fa solo lettura dell'ambiente e scrittura dell'output,
// per questo non ha un test suo (stesso schema di scripts/classifica-pr.mts).
//
// Variabili richieste:
//   REPOSITORY      owner/nome del repo del workflow (github.repository)
//   STATO           deployment_status.state
//   AMBIENTE        deployment.environment
//   URL_ANTEPRIMA   deployment_status.environment_url
//   REPO_TESTA_PR   JSON: array con il repo di partenza di ogni PR del commit
//
// Uso (da un workflow): node --experimental-strip-types scripts/guardia-anteprima.mts

import { appendFileSync } from 'node:fs';
import { valutaDeploymentAnteprima } from '../lib/guardiaAnteprima.ts';

function leggiElencoRepo(testo: string | undefined): string[] {
  if (!testo) return [];
  try {
    const dati: unknown = JSON.parse(testo);
    if (!Array.isArray(dati)) return [];
    return dati.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

function main(): void {
  const esito = valutaDeploymentAnteprima({
    repository: process.env.REPOSITORY ?? '',
    stato: process.env.STATO ?? '',
    ambiente: process.env.AMBIENTE ?? '',
    urlAnteprima: process.env.URL_ANTEPRIMA ?? '',
    repoTestaPr: leggiElencoRepo(process.env.REPO_TESTA_PR),
  });

  if (!esito.ok) {
    console.error(`::error title=Giro di fumo fermato::${esito.motivo}`);
    process.exit(1);
  }

  console.log(`Anteprima accettata: ${esito.url}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `url=${esito.url}\n`);
  }
}

main();
