#!/usr/bin/env node
// Girasole — ricrea gli account di test E2E_* dopo un `supabase db reset`.
//
// Perché esiste (A24, docs/programma-attivita.md): il reset del DB di
// test in CI (A23, `supabase db reset --linked ...`) riapplica le
// migration e il seed, ma azzera anche `auth.users` — non solo lo
// schema `public`. Gli account E2E_* usati da `e2e/auth.setup.ts` non
// sono più creati a mano una tantum nella dashboard Authentication (lì
// sparivano ad ogni reset): questo script li ricrea/aggiorna ad ogni
// run, con la Admin API di Supabase (service_role key), usando le
// stesse email/password già nei secret GitHub `E2E_<RUOLO>_EMAIL` /
// `E2E_<RUOLO>_PASSWORD` (vedi e2e/helpers.ts, .env.example).
//
// Nessuna dipendenza nuova: @supabase/supabase-js è già una dipendenza
// dell'app (usata anche da lib/supabase/admin.ts). Il trigger
// `handle_new_user` (supabase/migrations/0005_utenti_gestiti_da_app.sql)
// crea la riga `profili` corrispondente leggendo `user_metadata`
// (nome, cognome, telefono, ruolo): non serve scrivere direttamente su
// `profili` da qui, né richiedere ulteriori GRANT per `service_role`.
//
// Uso: node scripts/crea-utenti-e2e.mjs
// Richiede nell'ambiente: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Ogni ruolo il cui E2E_<RUOLO>_EMAIL/PASSWORD non è configurato viene
// saltato (log, non errore) — stesso principio di tolleranza di
// e2e/helpers.ts (hasCredenziali): un ruolo mancante non deve bloccare
// l'esecuzione degli altri.

import { createClient } from '@supabase/supabase-js';

// I quattro ruoli "core" (obbligatori per il criterio "Fatto quando" di
// A24: auth.setup.ts non deve saltare nessuno di questi in CI) più i due
// account opzionali usati da singoli scenari e2e (specs/03, specs/12).
const RUOLI = [
  { prefisso: 'E2E_ADMIN', ruolo: 'admin', nome: 'Admin', cognome: 'Test', obbligatorio: true },
  {
    prefisso: 'E2E_MAESTRA',
    ruolo: 'maestra',
    nome: 'Maestra',
    cognome: 'Test',
    obbligatorio: true,
    sezioneFixture: true,
  },
  {
    prefisso: 'E2E_ASSISTENTE',
    ruolo: 'assistente',
    nome: 'Assistente',
    cognome: 'Test',
    obbligatorio: true,
    sezioneFixture: true,
  },
  { prefisso: 'E2E_GENITORE', ruolo: 'genitore', nome: 'Genitore', cognome: 'Test', obbligatorio: true },
  {
    // e2e/12-dashboard-maestre.spec.ts: una maestra deliberatamente
    // SENZA sezioni assegnate — niente maestre_sezioni per questo account.
    prefisso: 'E2E_MAESTRA_SENZA_SEZIONE',
    ruolo: 'maestra',
    nome: 'Maestra',
    cognome: 'SenzaSezione',
    obbligatorio: false,
  },
  {
    // e2e/50-amministrazione_base.spec.ts: gli basta esistere con ruolo
    // genitore per essere promosso dall'admin — nessun login diretto,
    // quindi nessuna password richiesta da un secret (ne generiamo una
    // qualunque, mai letta da nessun test).
    prefisso: 'E2E_UTENTE_DA_PROMUOVERE',
    ruolo: 'genitore',
    nome: 'DaPromuovere',
    cognome: 'Test',
    obbligatorio: false,
    passwordNonRichiesta: true,
  },
];

