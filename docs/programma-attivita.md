# Programma di attività — girasole
## Da "vibe coding" a SDLC AI-driven, un'attività alla volta

Punto di partenza (17 set 2026): app in produzione con maestre attive, repo pubblico,
130 commit in 27 giorni, push diretti su `main`, nessuna board, migration a mano su
due DB Supabase (test e prod). Analisi completa in `docs/analisi-2026-09.md`.

Questo programma è l'**input** per le attività: ogni voce è pensata per diventare una
issue sulla board, da rianalizzare e affinare una alla volta prima di eseguirla.
Lo script `scripts/censisci-attivita.sh` le crea tutte in un colpo.

### Come leggere una voce
- **Obiettivo** — cosa deve essere vero alla fine.
- **Perché** — l'evidenza dall'analisi che la giustifica.
- **Fatto quando** — criterio di completamento verificabile.
- **Dipende da** — attività da chiudere prima.
- **Sforzo** S / M / L · **Tier** modello suggerito per l'agente · **Ambiente** dove va eseguita
  (PC = locale con DB; cloud = anche da telefono; CI = automatico) · **Rischio prod**.

### Regole del programma
1. **Una alla volta, in ordine.** L'ordine è per dipendenza e rischio, non per importanza.
2. **Nulla tocca la prod** fino alla Fase 2 inclusa, tranne il deploy normale via `main`.
3. **Rianalizza prima di eseguire.** Ogni issue va riletta e, se serve, spezzata in sotto-issue.
4. **Chiusa = verificata**, non "committata". Il criterio "Fatto quando" è il gate.

---

## Fase 0 — La board (oggi, a mano, ~1 ora)

### A00 · Creare le label e il Project GitHub
- **Obiettivo**: la macchina a stati esiste (label `status:*`, `type:*`, `area:*`, `tier:*`)
  e un Project "girasole" in vista Board con le colonne Triage / Needs info / Ready /
  In progress / Review / Done.
- **Perché**: senza uno stato visibile le 30 attività qui sotto restano una lista in un file.
- **Fatto quando**: `gh label list` mostra le label; il Project esiste con le automazioni
  "Item added → Triage" e "PR merged → Done".
- **Dipende da**: —  · **Sforzo** S · **Tier** — (manuale) · **Ambiente** PC/cloud · **Rischio prod** nessuno

### A01 · Censire questo programma come issue
- **Obiettivo**: ogni attività A00…A38 è una issue con label, milestone di fase e link
  al programma, nella board.
- **Perché**: da qui in poi la board è l'unica fonte di verità delle attività.
- **Fatto quando**: `scripts/censisci-attivita.sh` eseguito; issue visibili nel Project.
- **Dipende da**: A00 · **Sforzo** S · **Tier** — · **Ambiente** PC/cloud · **Rischio prod** nessuno

### A02 · Committare lo scaffold agenti (senza attivarlo)
- **Obiettivo**: `.claude/agents/*`, `.claude/commands/next-task.md`,
  `.github/workflows/claude-board.yml` e `scripts/` sono nel repo.
- **Perché**: i file devono esistere prima di poter essere letti dagli agenti; l'Action
  resta inerte finché manca il secret (A03) e il flusso PR (A10).
- **Fatto quando**: file su `main`; `npm run analyze` verde.
- **Dipende da**: A00 · **Sforzo** S · **Tier** haiku · **Ambiente** cloud · **Rischio prod** nessuno

### A03 · Secret `ANTHROPIC_API_KEY` e GitHub App
- **Obiettivo**: da Claude Code, `/install-github-app`; il secret è nel repo.
- **Perché**: prerequisito dell'unica Action economica (triage/review).
- **Fatto quando**: il secret compare in Settings → Secrets; un'issue di prova riceve
  il commento di triage.
- **Dipende da**: A02 · **Sforzo** S · **Tier** — · **Ambiente** PC · **Rischio prod** nessuno

---

