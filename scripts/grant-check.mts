#!/usr/bin/env -S node --experimental-strip-types
// Girasole — grant-check (A26, issue #28): wrapper I/O per lib/grantCheck.ts.
//
// Legge i sorgenti (app/, lib/, components/), interroga
// information_schema.role_table_grants del DB di TEST via Management API
// (sola lettura) e fallisce, con il nome della tabella, se manca un GRANT
// richiesto da `authenticated` o `service_role`. Non è testato
// unitariamente (I/O); la logica pura lo è, in lib/grantCheck.test.ts.
//
// Sicurezza: il project ref arriva SOLO da SUPABASE_TEST_PROJECT_REF
// (variabile di CI del progetto di test), mai hardcoded; il token da
// SUPABASE_ACCESS_TOKEN (secret di repo, lo stesso del reset A23). Nessuna
// scrittura sul DB: una sola SELECT su information_schema.
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

const ref = process.env.SUPABASE_TEST_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('Servono SUPABASE_TEST_PROJECT_REF (progetto di TEST) e SUPABASE_ACCESS_TOKEN.');
  process.exit(2);
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

const query = `select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('authenticated', 'service_role')`;

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
if (!res.ok) {
  console.error(`Query grant fallita: HTTP ${res.status} ${await res.text()}`);
  process.exit(2);
}
const righe = (await res.json()) as { grantee: string; table_name: string; privilege_type: string }[];
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
