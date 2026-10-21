# Bootstrap di un nuovo progetto (prompt standard)

Questo file è **il modo standard** con cui Matteo imposta un progetto della
stessa categoria di Girasole: web app gestionale piccola/media, repo
GitHub (di norma pubblico), Next.js + TypeScript + Supabase su Vercel,
sviluppata con agenti Claude Code e protetta da test automatici e CI.

È volutamente **indipendente dal dominio**: niente requisiti, niente ruoli,
niente nomi di tabelle o integrazioni di Girasole. Quelli stanno in `specs/` e
in `CLAUDE.md` del singolo progetto.

## Come si usa
1. Crea il repo vuoto e aprilo in Claude Code.
2. Copia **tutto il blocco** sotto "Prompt" (dal primo `---` all'ultimo),
   sostituisci i campi `{{...}}` della sezione "Parametri" e incollalo.
3. L'agente fa prima le domande aperte, poi esegue le fasi in ordine. Le azioni
   su GitHub, Supabase e Vercel che richiedono il mio account o i miei token le
   elenca come **passi manuali per Matteo**: non le inventa e non le salta.
4. Quando una decisione di questo file cambia, si aggiorna **questo file** (non
   solo il progetto in corso), così il prossimo bootstrap parte già aggiornato.

Origine: estratto da Girasole (`.github/workflows/`, `.githooks/`,
`.claude/`, `docs/sviluppo-dettagli.md`, `docs/adr/`). Se questo file e Girasole
divergono, vale ciò che è scritto qui per i **nuovi** progetti; la motivazione
di ogni scelta sta negli ADR di Girasole richiamati tra parentesi.

---

## Prompt

Sei l'agente che imposta da zero un nuovo progetto software. Leggi tutto prima
di agire. Non fare nulla di irreversibile o verso l'esterno (creare repo,
progetti cloud, secret, ruleset, deploy) senza averlo elencato come passo
manuale per me, a meno che io non ti abbia dato esplicitamente il permesso per
quel passo.

### Parametri (li compilo io; se qualcosa manca, chiedimelo)
- Nome progetto / slug repo: `{{NOME}}` / `{{SLUG}}`
- Descrizione in una riga: `{{DESCRIZIONE}}`
- Lingua della UI e dei testi utente: `{{LINGUA_UI}}` (default: italiano)
- Repo pubblico o privato: `{{VISIBILITA}}` (default: pubblico; se pubblico
  valgono tutte le regole "repo pubblico" qui sotto)
- Ruoli utente dell'app: `{{RUOLI}}` (es. admin / staff / utente)
- Dominio dei dati sensibili: `{{DATI_SENSIBILI}}` (es. minori, salute: alza il
  livello di attenzione su log, RLS, review di sicurezza)
- Integrazioni esterne previste: `{{INTEGRAZIONI}}` (email, pagamenti, captcha,
  cron...)
- Piano Vercel / Supabase all'inizio: `{{PIANI}}` (default: gratuiti, con la
  nota di quali limiti contano)
- Ref dei progetti Supabase (test e produzione): li creo io; tu usi solo
  segnaposto `<ref-test>` / `<ref-produzione>`.

### Domande aperte da farmi PRIMA di scrivere codice
Fammi una sola raccolta di domande (non una alla volta) su ciò che non è
derivabile: nome dei ruoli e confini di visibilità, dati sensibili, integrazioni,
se serve un cron, chi mergia (io), budget mensile per gli agenti in cloud.
Per i dubbi minori (stile, differenze visive minime, nomi) **decidi tu con le
best practice** e scrivilo nella PR: non bloccare il lavoro.

---

## 1. Stack tecnologico (default, non cambiare senza chiedere)

- **Next.js** (ultima major stabile) con App Router, **Server Components e
  Server Actions per default**; `'use client'` solo dove serve interattività.
  Bundler Turbopack (default). Con Next 16: `proxy.ts` al posto di
  `middleware.ts` (gira su runtime Node.js); `next lint` non esiste più, il
  lint è l'ESLint CLI con config flat `eslint.config.mjs` e
  `eslint-config-next` (core-web-vitals). (ADR 0010)
- **TypeScript** con `strict: true`. Niente `any` gratuiti.
- **Tailwind CSS 4**: tema e token in `app/globals.css` (`@theme`), niente
  `tailwind.config.ts`, plugin PostCSS `@tailwindcss/postcss`. Colori come
  **token di significato** (primario, bordo, neutro, errore...), non classi di
  colore sparse nelle pagine.
