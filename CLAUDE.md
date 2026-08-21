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
  `specs/50 - amministrazione_base.md`). Non esiste più un unico `SPEC.md`:
  quando si aggiunge o modifica un requisito, aggiornare o creare il file
  scenario corrispondente in `specs/` (aggiornando l'indice in
  `00 - overview.md`), non un documento monolitico.

## Test-first (importantissimo) — solo Playwright

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
   codice applicativo, un test per ogni `## Scenario:`.
3. **CODE** — implementa/modifica il codice applicativo (pagine, server
   actions, migration) finché soddisfa quei test.
4. **CHECK_COVERAGE** — verifica che ogni `## Scenario:` di ogni
   `specs/xxx.md` abbia un test corrispondente (nessuno scenario
   scoperto, nessun test orfano che non corrisponde più a uno scenario
   reale) ed esegui la suite (`npx playwright test`, con `npm run dev`
   attivo — vedi sotto).
5. **FIX** — se un test fallisce o uno scenario risulta scoperto, non è
   accettabile lasciarlo così "per ora": o si corregge il codice, o si
   corregge il test/requisito se era lui ad essere sbagliato. Poi si
   ripete dal passo 4.

- Niente piani di test in Markdown: l'unica suite di test è quella
  eseguibile in `e2e/`. Ogni file di requisiti in `specs/xxx.md` deve
  avere un corrispondente `e2e/xxx.spec.ts` con gli stessi identici nome
  e numero (es. `specs/13 - segna-presenza.md` →
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
