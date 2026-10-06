// Fixture e2e "bambino proprio" (issue #228, sotto-issue di #172 e #77).
//
// PERCHÉ. Più test lavoravano sui bambini del seed ("la prima card che ha
// il pulsante X") e si pestavano i piedi (06 segna "Assente" sullo stesso
// bambino su cui 13 segna "Presente"): per questo oggi girano in un solo
// worker (`chromium-stato-condiviso`, playwright.config.ts). Con questa
// fixture ogni test (o gruppo di test in sequenza) crea il SUO bambino,
// con un nome unico, nella sezione fixture, e lo elimina alla fine.
//
// COME SI USA.
//   import { test, expect } from './fixture-bambino';
//   import { apriGiornata, cardBambino } from './pagina-giornata';
//
//   test('...', async ({ page, bambino }) => {
//     await apriGiornata(page, dataOggiRoma());
//     const card = cardBambino(page, bambino);
//     ...
//   });
//
// `bambino` ha `id`, `nome`, `cognome` (unico: `E2eFx<tempo><casuale>`,
// ricavato da Date.now() e da un numero casuale, sempre dati fittizi) e
// `nomeCompleto`. Il bambino appartiene alla sezione fixture (la stessa
// del seed, a cui sono assegnate la maestra e l'assistente di test), quindi
// lo vedono tutti e tre i ruoli di staff; il genitore no (nessun legame).
//
// Per un gruppo di test in sequenza che condividono lo stato di un solo
// bambino (es. `test.describe.configure({ mode: 'serial' })` in 06) la
// fixture per-test non va bene, perché cancellerebbe il bambino tra un test
// e l'altro: si usano le due funzioni `creaBambinoFixture` /
// `eliminaBambinoFixture` dentro `test.beforeAll` / `test.afterAll`, con la
// fixture di worker `adminDb`. `afterAll` gira anche se un test fallisce.
//
// PULIZIA. Alla fine del test (anche se fallito, perché il teardown di una
// fixture gira sempre) il bambino viene eliminato; presenze, pasti e le
// altre righe collegate vanno via con lui (ON DELETE CASCADE). La
// cancellazione è riprovata e, se non cancella nulla (RLS che rifiuta,
// bambino già sparito), fa fallire il test: una perdita non resta
// silenziosa. Resta fuori solo il caso di un worker ucciso a metà: il
// bambino orfano si chiama "E2eFx...", è innocuo e lo ripulisce il reset
// del DB di test che la CI fa ad ogni PR (ADR-0006, ADR-0008).
//
// SICUREZZA. Il client `adminDb` usa la chiave anon pubblica e fa login
// come l'admin di test (E2E_ADMIN_EMAIL/PASSWORD), un login per worker: le
// scritture passano dalla RLS esattamente come quelle dell'app (policy
// `bambini_admin_write`). NON si usa mai la service_role key negli e2e.
// Mai dati reali di bambini, nemmeno qui.
import { test as base, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { credenziali } from './helpers';

// Sezione del seed (supabase/seed.sql) a cui scripts/crea-utenti-e2e.mjs
// assegna la maestra e l'assistente di test.
export const SEZIONE_FIXTURE_ID = '00000000-0000-0000-0000-000000000001';

export type BambinoFixture = {
  id: string;
  nome: string;
  cognome: string;
  nomeCompleto: string;
};

// Login come admin di test con la chiave anon (mai la service_role).
// Ritorna null se mancano credenziali o variabili Supabase: il chiamante
// si salta con test.skip, come gli altri test che richiedono un account.
export async function accediComeAdminDb(): Promise<SupabaseClient | null> {
  const cred = credenziali('admin');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chiaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!cred || !url || !chiaveAnon) return null;

  const db = createClient(url, chiaveAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword(cred);
  if (error) throw new Error(`Login admin della fixture bambino non riuscito: ${error.message}`);
  return db;
}

function cognomeUnico(): string {
  const casuale = Math.floor(Math.random() * 36 ** 4).toString(36);
  return `E2eFx${Date.now().toString(36)}${casuale}`;
}

// Opzioni per i test che hanno bisogno di un bambino particolare (es. il
// sesso per l'avatar, le allergie): di default femmina, senza allergie.
export type OpzioniBambinoFixture = {
  sesso?: 'M' | 'F' | null;
  noteAllergie?: string;
};

export async function creaBambinoFixture(
  db: SupabaseClient,
  opzioni: OpzioniBambinoFixture = {}
): Promise<BambinoFixture> {
  const nome = 'Fixture';
  const cognome = cognomeUnico();
  const { data, error } = await db
    .from('bambini')
    .insert({
      nome,
      cognome,
      sezione_id: SEZIONE_FIXTURE_ID,
      data_nascita: '2020-01-01',
      sesso: opzioni.sesso === undefined ? 'F' : opzioni.sesso,
      note_allergie: opzioni.noteAllergie ?? null,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`Creazione del bambino fixture non riuscita: ${error?.message ?? 'nessuna riga'}`);
  }
  return { id: data.id as string, nome, cognome, nomeCompleto: `${nome} ${cognome}` };
}

export async function eliminaBambinoFixture(db: SupabaseClient, id: string): Promise<void> {
  let ultimoErrore = '';
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    const { data, error } = await db.from('bambini').delete().eq('id', id).select('id');
    if (!error && data && data.length === 1) return;
    ultimoErrore = error?.message ?? 'nessuna riga eliminata (RLS o bambino già assente)';
    await new Promise((r) => setTimeout(r, 500 * tentativo));
  }
  throw new Error(`Pulizia del bambino fixture ${id} non riuscita: ${ultimoErrore}`);
}

export const test = base.extend<{ bambino: BambinoFixture }, { adminDb: SupabaseClient | null }>({
  adminDb: [
    async ({}, use) => {
      await use(await accediComeAdminDb());
    },
    { scope: 'worker' },
  ],

  bambino: async ({ adminDb }, use) => {
    base.skip(
      adminDb === null,
      'richiede E2E_ADMIN_EMAIL/PASSWORD e NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (fixture bambino)'
    );
    const bambino = await creaBambinoFixture(adminDb!);
    try {
      await use(bambino);
    } finally {
      await eliminaBambinoFixture(adminDb!, bambino.id);
    }
  },
});

export { expect };
