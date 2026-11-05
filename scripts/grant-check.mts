#!/usr/bin/env -S node --experimental-strip-types
// Girasole — grant-check (A26, issue #28): wrapper I/O per lib/grantCheck.ts.
//
// Legge i sorgenti (app/, lib/, components/), interroga
// information_schema.role_table_grants e column_privileges del DB di TEST, remoto o
// locale (scripts/query-db-test.mts, sola lettura) e fallisce, con il nome della tabella, se manca un GRANT
// richiesto da `authenticated` o `service_role`. Non è testato
// unitariamente (I/O); la logica pura lo è, in lib/grantCheck.test.ts.
//
// Sicurezza: nessuna scrittura sul DB, una sola SELECT su information_schema;
// come si raggiunge il DB di test è spiegato in scripts/query-db-test.mts.
//
// Uso (CI, dopo il reset del DB di test):
//   node --experimental-strip-types scripts/grant-check.mts

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  estraiRichieste,
  formattaViolazioni,
  guardiaRichieste,
  verificaGrant,
  type GrantDb,
  type Richiesta,
} from '../lib/grantCheck.ts';
import { eseguiQueryDbTest } from './query-db-test.mts';

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

const richieste: Richiesta[] = [];
for (const dir of CARTELLE) {
  for (const f of fileSorgenti(dir)) {
    richieste.push(...estraiRichieste(f, readFileSync(f, 'utf8')));
  }
}

const guardia = guardiaRichieste(richieste);
if (guardia) {
  console.error(guardia);
  process.exit(2);
}

// Privilegi di tabella (role_table_grants) più quelli concessi solo su alcune
// colonne (column_privileges): `grant update (colonna) on tabella` — es. la
// migration 0065 su impostazioni_calendario — non compare in role_table_grants,
// ma permette all'app di fare UPDATE di quelle colonne. Un privilegio di
// colonna conta come privilegio sulla tabella: il controllo resta
// "anti permission-denied", non verifica quali colonne (vedi lib/grantCheck.ts).
const query = `select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('authenticated', 'service_role')
union
select grantee, table_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and grantee in ('authenticated', 'service_role')`;

const righe = (await eseguiQueryDbTest(query, 'grant')) as { grantee: string; table_name: string; privilege_type: string }[];
const grant: GrantDb = righe.map((r) => ({
  grantee: r.grantee,
  tabella: r.table_name,
  privilegio: r.privilege_type,
}));

const tabelle = new Set(richieste.map((r) => r.tabella));
console.log(
  `Grant-check: ${richieste.length} richieste su ${tabelle.size} tabelle, ${grant.length} grant nel DB di test.`,
);
if (grant.length === 0) {
  console.error('Nessun grant letto dal DB: risposta inattesa, controllo non affidabile.');
  process.exit(2);
}

const violazioni = verificaGrant(richieste, grant);
if (violazioni.length > 0) {
  console.error(formattaViolazioni(violazioni));
  for (const v of violazioni) {
    console.log(`::error file=${v.file}::GRANT mancante: ${v.privilegio} su public.${v.tabella} per ${v.ruolo}`);
  }
  process.exit(1);
}
console.log('OK: tutti i grant richiesti dal codice sono presenti.');
