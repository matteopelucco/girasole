# Dettagli di sviluppo (estesi)

Versione completa, con le motivazioni, delle regole riassunte in
`CLAUDE.md`. Leggere la sezione pertinente solo quando si tocca
quell'argomento (CI, pre-push, reset del DB, versioning, test).

Contesto operativo per Claude Code su questo progetto.

## Stack
- Next.js 14 (App Router, Server Actions, Server Components di default)
- TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + Row Level Security) — client in `lib/supabase/`
- Deploy: Vercel (free tier)

## Convenzioni
- UI e testi visibili all'utente in italiano. Nomi di variabili/funzioni/file in
  inglese, salvo le entità di dominio (`bambini`, `presenze`, `pasti`,
  `promemoria`, `sezioni`) che restano in italiano perché rispecchiano le
  tabelle del database.
- Preferire Server Components e Server Actions; usare Client Components
  (`'use client'`) solo dove serve interattività (form dinamici, toggle, ecc.).
- Non introdurre nuove dipendenze senza chiederlo prima — l'obiettivo è restare
  comodamente dentro il free tier di Vercel e Supabase.
- Ogni nuova tabella o modifica allo schema va in `supabase/migrations/` come
  nuovo file numerato, mai modificata a mano dalla dashboard Supabase in
  produzione. **Anche l'applicazione di una migration non passa più dal SQL
  Editor** (A22): in locale si usa `supabase db push --project-ref <ref-test>`
  (esplicito e incrementale, mai un `supabase link` implicito su cui contare
  a occhi chiusi); in test l'applicazione avviene tramite il reset completo
  di CI (A23, `supabase db reset --project-ref <ref-test>`, prima della
  suite e2e — vedi sotto); in produzione resta manuale e deliberato, solo
  Matteo, con `supabase db push --project-ref <ref-produzione>` esplicito
  sul singolo comando dopo il merge — mai un link permanente verso il ref
  di produzione, mai un'automazione CI/agente verso la produzione.
- Le policy RLS sono la difesa primaria dei dati, non un dettaglio: ogni nuova
  query deve rispettare i confini di ruolo (admin / maestra / genitore)
  descritti in `specs/`. Se una feature richiede una nuova policy, scrivila
  nella migration insieme alla tabella.