- **Componenti UI**: shadcn/ui **copiato** in `components/ui/` (non un
  pacchetto), con Radix per il comportamento e CVA per le varianti, helper `cn`
  in `lib/utils.ts`. Pulsanti, campi, etichette, riquadri, tabelle, finestre e
  avvisi si importano **sempre** da `@/components/ui/...`: vietato scrivere
  nuove stringhe di classi per questi elementi nelle pagine. Icone da un unico
  file `components/icone.tsx` (niente `lucide-react`, niente `@base-ui/react`).
  Dipendenze UI approvate: `clsx`, `tailwind-merge`, `class-variance-authority`,
  `tw-animate-css`, `radix-ui`. Finestre di dialogo col `<dialog>` nativo se
  devono stare dentro un `<form>`. (ADR 0011)
- **Supabase**: Postgres + Auth + **Row Level Security**. Client in
  `lib/supabase/` (server, browser, admin). `@supabase/ssr` per la sessione.
- **Hosting**: Vercel (deploy automatico di `main` in produzione, anteprima per
  ogni PR). Regione scelta vicino agli utenti e fissata in `vercel.json`.
- **Test**: Vitest (unit, solo logica pura), Playwright (e2e) con
  `@axe-core/playwright` (accessibilità), pgTAP (policy RLS).
- **Qualità statica**: `tsc --noEmit`, ESLint, `jscpd` (duplicazione, soglia
  ~1,5%, `minLines 8`, ignora test e config), più controlli custom in `scripts/`.
- **Nessuna nuova dipendenza senza chiedermelo.** Meglio `fetch` diretto a
  un pacchetto in più per integrazioni semplici. Node 22+ nei workflow (esegue
  nativamente script `.mts` con `--experimental-strip-types`: gli script di
  controllo sono TypeScript "erasable" senza build, la **logica pura sta in
  `lib/` con unit test** e lo script è solo un guscio).
- `next-env.d.ts` non è versionato: si crea con `npx next typegen`, da lanciare
  prima di `tsc` su un clone pulito (CI e hook lo fanno).

### Convenzioni di codice
- Testi visibili all'utente in `{{LINGUA_UI}}`; variabili, funzioni, file in
  **inglese**, salvo i termini di dominio che rispecchiano le tabelle
  (restano nella lingua del dominio). Se cambia solo il termine mostrato in UI,
  **non si rinominano** tabelle, colonne, action o route (ADR 0001).
- L'esito di un'azione è comunicato dal suo effetto visibile, senza toast di
  successo ridondanti; dove l'effetto non si vede (campi identici dopo il
  salvataggio) si mostra "Ultimo salvataggio: data e ora" da `updated_at`
  (ADR 0003).
- Logica di dominio pura in `lib/`, co-locata con il suo test
  (`lib/date.ts` → `lib/date.test.ts`).
- La **versione mostrata nel footer** e la data di build non si scrivono a
  mano: `next.config.mjs` le deriva a build-time da `package.json` e dallo SHA
  del commit (`VERCEL_GIT_COMMIT_SHA` su Vercel, `git rev-parse HEAD` in locale).
  (ADR 0007)

## 2. Infrastruttura e ambienti

- **Due progetti Supabase separati: test e produzione.** Mai dati di
  produzione in test, mai il contrario.
- **Il DB di test è unico e condiviso** tra CI e sviluppo locale, e la CI lo
  **resetta a ogni run** (`supabase db reset`: ricrea schema da zero + seed).
  Accetto che questo cancelli i miei dati locali di prova. Niente secondo
  progetto "solo CI" finché non serve. (ADR 0006)
- **Una sola e2e alla volta sul DB di test**: il job e2e della CI sta in un
  gruppo di concorrenza globale, `cancel-in-progress: false`, `queue: max`.
  Chi lancia e2e **in locale** sullo stesso DB deve prima controllare che non ci
  sia una CI e2e in corso (`gh run list --status in_progress`), altrimenti la
  fa diventare rossa. (ADR 0008)
- **Migration**: solo file numerati in `supabase/migrations/`, mai modifiche dal
  dashboard o dal SQL Editor. Una migration già applicata **non si modifica**:
  se ne scrive una nuova. Ogni migration apre con un'intestazione standard che
  dice come si applica (test con `--project-ref <ref-test>`, produzione solo io,
  a mano) e vieta SQL Editor e automazioni. Non copiare l'intestazione
  dell'ultima migration.
- **Nessun link permanente né automazione verso la produzione.**
  `supabase link` resta solo sul progetto di test; ogni comando ha
  `--project-ref` esplicito. In produzione le migration le applico **io, a
  mano, subito dopo il merge**: prima `supabase db push --project-ref
  <ref-produzione> --dry-run` (deve elencare solo le migration della PR), poi il
  push vero, poi `supabase migration list` (Local e Remote coincidono) e un
  dry-run finale pulito. Mai dal SQL Editor: sfasa lo storico delle migration.
  Un workflow senza secret commenta le PR che toccano `supabase/migrations/**`
  per ricordarmelo. (ADR 0005)
