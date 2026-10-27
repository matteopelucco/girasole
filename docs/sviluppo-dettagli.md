# Dettagli di sviluppo (estesi)

Versione completa, con le motivazioni, delle regole riassunte in
`CLAUDE.md`. Leggere la sezione pertinente solo quando si tocca
quell'argomento (CI, pre-push, reset del DB, versioning, test).

Contesto operativo per Claude Code su questo progetto.

## Stack
- Next.js 16 (App Router, Server Actions, Server Components di default;
  build con Turbopack, il default di Next 16; `proxy.ts` al posto di
  `middleware.ts`, vedi [ADR 0010](adr/0010-next-16-proxy-e-eslint-cli.md))
- TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + Row Level Security) — client in `lib/supabase/`
- Deploy: Vercel
- Piani: **Pro** sia su Vercel sia su Supabase (da ottobre 2026; prima free
  tier/Hobby). I vincoli del piano free citati nello storico (es. il limite
  di 2 cron job di Vercel Hobby in `specs/07 - allarmi.md`) non valgono più
  come limite, restano solo come motivazione delle scelte fatte allora.

## Convenzioni
- UI e testi visibili all'utente in italiano. Nomi di variabili/funzioni/file in
  inglese, salvo le entità di dominio (`bambini`, `presenze`, `pasti`,
  `promemoria`, `sezioni`) che restano in italiano perché rispecchiano le
  tabelle del database.
- Preferire Server Components e Server Actions; usare Client Components
  (`'use client'`) solo dove serve interattività (form dinamici, toggle, ecc.).
