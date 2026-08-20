# CLAUDE.md — Girasole (Registro Elettronico Asilo Sartorio)

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
  produzione.
- Le policy RLS sono la difesa primaria dei dati, non un dettaglio: ogni nuova
  query deve rispettare i confini di ruolo (admin / maestra / genitore)
  descritti in `specs/`. Se una feature richiede una nuova policy, scrivila
  nella migration insieme alla tabella.

## Workflow
- Trunk-based development, commit atomici con messaggio in italiano.
- Prima di ogni nuova feature, aggiornare `TASKS.md` spuntando quanto
  completato.
- Riferimento ai requisiti dettagliati: `specs/` — un file numerato per
  scenario/funzionalità (`specs/00 - overview.md` per obiettivo, ruoli,
  fuori-scope e indice; `0x` per requisiti trasversali come
  `specs/01 - ux.md`; `1x` per la schermata/flusso della maestra, es.
  `specs/11 - login.md`; `5x` per l'amministrazione, es.
  `specs/50_amministrazione_base.md`). Non esiste più un unico `SPEC.md`:
  quando si aggiunge o modifica un requisito, aggiornare o creare il file
  scenario corrispondente in `specs/` (aggiornando l'indice in
  `00 - overview.md`), non un documento monolitico.

## Test-first (importantissimo)
- Ogni file di requisiti in `specs/xxx.md` deve avere un corrispondente
  file `tests/xxx.md` con gli stessi identici nome e numero (es.
  `specs/13 - segna-presenza.md` → `tests/13 - segna-presenza.md`), che
  traduce ogni scenario del requisito in casi di test concreti (dato/
  quando/allora, precondizioni, dati di prova, esito atteso) sufficienti
  a verificarlo efficacemente. `specs/00 - overview.md` fa eccezione: è
  un indice, non un requisito testabile, quindi non ha un file test
  corrispondente.
- **Ad ogni ri-lettura o modifica di un file in `specs/`, aggiornare
  subito il file `tests/` corrispondente** — aggiungere casi per gli
  scenari nuovi, correggere quelli cambiati, rimuovere quelli non più
  validi. I due file non devono mai divergere.
- Quando si esegue la suite (manualmente o via agente), annotare l'esito
  di ogni caso direttamente nel file `tests/xxx.md` (Pass / Fail /
  Bloccato, con nota sul motivo se Bloccato o Fail), così il file resta
  anche il registro dell'ultima esecuzione.
- Oltre al piano di test in Markdown, ogni `specs/xxx.md` ha anche un
  file `e2e/xxx.spec.ts` con test Playwright automatizzati (stesso nome/
  numero, es. `specs/13 - segna-presenza.md` →
  `e2e/13-segna-presenza.spec.ts`) — uno scenario di test per ogni
  `## Scenario:` del requisito, più un controllo di accessibilità axe-core
  (`nessunaViolazioneA11yGrave`, in `e2e/helpers.ts`) su ogni pagina
  toccata. Stessa regola del punto sopra: quando cambia uno scenario in
  `specs/`, aggiornare anche il test Playwright corrispondente, non solo
  il piano in Markdown.
- I test che richiedono una sessione autenticata (admin/maestra/genitore)
  leggono le credenziali da variabili d'ambiente `E2E_<RUOLO>_EMAIL` /
  `E2E_<RUOLO>_PASSWORD` (vedi `.env.example` ed `e2e/helpers.ts`) e si
  saltano da soli (`test.skip`) se non configurate — non devono mai
  fallire per un secret mancante, solo per una regressione reale.

## Test end-to-end (Playwright)
- Suite in `e2e/`, configurazione in `playwright.config.ts`. Include
  `@axe-core/playwright` per un controllo di accessibilità automatico su
  ogni pagina visitata dai test.
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

## Cosa NON fare in questa fase
- Non implementare rette/pagamenti (Fase 2).
- Non costruire il portale genitori completo (Fase 3) — lo schema dati e le
  RLS per i genitori sono già pronti, ma le pagine no.

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
- La suite Playwright gira automaticamente su ogni PR via GitHub Actions
  (`.github/workflows/playwright.yml`, gratuito su repo pubblici) e usa
  le variabili configurate come "Repository secrets" in GitHub — mai
  hardcoded nel workflow. Anche in CI devono puntare a un progetto
  Supabase di test, mai a quello di produzione.