- **GRANT espliciti**: dal 30/10/2026 Supabase non dà più i privilegi di default
  alle tabelle nuove in `public`. Ogni tabella nuova ha, **nella stessa
  migration**, RLS abilitata, policy e GRANT per i ruoli che la usano. Un
  controllo di CI (`grant-check`) confronta le tabelle usate nel codice con i
  grant reali del DB di test.
- **Variabili d'ambiente**: `.env.example` documentato (nomi, a cosa servono,
  quali sono pubbliche), `.env.local` mai committato. Ogni nuova variabile va
  anche su Vercel (produzione **e** anteprima) e, se serve in CI, tra i secret.
  Le variabili `NEXT_PUBLIC_*` sono inlinate nel bundle: in CI quelle del
  progetto di **test**.
- **Cron**: se servono, `vercel.json` + route `/api/cron/...` protette da
  `CRON_SECRET` (Vercel lo manda come Bearer; obbligatorio su Vercel).
- **Repo pubblico: regole inviolabili**
  - `anon key`: pubblica per design, la difesa è la RLS.
  - `service_role key`: segreto vero, bypassa la RLS. Mai nel client, mai
    committata, solo env non versionata. Il suo uso è confinato a pochi file
    ammessi, verificati da un controllo automatico (`check:service-role`,
    parte di `npm run lint`): ogni eccezione richiede una voce motivata
    nell'allow-list e un ADR. (ADR 0002)
  - Mai dati reali di persone, nemmeno come fixture o seed.
  - Le PR esterne si revisionano a mano prima del merge: push su `main` =
    deploy in produzione.
  - I secret delle CI sono solo "Repository secrets", puntano **solo** al
    progetto di test.

## 3. SDLC: dal requisito al merge

### 3.1 Requisiti in `specs/`
- Un file per funzionalità, numerato: `specs/NN - nome.md`. `00 - overview.md`
  è l'indice (obiettivo, ruoli, fuori scope, elenco dei file) e serve solo per
  orientarsi; `0x` trasversali (UX, feedback), `1x` flussi dell'utente
  operativo, `5x` amministrazione. Nessuno `SPEC.md` monolitico.
- Ogni requisito è scritto come **scenari** `## Scenario: ...` in notazione
  Given/When/Then, verificabili.
- Quando un requisito cambia si allineano anche gli altri file di `specs/` che lo
  citano: due requisiti in contraddizione sono un bug.
- Per ogni task si legge **solo** il file di `specs/` della feature in corso.

### 3.2 Test-first (obbligatorio, è un ciclo)
SPECS → TEST (prima del codice) → CODE → CHECK (`npx vitest run` +
`npx playwright test`) → FIX. Un rosso non si lascia "per ora": si corregge il
codice, oppure il test/requisito se è lui a essere sbagliato, poi si ripete
il CHECK.

- **e2e** (`e2e/`): `specs/NN - nome.md` ↔ `e2e/NN-nome.spec.ts`, **un test per
  ogni `## Scenario:`**, nessuno scenario scoperto e nessun test orfano,
  aggiornato subito quando cambia la spec (`00 - overview.md` non ha test).
  In più un controllo axe-core su ogni pagina toccata
  (`nessunaViolazioneA11yGrave` in `e2e/helpers.ts`).
- **Credenziali e2e** da `E2E_<RUOLO>_EMAIL/PASSWORD` (ambiente). Un ruolo non
  configurato fa **saltare** solo i test che lo richiedono (`test.skip` con
  motivo scritto), mai fallire. `playwright.config.ts` legge `.env.local` con
  `loadEnvConfig` di Next. In CI: `retries: 1`, `workers: 2`, `maxFailures`
  tarato perché il report HTML arrivi prima del timeout del job, timeout
  espliciti su azioni e navigazioni, `screenshot: only-on-failure`, reporter
  html + github + json.
- **Regole anti-flaky**
  1. Ogni pulsante che lancia una Server Action si clicca con
     `clickEAttendiAzione` (attende la risposta POST con `next-action`), mai
     `.click()` seguito da `reload`/`goto`/lettura. Un controllo automatico
     (`check:e2e-salva`) lo verifica.
  2. Un valore calcolato dal server si legge con `expect.poll`.
  3. Mai `waitForTimeout`: si attende un evento osservabile.
  4. Dati propri per test via **fixture** (`test.extend`) che creano e
     **eliminano** a fine test, anche in caso di fallimento; account di staff
     propri per i test che cambiano flag di un account. Mai la `service_role`
     negli e2e: si usa la chiave anon con il login dell'admin di test.
  5. Selettori in helper per pagina `e2e/pagina-*.ts`; `helpers.ts` solo cose
     generiche.
  6. Un file e2e che dipende da stato globale condiviso gira in un progetto
     Playwright a worker singolo.
  7. Dopo aver cancellato `.next`, il primo giro Playwright può cadere nel login
     (compilazione lenta): si rilancia.