## Fase 1 — Fondamenta (una sessione; solo configurazione, zero rischio prod)

### A10 · `main` protetto: solo PR, check obbligatori [FATTO 2026-09-20]
- **Obiettivo**: nessun push diretto su `main`; merge solo con check verdi;
  "delete branch on merge" attivo.
- **Perché**: la CI esistente scatta solo su PR, ma 116 commit su 130 sono arrivati
  senza PR: due build rotte (v0.39.0, v0.40.0) sono arrivate a Vercel. È anche ciò
  che rende sicuro lavorare dal telefono.
- **Fatto quando**: un push diretto su `main` viene rifiutato; una PR con check rossi
  non è mergeabile.
- **Fatto**: un GitHub ruleset (id 23738749, target `main`, `enforcement: active`)
  applicato manualmente da Matteo (repository owner) blocca cancellazione branch
  (`deletion`), force-push (`non_fast_forward`) e push diretto (`pull_request`,
  0 approvazioni richieste, merge/squash/rebase ammessi); la regola
  `required_status_checks` rende obbligatorio il context `CI / verifica` (il job
  unico di `.github/workflows/ci.yml` introdotto in A12). Il ruolo repository
  "Admin" ha `bypass_actors` con `bypass_mode: always`: finché il DB Supabase di
  test resta in pausa prolungata e lo step e2e è strutturalmente rosso (vedi
  CLAUDE.md, sezione "Repo pubblico", e la nota interna sul CI e2e rotto per
  credenziali/DB in pausa), solo Matteo può comunque mergiare una PR con quello
  step rosso; chiunque altro deve avere il check verde. La casella "Automatically
  delete head branches" del repository resta invece da attivare a mano in
  Settings → General (non è coperta dal ruleset ed è fuori dal perimetro di
  scrittura di questa attività, che non tocca configurazione repo via API).
- **Dipende da**: A12 (i check da rendere obbligatori devono esistere) · **Sforzo** S ·
  **Tier** — · **Ambiente** PC/cloud · **Rischio prod** nessuno

