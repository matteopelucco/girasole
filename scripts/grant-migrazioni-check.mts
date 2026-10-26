#!/usr/bin/env -S node --experimental-strip-types
// Girasole — grant-migrazioni-check (issue #359): wrapper I/O per
// lib/grantMigrazioni.ts.
//
// Legge i file di supabase/migrations/ e i sorgenti (app/, lib/, components/)
// e fallisce se:
//   1. una tabella di `public` non ha alcun GRANT esplicito nelle migration
//      (salvo quelle ammesse in TABELLE_SENZA_GRANT_AMMESSE);
//   2. il codice usa una tabella con un ruolo/privilegio che nelle migration
//      non è concesso esplicitamente (stessa estrazione del grant-check).
// Nessun DB, nessuna rete, nessun secret: a differenza di scripts/grant-check.mts
// (che legge il DB di test, dove i privilegi di default di Supabase possono
// nascondere un GRANT mancante) qui conta solo ciò che è scritto nelle
// migration. Non è testato unitariamente (I/O); la logica pura lo è, in
// lib/grantMigrazioni.test.ts. Agganciato a `npm run lint` (quindi alla CI
// statica e all'hook pre-push) tramite `npm run check:grant-migrazioni`.
//
// Uso:
//   node --no-warnings --experimental-strip-types scripts/grant-migrazioni-check.mts

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { estraiRichieste, guardiaRichieste, verificaGrant, type Richiesta } from '../lib/grantCheck.ts';
import {
  analizzaMigrazioni,
  formattaGrantMancanti,
  formattaTabelleSenzaGrant,
  guardiaAnalisi,
  tabelleSenzaGrant,
} from '../lib/grantMigrazioni.ts';

const CARTELLE = ['app', 'lib', 'components'];

function* fileSorgenti(dir: string): Generator<string> {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) {
      if (nome !== 'node_modules' && nome !== '.next') yield* fileSorgenti(p);
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.(test|spec)\.tsx?$/.test(nome)) {
      yield p;
    }
  }
}

const migrazioni = readdirSync('supabase/migrations')
  .filter((n) => n.endsWith('.sql'))
  .map((nome) => ({ nome, contenuto: readFileSync(join('supabase/migrations', nome), 'utf8') }));
const analisi = analizzaMigrazioni(migrazioni);
const guardiaMigrazioni = guardiaAnalisi(analisi);
if (guardiaMigrazioni) {
  console.error(guardiaMigrazioni);
  process.exit(2);
}

const richieste: Richiesta[] = [];
for (const dir of CARTELLE) {
  for (const f of fileSorgenti(dir)) {
    richieste.push(...estraiRichieste(f.replace(/\\/g, '/'), readFileSync(f, 'utf8')));
  }
}
const guardiaCodice = guardiaRichieste(richieste);
if (guardiaCodice) {
  console.error(guardiaCodice);
  process.exit(2);
}

let errori = 0;

const senzaGrant = tabelleSenzaGrant(analisi);
if (senzaGrant.length > 0) {
  console.error(formattaTabelleSenzaGrant(senzaGrant));
  for (const t of senzaGrant) console.log(`::error::Nessun GRANT esplicito nelle migration per public.${t}`);
  errori++;
}

const mancanti = verificaGrant(richieste, analisi.grant);
if (mancanti.length > 0) {
  console.error(
    formattaGrantMancanti(
      mancanti.map((v) => `GRANT non esplicito nelle migration: ${v.privilegio} su public.${v.tabella} per ${v.ruolo} (usata in ${v.file})`),
    ),
  );
  for (const v of mancanti) {
    console.log(`::error file=${v.file}::GRANT non esplicito nelle migration: ${v.privilegio} su public.${v.tabella} per ${v.ruolo}`);
  }
  errori++;
}

if (errori > 0) process.exit(1);
console.log(
  `Grant-migrazioni-check: ${analisi.tabelle.length} tabelle, ${analisi.grant.length} grant espliciti, ${richieste.length} richieste del codice: tutto coperto.`,
);