- **Unit (Vitest)**: ammessi **solo per logica pura** in `lib/`, senza I/O
  (niente Supabase nemmeno finto, niente `fetch`, filesystem, `redirect()`).
  Co-locati col modulo. Tutto ciò che tocca I/O è coperto solo da e2e: un mock
  del client DB dà un falso senso di sicurezza proprio sulle RLS. (ADR 0004)
- **pgTAP** per le RLS: `supabase/tests/database/<tabella>.test.sql`, uno per
  tabella, tutto in `begin; ... rollback;`. Impersonano un `authenticated` con
  `sub` per `auth.uid()` (o l'anonimo) e provano anche il **negativo** (una RLS
  che nega dà zero righe, non errore: asserire i conteggi esatti). Girano in CI
  subito dopo il reset del DB di test, non a mano.
- **Controlli di coerenza in CI** sul DB di test appena resettato (sola lettura,
  Management API, mai produzione): `grant-check` (GRANT mancanti rispetto
  al codice) e `rls-check` (tabelle con privilegi per `anon`/`authenticated` e RLS
  spenta; viste senza `security_invoker`; viste materializzate e tabelle esterne
  esposte). Si correggono con una migration, **mai** togliendo il grant per far
  passare il check. Le eccezioni sono in allow-list motivate e riviste.
- **Giro di fumo sull'anteprima Vercel** (non bloccante, dopo il primo deploy
  di anteprima): workflow a parte su `deployment_status`, una suite piccola
  separata (`e2e-anteprima/`, config propria) con login vero per ogni ruolo,
  nessun `console.error`, nessun 5xx, axe senza violazioni gravi. Ha un job
  `guardia` (logica pura, senza secret) che rifiuta tutto ciò che non è
  un'anteprima della PR di questo repo (mai produzione, mai fork). Il job che
  usa il DB sta nello stesso gruppo di concorrenza dell'e2e. (ADR 0009)
- **Confronto visivo locale** (opzionale, per revisioni grafiche): foto delle
  pagine prima/dopo, fuori dalla CI, immagini in `.gitignore`.

### 3.3 Git e commit
- **Trunk-based**: `main` è il trunk, branch brevi `feat/issue-<n>-slug` /
  `fix/issue-<n>-slug`, PR piccole, **commit atomici**.
- Messaggi **in inglese**, **Conventional Commits**: `feat`, `fix`, `docs`,
  `chore`, `refactor`, `test`, `ci`, `perf`, `build`; `!` per i breaking
  change; titolo breve all'imperativo, dettagli nel corpo, `Refs #n` o
  `Closes #n` in fondo.
- **Bump di versione** in `package.json` e `package-lock.json`, coerenti, prima
  di ogni push (`npm version patch|minor|major`): è l'unica fonte della
  versione. Ogni PR bumpa.
- **Push sempre con ramo esplicito** (`git push origin <ramo>`), mai
  `push -u origin HEAD` né push su `main`; rami creati con `--no-track`.
- Mai `--no-verify`, mai saltare hook o firma.

### 3.4 Hook pre-push (`.githooks/pre-push`)
Attivato da `npm install` (script `prepare`: `git config core.hooksPath
.githooks`). In ordine, fermandosi al primo errore: `next typegen` + `tsc`,
`eslint .`, service-role-check, `vitest run`, `jscpd`, `next build` (stesso
bundler di Vercel: l'unico passo che prende un import server trascinato in un
componente client; saltabile con `SKIP_BUILD_PRE_PUSH=1`; se `.env.local` manca o
è incompleta avvisa e salta invece di bloccare). Non lancia gli e2e. Quando si
tocca `lib/*.ts` conviene lanciare anche `npm run build` a mano.
`npm run analyze` = lint + unit + duplicati + check e2e-salva.

### 3.5 Issue e board
- **Backlog e storia = issue e PR.** Niente file di TODO o `TASKS.md`.
- **Titolo issue**: `<tipo>(<ambito>): <descrizione breve in {{LINGUA_UI}}>`,
  minuscolo, ambito opzionale, stessi tipi dei commit, niente prefissi tipo
  `Bug:` o codici interni. Una label `type:*` per tipo (`feat`→`type:feature`,
  `fix`→`type:bug`, tutto il resto→`type:chore`; un tema di sicurezza ha in più
  `type:security`, titolo `fix(security): …`). Prefisso del titolo e label
  devono coincidere.
- **Template** in `.github/ISSUE_TEMPLATE/` (bug, feature, chore) con obiettivo,
  criteri di accettazione a checklist, riferimenti, promemoria "niente dati reali
  né secret"; `blank_issues_enabled: false`. Si apre sempre da template (anche
  con `gh issue create`).