### A11 · Pulizia dei branch `claude/*` orfani [FATTO 2026-09-20]
- **Obiettivo**: i 18 branch remoti `claude/*` già mergiati o abbandonati sono eliminati.
- **Perché**: rumore; alcuni contengono lavoro mai mergiato da verificare prima di cancellare.
- **Fatto quando**: `git branch -r` mostra solo `main` (e branch di PR aperte).
- **Fatto**: 18 branch `claude/*` eliminati da origin da Matteo (repository
  owner), dopo verifica preventiva per ciascuno (`git log main..origin/<branch>`)
  che non contenesse commit non mergiati in `main` — sette con PR già mergiata
  (#1–#9), undici senza PR ma con contenuto già confluito in `main` o mai
  utile. `git branch -r` dopo `git fetch --prune` mostra ora solo `main` e i
  branch di PR/lavoro aperti. Restano da fare a mano da Matteo (fuori dal
  perimetro di questa attività): attivare "Automatically delete head branches"
  in Settings → General (già segnalato in A10) ed eventualmente ripulire
  `chore/issue-16-ci-unificato`, residuo della PR #49 già mergiata.
- **Dipende da**: — · **Sforzo** S · **Tier** haiku · **Ambiente** cloud · **Rischio prod** nessuno

### A12 · Workflow CI unificato su PR (con `next build`)
- **Obiettivo**: un solo `ci.yml` su `pull_request`: tsc → lint → jscpd → vitest →
  **`next build`** → e2e. Sostituisce `analisi-statica.yml` e `playwright.yml`.
- **Perché**: `next build` mancava ovunque (hook e CI): è il buco esatto di v0.39/0.40.
  Un solo workflow è più semplice da rendere "check obbligatorio".
- **Fatto quando**: una PR di prova mostra i 6 step; una PR con un import server in un
  client component fallisce in build.
- **Dipende da**: — · **Sforzo** M · **Tier** sonnet · **Ambiente** cloud · **Rischio prod** nessuno

### A13 · Regola ESLint sul confine client/server [FATTO 2026-09-23]
- **Obiettivo**: `no-restricted-imports`: un modulo `'use client'` non può importare
  `lib/auth` né `lib/supabase/server` (direttamente o via `lib/*` che li importano).
- **Perché**: la "nota per il futuro" in TASKS.md (v0.40.1) descrive un bug che nessuno
  strumento intercetta: deve diventare un errore di lint.
- **Fatto quando**: reintrodurre l'import di v0.39 fa fallire `npm run lint`.
- **Risultato**: due `overrides` in `.eslintrc.json` con `no-restricted-imports`
  (built-in, nessuna dipendenza nuova). Il primo copre l'import diretto da un
  Client Component (individuato per posizione — `components/**/*.tsx`,
  `app/**/error.tsx`/`global-error.tsx` — non per la direttiva `'use client'`,
  che ESLint non legge senza un plugin nuovo). Il secondo vieta a qualunque
  altro modulo `lib/*.ts` (tranne `lib/auth.ts` stesso e i `*.test.ts`) di
  importare `lib/auth`/`lib/supabase/server`, risolvendo il caso transitivo
  alla radice invece di inseguire ogni possibile catena di import — verificato
  reintroducendo (e poi ripristinando) esattamente la catena del bug storico
  v0.39/v0.40 (`VerificaBonifico.tsx` → `comunicazioneRetta.ts` →
  `calendarioScolastico.ts` → `auth.ts`). Limite noto: copre solo import via
  alias `@/lib/...` (unica convenzione in uso) e un Client Component creato
  fuori da `components/**` sfuggirebbe al primo override (ma resterebbe comunque
  coperto dal secondo, se passa da un modulo `lib/*`). Dettagli in TASKS.md.
- **Dipende da**: — · **Sforzo** S · **Tier** sonnet · **Ambiente** cloud · **Rischio prod** nessuno

### A14 · Versione da una sola fonte [implementato 2026-09-23, verifica su preview Vercel reale ancora da fare]
- **Obiettivo**: `VERSIONE_APP` letta da `npm_package_version`, `DATA_BUILD` da
  `VERCEL_GIT_COMMIT_SHA` + timestamp di build; niente più bump manuale in `lib/versione.ts`.
- **Perché**: due punti da tenere allineati a mano (package.json + versione.ts) e una
  data scritta a mano: drift garantito.
- **Fatto quando**: il footer mostra versione e SHA corretti su una preview Vercel senza
  toccare `versione.ts`.
- **Risultato**: `VERSIONE_APP`/`DATA_BUILD` (`lib/versione.ts`) non sono più costanti
  scritte a mano ma derivate in `next.config.mjs` (letto ad ogni `next build`/`next dev`,
  indipendentemente da come il comando è invocato — a differenza di uno script
  `prebuild` legato a un hook npm) e iniettate in `process.env` tramite l'opzione
  `env`, che le sostituisce nel bundle a build-time (server e client, anche senza
  prefisso `NEXT_PUBLIC_`, qui non necessario perché il footer è reso solo
  server-side). `VERSIONE_APP` legge `package.json` (non `process.env.npm_package_version`:
  non affidabile perché dipende da come Vercel invoca il build). `DATA_BUILD` combina lo
  SHA del commit (`VERCEL_GIT_COMMIT_SHA`, già disponibile su Vercel a build-time senza
  bisogno del toggle "Automatically expose System Environment Variables" — quel toggle
  serve solo alle varianti `NEXT_PUBLIC_*` per uso lato client; fallback locale a `git
  rev-parse HEAD`, poi a un placeholder se anche git fallisce) con il timestamp di build
  (fuso Europe/Rome), tramite `formattaDataBuild` — pura, testata in
  `lib/versione.test.ts` (bisestili non c'entrano ma cambi ora legale/solare e
  abbreviazione dello SHA sì). Verificato in locale (`npm run build`) che i valori
  finiscono letteralmente nel bundle server (`grep` sull'output di `.next/server`),
  ma **resta da confermare su una preview Vercel reale** che
  `VERCEL_GIT_COMMIT_SHA` sia effettivamente popolato in quell'ambiente — nessun modo di
  verificarlo prima di un deploy vero.
- **Dipende da**: — · **Sforzo** S · **Tier** sonnet · **Ambiente** cloud · **Rischio prod** basso

### A15 · `next build` nel pre-push hook (opzionale)
- **Obiettivo**: il hook locale include la build, o un flag per saltarla quando serve velocità.
- **Perché**: seconda linea di difesa oltre alla CI; costa ~1 minuto a push.
- **Fatto quando**: un push con build rotta è bloccato in locale.
- **Dipende da**: A12 · **Sforzo** S · **Tier** haiku · **Ambiente** PC · **Rischio prod** nessuno

### A16 · Attivare triage e review dell'agente
- **Obiettivo**: `claude-board.yml` gira: triage su issue aperta, review su PR aperta.
- **Perché**: primo passo autonomo, economico (Haiku/Sonnet), sul flusso PR ormai reale.
- **Fatto quando**: un'issue nuova riceve triage + label; una PR riceve la review.
- **Dipende da**: A03, A10 · **Sforzo** S · **Tier** — · **Ambiente** CI · **Rischio prod** nessuno

### A17 · Documentare il flusso remoto (telefono) [documentato 2026-09-23, validazione dal vivo ancora da fare]
- **Obiettivo**: `docs/flusso-remoto.md`: issue → sessione cloud → draft PR → CI (build,
  migration su test, e2e) → review agente → merge dal telefono.
- **Perché**: le sessioni cloud non raggiungono il DB; il flusso deve delegare alla CI
  ciò che la sandbox non può fare, altrimenti dal telefono si torna a spedire alla cieca.
- **Fatto quando**: un'attività piccola è stata portata da issue a merge interamente da telefono.
- **Risultato**: `docs/flusso-remoto.md` descrive i sei passi (issue → sessione cloud →
  cosa non può fare la sandbox → draft PR → CI/`claude-board.yml` → review e merge dal
  telefono) con i pezzi già esistenti nel repo dopo A10/A12/A16, più i limiti noti.
  Limite segnalato esplicitamente (nessuna invenzione): il meccanismo tecnico per
  avviare da telefono una sessione cloud di Claude Code agganciata a un'issue non è
  documentato da nessuna parte in questo repository — `claude-board.yml` copre solo
  triage e review, non implementazione (il commento in cima al file lo dice
  esplicitamente); dipende dalla funzionalità nativa del prodotto Claude Code, non da
  un'automazione repo-specifica. Altro limite documentato: una migration su test prima
  del merge non è automatizzata (dipende da A20/A21/A23, non ancora fatte), quindi il
  flusso è oggi sicuro solo per attività che non richiedono modifiche allo schema DB
  verificabili prima del merge. **Il criterio "Fatto quando" non è verificato da questa
  attività**: richiede un test dal vivo, solo da telefono, che solo Matteo può eseguire
  (issue → sessione cloud → PR → CI → review → merge, davvero dal telefono). Finché
  quel test non è fatto, A17 resta aperta in sostanza anche se la parte documentale è
  completa.
- **Dipende da**: A10, A12, A16 · **Sforzo** S · **Tier** haiku · **Ambiente** cloud · **Rischio prod** nessuno

---

## Fase 2 — Rete di sicurezza (si tocca il DB di test, mai la prod)

### A20 · Supabase CLI: init e link a test e prod [parziale 2026-09-23, login/link restano da fare a mano]
- **Obiettivo**: `supabase/config.toml` nel repo; `supabase link` funzionante verso il
  progetto di test e verso quello di prod (due profili).
- **Perché**: 51 migration applicate a mano via SQL Editor su due DB, senza tracciamento.
- **Fatto quando**: `supabase migration list` risponde per entrambi i progetti.
- **Risultato**: Supabase CLI installato con `npm install -g supabase` (il pacchetto npm
  `supabase` è oggi un wrapper ufficiale supportato su tutte le piattaforme incluso
  Windows — non è più vero, se mai lo è stato, che vada evitato: nessun postinstall
  blocca l'uso globale, il binario è scaricato correttamente e `supabase --version`
  risponde `2.117.0`). `supabase init` eseguito nella root del repo **senza** `--force`:
  ha generato solo `supabase/config.toml` e `supabase/.gitignore` (quest'ultimo ignora
  `.branches` e `.temp`, entrambi cache locale del CLI, non `supabase/migrations/`,
  `supabase/seed.sql` o `supabase/helper.sql`, già esistenti e non toccati — verificato
  con `git status` prima e dopo). `config.toml` controllato riga per riga: nessun
  segreto, solo default (porte locali, riferimenti `env(...)` per eventuali chiavi, mai
  valori in chiaro); `project_id = "girasole"` è solo un'etichetta locale, non
  un identificatore reale di un progetto Supabase. **Non eseguiti** (come da issue):
  `supabase login` e `supabase link` — richiedono un token personale o un login
  interattivo via browser, più il project-ref di entrambi i progetti (test e
  produzione), che l'agente non ha e non deve indovinare. Restano due comandi manuali
  per Matteo, vedi `TASKS.md` (voce A20) per il procedimento esatto passo-passo. Il
  criterio "Fatto quando" (`supabase migration list` risponde per entrambi i progetti)
  **non è verificato da questa attività**: si verifica solo dopo che Matteo ha fatto
  login e link con le sue credenziali.
- **Dipende da**: — · **Sforzo** M · **Tier** sonnet · **Ambiente** PC · **Rischio prod** nessuno (sola lettura)

### A21 · Riconciliazione una tantum dello stato migration
- **Obiettivo**: per ognuna delle 51 migration si sa se è applicata su test e su prod;
  le mancanti vengono applicate; `supabase_migrations` riflette la realtà.
- **Perché**: 4 migration risultate non applicate o fallite silenziosamente; 30 promemoria
  manuali; incertezza esplicita ("se il progetto di produzione è distinto…").
- **Fatto quando**: `supabase migration list` è identico e completo su test e prod;
  nessuna differenza di schema tra i due (`supabase db diff` vuoto).
- **Dipende da**: A20 · **Sforzo** L · **Tier** **opus** · **Ambiente** PC · **Rischio prod** **medio**
  (tocca la prod: farlo in orario di non uso, con backup prima)

### A22 · `db push` come unico canale; aggiornare CLAUDE.md e README
- **Obiettivo**: il SQL Editor non è più un modo ammesso per applicare migration;
  la procedura è documentata e l'agente la conosce.
- **Perché**: chiudere per sempre la classe di incidenti "applica da parte tua" (è
  la causa diretta della riconciliazione fatta in A21: 51 migration mai tracciate
  dal CLI perché applicate a mano).
- **Decisione (2026-09-24)**: il DB di test (`girasole_dev`) è lo stesso, condiviso,
  sia per la CI sia per lo sviluppo locale di Matteo — non un secondo progetto
  isolato. Di conseguenza:
  - **In locale**, una migration nuova si applica con
    `supabase db push --project-ref <ref-test>` (mai più SQL Editor), esplicito e
    incrementale — sicuro perché ogni migration è idempotente o già applicata.
  - **In test (CI)**, l'applicazione non è un `db push` incrementale ma il reset
    completo di A23 (`supabase db reset --project-ref <ref-test>`, che riapplica
    tutte le migration da zero e poi il seed): dato che gira ad ogni PR e il DB è
    condiviso con lo sviluppo locale, Matteo ha accettato esplicitamente che i
    propri dati di test locali vengano ricreati da zero ad ogni run di CI (usa il
    locale raramente). Vedi A23 per il meccanismo.
  - **In produzione**, resta manuale e deliberato: **mai** un `supabase link`
    permanente verso il ref di produzione (il collegamento di default resta
    sempre il test); Matteo lancia lui, dopo il merge,
    `supabase db push --project-ref <ref-produzione>` esplicito sul comando.
    Nessun automatismo CI/agente verso la produzione.
- **Fatto quando**: CLAUDE.md non cita più il SQL Editor; una migration nuova arriva
  in test tramite il reset di CI (A23) e in prod via `db push` esplicito dopo il
  merge.
- **Dipende da**: A21 (fatta, won't-do: prod e test già allineate su 51/51
  migration al 2026-09-23) · **Sforzo** S · **Tier** haiku · **Ambiente** cloud ·
  **Rischio prod** nessuno

### A23 · CI: DB di test pulito per ogni run (reset + migration + seed) prima della e2e
- **Obiettivo**: ogni run e2e parte da uno schema pulito con seed noto.
- **Perché**: il DB di test condiviso e mutabile è la causa dei 145 `test.skip` e
  dell'impossibilità di testare le azioni irreversibili.
- **Decisione (2026-09-24)**: niente secondo progetto Supabase isolato per la CI
  (scartata l'idea delle "preview branch" o di un progetto dedicato). Il
  meccanismo è `supabase db reset --project-ref <ref-test>` (comando verificato:
  resetta lo schema del progetto linkato riapplicando tutte le migration da
  zero, poi lancia `supabase/seed.sql` in automatico salvo `--no-seed`), da
  lanciare in CI prima della suite e2e, ad ogni run su ogni PR. Matteo accetta
  che questo cancelli e ricrei i suoi eventuali dati di test locali ad ogni
  esecuzione, dato che testa in locale raramente — se in futuro questo diventa
  un problema pratico, rivalutare l'isolamento (progetto/branch dedicato) a
  parte, non silenziosamente.
- **Fatto quando**: due run consecutivi della e2e danno lo stesso risultato; il seed
  crea sezioni/bambini/utenti di test riproducibili; una migration nuova aperta in
  PR è presente nel DB di test prima che la e2e parta, senza intervento manuale.
- **Dipende da**: A20 (fatta), A12 (fatta) · **Sforzo** L · **Tier** sonnet ·
  **Ambiente** CI · **Rischio prod** nessuno

### A24 · Account-ruolo di test e secret `E2E_*` completi
- **Obiettivo**: admin, maestra, assistente, genitore (+ i due opzionali) esistono nel
  progetto di test e i loro secret sono in GitHub.
- **Perché**: molti skip dipendono da un ruolo non configurato; un bug RLS (0030) è
  passato perché i test giravano solo come admin.
- **Fatto quando**: `auth.setup.ts` non salta nessun ruolo in CI.
- **Dipende da**: A23 (idealmente creati dal seed) · **Sforzo** S · **Tier** haiku · **Ambiente** PC · **Rischio prod** nessuno

### A25 · Rendere testabili le azioni irreversibili, ridurre gli skip
- **Obiettivo**: comunicazione Rojac, conferma settimana, decisione straordinario ecc.
  hanno test e2e che premono davvero "Conferma"; gli skip condizionali scendono
  drasticamente (obiettivo: solo quelli legati all'ora reale).
- **Perché**: 145 `test.skip` su 208 test; la suite verde dice meno di quanto sembri.
- **Fatto quando**: report Playwright con skip < 20; nessuno scenario di specs/16, 18, 19
  è "coperto solo da unit test" per impossibilità.
- **Dipende da**: A23, A24 · **Sforzo** L · **Tier** sonnet · **Ambiente** CI · **Rischio prod** nessuno

### A26 · Grant-check meccanico in CI
- **Obiettivo**: uno script confronta le tabelle usate nel codice (per ruolo:
  `authenticated`, `service_role`) con `information_schema.role_table_grants` sul DB di
  test; fallisce se manca un GRANT.
- **Perché**: 8 incidenti "permission denied", stessa classe, rifixata sei volte.
- **Fatto quando**: rimuovere un grant dal seed fa fallire la CI con il nome della tabella.
- **Dipende da**: A23 · **Sforzo** M · **Tier** sonnet · **Ambiente** CI · **Rischio prod** nessuno

### A27 · Test pgTAP sulle policy RLS per ruolo
- **Obiettivo**: test SQL che, per ogni ruolo, verificano cosa può leggere/scrivere
  sulle tabelle sensibili (prime: `presenze`, `pasti`, `profili_orari`, `comunicazioni_retta`).
- **Perché**: la RLS è "la difesa primaria" ma è verificata solo attraverso la UI, per lo
  più come admin. pgTAP testa la difesa direttamente, in secondi, senza browser.
- **Fatto quando**: pgTAP gira in CI; un test riproduce il bug 0030 e passa solo con la policy.
- **Dipende da**: A23 · **Sforzo** M · **Tier** **opus** · **Ambiente** CI · **Rischio prod** nessuno

### A28 · Error tracking in produzione
- **Obiettivo**: gli errori server (route, server action, cron) arrivano a un tracker
  (es. Sentry free) con stack e `digest`.
- **Perché**: i bug in prod si scoprono oggi dalle segnalazioni delle maestre e poi
  leggendo i log Vercel a mano.
- **Fatto quando**: un errore forzato in preview compare nel tracker con contesto utile;
  nessun PII di bambini nei payload.
- **Dipende da**: — · **Sforzo** S · **Tier** sonnet · **Ambiente** cloud · **Rischio prod** basso

---

## Fase 3 — Evoluzione (guidata dalla board, nel tempo)

### A30 · Spezzare `TASKS.md`
- **Obiettivo**: backlog residuo → issue; storia → `CHANGELOG.md`; promemoria migration →
  eliminati (A22). `TASKS.md` rimosso o ridotto a un puntatore.
- **Perché**: 180 KB (~45.000 token) caricati a ogni sessione, al 90% storia.
- **Fatto quando**: CLAUDE.md non chiede più di aggiornare TASKS.md; il file non esiste
  o è < 50 righe.
- **Dipende da**: A01, A22 · **Sforzo** M · **Tier** sonnet · **Ambiente** cloud · **Rischio prod** nessuno

### A31 · CHANGELOG generato e tag git per release
- **Obiettivo**: commit convenzionali → CHANGELOG automatico; tag `vX.Y.Z` a ogni merge
  che bumpa la versione.
- **Perché**: zero tag, nessun changelog; la storia vive solo in TASKS.md e nei messaggi di commit.
- **Fatto quando**: il tag e la voce di changelog compaiono senza intervento manuale.
- **Dipende da**: A14, A30 · **Sforzo** M · **Tier** sonnet · **Ambiente** CI · **Rischio prod** nessuno

### A32 · `CLAUDE.md` snellito a costituzione; specs on-demand
- **Obiettivo**: CLAUDE.md contiene regole stabili (< 1.500 token); procedure in `docs/`;
  istruzione esplicita di leggere solo la spec della feature in corso.
- **Perché**: 3.000 token di CLAUDE.md + 225 KB di specs; stabilità = prompt caching
  efficace (cache hit al 10%) e istruzioni più nitide.
- **Fatto quando**: una sessione tipica parte con < 10k token di contesto di governance.
- **Dipende da**: A22, A30 · **Sforzo** M · **Tier** sonnet · **Ambiente** cloud · **Rischio prod** nessuno

### A33 · ADR per le scelte deliberate
- **Obiettivo**: `docs/adr/` con le decisioni già prese (tabelle non rinominate;
  `service_role` per conteggi asilo-wide; "l'effetto è la conferma"; unit solo senza I/O…).
- **Perché**: oggi il "perché" è sepolto in voci di TASKS.md; l'agente e tu fra sei mesi
  ne avete bisogno.
- **Fatto quando**: almeno 6 ADR da 10-20 righe; CLAUDE.md rimanda a `docs/adr/`.
- **Dipende da**: A30 · **Sforzo** S · **Tier** haiku · **Ambiente** cloud · **Rischio prod** nessuno

### A34 · Check meccanico spec ↔ test in CI
- **Obiettivo**: script che verifica che ogni `## Scenario:` in `specs/` abbia un `test()`
  con titolo corrispondente nel file `e2e/` gemello (e viceversa).
- **Perché**: oggi è una regola in prosa (225 scenari vs 208 test); deve essere un check.
- **Fatto quando**: aggiungere uno scenario senza test fa fallire la CI.
- **Dipende da**: A12 · **Sforzo** S · **Tier** sonnet · **Ambiente** CI · **Rischio prod** nessuno

### A35 · Dependabot / Renovate
- **Obiettivo**: bump automatici delle dipendenze via PR, raggruppati, con CI verde come gate.
- **Perché**: nessun aggiornamento automatico; `npm audit` con high note.
- **Fatto quando**: prima PR di bump mergiata con CI verde.
- **Dipende da**: A10, A12 · **Sforzo** S · **Tier** haiku · **Ambiente** cloud · **Rischio prod** basso

### A36 · Upgrade Next 15/16 + React 19
- **Obiettivo**: stack aggiornato, `npm audit` senza high, e2e verde.
- **Perché**: Next 14.2.35 con vulnerabilità high note; breaking change da gestire con
  cura in produzione.
- **Fatto quando**: PR con preview + e2e verdi, mergiata in un weekend, con piano di
  rollback (revert + redeploy) provato prima.
- **Dipende da**: A23, A25, A28 (serve la rete di sicurezza completa) · **Sforzo** L ·
  **Tier** **opus** · **Ambiente** PC · **Rischio prod** **medio**

### A37 · Contenere il `service_role`
- **Obiettivo**: i conteggi asilo-wide (pasti Rojac, presenze mancanti…) diventano
  funzioni Postgres `security definer` esposte via RPC; `service_role` resta solo in cron
  e gestione utenti.
- **Perché**: 20 punti d'uso in 7 file, incluso una server action user-facing:
  l'autorizzazione migra silenziosamente dal DB all'app.
- **Fatto quando**: `createAdminClient` non compare in nessuna server action avviata da
  un utente; test pgTAP sulle RPC.
- **Dipende da**: A27 · **Sforzo** M · **Tier** **opus** · **Ambiente** PC · **Rischio prod** basso

### A38 · Backlog funzionale residuo come issue
- **Obiettivo**: le voci ancora aperte di TASKS.md ("saldo complessivo per bambino",
  "portale genitori") e le note "Fuori scope" delle specs sono issue `type:feature`
  in `status:triage`.
- **Perché**: la board deve contenere anche il lavoro di prodotto, non solo quello di processo.
- **Fatto quando**: TASKS.md non contiene più voci `- [ ]`.
- **Dipende da**: A01 · **Sforzo** S · **Tier** haiku · **Ambiente** cloud · **Rischio prod** nessuno

---

## Vista d'insieme

| Fase | Attività | Sforzo totale | Rischio prod | Cosa sblocca |
|---|---|---|---|---|
| 0 · Board | A00–A03 | ~1 h | nessuno | tutto il resto |
| 1 · Fondamenta | A10–A17 | ~½ giornata | nessuno | CI viva, PR sicure, telefono sicuro, agenti attivi |
| 2 · Rete di sicurezza | A20–A28 | 2–3 sessioni | medio solo in A21 | migration affidabili, e2e credibile, RLS testata |
| 3 · Evoluzione | A30–A38 | continua | basso (medio A36) | costi giù, contesto pulito, stack aggiornato |

Il percorso critico è **A00 → A12 → A10 → A20 → A21 → A23**: sei attività che
trasformano il repo da "spedisco e spero" a "ogni merge è verificato".
