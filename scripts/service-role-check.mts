#!/usr/bin/env -S node --experimental-strip-types
// Girasole — service-role-check (issue #214, sotto-issue d di #38): wrapper
// I/O per lib/serviceRoleCheck.ts.
//
// Legge i sorgenti del repo (ts/tsx/js/jsx/mjs/mts/cjs, fuori da node_modules,
// .next, cartelle nascoste, docs, specs, supabase) e fallisce, con file e riga,
// se `createAdminClient` o `SUPABASE_SERVICE_ROLE_KEY` compaiono fuori dalla
// lista ammessa FILE_AMMESSI (ADR-0002). Nessun DB, nessuna rete, nessun
// secret. Non è testato unitariamente (I/O); la logica pura lo è, in
// lib/serviceRoleCheck.test.ts. Agganciato a `npm run lint` (quindi alla CI
// statica e all'hook pre-push) tramite `npm run check:service-role`.
//
// Uso:
//   node --no-warnings --experimental-strip-types scripts/service-role-check.mts

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  formattaViolazioni,
  guardiaFile,
  trovaUsiNonAmmessi,
  type FileSorgente,
} from '../lib/serviceRoleCheck.ts';

// Escluse solo alla radice (lib/supabase/ va letta); node_modules ovunque.
const ESCLUSE_ALLA_RADICE = new Set(['docs', 'specs', 'supabase', 'test-results', 'playwright-report', 'coverage']);
const ESTENSIONI = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

function* fileSorgenti(dir: string): Generator<string> {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) {
      const esclusa = nome.startsWith('.') || nome === 'node_modules' || (dir === '.' && ESCLUSE_ALLA_RADICE.has(nome));
      if (!esclusa) yield* fileSorgenti(p);
    } else if (ESTENSIONI.test(nome) && !nome.endsWith('.d.ts')) {
      yield p;
    }
  }
}

const files: FileSorgente[] = [];
for (const f of fileSorgenti('.')) {
  files.push({ percorso: f, contenuto: readFileSync(f, 'utf8') });
}

const guardia = guardiaFile(files);
if (guardia) {
  console.error(guardia);
  process.exit(2);
}

const violazioni = trovaUsiNonAmmessi(files);
if (violazioni.length > 0) {
  console.error(formattaViolazioni(violazioni));
  for (const v of violazioni) {
    console.log(`::error file=${v.file},line=${v.riga}::service_role non ammessa qui (${v.tipo}): vedi FILE_AMMESSI in lib/serviceRoleCheck.ts e ADR-0002`);
  }
  process.exit(1);
}
console.log(`Service-role-check: ${files.length} file controllati, nessun uso di service_role fuori dalla lista ammessa.`);