## Workflow
- Trunk-based development, commit atomici. Messaggi **in inglese**, formato
  [Conventional Commits](https://www.conventionalcommits.org/):
  `<tipo>(<ambito opzionale>): <descrizione all'imperativo>`, con tipo in
  `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `perf`, `build`;
  `!` dopo il tipo per un breaking change. Titolo breve, dettagli nel corpo,
  `Refs #<n>` (o `Closes #<n>`) in fondo. Es.:
  `fix(presenze): block absence after Rojac communication`. Serve a generare
  CHANGELOG e tag (issue #32). I commit precedenti restano com'erano.
- Backlog e storia di lavoro: solo issue e PR (`docs/tasks-archivio.md`
  resta come storico).
- Riferimento ai requisiti dettagliati: `specs/` — un file numerato per
  scenario/funzionalità (`specs/00 - overview.md` per obiettivo, ruoli,
  fuori-scope e indice; `0x` per requisiti trasversali come
  `specs/01 - ux.md`; `1x` per la schermata/flusso della maestra, es.
  `specs/11 - login.md`; `5x` per l'amministrazione, es.
  `specs/50 - amministrazione_base.md`). Non esiste più un unico `SPEC.md`:
  quando si aggiunge o modifica un requisito, aggiornare o creare il file
  scenario corrispondente in `specs/` (aggiornando l'indice in
  `00 - overview.md`), non un documento monolitico.

## Analisi statica prima di ogni push
- Un git hook `pre-push` (`.githooks/pre-push`, attivato in automatico
  da `npm install` tramite lo script `prepare` in `package.json`, che
  imposta `core.hooksPath`) lancia type-check (`tsc --noEmit`), ESLint
  (`next lint`, configurato in `.eslintrc.json` con `next/core-web-vitals`),
  gli unit test Vitest (`npx vitest run` — vedi sotto), la ricerca di
  codice duplicato (`jscpd`, configurato in `.jscpd.json`) e la build di
  produzione (`next build`, A15) prima di ogni `git push`. Il push viene
  bloccato se uno dei cinque fallisce. A differenza della suite e2e, gli
  unit test non richiedono un server dev né credenziali (nessun I/O),
  quindi girano bene dentro un hook che deve restare veloce.
- La build (`next build`) è l'unico passo dell'hook che intercetta un
  import lato server trascinato in un componente client (lo stesso buco
  che in CI, A12, viene preso al passo 5) — per questo di default è
  ATTIVA. È anche il passo più lento (tipicamente decine di secondi in
  locale): saltabile con `SKIP_BUILD_PRE_PUSH=1 git push` quando serve un
  push veloce (gli altri quattro controlli girano comunque). Richiede le
  stesse `NEXT_PUBLIC_*` di `.env.local` usate da `npm run dev` (vedi
  `.env.example`): se `.env.local` manca o ne è priva, l'hook avvisa e
  salta la build invece di bloccare il push — non è una regressione di
  codice ma una macchina locale non configurata, e la build reale gira
  comunque in CI prima del merge.
- Lanciabile a mano in qualsiasi momento con `npm run analyze` (lint +
  unit test + duplicati; per il type-check separato, `npx tsc --noEmit`;
  per la build, `npm run build`).
- Se `jscpd` segnala una duplicazione reale (stessa logica ripetuta,
  non solo forma simile), il modo giusto per risolverla è estrarre una
  funzione condivisa (vedi `lib/auth.ts`, `requireAdmin`/`requireProfilo`/
  `requireUser`, che hanno eliminato la duplicazione più consistente).
  Se invece è coincidenza tra funzioni concettualmente diverse che
  capita abbiano la stessa forma (poche righe, validazione simile), non
  forzare un'astrazione solo per abbassare la percentuale — è consentito
  alzare la soglia in `.jscpd.json` con una nota sul perché.
- Questi strumenti girano solo in locale (nessun account/servizio
  esterno, nessun costo): niente SonarCloud o simili per ora — se in
  futuro serve un'analisi più approfondita o integrata nelle PR di
  GitHub, il piano gratuito di SonarCloud per repository pubblici è
  l'opzione più naturale, ma richiede una decisione esplicita (account
  da collegare, token da aggiungere ai secret) prima di essere
  implementato.

## Test-first (importantissimo) — Playwright (e2e) + Vitest (unit)

Due livelli di test, non alternativi: **e2e (Playwright)** copre ogni
`## Scenario:` di `specs/` così com'è sempre stato (comportamento
osservabile via browser, ruoli, RLS) — questa copertura non si riduce.
**Unit (Vitest)** è un livello aggiuntivo, più veloce, per la logica
pura dentro `lib/`: non sostituisce nessuno scenario e2e, ma copre in
millisecondi i casi limite che sarebbe costoso enumerare uno per uno
tramite browser (bisestili, cambi di mese/anno, combinazioni di una
regex), e permette di iterare su quella logica durante la sessione di
sviluppo con `npm run test:unit` invece di dover riavviare `npm run dev`
+ Playwright ad ogni modifica.

**Ciclo di lavoro obbligatorio per ogni modifica non banale**, in
quest'ordine, ed è un ciclo — non un percorso a senso unico: se il check
del passo 4 trova requisiti scoperti o test rotti, si torna al passo 2/3
finché non risulta tutto verde.