- Non introdurre nuove dipendenze senza chiederlo prima — l'obiettivo è tenere
  il progetto leggero e sotto controllo (anche ora che i piani sono Pro).
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
- **Intestazione delle nuove migration** (issue #204): ogni nuova migration
  apre con questo commento standard, senza istruzioni di applicazione
  diverse:

  ```sql
  -- Girasole — <titolo> (specs/NN). Applicazione: in test con
  -- `supabase db push --project-ref <ref-test>`; in produzione solo Matteo,
  -- a mano, con `--project-ref` esplicito (mai SQL Editor, mai automazioni).
  -- Non incollare questo file nel SQL Editor.
  ```

  **Non copiare l'intestazione dell'ultima migration**: molte migration già
  applicate riportano ancora la vecchia frase "Incolla questo file nel SQL
  Editor (test e produzione)", superata e in contrasto con questa regola e
  con l'[ADR 0005](adr/0005-niente-automazioni-verso-la-produzione.md). Le
  migration già applicate non si riscrivono.
- Le policy RLS sono la difesa primaria dei dati, non un dettaglio: ogni nuova
  query deve rispettare i confini di ruolo (admin / maestra / genitore)
  descritti in `specs/`. Se una feature richiede una nuova policy, scrivila
  nella migration insieme alla tabella.
- **GRANT espliciti (issue #359)**: dal 30 ottobre 2026 Supabase non concede
  più da solo privilegi alle tabelle nuove di `public`: senza `GRANT`
  esplicito supabase-js/PostgREST rispondono «permission denied», anche su un
  `supabase db reset` o su un branch di anteprima. Regola: **ogni tabella nuova
  nasce col suo `GRANT` nella stessa migration, insieme alla policy RLS**, solo
  per i ruoli e i privilegi che l'app usa davvero:
  - `authenticated` per le query con la sessione dell'utente;
  - `service_role` per cron e codice che usa `createAdminClient()` (bypassa la
    RLS ma **non** i privilegi di tabella);
  - `anon` solo se serve davvero (oggi nessuna tabella: la sola chiamata anonima
    è la funzione `puo_richiedere_reset_password`);
  - mai `grant all`, mai `all tables in schema`; per le tabelle riservate,
    `revoke all ... from public, anon, authenticated, service_role` e poi i
    soli `grant` necessari (esempio: `0062_registro_invii_rojac.sql`).

  Se per una tabella già esistente cambia l'uso del codice (nuovo ruolo o
  nuovo privilegio), il `GRANT` va in una migration nuova (modello:
  `0066_grant_select_invii_rojac_service_role.sql`). Sequenze: non servono (le
  chiavi sono `uuid`). Funzioni: i privilegi `execute` restano quelli già
  decisi caso per caso (`revoke ... from public, anon` + `grant` mirato).
  Controllo automatico: `npm run check:grant-migrazioni` (parte di
  `npm run lint`, quindi nella CI statica (non nel pre-push); vedi «Grant-migrazioni-check»
  più avanti).

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

### Migration in produzione dopo il merge (issue #237)
- **Perché serve un passo esplicito**: il merge su `main` fa il deploy di
  Vercel da solo, ma le migration in produzione le applica Matteo a mano
  (ADR 0005). Tra le due cose c'è una finestra in cui il codice chiama
  funzioni o colonne che nel DB di produzione ancora non esistono. Il
  5 ottobre 2026 mancava la `0056` (RPC dei pasti Rojac) e la
  comunicazione dei pasti non funzionava: l'unico segnale era un
  `console.error` nei log di Vercel e, a schermo, «Ricarica la pagina».
- **Promemoria automatico**: sulle PR che toccano `supabase/migrations/**`
  il workflow `.github/workflows/promemoria-migration.yml` pubblica (una
  sola volta per PR) un commento con questi passi. Non ha secret, non si collega a
  nessun database, non applica nulla: è solo un avviso.
- **Procedura (solo Matteo, subito dopo il merge)**, sempre con
  `--project-ref <ref-produzione>` esplicito:
  1. `supabase db push --project-ref <ref-produzione> --dry-run`: elenca
     cosa verrebbe applicato, senza modificare nulla. Deve elencare
     **solo** le migration della PR appena mergiata.
  2. `supabase db push --project-ref <ref-produzione>`: le applica, in
     ordine di versione, e le registra nello storico.
  3. `supabase migration list --project-ref <ref-produzione>`: Local e
     Remote devono coincidere. Poi un dry-run finale deve rispondere
     «Remote database is up to date».
  4. Se la PR cambia anche il codice che usa la migration, provare la
     schermata coinvolta in produzione.
- **Mai dal SQL Editor**: `db push` confronta i file in
  `supabase/migrations/` con la tabella `supabase_migrations.schema_migrations`
  del DB, non con lo schema reale. Una migration incollata nel SQL Editor
  esiste nel DB ma non nello storico: il `db push` successivo la considera
  ancora da applicare (e la riesegue), e `migration list` e `--dry-run`
  non servono più a scoprire cosa manca. Il 5 ottobre 2026 in produzione lo
  storico era vuoto (tutte le `0001`–`0059` applicate a mano), quindi il
  dry-run elencava tutte e 59.
- **Se qualcuno ha già applicato a mano** (storico fuori allineamento):
  prima verificare che lo schema contenga davvero quelle migration, poi
  `supabase migration repair --status applied <versione> --project-ref
  <ref-produzione>` (più versioni nello stesso comando). Il comando scrive
  solo nella tabella dello storico, non esegue le migration; si fida di chi
  lo lancia, quindi non va usato per «far sparire» una migration mancante.
  Chiudere con `migration list` e un dry-run pulito.
- **Una migration già applicata non si modifica**: per cambiare qualcosa si
  scrive un file nuovo. Un file si può correggere solo se non è stato
  ancora applicato in nessun ambiente.

### Rilasci e tag (issue #32)
- **Cosa succede da solo**: a ogni merge su `main` che cambia `version` in
  `package.json` (cioè ogni PR, vedi bump di versione in CLAUDE.md), il
  workflow `.github/workflows/release.yml` crea il tag `vX.Y.Z` e una
  **GitHub Release** con le note generate dai commit convenzionali
  (raggruppati: breaking change, feat, fix, ...). Il changelog è la pagina
  *Releases* del repo. Nessun intervento manuale.
- **Come**: `scripts/rilascio.mts` legge la `version` a `github.event.before`
  e a `github.sha`; la logica pura (`decidiTag`, `generaNoteRilascio`) è in
  `lib/rilascio.ts`, con unit test. Le note coprono i commit dall'ultimo tag
  `v*` (o, al primo rilascio, dal solo push corrente): un merge senza bump
  non perde le sue modifiche, finiscono nella release successiva. I commit
  non convenzionali (storia precedente) finiscono sotto "Altro".
- **Permessi**: il workflow parte senza permessi; solo il job `rilascio` ha
  `contents: write`, usato da `gh release create` (tag + release via API, nessun
  `git push` e nessun commit su main). È un workflow a parte, dopo il merge:
  non fa parte del gate `CI / verifica` e non lo rallenta.
- **Perché non un `CHANGELOG.md` versionato**: aggiornarlo richiede un commit
  su `main` dopo il merge, che il ruleset (PR obbligatoria) impedisce e che
  non va aggirato; generarlo dentro ogni PR darebbe conflitti continui (tutte
  le PR toccano lo stesso punto del file). Se in futuro servisse, il file è già
  nell'allow-list "non codice" di `lib/pr-classificazione.ts`.
- **Se il tag manca** (workflow fallito o saltato): Actions → *Release* →
  *Run workflow* su `main` con `forza` attivo (crea la release per la versione
  attuale; è idempotente), oppure da terminale
  `gh workflow run release.yml --ref main -f forza=true`. Per una versione
  non più in testa: `gh release create vX.Y.Z --target <sha> --generate-notes`.
  Il tag non si ricrea mai a mano con `git tag` + `git push` su `main`.

## Analisi statica prima di ogni push
- Un git hook `pre-push` (`.githooks/pre-push`, attivato in automatico
  da `npm install` tramite lo script `prepare` in `package.json`, che
  imposta `core.hooksPath`) lancia type-check (`tsc --noEmit`), ESLint
  (`eslint .`, configurato in `eslint.config.mjs` con
  `eslint-config-next/core-web-vitals`: `next lint` non esiste più da
  Next 16),
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
  unit test + duplicati + click e2e + pulsanti/campi copiati, `check:ui`; per il type-check separato, `npx next typegen`
  e poi `npx tsc --noEmit`; per la build, `npm run build`).
