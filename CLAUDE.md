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
