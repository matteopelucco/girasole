---
description: Ciclo agentico su "n" task della board (n da parametro o calcolato dal budget di token): analizza, implementa, verifica in CI e mergia da solo solo i task ai-driven
argument-hint: "[n] [--dry-run]"
---

Sei l'**orchestratore** del ciclo autonomo di girasole. Come `/next-task`
coordini leggendo lo stato dalla board (label e Project), ma qui ripeti il
ciclo su più task, **uno alla volta**. Il lavoro pesante lo fanno gli agenti
(`triage`, `implementer`, `rls-guardian`): tu leggi solo esiti brevi, per tenere
piccolo il tuo contesto.

Argomenti: `$ARGUMENTS`
- un numero intero = `n`, tetto di task da tentare; assente = lo calcoli (Fase 1);
- `--dry-run` = esegui solo Fasi 0-1 e la selezione, stampa il piano e fermati,
  senza toccare label, branch o PR.

## Fase 0 — Pre-flight (se un punto fallisce, fermati e dillo)
1. Working tree pulito, branch `main`, `git pull --ff-only`. Altrimenti non
   cominciare: potresti sporcare lavoro in corso.
2. `gh auth status` ok con scope `project`.
3. Le label `ai-driven` e `human-in-the-loop` esistono (creale se mancano:
   `gh label create ai-driven --color 0e8a16 --description "Eseguibile e mergiabile in autonomia dall'agente"` e
   `gh label create human-in-the-loop --color d93f0b --description "Serve l'umano: la PR resta aperta per la sua review"`).
4. PR `human-in-the-loop` già aperte e in attesa: se sono ≥ 3, fermati (non
   accumulare lavoro che nessuno ha ancora guardato).

## Fase 1 — Budget: quanti task posso permettermi?
Usa `mcp__ccd_session_mgmt__get_usage` (caricalo con ToolSearch se differito).
Restituisce le finestre del piano (5 ore, settimanale) con `percentUsed`, più
`extraUsage` e la finestra di contesto di questa sessione.

**Soglie di sicurezza** (non si sfondano mai, nemmeno se `n` è più alto):
| Finestra | Tetto di utilizzo |
|---|---|
| 5 ore | 80 % |
| Settimanale (tutti i modelli) | 85 % |
| Extra usage / mensile | non si entra mai in extra usage; se è abilitato e `percentUsed` ≥ 80 %, fermati |
| Contesto di questa sessione | 60 % (`context.percentUsed`) |

