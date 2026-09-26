# CLAUDE.md — Girasole (Registro Elettronico Asilo Sartorio)

Regole operative, in breve. Le motivazioni e i dettagli (CI, pre-push, reset
del DB, versioning) sono in [docs/sviluppo-dettagli.md](docs/sviluppo-dettagli.md):
leggere la sezione pertinente solo quando si tocca quell'argomento. Il
"perché" delle scelte deliberate (non i dettagli operativi) è in
[docs/adr/](docs/adr/README.md).

## Stack
Next.js 14 (App Router, Server Actions, Server Components di default),
TypeScript, Tailwind CSS, Supabase (Postgres + Auth + RLS, client in
`lib/supabase/`). Deploy su Vercel (free tier).

## Convenzioni
- UI e testi in italiano. Variabili/funzioni/file in inglese, tranne le
  entità di dominio (`bambini`, `presenze`, `pasti`, `promemoria`,
  `sezioni`) che rispecchiano le tabelle.
- Server Components e Server Actions di default; `'use client'` solo dove
  serve interattività.
- Nessuna nuova dipendenza senza chiedere (restare nel free tier).
- Schema: ogni modifica è un nuovo file numerato in `supabase/migrations/`,
  mai modifiche a mano dalla dashboard. Applicazione: in locale
  `supabase db push --project-ref <ref-test>`; in test la applica il reset
  di CI; in produzione solo Matteo, a mano, con `--project-ref` esplicito.
  Mai link permanenti né automazioni verso la produzione.
- Le policy RLS sono la difesa primaria dei dati: ogni query rispetta i
  confini di ruolo (admin / maestra / genitore) descritti in `specs/`. Una
  policy nuova va nella migration insieme alla tabella.

## Workflow
- Trunk-based, commit atomici con messaggio in italiano.
- `TASKS.md` contiene solo le voci aperte: aggiornarlo prima di ogni nuova
  feature. Lo storico è in `docs/tasks-archivio.md`, da leggere solo se
  serve il contesto di una voce passata.
- Requisiti in `specs/`, un file numerato per scenario (`00 - overview.md`
  è l'indice; `0x` trasversali, `1x` maestra, `5x` amministrazione). Nuovi
  requisiti: aggiornare o creare il file scenario e l'indice.
- Prima di ogni push: bump di versione in `package.json` e
  `package-lock.json` (`npm version patch|minor|major`), coerenti tra loro.
  `VERSIONE_APP` e `DATA_BUILD` si derivano a build-time: non toccare
  `lib/versione.ts` a mano.

## Controlli prima del push
L'hook `.githooks/pre-push` (attivato da `npm install`) lancia `tsc`,
`next lint`, `vitest`, `jscpd` e `next build`; il push si blocca se uno
fallisce. `SKIP_BUILD_PRE_PUSH=1` salta solo la build. A mano:
`npm run analyze`, `npx tsc --noEmit`, `npm run build`.
Se `jscpd` segnala una duplicazione reale si estrae una funzione condivisa
(es. `lib/auth.ts`); una somiglianza casuale non va forzata in
un'astrazione, si alza la soglia in `.jscpd.json` con una nota.

## Test-first (obbligatorio)
Ciclo per ogni modifica non banale, da ripetere finché è tutto verde:
1. **SPECS**: il file `specs/xxx.md` descrive il comportamento con
   `## Scenario:` Given/When/Then; allineare gli altri file che lo citano.
2. **TEST**: `e2e/xxx.spec.ts` con un test per ogni `## Scenario:`, prima
   del codice; `lib/xxx.test.ts` se si tocca una funzione pura in `lib/`.
3. **CODE**: implementare finché i test passano.
4. **CHECK**: nessuno scenario scoperto né test orfano; eseguire
   `npx vitest run` e `npx playwright test` (con `npm run dev`).
5. **FIX**: un test rosso o uno scenario scoperto non si lascia "per ora".

**e2e (Playwright)**
- `specs/NN - nome.md` ↔ `e2e/NN-nome.spec.ts`, stessi nome e numero
  (`00 - overview.md` escluso). Modificando una spec si aggiorna subito
  il file e2e. Controllo axe-core (`nessunaViolazioneA11yGrave`) su ogni
  pagina toccata.
- Credenziali da `E2E_<RUOLO>_EMAIL/PASSWORD`; senza, il test si salta
  (`test.skip`), non fallisce.
- I test scrivono dati veri: `NEXT_PUBLIC_SUPABASE_URL` deve puntare al
  progetto di **test**, mai alla produzione.
- Ogni salvataggio seguito da `reload`/`goto`/lettura di un valore calcolato
  dal server si clicca con `clickEAttendiAzione` (`e2e/helpers.ts`); i
  valori calcolati si leggono con `expect.poll`.

**Unit (Vitest)**
- Solo funzioni pure in `lib/`: niente Supabase (nemmeno mockato), `fetch`,
  filesystem o `redirect()`. Tutto ciò che fa I/O resta coperto solo da e2e.
- Test co-locati (`lib/date.ts` → `lib/date.test.ts`), con i casi limite
  significativi. `npm run test:unit` o `npm run test:unit:watch`.

## Repo pubblico: sicurezza (non negoziabile)
- La `anon key` è pubblica per design: la sicurezza è la RLS.
- La `service_role key` bypassa la RLS: mai lato client, mai committata,
  mai in una route pubblica. Solo in variabili d'ambiente non versionate.
- Mai dati reali di bambini o genitori, nemmeno come seed o fixture.
- Le PR esterne si revisionano prima del merge: un push su `main` fa
  deploy in produzione.
- CI (`.github/workflows/ci.yml`): tsc → lint → jscpd → vitest →
  `next build` → reset del DB di test (`girasole_dev`, condiviso con lo
  sviluppo locale) → e2e. Secret solo come Repository secrets, sempre verso
  il progetto di test.
