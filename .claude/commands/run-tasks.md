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
Usa `mcp__ccd_session_mgmt__get_usage` (caricalo con ToolSearch se differito):
restituisce `percentUsed` per le finestre del piano, `extraUsage` e il contesto
della sessione.

| Finestra | Tetto (mai da sfondare, nemmeno con `n` più alto) |
|---|---|
| 5 ore | 80 % |
| Settimanale (tutti i modelli) | 85 % |
| Extra usage / mensile | mai entrarci; se abilitato e `percentUsed` ≥ 80 %, fermati |
| Contesto di questa sessione (`context.percentUsed`) | 60 % |

- **Costo per task**: stima iniziale prudente 10 punti % (5 ore) e 3 punti %
  (settimanale). Dopo ogni task rileggi l'usage e tieni come stima la
  differenza **massima** osservata (granularità 1 %, altre sessioni consumano
  in parallelo).
- **Formula**: `n_budget = min( floor((80 − usato_5h) / costo_5h), floor((85 − usato_sett) / costo_sett) )`;
  `n` passato → `n_effettivo = min(n, n_budget)`; `n` assente →
  `n_effettivo = min(n_budget, 5)` (5 alzabile solo con `n` esplicito).
- Prima di **ogni** task ricalcola con la stima aggiornata: se il prossimo non
  ci sta, fermati e riporta quando si resetta la finestra (`resetsAt`).
- `get_usage` non disponibile o `unavailable`: usa `n` se c'è, altrimenti
  `n = 2`, e dì che non hai potuto controllare il budget.

Dì in una riga il budget letto e l'`n_effettivo` scelto.

## Fase 2 — Selezione dei task (priorità = posizione in board, bug in vantaggio)
La board è ordinata a mano da Matteo: **più in alto = più importante**. È il
criterio di priorità quasi esclusivo. Non sostituirlo con tuoi giudizi di
comodo (issue "più piccola", tier più economico, numero di issue più basso,
area che conosci meglio): nel dubbio vince la posizione.