**Costo per task**: all'inizio stima prudente 10 punti % sulla finestra 5 ore e
3 punti % su quella settimanale. Dopo ogni task rileggi l'usage e misura la
differenza reale; tieni come stima il **massimo** osservato (la granularità è
1 %, e altre sessioni dell'utente possono consumare in parallelo).

**Calcolo di `n`**:
- `n_budget = min( floor((80 − usato_5h) / costo_5h), floor((85 − usato_sett) / costo_sett) )`
- `n` passato → `n_effettivo = min(n, n_budget)`; `n` assente → `n_effettivo = min(n_budget, 5)`
  (5 è il tetto automatico, alzabile solo passando `n` esplicito).
- Prima di **ogni** task ricalcola con la stima aggiornata: se il prossimo non
  ci sta, fermati e riporta quando si resetta la finestra (`resetsAt`).
- Se `get_usage` non è disponibile (non sei nell'app desktop) o risponde
  `unavailable`: usa `n` se c'è, altrimenti `n = 2`, e dì chiaramente che
  non hai potuto controllare il budget.

Dì in una riga il budget letto e l'`n_effettivo` scelto.

## Fase 2 — Selezione dei task (ordine = ranking della board)
1. Leggi la board (Project 2 dell'utente):
   `gh project item-list 2 --owner matteopelucco --limit 200 --format json`
   L'ordine dell'array è il ranking della board: **rispettalo**, non
   riordinare per numero di issue o per tier.
2. Tieni solo gli elementi `Issue` aperti con Status **`Todo`**. Scarta:
   - Status `In Progress`, `Need Info`, `Done`;
   - label `status:needs-info`, `status:blocked`, `status:in-progress`,
     `status:review` (stanno aspettando qualcuno);
   - issue che hanno già una PR aperta collegata;
   - issue con "Dipende da #X / Axx" non ancora chiuse;
   - elementi di tipo `PullRequest` (es. bump di Dependabot): non sono task.
3. Prendi i primi in ordine finché ne hai `n_effettivo`. Per le issue senza
   `status:ready` (`status:triage` o nessuna label di stato) lancia prima
   l'agente **triage**; se l'esito è `status:needs-info` salta la issue.
4. Con `--dry-run`: stampa tabella (n°, titolo, classificazione prevista) e fermati.

## Fase 3 — Ciclo per ogni task (strettamente sequenziale)

### 3.1 Leggi e classifica
Leggi la issue (`gh issue view <n> --comments`) e il file `specs/` pertinente
(non altro). Decidi **una** etichetta tra `ai-driven` e `human-in-the-loop`.

**`human-in-the-loop`** se vale almeno uno di questi:
- modifiche massive (indicativamente > 15 file o > 600 righe, o più aree
  trasversali insieme), o refactor architetturali;
- aggiornamenti di dipendenze **major** (Next, React, vitest, ...);
- tocca **dati di produzione**: migration in `supabase/migrations/` (da
  applicare a mano in produzione), cambio di significato di colonne/dati
  esistenti, backfill;
- tocca RLS, auth, ruoli (`area:rls-auth`, `area:db`, `type:security`, `tier:opus`);
- modifica workflow CI (`.github/workflows/`), ruleset, secret, hook, `CLAUDE.md`;
- requisito ambiguo o decisione di prodotto da prendere.

**`ai-driven`** se è semplice e contenuto: modifiche prevalentemente
visive/estetiche, di navigazione, copy, bug fix localizzati, test, docs,
chore piccole senza impatto sui dati.

**Nel dubbio: `human-in-the-loop`**, e lascia un commento sulla issue che
dice esplicitamente *quale dubbio* hai avuto (prefisso `**Dubbio di classificazione:**`).

Applica la label (`gh issue edit <n> --add-label ...`). I commenti si scrivono
in un file temporaneo e si pubblicano con `--body-file`, mai inline.

**Escalation a senso unico**: la classificazione può passare da `ai-driven` a
`human-in-the-loop` dopo l'implementazione (vedi 3.4), mai il contrario.

### 3.2 Scomposizione se troppo grande
Se un solo ciclo non basta (più di ~15 file, più feature indipendenti, o
checklist di oltre ~6 punti non omogenei): crea sotto-issue piccole
(`Sotto-issue **a/b/c** di #<n>`, ognuna con obiettivo, criteri di
accettazione e label `type:`/`area:`/`tier:`/`status:ready` + la propria
classificazione), aggiungile alla board (`gh project item-add 2 --owner
matteopelucco --url <url>`) e collegale alla madre come sub-issue
(`gh api repos/matteopelucco/girasole/issues/<madre>/sub_issues -F sub_issue_id=<id numerico della figlia>`).
Commenta sulla madre l'elenco. Poi esegui la **prima** sotto-issue in questo
ciclo (la madre resta aperta, le PR usano `Refs #<madre>`; le altre
sotto-issue entrano nel ranking dei cicli successivi). Questo conta come un task.

### 3.3 Implementazione
Invoca l'agente **implementer** con il numero della issue (o della sotto-issue)
e queste istruzioni aggiuntive:
- test-first come da `CLAUDE.md` (specs → test → codice);
- bump versione coerente in `package.json`/`package-lock.json`
  (`npm version patch --no-git-tag-version`; `minor` per feature) prima del push;
- check locali completi: `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`,
  `npm run build`; più il test e2e pertinente (`npx playwright test e2e/NN-*.spec.ts`)
  se le credenziali `E2E_*` sono nell'ambiente (altrimenti lo farà la CI e dillo
  nel corpo della PR). Se il primo giro Playwright a freddo cade in `auth.setup`
  (compilazione > 20 s) si rilancia: non è un errore reale;
- push (il hook `pre-push` ripete tsc/lint/jscpd/vitest/build) e **draft PR** con `Closes #<n>`;
- se la specifica è più ambigua del previsto: `status:needs-info` con le domande,
  nessun codice. In quel caso **salta al task successivo** (non conta come fallito).

### 3.4 Review di sicurezza e riclassificazione
Guarda il diff della PR (`gh pr diff <pr> --name-only`). Se tocca
`supabase/migrations/`, policy RLS, auth/middleware, ruoli o la issue ha
`area:db`, `area:rls-auth`, `type:security`:
1. invoca l'agente **rls-guardian** sulla PR;
2. `BLOCCO` → una sola tornata di correzione con l'implementer, poi nuova
   review; se resta `BLOCCO`, fermati su questo task come `human-in-the-loop`
   (e segnalalo);
3. **qualsiasi** PR che arriva qui diventa `human-in-the-loop` (migration da
   applicare a mano sul DB, in produzione solo Matteo con `--project-ref`
   esplicito). Scambia la label e commenta il motivo.

Riclassifica a `human-in-the-loop` anche se il diff reale ha sforato i criteri
di 3.1 (workflow CI, dipendenze major, dimensione) pur essendo partito `ai-driven`.

### 3.5 Rebase e CI
**Rebase automatico**: se la branch della PR è indietro rispetto a `main` o la
PR risulta `CONFLICTING` (tipico: bump di versione in `package.json` /
`package-lock.json` identico in due PR), procedi senza chiedere:
`git fetch origin && git rebase origin/main` sulla branch della PR (mai su `main`).
- Conflitti banali (solo il campo `version` di `package.json` /
  `package-lock.json`): tieni il contenuto di `main` e rifai il bump
  (`npm version patch --no-git-tag-version`, `minor` per feature) così che la
  versione risulti maggiore di quella su `main`.
- Altri conflitti: risolvi solo se la risoluzione è inequivoca e non cambia il
  significato di nessuna delle due modifiche; altrimenti `git rebase --abort`,
  lascia la PR com'è e segnala il conflitto all'umano.
- Dopo il rebase: `git push --force-with-lease` **solo** sulla branch della PR
  (mai `--force` nudo, mai su `main`); il hook pre-push ripete i controlli e
  riparte la CI.

Attendi la CI con **un solo** comando bloccante in background:
`gh pr checks <pr> --watch --fail-fast` (`run_in_background`). Non fare cicli
di `sleep` né scheduler: ti riattivi quando il comando termina. Il check
che decide è `CI / verifica` (la e2e può impiegare ~11 min più la coda
globale sul DB di test).

Se è **rossa**, leggi solo la parte utile (`gh run view <run-id> --log-failed`,
ultime righe) e classifica:
- **infrastruttura** (DB di test irraggiungibile/in pausa, job e2e
  cancellato dalla coda, timeout senza test falliti): `gh run rerun <run-id> --failed`
  **una** volta; se resta rossa per lo stesso motivo non è colpa del codice:
  lascia la PR aperta, **non mergiare**, segnala `CI bloccata da infrastruttura`;
- **flaky noto** (e2e instabile che passa al secondo giro): vale il rerun di cui sopra;
- **vera regressione**: invoca di nuovo l'implementer con l'errore, push sulla
  stessa branch (aggiorna la PR, riparte la CI). **Massimo 2 giri di fix**;
  poi fermati, lascia la PR in draft con un commento sul fallimento, e segnala.

Mai `--admin`, mai bypassare il ruleset di `main`, mai saltare un check rosso
legittimo (tsc, lint, build, vitest), nemmeno se l'utente di solito può farlo.

### 3.6 Esito
- **`ai-driven` e `CI / verifica` verde**: `gh pr ready <pr>` poi
  `gh pr merge <pr> --squash --delete-branch` (stile della cronologia
  `titolo (#issue) (#pr)`). Poi `git checkout main && git pull --ff-only`.
  Verifica che la issue si sia chiusa (la label `status:done` la mette
  l'automazione A16); se è sotto-issue, controlla se la madre ha finito e in
  quel caso chiudila con un commento di riepilogo.
- **`human-in-the-loop`** (anche dopo CI verde): **non mergiare**. Lascia la PR
  aperta (draft se non era già pronta), issue in `status:review`, e un
  commento sulla PR con: cosa è stato fatto, perché serve l'umano (la regola di
  3.1/3.4 che è scattata), cosa deve decidere o applicare (es. la migration),
  e cosa è già verificato. Poi passa al task successivo.

### 3.7 Dopo ogni task
Rileggi l'usage, aggiorna le stime di costo (Fase 1), riverifica le soglie e
il contesto della sessione. Fermati e riporta se:
- raggiunto `n_effettivo`, o finiti i task idonei;
- una soglia di budget o il 60 % di contesto sono raggiunti;
- 2 task consecutivi sono finiti in errore (probabile problema sistemico:
  non bruciare budget a ripetere);
- ci sono ≥ 3 PR `human-in-the-loop` in attesa.

## Fase 4 — Report finale e avviso
Tabella breve, una riga per task: n° issue · classificazione · esito
(`mergiata` / `PR aperta: serve te` / `needs-info` / `fallita` / `saltata`)
· link PR. Subito sotto la tabella, **un paragrafo descrittivo** (in prosa,
non un elenco, 4-8 righe) di cosa è stato fatto nel ciclo: che cosa è
cambiato per l'app o per il processo, quali task sono andati in porto da soli e
quali no e perché, se ci sono state scomposizioni, giri di fix o rebase, e
cosa resta da fare. Pensato per chi legge solo quel paragrafo. Poi: budget prima/dopo (% 5 ore e settimanale, reset), motivo
della fermata, e la lista esplicita di **cosa deve fare l'umano** (PR da
revisionare, migration da applicare, dubbi di classificazione commentati,
domande rimaste su `needs-info`).

Se ci sono PR `human-in-the-loop` o fallimenti e hai a disposizione
`PushNotification` (caricalo con ToolSearch), mandane una breve all'utente
con il riepilogo; altrimenti basta il report.

## Regole dure (valgono sopra ogni altra)
- Un task alla volta; mai agenti in parallelo (DB di test e branch condivisi).
- Mai merge di `human-in-the-loop`; mai merge con CI non verde; mai `--admin`.
- Mai toccare la produzione: nessun `supabase db push`/`link` verso produzione,
  nessun secret nel codice o nei commenti (repo pubblico).
- Mai dati reali di bambini o genitori, nemmeno nelle fixture.
- Non leggere `docs/tasks-archivio.md` né `docs/programma-attivita.md` se il task non lo richiede.
- In caso di dubbio su cosa è sicuro: scegli `human-in-the-loop` e dillo.
