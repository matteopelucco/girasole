#!/usr/bin/env -S node --experimental-strip-types
// Girasole — wrapper I/O per lib/e2e-salvataggio.ts (issue #171, #77 a).
//
// Legge i file `e2e/*.spec.ts` e segnala ogni click su un bottone di
// salvataggio ("Salva…", "Registra…", "Aggiorna…") non fatto con
// `clickEAttendiAzione` e seguito, nello stesso test, da `reload`/`goto`.
// Esce con codice 1 se ne trova (collegato a `npm run analyze`). Fa lettura
// di file (I/O), per questo NON è testato unitariamente: la logica pura è
// coperta da `lib/e2e-salvataggio.test.ts`. Stesso pattern di
// scripts/classifica-pr.mts (esecuzione nativa di .ts con Node 22+, import
// relativo con estensione `.ts` esplicita).
//
// Uso:
//   node --experimental-strip-types scripts/controlla-click-salva.mts

import { readdirSync, readFileSync } from 'node:fs';
import { trovaClickSalvaNonAttesi } from '../lib/e2e-salvataggio.ts';

const CARTELLA_E2E = 'e2e';

function main(): void {
  const files = readdirSync(CARTELLA_E2E)
    .filter((nome) => nome.endsWith('.spec.ts'))
    .sort();

  let segnalazioni = 0;
  for (const nome of files) {
    const percorso = `${CARTELLA_E2E}/${nome}`;
    for (const { riga, rigaRicaricamento } of trovaClickSalvaNonAttesi(
      readFileSync(percorso, 'utf8')
    )) {
      segnalazioni++;
      console.error(
        `${percorso}:${riga}: click di salvataggio non atteso, seguito da reload/goto (riga ${rigaRicaricamento}): usa clickEAttendiAzione (e2e/helpers.ts)`
      );
    }
  }

  if (segnalazioni > 0) {
    console.error(`\n${segnalazioni} click di salvataggio non attesi (issue #171).`);
    process.exit(1);
  }
  console.log(`Click di salvataggio: ${files.length} file e2e controllati, nessun problema.`);
}

main();
