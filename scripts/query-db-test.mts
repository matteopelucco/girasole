// Girasole — una SELECT di controllo sul database di test, per grant-check e
// RLS-check (issue #419). Due strade, scelte dall'ambiente:
//  - SUPABASE_DB_URL_LOCALE: il database locale del job `e2e`, con psql,
//    in una transazione di sola lettura. Sono accettati solo indirizzi di
//    questo computer (lib/queryDbTest.ts);
//  - altrimenti il progetto di TEST via Management API: il ref arriva SOLO da
//    SUPABASE_TEST_PROJECT_REF, il token da SUPABASE_ACCESS_TOKEN.
// In entrambi i casi nessun accesso alla produzione. Un errore termina il
// processo con exit code 2, come "controllo non eseguito".

import { execFileSync } from 'node:child_process';
import { sqlRigheJson, urlDbLocaleValido } from '../lib/queryDbTest.ts';

function fallisci(messaggio: string): never {
  console.error(messaggio);
  process.exit(2);
}

function queryLocale(url: string, query: string, etichetta: string): unknown {
  if (!urlDbLocaleValido(url)) fallisci('SUPABASE_DB_URL_LOCALE deve indicare un database su questo computer.');
  try {
    const uscita = execFileSync('psql', [url, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sqlRigheJson(query)], {
      encoding: 'utf8',
      env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' },
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(uscita);
  } catch (errore) {
    // Solo il tipo di errore: l'indirizzo contiene la password del database locale.
    fallisci(`Query ${etichetta} fallita sul database locale: ${errore instanceof Error ? errore.name : 'errore'}`);
  }
}

async function queryRemota(query: string, etichetta: string): Promise<unknown> {
  const ref = process.env.SUPABASE_TEST_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) fallisci('Servono SUPABASE_TEST_PROJECT_REF (progetto di TEST) e SUPABASE_ACCESS_TOKEN.');

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) fallisci(`Query ${etichetta} fallita: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

export async function eseguiQueryDbTest(query: string, etichetta: string): Promise<unknown> {
  const urlLocale = process.env.SUPABASE_DB_URL_LOCALE;
  return urlLocale ? queryLocale(urlLocale, query, etichetta) : queryRemota(query, etichetta);
}