// Sezione "Girasoli" creata da supabase/seed.sql. Maestra e assistente
// di test vi vengono assegnate ad ogni reset (issue #70): senza una
// sezione non vedono bambini né la card Presenze in dashboard, e i test
// e2e che li usano (01, 06, 13, 14, 16…) passavano o fallivano a seconda
// che un altro test avesse già fatto l'assegnazione da /admin/maestre.
// E2E_MAESTRA_SENZA_SEZIONE resta invece deliberatamente senza.
const SEZIONE_FIXTURE_ID = '00000000-0000-0000-0000-000000000001';

function passwordCasuale() {
  return `Aa1!${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

// L'Admin API non offre un "getUserByEmail" diretto in questa versione
// del client: pagina auth.admin.listUsers finché non trova l'email (i
// progetti di test hanno poche decine di utenti, non serve altro).
async function trovaUtentePerEmail(admin, email) {
  const perPage = 200;
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage });
    if (error) throw error;
    const trovato = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (trovato) return trovato;
    if (data.users.length < perPage) return null;
  }
}

async function creaOAggiornaUtente(admin, { email, password, nome, cognome, ruolo }) {
  const user_metadata = { nome, cognome, telefono: '3331234567', ruolo };

  const creazione = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata,
  });
  if (!creazione.error) return { utente: creazione.data.user, creato: true };

  const giaEsistente = /already|registrat/i.test(creazione.error.message);
  if (!giaEsistente) throw creazione.error;

  // Percorso solo per riavvii locali senza un reset completo di mezzo:
  // in CI, dopo A23, auth.users è sempre vuota e passa sempre dal ramo
  // sopra. Qui aggiorniamo comunque password e metadata per restare
  // idempotenti.
  const esistente = await trovaUtentePerEmail(admin, email);
  if (!esistente) throw creazione.error;

  const aggiornamento = await admin.auth.admin.updateUserById(esistente.id, {
    password,
    user_metadata,
  });
  if (aggiornamento.error) throw aggiornamento.error;
  return { utente: aggiornamento.data.user, creato: false };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      '[crea-utenti-e2e] Mancano NEXT_PUBLIC_SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY: impossibile procedere.'
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let unRuoloObbligatorioFallito = false;

  for (const config of RUOLI) {
    const email = process.env[`${config.prefisso}_EMAIL`];
    const passwordDaSecret = process.env[`${config.prefisso}_PASSWORD`];
    const password = passwordDaSecret || (config.passwordNonRichiesta ? passwordCasuale() : undefined);

    if (!email || !password) {
      console.log(`[crea-utenti-e2e] salto ${config.prefisso}: secret non configurato.`);
      continue;
    }

    try {
      const { utente, creato } = await creaOAggiornaUtente(admin, {
        email,
        password,
        nome: config.nome,
        cognome: config.cognome,
        ruolo: config.ruolo,
      });
      console.log(
        `[crea-utenti-e2e] ${config.prefisso} (${email}) ${creato ? 'creato' : 'aggiornato'}, ruolo "${config.ruolo}".`
      );

      if (config.sezioneFixture) {
        const { error } = await admin
          .from('maestre_sezioni')
          .upsert({ maestra_id: utente.id, sezione_id: SEZIONE_FIXTURE_ID }, { ignoreDuplicates: true });
        if (error) throw error;
        console.log(`[crea-utenti-e2e] ${config.prefisso} assegnato alla sezione fixture ${SEZIONE_FIXTURE_ID}.`);
      }
    } catch (err) {
      const messaggio = err instanceof Error ? err.message : String(err);
      console.error(`[crea-utenti-e2e] ERRORE su ${config.prefisso} (${email}): ${messaggio}`);
      if (config.obbligatorio) unRuoloObbligatorioFallito = true;
    }
  }

  if (unRuoloObbligatorioFallito) {
    console.error(
      '[crea-utenti-e2e] Uno o più ruoli obbligatori (admin/maestra/assistente/genitore) non sono pronti: la e2e non può procedere in modo affidabile.'
    );
    process.exit(1);
  }
}

main();