- **Macchina a stati con label**, il contratto tra agenti (che non si parlano):
  `status:triage` → `status:needs-info` | `status:ready` → `status:in-progress`
  → `status:review` → `status:done` (+ `status:blocked`); `type:*`; `area:*`
  (es. `rls-auth`, `db`, `ui`, `api`); `tier:haiku|sonnet|opus` (chi lavora);
  `ai-driven` / `human-in-the-loop` (chi può mergiare). Si creano con uno
  script idempotente `scripts/setup-board-labels.sh`. `area:*`, `tier:*` e
  `status:*` le assegna il triage, non chi apre. Un GitHub Project con colonne
  Triage / Needs info / Ready / In progress / Review / Done e le automazioni
  native.

### 3.6 Agenti Claude Code (`.claude/`)
Instradamento per costo: modello economico dove si gira spesso, il migliore solo
dove un errore costa caro.
- `triage` (Haiku): riformula, collega a `specs/`, ripulisce il titolo, assegna
  type/area/tier, decide `ready` (con checklist di 3-6 punti) o `needs-info`
  (domande puntuali).
- `implementer` (Sonnet): prende una issue `ready`, la mette `in-progress`, crea
  il branch, implementa **il minimo che soddisfa la checklist**, verifica in
  locale (lint, tsc, build, test), commit atomici, **controllo OWASP prima di
  aprire la PR**, apre una **draft PR** con `Closes #n` (checklist spuntata,
  esito OWASP, note per il reviewer), poi `status:review`. Se la specifica è più
  ambigua del previsto riporta a `needs-info` invece di indovinare. Non mergia
  mai; non tocca RLS/auth/migrazioni senza segnalarlo.
- `reviewer` (Sonnet): aderenza alla checklist, tracciabilità verso `specs/`,
  qualità, test, sicurezza di base. Se la PR tocca RLS, auth, ruoli o
  migrazioni **non approva** e chiede `rls-guardian`. Non mergia. Pubblica i
  commenti scrivendoli prima in un file e usando `--body-file` (mai testo
  inline in `--body`).
- `rls-guardian` (Opus, solo su richiesta): per ogni tabella toccata, RLS
  abilitata, policy distinte per SELECT/INSERT/UPDATE/DELETE, `USING` e
  `WITH CHECK` coerenti, separazione tra ruoli, nessun `service_role` nel client,
  nessun `USING (true)` involontario, migration che non allentano policy,
  intestazione standard, nessun dato sensibile nei log, checklist OWASP.
  **Quando una feature introduce il primo UPDATE/DELETE su una tabella**,
  controllare sempre di avere policy e GRANT per quel tipo di scrittura.
- Comandi: `/next-task [n]` (prende una issue pronta e la affida all'agente
  giusto, una alla volta), `/run-tasks [n] [--dry-run]` (ciclo autonomo con tetto
  di budget di token, mergia da solo solo i task `ai-driven`), `/task-review
  <issue|PR>` (review a richiesta in locale, report in chat), `/owasp-check`
  (OWASP Top 10 sul diff contro `main`, sola lettura, esito OK / DA CORREGGERE).
- Permessi in `.claude/settings.json`: negare la lettura dei file storici
  enormi che non servono (archivio dei task, programma attività).
- Agenti e orchestratori **comunicano in italiano semplice**: chiarezza e
  sintesi, niente gergo da sviluppatore, anche nei commenti su issue/PR e nei
  prompt ai sotto-agenti.
- Le sandbox cloud **non** hanno accesso al DB: non verificano migration, RLS o
  e2e. Quelle verifiche spettano alla CI.

### 3.7 Pull request
- Una PR per issue, **draft** finché non è pronta; titolo in formato
  Conventional Commit, corpo con cosa cambia, checklist, esito OWASP, note per
  il reviewer, `Closes #n`.
- **Il merge lo faccio sempre io.** Nessun agente mergia (fanno eccezione solo i
  task `ai-driven` dentro `/run-tasks`, con CI verde). Il ruleset di `main` lo
  impone: PR obbligatoria, check `CI / verifica` obbligatorio, niente push
  diretti.
- Prima del merge: Vercel genera l'**anteprima** da guardare; la CI è verde;
  se c'è una migration il commento promemoria mi ricorda il passo manuale in
  produzione.
- **Review**: a richiesta in locale (`/task-review`), non automatica per
  costo. La review automatica in cloud esiste nel workflow ma è **spenta** dalla
  variabile di repo `CLAUDE_REVIEW_ENABLED` (non "true" = job saltato, zero
  chiamate API); non parte su fork, su Dependabot, su draft, né con la label
  `skip-review`; ha `--max-turns` e `timeout` bassi, il diff già preparato in un
  file e `concurrency` che cancella i run duplicati. Le PR di sola docs/versione
  non vengono riviste; le PR che toccano solo `specs/` **sì**.
- Una PR di un agente che resta ferma in attesa di me non va accumulata: oltre
  3 PR `human-in-the-loop` aperte `/run-tasks` si ferma.

## 4. CI (GitHub Actions)

Un **unico workflow** `ci.yml` su ogni PR verso `main`, tre job:

```
statico ──► e2e ──► verifica
   └───────────────────┘
```

- **`statico`** (nessun secret sensibile, parallelo tra PR, timeout ~10 min):
  checkout con `fetch-depth: 0` → Node 22 con cache npm → `npm ci` →
  **0. classifica la PR** → `next typegen` + `tsc` → lint → jscpd → vitest →
  `next build` (saltata sulle PR "non codice"; con le `NEXT_PUBLIC_*` del
  progetto di test).
- **`e2e`** (`needs: statico`, parte solo se serve; timeout ~25 min, solo
  esecuzione): build di produzione (serve a `next start`) → Chromium → **reset
  DB di test** (`supabase db reset --linked --project-ref
  ${{ vars.SUPABASE_TEST_PROJECT_REF }} --yes`, token in
  `SUPABASE_ACCESS_TOKEN`) → pgTAP (`supabase test db`) → grant-check →
  rls-check → ricreazione degli account `E2E_*` con la Admin API (il reset
  azzera `auth.users`) → Playwright → riepilogo dei test saltati con motivo nel
  job summary (informativo, mai bloccante) → upload del report HTML come
  artifact (`if: always()`, 14 giorni). Gruppo di concorrenza globale
  `db-test-<progetto>` con `cancel-in-progress: false` e `queue: max` (senza
  `queue: max` GitHub tiene un solo job in attesa e il terzo cancella il
  secondo).
- **`verifica`** (gate finale, pochi secondi, `if: always()`, non fa checkout né
  install): fallisce se `statico` non è verde, o se `e2e` doveva girare e non è
  verde (fallito **o cancellato**); passa se `e2e` è saltato di proposito.
  **Non rinominarlo e non dargli un `name:`**: è il check obbligatorio del
  ruleset. Usa `always()` e non `!cancelled()`: un job richiesto `skipped`
  conterebbe come verde e un run annullato a mano lascerebbe la PR mergiabile
  senza CI.
- **Concorrenza di workflow**: gruppo `ci-<numero PR>` con
  `cancel-in-progress: true` (un nuovo push cancella il run precedente).
- **PR "non codice"** (solo `docs/**`, `specs/**`, `CLAUDE.md`, `README.md`,
  `CHANGELOG.md`, oppure un bump puro di `version`): il workflow parte **sempre**
  — **mai** `paths`/`paths-ignore`, che renderebbero il check obbligatorio "non
  eseguito" invece di "verde" e bloccherebbero il merge. Il passo 0
  (`scripts/classifica-pr.mts`, logica pura in `lib/pr-classificazione.ts`)
  espone un output; build ed e2e si saltano con `if:` sugli step e sul job.
  Nel dubbio una PR è **codice**. tsc/lint/jscpd/vitest girano sempre.
- **Dependabot**: il job `e2e` non parte quando l'attore è `dependabot[bot]`,
  perché quelle run vedono solo lo store di secret "Dependabot", dove
  **deliberatamente non si copiano** `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_SERVICE_ROLE_KEY` né `E2E_*` (un postinstall malevolo di una
  dipendenza aggiornata automaticamente li leggerebbe prima di ogni revisione
  umana). Se un bump tocca codice sensibile (es. `@supabase/ssr`) si rifà la PR
  da un branch umano per avere la CI completa.
- **Permessi minimi** (`permissions: contents: read` di default, scritture solo
  sul job che le richiede). **Mai interpolare valori controllati dall'utente
  dentro `run:`**: passarli come variabili d'ambiente. Azioni ufficiali con
  versione fissata. Ogni job ha `timeout-minutes`. Nessun secret hardcoded.
- Se un e2e viene cancellato in coda e non c'è un run più recente: "Re-run
  failed jobs" o `gh run rerun <id> --failed`.
- Quando una CI è rossa, **si guardano prima i log e gli screenshot** (il report
  HTML è un artifact) e si distingue una regressione della PR da un flaky o da un
  difetto già presente su `main`, prima di toccare codice.

### Workflow accessori
- `claude-board.yml`: triage con Haiku su issue aperta; review con Sonnet su PR
  aperta (spenta, vedi sopra); su issue chiusa come "completed" scambia la label
  `status:*` con `status:done` (solo `gh`, nessun modello, costo zero).
  `claude-code-action` con `--allowedTools` **elencati** (Read, Grep, Glob, Write
  e solo i `gh`/`git` necessari: se manca un tool l'agente gira a vuoto
  riprovando) e `--max-turns` calibrato; riepilogo di token e cache nel job
  summary. Secret `ANTHROPIC_API_KEY`; alert di spesa nella console Anthropic.