- `next-env.d.ts` non è versionato (è in `.gitignore`): Next lo riscrive
  a ogni build e sporcava le PR. Lo crea, insieme ai tipi delle rotte in
  `.next/types/` richiesti da `tsconfig.json`, `npx next typegen` (comando
  ufficiale di Next dalla 15.5, senza build completa). Per questo il job `statico`
  della CI e l'hook `pre-push` lo lanciano prima di `tsc`; su un clone nuovo
  senza quel passo `tsc` non trova i tipi (la build li crea da sola).
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
- **Quali test e2e sono saltati, e perché (issue #176)**: nella pagina del
  run di CI, job `e2e`, sezione *Summary*, il riepilogo "Test e2e saltati"
  elenca file, titolo e motivo di ogni skip più il totale per motivo. In CI
  Playwright scrive anche `playwright-json/report.json` (reporter `json`);
  lo legge `scripts/riepilogo-skip-e2e.mts` (logica pura in
  `lib/playwright-skip-riepilogo.ts`). Lo step è informativo e non fa mai
  fallire il job. Il motivo è la descrizione di `test.skip(cond, 'motivo')`:
  scrivila sempre, o comparirà "motivo non indicato".
- **Invio email simulato (`EMAIL_DRY_RUN`, issue #387)**: in CI non c'è
  `RESEND_API_KEY`, ma lo step «Test end-to-end» imposta `EMAIL_DRY_RUN=1`:
  `inviaEmail` (`lib/email.ts`) ritorna con successo senza chiamare Resend e
  senza scrivere nei log destinatario, oggetto o testo (solo "Invio email
  simulato"). Così i test che inviano mail (e2e 07, 52, 56, 59, 61, 62, 63,
  64) girano davvero. Un test che ha bisogno dell'invio si salta con
  `test.skip(!emailDisponibile(), 'motivo')` (`e2e/helpers.ts`: vero se c'è la
  chiave o l'invio simulato): non scrivere `process.env.RESEND_API_KEY` nei
  file. I test che provano l'**errore** dell'invio si saltano invece quando
  `emailDisponibile()` è vero. In produzione (`VERCEL_ENV=production`) la
  variabile si ignora, con un avviso nei log (logica pura:
  `modalitaInvioEmail`, test in `lib/email.test.ts`): non va mai impostata su
  Vercel. Resta fuori dalla pagina «Variabili d'ambiente» (specs/62). Un test
  che richiedesse una chiave vera dovrebbe controllare `RESEND_API_KEY`
  direttamente (oggi nessuno lo fa). I test dei cron richiedono anche
  `CRON_SECRET`: la CI imposta un valore finto nel passo Playwright (il server
  di prova gira solo sul runner, nessun Repository secret); quello vero sta solo su Vercel.
- Ogni salvataggio seguito da `reload`/`goto`/lettura di un valore
  calcolato dal server deve usare `clickEAttendiAzione`
  (`e2e/helpers.ts`); i valori calcolati dal server si leggono con
  `expect.poll` per attendere il calcolo asincrono.
- **Regole anti-flaky (issue #77, #174)**, valide anche per i test nuovi:
  1. Ogni bottone che avvia una Server Action (Salva, Registra, Aggiorna,
     Assegna, Invia, Annulla invio...) si clicca con `clickEAttendiAzione`,
     mai con `.click()` seguito da `reload`/`goto`. Eccezione: se il click
     non lancia nessuna azione (popup nativo rifiutato, validazione `required`
     del browser), `clickEAttendiAzione` resterebbe in attesa per sempre:
     si usa `.click()` e si asserisce l'effetto (es. `input:invalid`).
  2. Un valore calcolato dal server (saldo, totali, differenza ore) non si
     legge con `expect(await leggi()).toBe(...)` ma con
     `await expect.poll(leggi).toBe(...)`: la pagina si aggiorna dopo la
     risposta dell'azione, non insieme a essa.
  3. Niente `page.waitForTimeout(...)`: si attende l'esito (URL, elemento,
     risposta dell'azione, segnale esposto dall'app come
     `data-barra-caricamento-pronta`). Per un controllo "non compare nulla"
     dopo un click si attende un evento (es. due `requestAnimationFrame`),
     non un ritardo fisso.
  4. Dati propri con le fixture `bambino`/`utente`, selettori nei file
     `e2e/pagina-*.ts` (vedi sotto).
- **Dati propri per test (issue #228, #172)**: un test che scrive su un
  bambino non usa quelli del seed ma la fixture `bambino` di
  `e2e/fixture-bambino.ts` (`test.extend`): crea un bambino con nome unico
  `E2eFx...` nella sezione fixture e lo elimina a fine test, anche se
  fallisce. Usa la chiave anon con il login dell'admin di test (RLS
  applicata), mai la service_role. Per un gruppo di test in sequenza con
  stato condiviso (06) si usano `creaBambinoFixture`/`eliminaBambinoFixture`
  in `beforeAll`/`afterAll`. Documentazione completa in testa al file.
- **Utente di staff proprio (issue #230, #172)**: un test che accende un
  flag di un account (es. "Ore di lavoro", profilo orario) non usa gli
  account condivisi (admin, maestra) ma la fixture `e2e/fixture-utente.ts`:
  `creaUtente({ ruolo, abilitato })` crea dalla schermata /admin/maestre un
  utente con email unica `e2e-fx-...@example.com`, `apriComeUtente(utente)`
  ne apre la sessione in un contesto a parte, e a fine test (anche se
  fallisce) l'utente viene eliminato con tutti i suoi dati (ore, monte ore).
  Nessuna service_role negli e2e. Così gli account condivisi restano sempre
  "senza abilitazione" e i test che lo verificano sono deterministici. Del
  progetto `chromium-stato-condiviso` (un solo worker) restano 06, 13 e 16
  (presenze e pasti di oggi; 16 legge lo stato globale della giornata e non
  può avere dati propri).
- **Helper per pagina (issue #249, #173)**: i selettori della schermata
  "Presenze e pasti" stanno in `e2e/pagina-giornata.ts` (card, pulsanti di
  presenza e pasto, nota, riepilogo, banner Rojac, classi di stato); i
  test non ripetono `getByRole('group', { name: 'Presenza' })` e simili:
  se un'etichetta cambia, si corregge lì. `e2e/helpers.ts` tiene solo
  quanto è generico (login, a11y, date, `clickEAttendiAzione`).
  Analogamente (issue #250, #173) l'amministrazione del personale sta in
  `e2e/pagina-personale.ts`: utenti di `/admin/maestre` (form di creazione,
  riga/scheda, spunta "Ore di lavoro", profilo orario), profili orari
  (creazione, apertura, eliminazione) e campi del report ore
  (`campoGiorno(page, 'Differenza ore', 'Lunedì')`, pulsanti di
  salvataggio/conferma, navigazione tra settimane). La fixture
  `e2e/fixture-utente.ts` usa lo stesso form di creazione.

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

### pgTAP — policy RLS per ruolo (issue #29/#180)
- Le RLS si verificano con un Postgres reale: `supabase/tests/database/<tabella>.test.sql`, un file per tabella, tutto in `begin; ... select * from finish(); rollback;` così non resta nessun dato. Modello: `profili_orari.test.sql`.
- Per aggiungere un test: copia gli helper in testa (`pg_temp.ids_as(uuid)` esegue la select impersonando un `authenticated` con `sub` per `auth.uid()`, o l'anonimo se `null`, poi torna al ruolo di partenza e restituisce il risultato; `pg_temp.write_as(uuid, sql)` fa lo stesso per le scritture e restituisce lo SQLSTATE), crea gli utenti fittizi (`@example.test`) con un `insert into auth.users` (il trigger crea il profilo dal `ruolo` in `raw_user_meta_data`) e confronta i risultati con `is(...)`. Aggiorna `select plan(N)`. Le funzioni pgTAP girano sempre col ruolo di partenza, mai da `authenticated`/`anon`.
- File presenti (issue #180/#181): `profili_orari.test.sql`, `presenze.test.sql`, `pasti.test.sql`. In questi ultimi due `write_as` restituisce il numero di righe toccate (`'1'`, o `'0'` quando la RLS riduce UPDATE/DELETE a zero righe) oppure lo SQLSTATE.
- Scritture "di oggi" dello staff: il trigger di chiusura di `presenze`/`pasti` (0022) rifiuta sabato, domenica e giorni in `giorni_chiusura`, quindi l'esito dipenderebbe dal giorno in cui gira la CI. I due file lo verificano una volta su un sabato fisso (2030-03-16), poi lo disattivano nella transazione (`alter table ... disable trigger`, ripristinato dal rollback) e misurano la sola RLS; fixture storiche su un feriale fisso (2030-03-12), fixture "di oggi" su `oggi_roma()`.
- Un test RLS deve provare anche il "negativo": una RLS che nega non dà errore ma zero righe, quindi asserisci i conteggi esatti (e, per un bug, `drop policy` dentro la transazione e verifica che il risultato cambi).
- pgTAP sul progetto di test è già installato nello schema `extensions`, che non è nel `search_path` della connessione di `pg_prove`: senza rimedio `plan()`/`is()`/`finish()` danno "function plan(integer) does not exist".
  Per questo ogni file, dopo `create extension if not exists pgtap with schema extensions`, legge dal catalogo lo schema di pgTAP e fa `set local search_path` (blocco `do` in testa a `profili_orari.test.sql`): copialo così com'è.
  Il login role temporaneo della CLI remota può non ereditare USAGE su quello schema: il file prova `set local role postgres` e stampa un `DIAG[...]` (ruolo, search_path, schema, USAGE, funzioni `plan`) nel log, utile se `plan()` non si risolve.
- Non eseguire `supabase test db --linked` a mano: in CI gira nel job `e2e`, step "6a", subito dopo il reset del DB di test (stesso `--project-ref`, mai la produzione).
- Esito: lo step è rosso se un `ok`/`is` fallisce; nel log del job le righe `not ok N - descrizione` con `Failed test` indicano quale asserzione e perché (atteso/ottenuto). Riga finale `Result: PASS`/`FAIL`.

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
  `is-non-codice-ci`. Se true (solo `docs/**`, `specs/**`, `CLAUDE.md`,
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
- **Grant-migrazioni-check (issue #359)**: complemento statico del
  grant-check, senza DB né secret. Il grant-check legge il DB di test, dove i
  privilegi di default di Supabase possono nascondere un `GRANT` mai scritto
  nelle migration (dopo il 30 ottobre 2026 il default non c'è più e un
  `supabase db reset` si romperebbe). `scripts/grant-migrazioni-check.mts`
  (logica pura in `lib/grantMigrazioni.ts`, test in
  `lib/grantMigrazioni.test.ts`) ricostruisce dai file SQL i `GRANT` espliciti
  per tabella e ruolo (applicando `drop`, `rename` e `revoke` in ordine) e
  fallisce se (1) una tabella di `public` non ha nessun `GRANT` a
  `authenticated`/`service_role`, salvo `TABELLE_SENZA_GRANT_AMMESSE` (oggi solo
  `tentativi_reset_password`, accessibile solo dalla funzione security
  definer), oppure (2) il codice (stessa estrazione del grant-check, quindi
  stesse annotazioni `// grant-check:`) usa una tabella con un ruolo/privilegio
  non concesso nelle migration. Limiti: euristica sul testo SQL, non copre
  `anon`, i `GRANT` fuori dalle migration (vietati) né la RLS; un `GRANT` di
  colonna conta come privilegio di tabella. È agganciato a `npm run lint`.
  **Cosa non simula**: la CI non può togliere i privilegi di default del
  progetto di test condiviso senza modificarne la configurazione; la garanzia
  che il `db reset` regga senza default è questo controllo statico, più il
  grant-check e le e2e reali dopo il reset.
- **RLS-check (issue #131)**: passo 6c del job `e2e`, subito dopo il
  grant-check, stessa Management API e stessi secret (nessuno nuovo, ref solo
  da `SUPABASE_TEST_PROJECT_REF`, mai la produzione, sola SELECT).
  `scripts/rls-check.mts` (logica pura in `lib/rlsCheck.ts`) legge `pg_class`
  e fallisce se una tabella di `public` con privilegi per `authenticated` o
  `anon` ha `relrowsecurity = false`: il grant-check non lo vede. Il
  rimedio è abilitare la RLS e definire le policy in una migration, **mai**
  togliere il grant per far passare il check. Tabelle volutamente esposte
  senza RLS: `ALLOW_LIST_SENZA_RLS` in `lib/rlsCheck.ts`, oggi **vuota**;
  ogni voce va motivata e rivista da rls-guardian. Dall'issue #133 il
  check copre anche gli altri oggetti di `public` (`pg_class.relkind`),
  sempre con privilegi per `authenticated`/`anon`:
  - **vista** (`v`): fallisce se non ha `security_invoker = true` in
    `pg_class.reloptions` (senza, gira coi diritti del proprietario e
    scavalca la RLS delle tabelle sottostanti); accettati i valori
    booleani di Postgres (`true`, `on`, `yes`, `1`, …), vale l'ultima
    occorrenza e ogni altro valore conta come falso;
  - **vista materializzata** (`m`) e **tabella esterna** (`f`): falliscono
    sempre, perché non hanno RLS e `security_invoker` non le riguarda;
  - rimedio: `security_invoker = true` (`CREATE VIEW ... WITH
    (security_invoker = true)` o `ALTER VIEW ... SET (...)`) oppure
    togliere il grant (qui sì, perché l'oggetto non può avere RLS); le
    eccezioni vanno in `ALLOW_LIST_ESPOSTI_SENZA_RLS` (in
    `lib/rlsCheck.ts`, oggi **vuota**, ogni voce motivata e rivista da
    rls-guardian). Nessuna migration crea oggi viste: il controllo
    previene il caso futuro.
  Non verifica che le
  policy esistano o siano corrette (solo che la RLS sia attiva) né i grant
  in eccesso. Fail-closed: esce con codice 2 se una riga ha `grantee` né
  array né stringa, `rls` non booleano, `relkind` sconosciuto o `reloptions`
  illeggibili (`null`/assenti valgono "nessuna opzione", quindi una vista
  viene segnalata), se non legge oggetti o se manca la tabella
  `public.bambini` (DB non migrato o ref sbagliato). Conta anche i grant
  solo su colonne (`has_any_column_privilege`). **Limiti**:
  - una RLS attiva senza policy blocca tutto (fail-closed), ma una policy
    `USING (true)` passa il check: la correttezza delle policy resta a
    rls-guardian e alle e2e per ruolo;
  - solo lo schema `public` e i ruoli `anon`/`authenticated`; le funzioni
    `SECURITY DEFINER` esposte via RPC (es. `puo_richiedere_reset_password`)
    restano fuori;
  - privilegi TRUNCATE, REFERENCES e TRIGGER esclusi;
  - gira solo sul DB di test resettato: non vede la produzione (es.
    modifiche fatte dal pannello).
- **Service-role-check (issue #214, ADR-0002)**: `npm run check:service-role`
  (`scripts/service-role-check.mts`, logica pura in `lib/serviceRoleCheck.ts`)
  fallisce, con file e riga, se `createAdminClient`, l'import di
  `lib/supabase/admin` o `SUPABASE_SERVICE_ROLE_KEY` compaiono fuori da
  `FILE_AMMESSI` (factory, cron e librerie del cron, gestione utenti, script,
  e2e, test). È concatenato a `npm run lint` (quindi nel passo 2 dello
  `statico`, in `npm run analyze` e, come passo a sé, nel pre-push): nessun
  DB, rete o secret. Per ammettere un'eccezione: nuova voce in `FILE_AMMESSI`
  con motivazione + aggiornamento di ADR-0002, con review umana.
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

## Giro di fumo sull'anteprima di Vercel (issue #267)
Secondo controllo, **separato dall'e2e** di `ci.yml` e **non bloccante**:
dopo il deploy di anteprima di Vercel, Playwright prova l'app vera, quella
che Vercel serve, dove l'e2e di CI vede solo un `next start` locale. Serve
a vedere un'anteprima rotta (variabili d'ambiente Vercel, build, collegamento
al DB) prima del merge. Decisioni di Matteo: anteprime non protette (niente
chiave di bypass), controllo non obbligatorio, mai insieme a un'altra e2e.
Motivazioni in [ADR-0009](adr/0009-giro-di-fumo-sull-anteprima-vercel.md).

- **Cosa fa**: workflow `.github/workflows/anteprima-fumo.yml`, evento
  `deployment_status` (stato `success`, ambiente `Preview`). Cinque test in
  `e2e-anteprima/fumo.spec.ts` (config dedicata
  `playwright.anteprima.config.ts`, `testDir` e cartelle di report/output
  proprie): anonimo (login visibile, pagine protette rimandano al login);
  admin, maestra, assistente, genitore (login vero, pagine principali senza
  errori né schermate vuote, uscita). Admin, maestra e assistente salvano
  anche un avviso `Fumo anteprima <ruolo> <tempo>` e lo cancellano nello
  stesso test; il genitore è in sola lettura e deve restare fuori da
  `/admin` e dalle pagine dello staff. Su ogni pagina: nessun `console.error`,
  nessun errore JS non gestito, nessuna risposta 5xx, axe-core senza
  violazioni gravi (`nessunaViolazioneA11yGrave`, importato da
  `e2e/helpers.ts` senza modificarlo). Credenziali mancanti = test rosso
  (nel fumo uno skip sarebbe un falso verde).
- **Non tocca l'e2e**: cartella, config, report e output sono separati; la
  regola `specs/NN` <-> `e2e/NN` riguarda solo `e2e/`. Nessun `spec` per il
  giro (è infrastruttura di CI). `npm run analyze`, `jscpd`, lint, `tsc` e
  `vitest` non cambiano: `tsc` compila anche la nuova cartella, gli altri
  controlli guardano solo `app/`, `components/`, `lib/`.
- **Guardia (prima di toccare i secret)**: il job `guardia` usa la logica
  pura `lib/guardiaAnteprima.ts` (unit test co-locati) tramite
  `scripts/guardia-anteprima.mts`. Rifiuta, con un errore chiaro: stato
  diverso da `success`; ambiente diverso da `Preview`; indirizzo che non sia
  `https://girasole-<...>.vercel.app` (quindi non la produzione
  `girasole.vercel.app`, non l'indirizzo di ramo di `main`, non altri domini,
  non altri progetti Vercel, non credenziali/porte nell'indirizzo); commit
  senza nessuna PR di questo repository o con una PR che arriva da un fork.
  La logica della guardia viene dal ramo principale, non dal commit
  dell'anteprima. La stessa verifica sull'indirizzo gira anche in
  `playwright.anteprima.config.ts`: un giro lanciato a mano contro la
  produzione o `localhost` si ferma subito.
- **Coda del DB**: il job `fumo` sta nel gruppo `db-test-girasole-dev`
  (`cancel-in-progress: false`, `queue: max`), lo stesso del job `e2e` di
  `ci.yml` (ADR-0008): non interrompe né fa cancellare nessuna e2e, e
  aspetta se ne sta girando una. Solo `fumo` entra nella coda: `guardia`
  no. Non reimposta il DB.
- **Secret**: solo gli otto `E2E_<RUOLO>_EMAIL/PASSWORD` di admin, maestra,
  assistente, genitore. Niente `service_role`, niente token Supabase. Gli
  account li ricrea la CI e2e dopo ogni reset del DB (`scripts/crea-utenti-e2e.mjs`):
  il giro di fumo **non** li ricrea (servirebbe la `service_role`). Se il
  login è rifiutato, il test dice di controllare che l'anteprima punti al DB
  di test e che la CI e2e abbia girato dopo l'ultimo reset. Gli account
  esistono solo nel DB di test: contro un'anteprima che puntasse per errore
  al DB di produzione, il login fallirebbe.
- **Dati di prova**: avvisi `Fumo anteprima <ruolo> ...`, cancellati a fine
  test (anche se il test fallisce). A inizio test ogni ruolo cancella anche
  i propri residui di un giro precedente (solo quelli con il proprio ruolo
  nel nome: i test girano in parallelo). Se un worker muore a metà, l'avviso
  orfano è innocuo e lo azzera il reset del DB di test della prossima CI
  (ADR-0006).
- **Cosa conta come errore**: dopo "Pubblica avviso" il test cerca solo
  `role="alert"` dentro il form e popup bloccanti (`alertdialog`). La
  dashboard mostra anche riquadri di prodotto con `role="alert"` (rette non
  inviate, presenze, ore) che dipendono dai dati del DB di test condiviso: non
  sono errori e il test non li conta (issue #310).
- **Navigazione al dettaglio**: il test clicca il link dell'avviso e non usa
  `goto`; se la pagina non arriva al dettaglio è un difetto dell'app da
  riportare, non da aggirare nel test.
- **Dove si vede l'esito**: tab Actions, workflow "Anteprima fumo", una run
  per ogni deploy di anteprima riuscito; il report HTML di Playwright è
  l'artifact `anteprima-fumo-report` (14 giorni). Non compare tra i check
  della PR come blocco.
- **Come si rilancia**: dalla pagina della run, "Re-run all jobs" (o
  `gh run rerun <run-id>`); oppure fa un nuovo push sulla PR (nuovo
  deploy, nuova run). A mano in locale, con le `E2E_*` in `.env.local`:
  `ANTEPRIMA_URL=https://girasole-... npm run test:anteprima`.
- **Come si rende obbligatorio**: oggi il workflow non è nel ruleset di
  `main`, quindi non blocca. Per renderlo bloccante: (1) stabilizzare il
  giro (alcune run di fila verdi); (2) il check da richiedere sarebbe
  `Anteprima fumo / fumo`, ma `deployment_status` crea il check sul commit
  del deploy e arriva dopo il deploy: un check richiesto che non arriva mai
  (deploy fallito, PR "non codice") blocca il merge, come ricorda
  `ci.yml` per `CI / verifica`. Prima di aggiungerlo al ruleset conviene
  quindi un job-gate che passi anche quando il fumo non parte, o spostare il
  giro dentro `ci.yml` aspettando il deploy. Decisione da rivedere con
  Matteo: non è in scope della #267.
- **Limiti da conoscere**: (a) `deployment_status` parte solo da un workflow
  presente su `main`: la prima run reale arriva **dopo il merge** della PR
  che lo introduce; (b) se la run del fumo parte prima della CI e2e della
  stessa PR e la PR contiene una migration, l'anteprima può parlare con uno
  schema del DB di test ancora vecchio: un rosso in quel caso va riletto
  dopo l'e2e (rilancio); (c) il nome dell'ambiente `Preview` è quello che
  Vercel dà alle anteprime (con più progetti diventa `Preview – <progetto>`,
  accettato): se alla prima run non parte nulla, controllare il nome
  dell'ambiente nella tab Deployments del repo; (d) le variabili d'ambiente
  "Preview" di Vercel devono puntare al progetto Supabase di **test**.

## Confronto visivo delle pagine (issue #333)
Rete di sicurezza **locale** per la revisione grafica ("UX REVIEW"): foto
delle pagine principali prima di una modifica, confronto dopo. Non è l'e2e,
non risponde a nessuno `specs/NN` (la regola `specs/NN` <-> `e2e/NN` riguarda
solo `e2e/`) e **non fa parte della CI** né di `npx playwright test`: sta in
`e2e-confronto-visivo/` con la config `playwright.confronto-visivo.config.ts`
(che si rifiuta di partire se `CI` è impostata).

- **Prima della modifica**: `npm run test:visivo:riferimento` salva 15 pagine
  x 2 misure (telefono 390 px, desktop 1280 px) = 30 foto, a pagina intera.
- **Dopo la modifica**: `npm run test:visivo` rifà le foto e le confronta;
  qualunque pixel diverso è un rosso. Le differenze si vedono nel report:
  `npx playwright show-report confronto-visivo/report` (atteso / attuale /
  differenza, con cursore); i file stanno anche in `confronto-visivo/differenze/`.
  Se la differenza è voluta, rilanciare il comando di riferimento per
  aggiornare le foto.
- **Condizioni**: `E2E_ADMIN_EMAIL/PASSWORD` in `.env.local` (login come admin,
  mai credenziali nel repo; senza, il giro fallisce); server `next dev` (parte
  da solo, o si riusa quello acceso: usare lo **stesso tipo di server** per
  riferimento e confronto); DB di test. Il primo giro a freddo può cadere nel
  login mentre Next compila: rilanciare.
- **Mai durante una e2e sul DB di test condiviso**: prima controllare
  `gh run list --status in_progress` (e che nessuna e2e locale sia in corso).
  Il giro non scrive nulla, ma il login crea sessioni e un reset del DB a metà
  darebbe foto false.
- **Immagini**: la cartella `confronto-visivo/` è in `.gitignore`, non si
  committa. Contengono solo i dati del DB di test (mai dati reali).
- **Rumore da tenere presente**: il piè di pagina (versione e data di build) è
  coperto; le pagine che mostrano "oggi", orari o lanci recenti cambiano da
  un giorno all'altro. Riferimento e confronto vanno fatti a poca distanza,
  sullo stesso DB. Le pagine sono: accesso, dashboard, giornata, report
  (giornaliero, mensile), ore di lavoro, calendario (attività, chiusure),
  amministrazione, cron job, azioni, rette, maestre, parametri di
  funzionamento, impostazioni avanzate. Anche i caratteri contano: se
  `next dev` non riesce a scaricare Poppins/Open Sans da Google Fonts usa
  un carattere di ripiego, e foto e confronto vanno fatti nelle stesse
  condizioni di rete.

## Tailwind 4 (issue #334)
Dal passaggio a Tailwind 4 non c'è più `tailwind.config.ts`: tema e font stanno
in `app/globals.css` (`@theme`), la scansione dei sorgenti (compreso `lib/`) è
automatica, e il plugin PostCSS è `@tailwindcss/postcss` (senza `autoprefixer`).
Per restare identici alla versione 3, `globals.css` ridefinisce in esadecimale la
palette di Tailwind 3 (solo le famiglie usate; un colore di una famiglia nuova
va copiato da `tailwindcss@3.4`, `colors.js`) e ripristina i valori predefiniti
che la 4 ha cambiato (colore dei bordi, cursore dei pulsanti, segnaposto,
sfondo dei campi, margini interni di celle, voci dei menu e campo data). La
palette di Tailwind 4 è `oklch(...)` e darebbe colori calcolati diversi da quelli
che leggono le e2e (`rgb(...)`). Differenza che resta: `space-y-*` e `divide-y`
cambiano lato del margine/bordo (vedi la PR #334 per i punti toccati).

## Componenti di `components/ui/` (issue #337)
Decisione e motivi: [ADR 0011](adr/0011-libreria-componenti-shadcn.md). I
componenti sono quelli di **shadcn/ui**, copiati nel repo (non un pacchetto) e
stilati con i token di `app/globals.css` (sezione "Sistema grafico" di
`specs/01 - ux.md`).

- **Cosa c'è oggi**: la cartella `components/ui/` contiene solo `.gitkeep`
  (nessun componente ancora) e l'helper `cn` sta in `lib/utils.ts` (unisce
  classi e risolve i conflitti di Tailwind: `cn('p-2', 'p-4')` dà `p-4`). I
  componenti veri (pulsante, campo, etichetta, riquadro, finestra...) arrivano
  con le issue successive della serie "UX REVIEW"; quando arrivano, questo
  elenco si aggiorna nella stessa PR.
- **Finestre di dialogo** (issue #342): `components/ui/finestra.tsx` è la
  `Finestra` unica (EliminaUtente, InvioEmailRojac, InvioSingoloRetta,
  VerificaBonifico, DialogErrore). Usa il `<dialog>` nativo e non Radix, per
  scelta: una finestra "portata" in fondo al body uscirebbe dal `<form>` che la
  contiene e i suoi pulsanti di invio (es. "Conferma invio" nella tabella delle
  rette) non invierebbero più; in più non pesa nulla nel browser. Si monta solo
  quando serve (`{aperta && <Finestra …>}`) e si chiude in `onChiudi`.
- **Etichette, riquadri, avvisi, stato vuoto** (issue #340): `etichetta-pillola.tsx`
  (`EtichettaPillola`), `riquadro.tsx` (`Riquadro`), `avviso.tsx` (`Avviso`,
  `role="alert"` solo per l'errore) e `stato-vuoto.tsx` (`StatoVuoto`). Dettagli e
  valori scelti in `specs/01 - ux.md`.
- **Tabella** (issue #341): `tabella.tsx` (`Tabella`, `TabellaRiga`,
  `TabellaTitolo`, `TabellaCella`, `TabellaScorrevole`...). Per una nuova
  tabella dati si usano questi pezzi, non `<table>`: `scope` e `<caption>` li
  scrive la pagina. Dettagli in `specs/01 - ux.md`.
- **Quando usarli**: ogni volta che serve un pulsante, un campo, un'etichetta di
  stato, una tabella, un riquadro di avviso o una finestra di dialogo, si importa il
  componente da `@/components/ui/...`.
- **Regola**: niente nuove stringhe di classi per pulsanti e campi fuori da
  `components/ui/`. Se manca una variante, si aggiunge al componente (con
  `class-variance-authority`), non si copia una stringa nella pagina. Le
  schermate non ancora migrate restano come sono finché non le riprende la
  loro issue. I pulsanti di stato Presente/Assente/Sì/No hanno il loro
  componente (`pulsante-stato.tsx`, issue #350).
- **Controllo automatico** (issue #351): `npm run check:ui`
  (`scripts/controlla-ui.mts`, logica pura in `lib/controlloUi.ts`) fallisce,
  con file e riga, se in `app/`, `components/` o `lib/` (fuori da
  `components/ui/`) compare la combinazione tipica di un pulsante (tinta piena
  con `px-*` `py-*`, o bordo grigio e `bg-white` con padding) o di un campo
  (`border-stone-300` con `focus:border-*`). È in `npm run analyze` e nel
  pre-push; nessun DB, rete o secret. Le schermate non ancora migrate sono
  nell'elenco `ECCEZIONI` di `lib/controlloUi.ts`, ognuna con il motivo: per
  toglierne una si sostituiscono le classi con `Pulsante`/`Campo`, e il
  controllo stesso avvisa quando una voce non serve più. Una voce nuova è una
  decisione da review umana, non una scorciatoia.
- **Colori e misure**: solo i token di significato (`bg-primary`, `text-danger`,
  `rounded-base`...), mai le tinte della palette. Non si ridefiniscono
  `--radius-sm/md/lg/xl`.
- **Come aggiungere un componente**:
  1. Prima la spec e il test, come per ogni altra cosa (ciclo test-first).
  2. Copiarlo con il CLI senza installarlo nel progetto:
     `npx shadcn@latest add <nome>` (usa `components.json`; scrive in
     `components/ui/`). In alternativa, copiare a mano il sorgente dal sito di
     shadcn/ui.
  3. Rivedere la differenza **prima di committare**: il CLI può riscrivere
     `app/globals.css` o aggiungere dipendenze. Tenere solo quello che serve.
     Non devono cambiare i token esistenti, né `--radius-*`.
  4. Usare la variante **Radix** (pacchetto `radix-ui`). `@base-ui/react` non è
     approvata: se il componente la importa, non va bene così.
  5. **Icone**: `lucide-react` non è approvata, anche se `components.json` ha
     `iconLibrary: lucide` e il sorgente copiato la importa. Sostituire le icone
     con quelle di `components/icone.tsx` (aggiungendone una lì se manca;
     sempre decorative, `aria-hidden`).
  6. Controllare le dipendenze del componente: sono ammesse solo `clsx`,
     `tailwind-merge`, `class-variance-authority`, `tw-animate-css` e
     `radix-ui`. Altre vanno chieste a Matteo.
  7. Se serve un colore nuovo, entra come token in `@theme`
     (`app/globals.css`) e nella tabella della spec, non come tinta nel
     componente.
  8. Migrando una schermata, nome accessibile, ruolo, `data-testid` e struttura
     dei contenitori non cambiano (le e2e usano `getByRole`, `getByLabel`,
     `locator('..')`). Le e2e e il controllo axe-core della pagina restano verdi
     e, per le schermate esistenti, `npm run test:visivo` mostra l'eventuale
     differenza di aspetto (vedi "Confronto visivo").
- **Aggiornamenti**: i componenti copiati non si aggiornano da soli. Per
  riprendere una correzione di shadcn/ui si rilancia `npx shadcn@latest add
  <nome> --overwrite` e si rivede la differenza, tenendo le modifiche locali
  volute.

## Review automatica di Claude in CI: interruttore (issue #160)
- Il job `review` di `claude-board.yml` (review di ogni PR con Sonnet) è
  **spento di default** per costo: parte solo se la variabile di repository
  `CLAUDE_REVIEW_ENABLED` vale `true`. Senza la variabile il job risulta
  **skipped** (non rosso) e non chiama Anthropic.
- Riattivarla: GitHub → Settings → Secrets and variables → Actions →
  **Variables** → New repository variable `CLAUDE_REVIEW_ENABLED` =
  `true`. Spegnerla di nuovo: eliminare la variabile o metterla a
  qualunque altro valore. Non serve modificare il codice.
- Richiede un `ANTHROPIC_API_KEY` valido e con credito (con la chiave non
  valida il job fallisce subito, `is_error: true`, senza chiamare il
  modello).
- Il job `triage` (Haiku, su issue aperta) e `chiusura-issue` (nessun
  modello) non sono toccati.
- Al posto della review automatica: review a richiesta in locale (issue
  #161, comando `/task-review`).

## Review a richiesta in locale: `/task-review` (issue #161)
Comando di Claude Code (`.claude/commands/task-review.md`), accanto a
`/next-task` e `/run-tasks`: `/task-review #157` (issue o PR; `--leggera` per PR piccole).
- **Fa**: trova la PR (da issue: branch `*/issue-N-*`, `Closes #N`, ricerca;
  da PR: diretta), legge issue, `specs/` pertinenti, diff e CI, lancia l'agente
  `reviewer` e produce in chat verdetto (OK / OK con rilievi / da correggere),
  rilievi `[severità] file:riga`, controlli specs ↔ e2e ↔ unit, versione bumpata
  rispetto a `main` e `Closes #N`. Se il diff tocca RLS/auth/migration/`supabase/`
  **propone** `rls-guardian` e lo lancia solo dopo conferma.
- **Non fa**: nessun commento, merge, `gh pr ready` né cambio di label
  (`status:review` resta scelta umana); il report si posta come commento solo
  su richiesta esplicita (`--body-file`). Senza PR aperta si ferma.

## Controllo OWASP prima della PR: `/owasp-check` (issue #102)
Comando di Claude Code (`.claude/commands/owasp-check.md`), in sola lettura.
- **Fa**: analizza solo il diff della branch contro `main` sulle categorie
  OWASP Top 10 pertinenti a una web app con database (accessi/RLS,
  iniezione/XSS, autenticazione, secret e `service_role`, configurazione ed
  errori, dipendenze con `npm audit` se toccate, logging) e chiude con
  `Esito OWASP: OK` oppure `DA CORREGGERE` con elenco `file:riga`.
- **Flusso**: l'`implementer` lo esegue prima di aprire la PR e, se l'esito non
  è `OK`, continua a lavorare e lo rilancia; l'esito va nel corpo della PR.
  `rls-guardian` lo usa come checklist nella review di sicurezza. Non gira in
  CI (sarebbe troppo tardi) e non sostituisce `rls-guardian` né i test pgTAP.

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