1. **SPECS** — leggi/scrivi/aggiorna il file `specs/xxx.md` interessato
   finché descrive esattamente il comportamento voluto, con `## Scenario:`
   Given/When/Then verificabili. Se tocchi un requisito, controlla anche
   gli altri file in `specs/` che lo referenziano (link `[...](...)`) e
   allineali: due requisiti che si contraddicono sono un bug quanto un
   test rotto.
2. **TEST_WRITING** — scrivi o aggiorna `e2e/xxx.spec.ts` PRIMA (o
   comunque prima di dichiarare finito il lavoro) di modificare il
   codice applicativo, un test per ogni `## Scenario:`. Se il codice che
   stai per scrivere/toccare introduce o modifica una funzione pura in
   `lib/` (vedi criterio sotto), scrivi/aggiorna anche il corrispondente
   `lib/xxx.test.ts`.
3. **CODE** — implementa/modifica il codice applicativo (pagine, server
   actions, migration) finché soddisfa quei test.
4. **CHECK_COVERAGE** — verifica che ogni `## Scenario:` di ogni
   `specs/xxx.md` abbia un test e2e corrispondente (nessuno scenario
   scoperto, nessun test orfano che non corrisponde più a uno scenario
   reale) ed esegui entrambe le suite: `npx vitest run` (secondi, sempre)
   e `npx playwright test` (con `npm run dev` attivo — vedi sotto).
5. **FIX** — se un test fallisce o uno scenario risulta scoperto, non è
   accettabile lasciarlo così "per ora": o si corregge il codice, o si
   corregge il test/requisito se era lui ad essere sbagliato. Poi si
   ripete dal passo 4.

### e2e (Playwright) — comportamento end-to-end
- Niente piani di test in Markdown: l'unica suite di test end-to-end è
  quella eseguibile in `e2e/`. Ogni file di requisiti in `specs/xxx.md`
  deve avere un corrispondente `e2e/xxx.spec.ts` con gli stessi identici
  nome e numero (es. `specs/13 - segna-presenza.md` →
  `e2e/13-segna-presenza.spec.ts`), con uno scenario di test Playwright
  per ogni `## Scenario:` del requisito, più un controllo di
  accessibilità axe-core (`nessunaViolazioneA11yGrave`, in
  `e2e/helpers.ts`) su ogni pagina toccata. `specs/00 - overview.md` fa
  eccezione: è un indice, non un requisito testabile, quindi non ha un
  file di test corrispondente.
- **Ad ogni ri-lettura o modifica di un file in `specs/`, aggiornare
  subito il file `e2e/` corrispondente** — aggiungere test per gli
  scenari nuovi, correggere quelli cambiati, rimuovere quelli non più
  validi. I due file non devono mai divergere.
- I test che richiedono una sessione autenticata (admin/maestra/
  genitore) leggono le credenziali da variabili d'ambiente
  `E2E_<RUOLO>_EMAIL` / `E2E_<RUOLO>_PASSWORD` (vedi `.env.example` ed
  `e2e/helpers.ts`) e si saltano da soli (`test.skip`) se non
  configurate — non devono mai fallire per un secret mancante, solo per
  una regressione reale.
- Suite in `e2e/`, configurazione in `playwright.config.ts`. Include
  `@axe-core/playwright` per il controllo di accessibilità.
- **Eseguirli in locale (gratis, nessun servizio esterno)**: in un
  terminale `npm run dev`, in un altro `npx playwright test` (oppure
  `npx playwright test --ui` per la modalità interattiva con
  time-travel debugging — utile per capire perché un test fallisce).
  Se il server su `:3000` non è già acceso, Playwright lo avvia da solo.
- **Il database usato in locale deve essere un progetto Supabase di
  TEST, mai quello di produzione**: i test scrivono e modificano dati
  veri (presenze, pasti, promemoria, sezioni, bambini, ruoli) sul
  progetto puntato da `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` — non
  sono in sola lettura. Prima di lanciare la suite, verificare sempre
  quale progetto Supabase è configurato.