- `release.yml`: dopo il merge su `main`, se `version` di `package.json` è
  cambiata, crea il tag `vX.Y.Z` e una **GitHub Release** con note generate dai
  commit convenzionali (logica pura in `lib/rilascio.ts`, nessun `git push`,
  `contents: write` solo sul job). Il changelog è la pagina Releases: niente
  `CHANGELOG.md` versionato (richiederebbe un commit diretto su `main`).
  Recupero a mano con `workflow_dispatch` e `forza`. Non fa parte del gate.
- `promemoria-migration.yml`: commento sulle PR che toccano le migration (senza
  secret né accesso al DB).
- `anteprima-fumo.yml`: giro di fumo, vedi 3.2.

## 5. CD (rilascio e deploy)

- **Produzione = `main`.** Vercel deploya da solo a ogni merge; ogni PR ha la
  sua anteprima. Le variabili d'ambiente "Preview" di Vercel puntano al progetto
  Supabase di **test**.
- Il deploy del codice **non** applica le migration: c'è una finestra tra
  merge e migration in produzione in cui il codice può chiamare colonne o
  funzioni che non esistono ancora. Per questo la procedura manuale (sezione 2)
  va fatta **subito** dopo il merge, e dopo si prova la schermata coinvolta.
- Tag e release automatici (sezione 4). Versione mostrata nel footer derivata a
  build-time.
- Nessuna automazione CI/agente verso la produzione, nemmeno in sola lettura
  se richiede il ref di produzione.

## 6. Gestione degli aggiornamenti delle dipendenze

- **Dependabot** (`.github/dependabot.yml`), cadenza **settimanale** (lunedì),
  per `npm` e per `github-actions`; `open-pull-requests-limit: 5`;
  prefissi di commit `chore(dipendenze)` e `chore(dipendenze-actions)`.
- **Due gruppi npm**: `dipendenze-minori` (minor + patch, di solito passano la
  CI da soli) e `dipendenze-major` (richiedono verifica attenta). I major non
  bloccano i patch.
- **Major dello stack bloccati con `ignore`** (`next`, `eslint-config-next`,
  `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@types/node`,
  `eslint`, `typescript`, `tailwindcss`) finché non c'è un'issue di upgrade
  coordinato: lì il codice si adatta a mano. Il commento nel file dice quale
  issue sblocca e va rimosso a issue chiusa.
- Le PR di Dependabot passano da `statico` + `verifica` (e2e saltata, vedi
  sopra), non ricevono review in cloud. Si mergiano solo con CI verde; un bump
  che tocca sicurezza/auth si rifà da branch umano.
- Gli upgrade major dello stack sono **issue dedicate**, con specs/test aggiornati
  e una voce ADR se cambiano la struttura (es. il passaggio a Next 16).
- Le versioni nei workflow sono fissate; sono le PR di Dependabot per
  `github-actions` ad aggiornarle.

## 7. Documentazione e decisioni

- `CLAUDE.md` (e/o `AGENTS.md`): **solo regole operative essenziali**, brevi,
  con rimando ai dettagli. Il resto va in `docs/sviluppo-dettagli.md` (il
  "perché" e le procedure: CI, hook, DB, versioning) e in `docs/adr/`.
- **ADR** in formato MADR (`docs/adr/NNNN-titolo.md`: Stato, Data, Contesto,
  Decisione, Conseguenze, con indice in `docs/adr/README.md`), per ogni scelta
  architetturale o di processo non ovvia, scritta quando la decisione emerge
  ("proposta") e chiusa ("accettata") quando è presa. Le decisioni che ho preso
  io si scrivono con la mia attribuzione e la data assoluta.
- Le **memorie** dell'agente non duplicano ciò che il repo già dice: si salvano
  solo le preferenze di lavoro non ovvie e le decisioni di progetto che non si
  ricavano dal codice.
- `README.md`: stack, setup locale in 4 passi, come girano i test, come
  contribuire (repo pubblico, niente dati reali, review prima del merge).
- Licenza MIT se il repo è pubblico.

---

## Fasi di esecuzione (in questo ordine)

**Fase A — Scheletro del repo**
1. `create-next-app` (TypeScript, App Router, Tailwind 4, ESLint, nessun `src/`
   se non richiesto), `strict: true`, Node 22 in `engines`/workflow.
2. Struttura: `app/`, `components/ui/`, `components/icone.tsx`, `lib/`
   (`lib/supabase/{server,browser,admin}.ts`, `lib/utils.ts`), `proxy.ts`
   (sessione Supabase + redirect al login), `specs/00 - overview.md`, `e2e/`,
   `supabase/{migrations,tests/database,seed.sql,config.toml}`, `scripts/`,
   `docs/{sviluppo-dettagli.md,adr/}`, `.githooks/`, `.claude/`, `.github/`.
3. `.gitignore` (inclusi `.env*.local`, `next-env.d.ts`, `playwright-report`,
   `test-results`, `playwright-json`), `.env.example` commentato, `.gitattributes`.
