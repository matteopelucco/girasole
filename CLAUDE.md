# CLAUDE.md — Girasole (Registro Elettronico Asilo Sartorio)

Regole operative **essenziali**. Motivazioni, dettagli procedurali (CI,
hook, DB, versioning) e il "perché" delle scelte deliberate sono in
[docs/sviluppo-dettagli.md](docs/sviluppo-dettagli.md) e
[docs/adr/](docs/adr/README.md): consulta la sezione pertinente solo quando
la tua task lo richiede.

## Stack
Next.js 14 (App Router, Server Actions, Server Components), TypeScript,
Tailwind CSS, Supabase (Postgres + Auth + RLS), deploy Vercel (free tier).

## Convenzioni
- UI italiana; variabili/funzioni/file inglesi, salvo dominio
  (`bambini`, `presenze`, `pasti`, `promemoria`, `sezioni`).
- Server Components/Actions per default; `'use client'` solo se serve
  interattività.
- Nessuna nuova dipendenza senza chiederlo (free tier).
- Schema: file numerati in `supabase/migrations/`, mai dashboard.
  RLS: difesa primaria. Policy nuova → migration insieme alla tabella.

## Specs: leggi solo il pertinente
Per ogni task, leggere **solo** il file `specs/` della feature in corso;
`specs/00 - overview.md` solo per orientarsi; non leggere
`docs/tasks-archivio.md` o `docs/programma-attivita.md` se il lavoro non
lo richiede.

## Workflow
- Trunk-based, commit atomici in italiano.
- `TASKS.md` (voci aperte): aggiornare prima di ogni feature. Storico in
  `docs/tasks-archivio.md`.
- Requisiti: `specs/`, numerati per scenario. Aggiornare `00 - overview.md`
  se nuovi.
- Bump versione in `package.json`/`package-lock.json` coerenti prima di
  ogni push (`npm version patch|minor|major`).
- Pre-push: `tsc`, `lint`, `jscpd`, `vitest`, `next build` (saltabile con
  `SKIP_BUILD_PRE_PUSH=1`). Dettagli in `docs/sviluppo-dettagli.md`.

## Test-first (obbligatorio)
Ciclo: SPECS → TEST (prima del codice) → CODE → CHECK (verde?) → FIX.

**e2e**: `specs/NN - nome.md` ↔ `e2e/NN-nome.spec.ts`, uno scenario =
un test. Nessuno scenario coperto 2× né test orfano. Credenziali da
`E2E_<RUOLO>_EMAIL/PASSWORD` (ambiente); DB = progetto test, mai
produzione. Controllo a11y con axe-core su ogni pagina toccata.

**Unit**: Solo logica pura in `lib/`, co-locati (`lib/date.ts` →
`lib/date.test.ts`). Niente Supabase, `fetch`, filesystem o `redirect()`
— tutto ciò è e2e. Dettagli in `docs/sviluppo-dettagli.md`.

## Repo pubblico: sicurezza (inviolabile)
- `anon key`: pubblica per design → RLS è la difesa.
- `service_role key`: segreto vero, bypassa RLS → mai client, mai
  committata, solo env non versionata.
- Mai dati reali di bambini/genitori, nemmeno fixture.
- PR esterne revisionare prima del merge (push a `main` = deploy prod).
- CI: tsc → lint → jscpd → vitest → build → DB reset → e2e. Secret solo
  Repository secrets, verso progetto test. Dettagli in
  `docs/sviluppo-dettagli.md`.