- Le credenziali degli account di test (`E2E_*`) vanno in `.env.local`
  (mai committate). Un ruolo mancante fa saltare solo i test che lo
  richiedono: la suite resta comunque eseguibile parzialmente.
- Ogni salvataggio seguito da `reload`/`goto`/lettura di un valore
  calcolato dal server deve usare `clickEAttendiAzione`
  (`e2e/helpers.ts`); i valori calcolati dal server si leggono con
  `expect.poll` per attendere il calcolo asincrono.

### Unit (Vitest) — solo logica pura
- **Criterio di ammissione, rigido**: un unit test in `lib/xxx.test.ts`
  è ammesso solo per funzioni **senza I/O** — niente chiamate Supabase
  (nemmeno con un client "finto"), niente `fetch`, niente filesystem,
  niente `redirect()` di Next.js. Se una funzione tocca anche solo in
  parte uno di questi, resta coperta esclusivamente da e2e: un mock del
  client Supabase darebbe un falso senso di sicurezza proprio sulle RLS,
  che sono "la difesa primaria dei dati" (vedi Convenzioni) e si
  verificano solo con un Postgres reale e una sessione reale. Esempio:
  in `lib/auth.ts`, `puoScrivereData`/`assicuraScrivibile` sono unit
  test (prendono ruolo/data, nessun I/O); `requireUser`/`requireProfilo`/
  `requireAdmin`/`requireStaff` restano solo e2e (fanno query Supabase e
  `redirect()`).
- Co-locati accanto al modulo che testano (`lib/date.ts` →
  `lib/date.test.ts`, non una cartella `__tests__` separata), niente
  mapping 1:1 con `specs/xxx.md`: una funzione di `lib/` può essere
  usata da più scenari (es. `lib/date.ts` da `specs/13`, `specs/14` e
  `specs/51`), quindi si testa una volta sola al livello del modulo,
  con i casi limite significativi (bisestili, cambi mese/anno,
  confini di regex), non uno scenario e2e per ogni combinazione.
- Configurazione in `vitest.config.mts` (environment `node`, alias `@`
  come in `tsconfig.json`). Nessuna dipendenza da un server dev, da
  Playwright o da credenziali: girano ovunque, incluso dentro l'hook
  `pre-push`.
- Eseguirli con `npm run test:unit` (una tantum) o `npm run
  test:unit:watch` (rilancia ad ogni modifica — utile durante lo
  sviluppo di una funzione in `lib/`).

## Repo pubblico — regole di sicurezza (non negoziabili)
Questo repository è pubblico su GitHub: chiunque legga il codice, anche in
cronologia commit passata, anche dopo un'eventuale rimozione.
- La `anon key` di Supabase (in `.env.local`, mai committata) è pensata per
  essere esposta lato client: la sicurezza reale è la RLS, non la sua
  segretezza.
- La `service_role key` di Supabase è invece un segreto vero: bypassa tutte
  le policy RLS. Non va MAI usata in codice lato client, né committata, né
  messa in una route pubblica. Se serve per uno script locale (es. import
  dati), resta solo in una variabile d'ambiente non versionata.
- Non committare mai dati reali di bambini o genitori — nemmeno come seed o
  fixture di test. Usare sempre dati fittizi per esempi e test.
- Le pull request di collaboratori esterni vanno revisionate prima del
  merge su `main`: un push su `main` fa deploy automatico in produzione
  su Vercel.
- Su ogni PR gira un unico workflow GitHub Actions
  (`.github/workflows/ci.yml`, gratuito su repo pubblici) con un passo di
  classificazione seguito da sette passi: tsc → lint → jscpd → vitest →
  **`next build`** (job `statico`) → reset del DB di test → e2e (job
  `e2e`), più il job `verifica` che fa da gate (vedi "Coda del DB"
  sotto). I primi quattro
  non richiedono secret e falliscono in secondi; la build di produzione è
  l'unico passo che intercetta un import lato server trascinato in un
  componente client (dalla A15 lo intercetta anche il pre-push hook in
  locale, salvo skip esplicito o `.env.local` incompleta — vedi sopra); la
  suite e2e usa le variabili configurate come "Repository secrets" in
  GitHub — mai hardcoded nel workflow. Anche in CI devono puntare a un
  progetto Supabase di test, mai a quello di produzione.
