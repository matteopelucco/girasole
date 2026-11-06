#!/usr/bin/env -S node --experimental-strip-types
// Girasole — RLS-check (issue #131, esteso da #133): wrapper I/O per lib/rlsCheck.ts.
//
// Interroga pg_class del DB di TEST, remoto o locale (sola lettura, una sola
// SELECT) e fallisce se, in `public`, esposti a `authenticated`/`anon`:
//  - una tabella ha la RLS disattivata;
//  - una vista non ha `security_invoker = true`;
//  - una vista materializzata o una tabella esterna ha qualunque privilegio.
// Stessa chiamata del grant-check (scripts/query-db-test.mts). Nessun accesso
// alla produzione.
//
// Uso (CI, dopo il reset del DB di test):
//   node --experimental-strip-types scripts/rls-check.mts

import {
  QUERY_RLS,
  formattaEsposti,
  formattaSenzaRls,
  guardiaTabelle,
  normalizzaRighe,
  trovaEspostiSenzaRls,
  trovaSenzaRls,
} from '../lib/rlsCheck.ts';
import { eseguiQueryDbTest } from './query-db-test.mts';

const normalizzato = normalizzaRighe(await eseguiQueryDbTest(QUERY_RLS, 'RLS'));
if ('errore' in normalizzato) {
  console.error(normalizzato.errore);
  process.exit(2);
}
const { oggetti } = normalizzato;

const guardia = guardiaTabelle(oggetti);
if (guardia) {
  console.error(guardia);
  process.exit(2);
}
const tabelle = oggetti.filter((o) => o.relkind === 'r' || o.relkind === 'p');
console.log(
  `RLS-check: ${tabelle.length} tabelle in public, ${tabelle.filter((t) => t.rls).length} con RLS attiva; ` +
    `${oggetti.length - tabelle.length} tra viste, viste materializzate e tabelle esterne.`,
);

const senzaRls = trovaSenzaRls(oggetti);
const esposti = trovaEspostiSenzaRls(oggetti);
if (senzaRls.length > 0 || esposti.length > 0) {
  if (senzaRls.length > 0) console.error(formattaSenzaRls(senzaRls));
  if (senzaRls.length > 0 && esposti.length > 0) console.error('');
  if (esposti.length > 0) console.error(formattaEsposti(esposti));
  for (const v of senzaRls) {
    console.log(`::error::RLS disattivata su public.${v.nome} (grant: ${v.grantee.join(', ')})`);
  }
  for (const v of esposti) {
    console.log(
      `::error::public.${v.nome} (relkind ${v.relkind}) esposto senza RLS: usare security_invoker = true o togliere il grant (grant: ${v.grantee.join(', ')})`,
    );
  }
  process.exit(1);
}
console.log(
  'OK: ogni tabella con grant ad authenticated/anon ha la RLS attiva; nessuna vista senza security_invoker, vista materializzata o tabella esterna è esposta.',
);
