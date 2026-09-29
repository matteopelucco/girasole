#!/usr/bin/env -S node --experimental-strip-types
// Girasole — RLS-check (issue #131): wrapper I/O per lib/rlsCheck.ts.
//
// Interroga pg_class del DB di TEST via Management API (sola lettura, una
// sola SELECT) e fallisce se una tabella di `public` con privilegi per
// `authenticated`/`anon` ha la RLS disattivata. Stessa chiamata e stessi
// secret del grant-check: il ref arriva SOLO da SUPABASE_TEST_PROJECT_REF,
// il token da SUPABASE_ACCESS_TOKEN. Nessun accesso alla produzione.
//
// Uso (CI, dopo il reset del DB di test):
//   node --experimental-strip-types scripts/rls-check.mts

import { QUERY_RLS, formattaSenzaRls, guardiaTabelle, trovaSenzaRls, type TabellaRls } from '../lib/rlsCheck.ts';

const ref = process.env.SUPABASE_TEST_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('Servono SUPABASE_TEST_PROJECT_REF (progetto di TEST) e SUPABASE_ACCESS_TOKEN.');
  process.exit(2);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: QUERY_RLS }),
});
if (!res.ok) {
  console.error(`Query RLS fallita: HTTP ${res.status} ${await res.text()}`);
  process.exit(2);
}
const righe = (await res.json()) as { tabella: string; rls: boolean; grantee: string[] | string }[];
const tabelle: TabellaRls[] = righe.map((r) => ({
  tabella: r.tabella,
  rls: r.rls === true,
  // Postgres array: normalmente già array JSON; tollera la forma testuale "{a,b}".
  grantee: Array.isArray(r.grantee) ? r.grantee : String(r.grantee).replace(/[{}]/g, '').split(',').filter(Boolean),
}));

const guardia = guardiaTabelle(tabelle);
if (guardia) {
  console.error(guardia);
  process.exit(2);
}
console.log(`RLS-check: ${tabelle.length} tabelle in public, ${tabelle.filter((t) => t.rls).length} con RLS attiva.`);

const violazioni = trovaSenzaRls(tabelle);
if (violazioni.length > 0) {
  console.error(formattaSenzaRls(violazioni));
  for (const v of violazioni) {
    console.log(`::error::RLS disattivata su public.${v.tabella} (grant: ${v.grantee.join(', ')})`);
  }
  process.exit(1);
}
console.log('OK: ogni tabella con grant ad authenticated/anon ha la RLS attiva.');
