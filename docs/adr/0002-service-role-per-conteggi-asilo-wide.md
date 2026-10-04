# ADR-0002 — `service_role` key per conteggi/azioni che attraversano tutte le sezioni

- Stato: Accettata
- Data: 2026-08-22 (creazione utenti), estesa il 2026-08-26 (conteggio
  pasti Rojac)

## Contesto
La RLS filtra per sezione: una maestra vede via `authenticated` solo le
proprie sezioni. Alcune funzionalità richiedono invece un dato
sull'intero asilo, non filtrabile per ruolo dell'utente che le invoca:
- la creazione/eliminazione di un utente in `auth.users` (solo l'API
  admin di Supabase può farlo, `lib/supabase/admin.ts`,
  specs/03 - utenti-e-ruoli.md);
- il conteggio dei pasti "sì" su tutti i bambini attivi dell'asilo per
  la comunicazione a Rojac (`lib/pastiRojac.ts`,
  `contaPastiSiOggiTuttoAsilo`), che deve coprire tutte le sezioni anche
  quando l'azione è avviata da una singola maestra;
- il cron notturno che compone il report aggregato (nessuna sessione
  utente attiva da cui ereditare i permessi).

## Decisione
Usare `createAdminClient()` (client Supabase con la `service_role key`,
che bypassa la RLS) solo lato server, dentro `'use server'`, per queste
azioni asilo-wide specifiche — mai per servire dati filtrati per ruolo
che la RLS già gestisce correttamente. L'autorizzazione a invocare
quell'azione (es. solo un ruolo che può inviare la comunicazione pasti)
resta responsabilità del codice applicativo che precede la chiamata, non
della RLS.

## Conseguenze
- Positive: evita di dover esprimere in RLS un'eccezione ad hoc
  ("questo ruolo vede tutte le sezioni solo per questo conteggio"), che
  indebolirebbe la policy per tutti gli altri usi.
- Negative: ogni nuovo uso di `createAdminClient()` sposta il confine di
  sicurezza dal database al codice applicativo — un bug nel controllo a
  monte (es. dimenticare di verificare il ruolo prima di chiamarlo)
  bypassa la RLS senza che il database se ne accorga. Per questo la
  service_role key non deve mai raggiungere il client (vedi
  `.env.example`, CLAUDE.md "Repo pubblico: sicurezza") e ogni nuovo uso
  va giustificato esplicitamente in un commento nel codice, come già
  fatto in `lib/supabase/admin.ts` e `lib/pastiRojac.ts`.
- La motivazione puntuale di ciascun uso resta nel commento accanto al
  `createAdminClient()` corrispondente, non duplicata qui.

## Aggiornamento (issue #211, sotto-issue di #38)
Il conteggio e i controlli dei pasti per Rojac (`lib/pastiRojac.ts`) non usano
più la service_role: sono tre funzioni Postgres `security definer` (migration
0056) richiamate via RPC con la sessione dell'utente, con il controllo del
ruolo dentro la funzione.

## Aggiornamento (issue #212, sotto-issue di #38)
Nemmeno la registrazione della comunicazione (INSERT in `pasti_comunicati`) usa
più la service_role: è la funzione `comunica_pasti_rojac(data)` (migration
0057, `security definer`, ruolo admin/maestra verificato dentro, maestra solo
su oggi). Si è scartato l'INSERT col client dell'utente: il trigger 0033 non è
`security definer` e con la RLS di una maestra non vedrebbe i bambini delle
altre sezioni, e la policy 0020 non vincola `numero_pasti`/`comunicato_da`/
`comunicato_da_nome` (log contabile falsificabile). La migration revoca anche
l'INSERT diretto ad `authenticated`. Restano con la service_role la gestione
utenti (Admin API di Auth) e i cron (con le loro librerie). Il GRANT INSERT a
service_role di 0021 è stato rimosso con la migration 0058 (issue #217): nessun
codice lo usava più e la RPC `security definer` non dipende da quel privilegio.
La 0058 revoca anche UPDATE, DELETE e TRUNCATE a service_role, anon e
authenticated (residui dei default privileges di Supabase, inutilizzati; la
service_role ignora la RLS e avrebbe potuto riscrivere il log contabile via
REST). Restano SELECT a service_role (cron) e ad authenticated, e tutti i
privilegi al proprietario `postgres`.

## Aggiornamento (issue #213, sotto-issue di #38)
Il download del PDF mensile delle ore di lavoro (`/admin/ore-lavoro/pdf`) non usa
più la service_role: `lib/reportOreLavoro.ts` riceve il client dal chiamante.
La route admin passa il client della sessione dell'admin (dopo `requireAdmin()`),
le cui policy di lettura per l'admin (`*_select_own_or_admin`, `giorni_chiusura_select_staff`, `profili_orari_admin_all`) leggono già i dati di tutto il personale
(verificato da `supabase/tests/database/ore_lavoro_report_admin.test.sql`); il
cron `report-presenze` continua a passare la service_role.

## Aggiornamento (issue #214, sotto-issue di #38): la regola e come ammettere un'eccezione
Chiusi #211-#213, `createAdminClient` resta solo dove la service_role è
inevitabile, ed è ora **imposto dalla CI**:
- `lib/supabase/admin.ts` (la factory);
- i cron `app/api/cron/**` e le librerie usate solo da loro
  (`lib/reportPresenze.ts`): non c'è una sessione utente da cui ereditare i
  permessi;
- la gestione utenti `app/admin/maestre/actions.ts` (Admin API di Supabase
  Auth: `createUser`/`updateUserById`/`deleteUser`, non esistono come RPC);
- `scripts/` ed `e2e/` (CI e manutenzione, fuori dal bundle dell'app) e i file
  `*.test.ts`/`*.spec.ts`;
- `lib/grantCheck.ts`, che nomina la factory solo dentro letterali regex per
  l'analisi statica.

Il criterio "`createAdminClient` assente da ogni server action avviata da un
utente" (specs/03, specs/07) va quindi letto con **un'eccezione**: la gestione
utenti (`auth.admin.*`).

`npm run check:service-role` (`scripts/service-role-check.mts`, logica pura in
`lib/serviceRoleCheck.ts`, agganciato a `npm run lint` e all'hook pre-push) fa
fallire la CI se `createAdminClient`, l'import di `lib/supabase/admin` o la
variabile `SUPABASE_SERVICE_ROLE_KEY` compaiono in qualunque altro file,
indicando file e riga. **Per ammettere un'eccezione**: aggiungere il file a
`FILE_AMMESSI` in `lib/serviceRoleCheck.ts` con la motivazione e aggiornare
questa ADR nella stessa PR; la modifica richiede review umana (e rls-guardian).
La strada preferita resta una RPC `security definer` chiamata con la sessione
dell'utente.
