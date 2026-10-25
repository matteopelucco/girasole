#!/usr/bin/env -S node --experimental-strip-types
// Girasole — wrapper I/O per lib/controlloUi.ts (issue #351, ADR 0011).
//
// Legge i sorgenti di app/, components/ e lib/ e fallisce, con file e riga, se
// fuori da components/ui/ compaiono le classi tipiche di un pulsante o di un
// campo scritte a mano (salvo le voci di ECCEZIONI in lib/controlloUi.ts, che
// devono restare motivate e necessarie). Nessun DB, rete o secret. Non è
// testato unitariamente (I/O): la logica pura lo è, in lib/controlloUi.test.ts.
// Collegato a `npm run analyze` e al hook pre-push tramite `npm run check:ui`.
//
// Uso:
//   node --experimental-strip-types scripts/controlla-ui.mts

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { controllaUi, formattaEsito, type FileSorgente } from '../lib/controlloUi.ts';

const CARTELLE = ['app', 'components', 'lib'];
const ESTENSIONI = /\.(ts|tsx)$/;

function* fileSorgenti(dir: string): Generator<string> {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) {
      if (!nome.startsWith('.') && nome !== 'node_modules') yield* fileSorgenti(p);
    } else if (ESTENSIONI.test(nome) && !nome.endsWith('.d.ts')) {
      yield p;
    }
  }
}

const files: FileSorgente[] = [];
for (const cartella of CARTELLE) {
  for (const f of fileSorgenti(cartella)) {
    files.push({ percorso: f, contenuto: readFileSync(f, 'utf8') });
  }
}

if (!files.some((f) => f.percorso.replace(/\\/g, '/').startsWith('components/ui/'))) {
  console.error('components/ui/ non è tra i file letti: cartelle scansionate non corrispondenti, controllo non affidabile.');
  process.exit(2);
}

const esito = controllaUi(files);
if (esito.violazioni.length > 0 || esito.eccezioniObsolete.length > 0) {
  console.error(formattaEsito(esito));
  process.exit(1);
}
console.log(`Controllo UI: ${files.length} file controllati, nessun pulsante o campo copiato fuori da components/ui/.`);