1. Leggi la board (Project 2 dell'utente) **già filtrata**, senza scaricare
   l'output grezzo:
   ```
   gh project item-list 2 --owner matteopelucco --limit 500 --format json --jq '{complete:(.totalCount==(.items|length)), pr_todo:([.items[]|select(.status=="Todo" and .content.type=="PullRequest")]|length), todo:[.items|to_entries[]|select(.value.status=="Todo" and .value.content.type=="Issue")|{pos:.key, n:.value.content.number, t:.value.title, l:.value.labels}]}'
   ```
   - L'ordine dell'array della board è il ranking: `pos` (da 0) è l'indice nella
     board **prima** del filtro e serve per il report; `todo` resta nell'ordine
     originale, quindi la posizione dei candidati (1, 2, 3…) è quella nella
     lista `todo`.
   - `complete` deve essere `true` (`totalCount` == `items.length`); se è
     `false` la board supera il limite: alzalo (deve restare sopra il numero
     di item, altrimenti le issue `Todo` in fondo non si vedono mai).
2. Il filtro tiene già solo le `Issue` con Status **`Todo`** (restano fuori
   `In Progress`, `Need Info`, `Done` e i `PullRequest`, es. i bump di
   Dependabot). Dei candidati scarta ancora:
   - label `status:needs-info`, `status:blocked`, `status:in-progress`,
     `status:review` (stanno aspettando qualcuno);
   - issue che hanno già una PR aperta collegata;
   - issue con "Dipende da #X / Axx" non ancora chiuse;
   - **madri con sub-issue aperte**: sono contenitori, non task. Per ogni
     candidato controlla, senza gonfiare il contesto:
     `gh api repos/matteopelucco/girasole/issues/<n>/sub_issues --jq '[.[]|select(.state=="open")|.number]'`
     (array vuoto = nessuna figlia aperta). Se una madre ha **tutte** le figlie
     chiuse, chiudila con un commento di riepilogo **solo se** i suoi criteri
     "Fatto quando" sono davvero soddisfatti (come in 3.6); altrimenti lasciala
     aperta e segnalala all'umano (es. obiettivo numerico non raggiunto).
   Le schede di PR in Todo non sono task e non vanno contate (il Project le
   porta in `Done` da solo se i workflow integrati "Pull request merged" e
   "Item closed" sono attivi: è un'impostazione che fa Matteo a mano).
3. **Priorità dei bug nel loro intorno.** Un bug è un'issue con label
   `type:bug` (o `bug`), oppure con titolo che inizia per `fix:` / `fix(`
   (convenzione dei titoli in `CLAUDE.md`; le issue storiche `Bug: …` hanno
   comunque `type:bug`). Un bug può scavalcare i non-bug **vicini**, non l'intera lista:
   - posizione effettiva del bug = `posizione − 5` (l'intorno è di 5 posti);
     per i non-bug la posizione effettiva è quella reale;
   - riordina per posizione effettiva crescente; a parità vince il bug; tra
     elementi dello stesso tipo resta l'ordine di board (ordinamento stabile);
   - quindi un bug in posizione 4 passa davanti a tutto, un bug in posizione 9
     passa davanti ai non-bug in posizione 5-8 ma non a quelli in 1-4, un bug
     in posizione 30 non scavalca nulla di quello che sta in alto;
   - tra due bug conta la posizione di board (il più in alto prima).
4. Prendi i primi della lista così ordinata finché ne hai `n_effettivo`. Per le
   issue senza `status:ready` (`status:triage` o nessuna label di stato) lancia
   prima l'agente **triage**; se l'esito è `status:needs-info` salta la issue
   e passa alla successiva **nella stessa lista ordinata**.
5. Con `--dry-run`: stampa tabella (posizione di board, posizione effettiva,
   n° issue, titolo, "bug" sì/no, classificazione prevista) e fermati. Il
   report finale (Fase 4) riporta nella riga di ogni task la posizione di board
   e, se un bug ha scavalcato altri, quali.

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
Commenta sulla madre l'elenco. Quando parte la prima sotto-issue, sposta la
madre in Status `In Progress` nel Project (solo lettura per trovare gli id, poi
una sola modifica):
```
gh project field-list 2 --owner matteopelucco --format json --jq '.fields[]|select(.name=="Status")|{id,options}'   # id campo Status e id opzione "In Progress"
gh project view 2 --owner matteopelucco --format json --jq '.id'                                                    # id del Project
gh project item-list 2 --owner matteopelucco --limit 500 --format json --jq '.items[]|select(.content.number==<madre>)|.id'   # id della scheda
gh project item-edit --id <id scheda> --project-id <id Project> --field-id <id campo Status> --single-select-option-id <id opzione>
```
Gli id non si scrivono a mano nel comando: si rileggono ogni volta con i primi
tre comandi (le opzioni sono `Todo`, `In Progress`, `Need Info`, `Done`). Poi esegui la **prima** sotto-issue in questo
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
  quel caso chiudila con un commento di riepilogo, ma solo se i suoi criteri
  "Fatto quando" sono davvero soddisfatti (altrimenti lasciala aperta e
  segnalala). Alla chiusura della madre lo Status passa a `Done`: di solito lo
  fa il workflow "Item closed" del Project; se non è attivo (o la scheda resta
  `In Progress`), fallo con `gh project item-edit` come in 3.2, scegliendo
  l'opzione `Done`.
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
Tabella breve, una riga per task: n° issue · posizione in board (con nota
`bug: ha scavalcato #X, #Y` se è successo) · classificazione · esito
(`mergiata` / `PR aperta: serve te` / `needs-info` / `fallita` / `saltata`)
· link PR. Subito sotto la tabella, **un paragrafo descrittivo** (in prosa,
non un elenco, 4-8 righe) di cosa è stato fatto nel ciclo: che cosa è
cambiato per l'app o per il processo, quali task sono andati in porto da soli e
quali no e perché, se ci sono state scomposizioni, giri di fix o rebase, e
cosa resta da fare. Pensato per chi legge solo quel paragrafo. Poi: lo stato
della colonna `Todo` in due numeri separati, **Todo reali** (task candidabili)
e **madri/PR in Todo** (madri scartate in Fase 2 più `pr_todo`: non sono
lavoro da fare); budget prima/dopo (% 5 ore e settimanale, reset), motivo
della fermata, e la lista esplicita di **cosa deve fare l'umano** (PR da
revisionare, migration da applicare, dubbi di classificazione commentati,
domande rimaste su `needs-info`).

**Link alle issue (sempre).** Ogni volta che il report nomina una issue (nella
tabella, nel paragrafo, nelle liste "cosa deve fare l'umano", nelle note) la
scrive in forma breve con link ipertestuale alla issue su GitHub:
`[#245](https://github.com/matteopelucco/girasole/issues/245)`, mai il solo
`#245` né l'URL nudo né il titolo al posto del numero. Lo stesso vale per le PR
(`[#248](https://github.com/matteopelucco/girasole/pull/248)`), compresa la
colonna "link PR" della tabella. Vale anche per il report di `--dry-run`.

Se ci sono PR `human-in-the-loop` o fallimenti e hai a disposizione
`PushNotification` (caricalo con ToolSearch), mandane una breve all'utente
con il riepilogo; altrimenti basta il report.

## Regole dure (valgono sopra ogni altra)
- Un task alla volta; mai agenti in parallelo (DB di test e branch condivisi).
- Mai merge di `human-in-the-loop`; mai merge con CI non verde; mai `--admin`.
- Mai toccare la produzione: nessun `supabase db push`/`link` verso produzione,
  nessun secret nel codice o nei commenti (repo pubblico).
- Mai dati reali di bambini o genitori, nemmeno nelle fixture.
- `docs/tasks-archivio.md` e `docs/programma-attivita.md` non si leggono: sono
  bloccati da `permissions.deny` in `.claude/settings.json`.
- In caso di dubbio su cosa è sicuro: scegli `human-in-the-loop` e dillo.