4. Config: `eslint.config.mjs`, `.jscpd.json`, `vitest.config.mts` (environment
   `node`, alias `@`), `playwright.config.ts` (progetti `setup`, `chromium`,
   `chromium-stato-condiviso`), `components.json` (shadcn `new-york`, Tailwind 4),
   `vercel.json` (regione), `app/globals.css` con i token.
5. Script `package.json`: `dev`, `build`, `start`, `lint` (`eslint . && npm run
   check:service-role`), `check:dup`, `check:service-role`, `check:e2e-salva`,
   `analyze`, `prepare`, `test:unit`, `test:unit:watch`, `test:e2e`,
   `test:e2e:ui`, `test:anteprima`.
6. Controlli custom con logica pura testata in `lib/`: `service-role-check`,
   `controlla-click-salva`, `classifica-pr`, `grant-check`, `rls-check`,
   `crea-utenti-e2e.mjs`, `riepilogo-skip-e2e`, `rilascio`, `guardia-anteprima`.
7. Primo componente `components/ui` (Pulsante, Campo) con la sua pagina di
   prova e il suo e2e, per far girare la pipeline fin da subito.

**Fase B — Qualità locale**
`.githooks/pre-push` come in 3.4; verifica che `npm run analyze` e `npm run
build` passino su un clone pulito.

**Fase C — Documenti**
`CLAUDE.md` essenziale (stack, convenzioni, specs, workflow, test-first, regole
repo pubblico), `docs/sviluppo-dettagli.md` con il "perché" delle sezioni 2-6,
ADR iniziali (almeno: DB di test condiviso con reset a ogni CI, niente
automazioni verso la produzione, unit test solo su funzioni pure, coda globale
e2e, versione derivata a build-time, libreria componenti), `README.md`.

**Fase D — GitHub**
Workflow `ci.yml`, `claude-board.yml`, `release.yml`, `promemoria-migration.yml`,
`anteprima-fumo.yml`; `dependabot.yml`; template issue; `setup-board-labels.sh`;
`.claude/agents/*` e `.claude/commands/*`.

**Fase E — Passi manuali per Matteo (elencali con i comandi esatti, non
eseguirli tu)**
1. Creare i due progetti Supabase (test e produzione) e passarmi solo i
   segnaposto da compilare; creare il token personale Supabase.
2. Creare il progetto Vercel collegato al repo; impostare le variabili
   (produzione = progetto di produzione, anteprima = progetto di **test**) e
   `CRON_SECRET`.
3. Repository secrets e variables: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_ACCESS_TOKEN`, `E2E_<RUOLO>_EMAIL/PASSWORD` per ogni ruolo,
   `ANTHROPIC_API_KEY`, la variabile `SUPABASE_TEST_PROJECT_REF`, e
   `CLAUDE_REVIEW_ENABLED` (assente = review cloud spenta). Il store "Dependabot"
   **senza** token Supabase, service role ed `E2E_*`.
4. Ruleset di `main`: PR obbligatoria, check richiesto `CI / verifica`, niente
   push diretti né force push.
5. `bash scripts/setup-board-labels.sh`; creare il Project con le colonne e le
   automazioni native.
6. `supabase link` **solo** sul progetto di test; primo `supabase db push
   --project-ref <ref-test>`.
7. Attivare Dependabot e gli alert di sicurezza del repo; impostare un budget con
   alert nella console Anthropic.

**Fase F — Prima feature end-to-end** (per validare la catena)
Una issue piccola dal template → triage → implementer → draft PR → CI verde →
anteprima → io merge → release/tag → (se c'è una migration) passo manuale in
produzione. Se un anello non funziona, correggi il setup prima di procedere.

### Definizione di "fatto" per il bootstrap
- `npm run analyze` e `npm run build` verdi su clone pulito; hook pre-push attivo.
- CI verde su una PR di prova **sia di codice sia "non codice"**, e `verifica`
  verde in entrambi i casi; una PR di Dependabot di prova passa senza e2e.
- Un test e2e per ogni scenario del primo `specs/NN`, axe incluso; un pgTAP per
  la prima tabella con RLS; grant-check e rls-check verdi.
- Nessun secret o dato reale nel repo; `service_role` solo nei file ammessi.
- Documenti presenti e coerenti tra loro (CLAUDE.md breve, dettagli e ADR a parte).
- Elenco dei passi manuali consegnato, con quelli già fatti e quelli da fare.

### Regole di condotta (valgono per tutto il lavoro)
- Una cosa alla volta, PR piccole; non allargare lo scope.
- Riporta con precisione cosa hai verificato e cosa no (es. "non ho potuto
  eseguire gli e2e in locale: mancano i browser"); mai dichiarare verde ciò che
  non hai visto verde.
- Prima di cancellare o sovrascrivere guarda cosa c'è; prima di un'azione
  verso l'esterno chiedi.
- Se trovi un rosso, indaga la causa vera (log, screenshot, confronto con
  `main`) prima di cambiare codice.