- **PR "non codice" saltano gli step pesanti (issue #98)**: `ci.yml`
  NON usa `paths`/`paths-ignore` (renderebbe il check obbligatorio del
  ruleset di `main` "non eseguito" invece che "verde" su queste PR,
  bloccando il merge) — parte sempre, e un primo
  step (`node --experimental-strip-types scripts/classifica-pr.mts
  <baseSha> <headSha>`, che
  richiede `fetch-depth: 0` nel checkout) classifica la PR usando la
  logica pura di `lib/pr-classificazione.ts` ed espone l'output
  `is-non-codice-ci`. Se true (solo `docs/**`, `specs/**`,
  `README.md`, `CHANGELOG.md`, o un bump puro del campo `version` in
  `package.json`/`package-lock.json`), la build (passo 5) resta `skipped`
  nel log e il job `e2e` (passi 6-8) non parte, quindi la PR non occupa
  la coda del DB — tsc/lint/jscpd/vitest (economici, pochi secondi in
  totale) restano SEMPRE attivi, anche su queste PR. Stessa
  logica riusata in `.github/workflows/claude-board.yml`: il job `review`
  fa la stessa classificazione (con un'allow-list più stretta, che
  ESCLUDE `specs/**`: una PR che tocca solo `specs/` riceve comunque
  sempre una review, anche con un nuovo `## Scenario:`, per non dover
  analizzare il contenuto del diff riga per riga) e salta il solo step
  `claude-code-action` quando l'output `is-non-codice-review` è true —
  non l'intero job, perché `jobs.<id>.if` non può eseguire script. Nessuna
  dipendenza nuova: Node 22+ esegue nativamente `scripts/classifica-pr.mts`
  (file `.ts`, sintassi TypeScript "erasable" — solo tipi/interfacce). Il
  flag `--experimental-strip-types` è passato sulla riga di comando dei
  workflow (lo shebang del file conta solo eseguendolo direttamente). Nel
  dubbio è codice: se gli SHA mancano o `git diff` fallisce, lo step non
  fallisce e la PR è classificata "codice" (CI completa, review eseguita).
- **Il reset del DB di test prima della e2e (A23)** usa il Supabase CLI
  (`supabase db reset --project-ref <ref-test>`, ref letto dalla
  repository variable `SUPABASE_TEST_PROJECT_REF`, non un secret): riapplica
  tutte le migration da zero e poi lancia `supabase/seed.sql`, così ogni
  run parte da schema e seed noti. Il DB di test (`girasole_dev`) è
  condiviso tra CI e sviluppo locale di Matteo, non un progetto isolato:
  Matteo ha accettato esplicitamente che questo step cancelli e ricrei
  anche i suoi eventuali dati inseriti a mano in locale ad ogni run di CI
  (vedi `docs/programma-attivita.md`, voci A22/A23). Richiede il
  repository secret `SUPABASE_ACCESS_TOKEN` (token di accesso personale
  Supabase, non la password del database): se manca, questo passo fallisce
  — va creato da Matteo su
  https://supabase.com/dashboard/account/tokens e aggiunto con
  `gh secret set SUPABASE_ACCESS_TOKEN`.
- **Grant-check (A26, issue #28)**: passo 6b del job `e2e`, subito dopo il
  reset. `scripts/grant-check.mts` (logica pura in `lib/grantCheck.ts`)
  estrae dal codice le tabelle usate per ruolo (`authenticated` per i client
  utente, `service_role` per i client da `createAdminClient()`) e il
  privilegio (select/insert/update/delete/upsert), poi legge
  `information_schema.role_table_grants` sul DB di test via Management API
  (sola SELECT; ref da `SUPABASE_TEST_PROJECT_REF`, token da
  `SUPABASE_ACCESS_TOKEN`, mai la produzione). Fallisce con
  "GRANT mancante: <privilegio> su public.<tabella> per <ruolo>". I grant
  vivono nelle migration (non nel seed). Limiti dell'euristica: statica, non
  copre `anon`, non richiede il SELECT implicito di update/delete, non vede
  query costruite dinamicamente. Un parametro generico `SupabaseClient`
  (può ricevere client utente o admin) richiede il grant per ENTRAMBI i
  ruoli; se la funzione serve solo a codice server/cron, va attribuita a
  `service_role` con l'annotazione `// grant-check: service_role` subito
  sopra la funzione, o tipizzando `ReturnType<typeof createAdminClient>`,
  **non** concedendo il grant ad `authenticated`: ogni nuovo grant ad
  `authenticated` richiede verifica RLS. Il check è "anti
  permission-denied", non un controllo di sicurezza: non copre grant in
  eccesso, RLS né la produzione. L'annotazione `// grant-check:
  authenticated` fa l'opposto, per gli helper generici usati solo con la
  sessione utente. Se non estrae nessuna richiesta, esce con
  codice 2 (parser rotto). Localmente: stesso comando con le due
  variabili impostate sul progetto di test.
- **RLS-check (issue #131)**: passo 6c del job `e2e`, subito dopo il
  grant-check, stessa Management API e stessi secret (nessuno nuovo, ref solo
  da `SUPABASE_TEST_PROJECT_REF`, mai la produzione, sola SELECT).
  `scripts/rls-check.mts` (logica pura in `lib/rlsCheck.ts`) legge `pg_class`
  e fallisce se una tabella di `public` con privilegi per `authenticated` o
  `anon` ha `relrowsecurity = false`: il grant-check non lo vede. Il
  rimedio è abilitare la RLS e definire le policy in una migration, **mai**
  togliere il grant per far passare il check. Tabelle volutamente esposte
  senza RLS: `ALLOW_LIST_SENZA_RLS` in `lib/rlsCheck.ts`, oggi **vuota**;
  ogni voce va motivata e rivista da rls-guardian. Non verifica che le
  policy esistano o siano corrette (solo che la RLS sia attiva) né i grant
  in eccesso. Fail-closed: esce con codice 2 se una riga ha `grantee` né
  array né stringa o `rls` non booleano, se non legge tabelle o se manca
  `public.bambini` (DB non migrato o ref sbagliato). Conta anche i grant
  solo su colonne (`has_any_column_privilege`). **Limiti**:
  - una RLS attiva senza policy blocca tutto (fail-closed), ma una policy
    `USING (true)` passa il check: la correttezza delle policy resta a
    rls-guardian e alle e2e per ruolo;
  - viste, viste materializzate e tabelle esterne non sono coperte (una
    vista senza `security_invoker` scavalca la RLS; follow-up in issue);
  - solo lo schema `public` e i ruoli `anon`/`authenticated`; le funzioni
    `SECURITY DEFINER` esposte via RPC (es. `puo_richiedere_reset_password`)
    restano fuori;
  - privilegi TRUNCATE, REFERENCES e TRIGGER esclusi;
  - gira solo sul DB di test resettato: non vede la produzione (es.
    modifiche fatte dal pannello).
- **Coda del DB di test (issue #105, ADR-0008)**: `ci.yml` ha tre job,
  `statico` (passi 0-5) → `e2e` (passi 6-8) → `verifica`. Solo `e2e`
  usa il DB, e sta in un gruppo di concorrenza globale
  (`db-test-girasole-dev`, `cancel-in-progress: false`, `queue: max`):
  una e2e alla volta tra tutte le PR, le altre aspettano in ordine di
  arrivo (fino a 100 in attesa; senza `queue: max` GitHub ne terrebbe
  una sola e la terza cancellerebbe la seconda). I passi statici restano
  paralleli tra PR. `e2e` ricompila l'app (serve a `next start`) e non
  parte sulle PR "non codice" né su quelle di Dependabot.
  - Il check obbligatorio del ruleset di `main` resta `CI / verifica`:
    il job `verifica` gira sempre e passa solo se `statico` è verde e
    `e2e` è verde o saltato di proposito. Non rinominarlo.
  - Un nuovo push sulla stessa PR cancella ancora l'intero run
    precedente (gruppo per PR a livello di workflow), compreso il suo
    `e2e` in coda o in corso.
  - L'attesa in coda non conta nel `timeout-minutes` del job `e2e` (25
    min, solo esecuzione). Con più PR aperte la CI dura di più: ~11 min
    per ogni e2e davanti in coda.
  - Se un `e2e` viene cancellato mentre aspetta (coda piena, annullo a
    mano) e non c'è un run più recente per la PR, `verifica` resta
    rosso: "Re-run failed jobs" dalla pagina del run, oppure
    `gh run rerun <run-id> --failed`.
  - La coda vale solo tra run di CI: una sessione locale sullo stesso DB
    può ancora sovrapporsi (ADR-0006).

  ## Versioning
  - `VERSIONE_APP` e `DATA_BUILD` (`lib/versione.ts`, mostrate nel footer)
    sono derivate automaticamente a build-time in `next.config.mjs`, non
    più scritte a mano: `VERSIONE_APP` legge `package.json`, `DATA_BUILD`
    combina lo SHA del commit (`VERCEL_GIT_COMMIT_SHA` su Vercel, `git
    rev-parse HEAD` in locale) con il timestamp di build. Non toccare
    `lib/versione.ts` a mano ad ogni rilascio: resta un file di logica
    pura (`formattaDataBuild`, testata in `lib/versione.test.ts`), non
    più costanti da aggiornare.
  - Prima di ogni push su git effettuare comunque un bump di versione in
    `package.json`/`package-lock.json` (`npm version patch|minor|major`
    o a mano nei due file, tenendoli coerenti) — è l'unica fonte che
    alimenta `VERSIONE_APP`, quindi resta manuale.
  - La data di build non va più tracciata a mano: `DATA_BUILD` la deriva
    da sé ad ogni `next build`/`next dev` (vedi `next.config.mjs`).

## Token e cache delle esecuzioni Claude in CI (issue #119)
- Ogni job `triage`/`review` di `claude-board.yml` scrive nel **job
  summary** (pagina del run su GitHub Actions, sezione "Summary") una
  tabella con token di input, di output, letti dalla cache, scritti in
  cache, contesto totale, quota letta dalla cache, turni e costo. Lo
  produce `scripts/riepilogo-token-claude.mts` (logica in
  `lib/claude-usage.ts`) leggendo l'output di `claude-code-action`.
  Contiene solo contatori numerici, nessun secret né testo della sessione.
- Come leggerla: il "contesto totale" (input + letti + scritti in cache) è
  il numero da confrontare con la soglia di A32 (sessione tipica < 10k
  token di governance). Attenzione: comprende anche diff e file letti,
  non solo `CLAUDE.md`. Ogni esecuzione CI è una sessione nuova e la
  cache dura pochi minuti: la "quota letta dalla cache" cresce nei turni
  successivi della stessa esecuzione, non tra PR diverse.
- Il file JSON grezzo NON è pubblicato come artifact: il repo è pubblico
  e può contenere il testo della sessione. Nel summary ci sono solo
  contatori numerici.
- Se il riepilogo dice "nessun dato", lo step è stato saltato o il file non
  c'era (es. PR "non codice" senza review): non rende rosso il job.
