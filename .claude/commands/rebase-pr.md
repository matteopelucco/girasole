---
description: Porta una PR rimasta indietro rispetto a main in pari con un rebase e, solo se richiesto con --merge, la mergia
argument-hint: <n° PR> [--merge]
---

Aggiorni **una** PR rimasta indietro rispetto a `main`: verifichi che il motivo
per cui non si può mergiare sia davvero quello, fai il rebase su `main`,
aggiorni la PR e, solo se c'è `--merge`, la mergi a CI verde.

Argomenti: `$ARGUMENTS`
- il primo numero intero è la PR (con o senza `#`); senza numero, fermati e
  chiedilo;
- `--merge` (opzionale) = dopo il rebase e la CI verde, mergia la PR. Senza
  `--merge` non mergiare mai, nemmeno se è tutto verde.

Comunica in italiano semplice e breve; link in forma
`[#372](https://github.com/matteopelucco/girasole/pull/372)`.

## 1. Pre-flight (se un punto fallisce, fermati e dillo)
1. `git status --short` vuoto: se c'è lavoro non salvato non cominciare.
   Ricorda il ramo corrente (`git branch --show-current`) per tornarci alla fine.
2. `gh auth status` ok.
3. Leggi la PR:
   `gh pr view <n> --json number,state,isDraft,baseRefName,headRefName,isCrossRepository,mergeStateStatus,mergeable,labels,title,statusCheckRollup`
   - `state` deve essere `OPEN` e `baseRefName` `main`;
   - `isCrossRepository` `true` (PR da fork) = **fermati**: le PR esterne si
     revisionano a mano, non si toccano con questo command;
   - se `headRefName` è `main`, fermati.

## 2. La PR è davvero indietro?
`git fetch origin`, poi:
`git rev-list --count origin/<headRefName>..origin/main` (commit di `main` che
mancano alla PR) e `mergeStateStatus`.

- **Indietro** = almeno 1 commit di `main` manca nel ramo (di solito
  `mergeStateStatus` è `BEHIND` o `DIRTY`, `mergeable` `CONFLICTING`):
  prosegui.
- **Non indietro** (0 commit mancanti): **non fare il rebase**. Spiega il vero
  motivo per cui non si mergia (CI rossa o in corso, bozza, review richiesta,
  ecc.: leggi `mergeStateStatus` e `statusCheckRollup`) e fermati. Con `--merge`
  non mergiare comunque: il command serve solo per le PR rimaste indietro.

Dì in una riga quanti commit mancano e se ci sono conflitti attesi.

## 3. Rebase
1. Porta il ramo della PR in locale **senza perdere commit locali**: se esiste
   già `<headRefName>` in locale e differisce da `origin/<headRefName>`, fermati
   (potrebbe avere lavoro non pubblicato); altrimenti
   `git checkout -B <headRefName> origin/<headRefName>` (o `git checkout` se
   coincide già).
2. `git rebase origin/main` (mai su `main`, mai su rami di altre PR).
3. **Conflitti**:
   - Solo `package.json` / `package-lock.json` sul campo `version`:
     tieni la versione di `main` e rifai il bump con lo stesso tipo della PR
     (`patch|minor|major`, deducilo dalla differenza tra la versione al
     punto di partenza della PR e quella della PR), con
     `npm version <tipo> --no-git-tag-version`, così che la versione risulti
     **maggiore** di quella su `main`. Occhio: i file hanno fine riga CRLF,
     non risolvere i marcatori con regex fragili. Prima di `git add` verifica
     che non restino `<<<<<<<`, `=======`, `>>>>>>>`
     (`grep -n` su tutti i file in conflitto) e che i JSON si leggano
     (`node -e "JSON.parse(require('fs').readFileSync('package.json'))"` e lo
     stesso per `package-lock.json`).
   - Altri conflitti: risolvi **solo** se la risoluzione è inequivoca e non
     cambia il significato di nessuna delle due modifiche. Altrimenti
     `git rebase --abort`, lascia la PR com'è, torna al ramo di partenza,
     elenca i file in conflitto e fermati.
   - Dopo ogni risoluzione `git add <file>` e
     `GIT_EDITOR=true git rebase --continue`.
4. A rebase finito, controlla che la versione in `package.json` e
   `package-lock.json` sia la stessa e **maggiore** di quella di
   `origin/main`; se la PR non toccava la versione, non aggiungere un bump.
5. Verifica che il diff sia ancora quello della PR e solo quello:
   `git diff --stat origin/main...HEAD` (nessun file estraneo).

## 4. Aggiorna la PR
`git push --force-with-lease origin <headRefName>` con **nome di ramo
esplicito**: mai `--force` nudo, mai `push -u origin HEAD`, mai su `main`, mai
`--no-verify`. Il hook `pre-push` ripete tsc, lint, jscpd, vitest e build: se
fallisce, leggi l'errore, **non** aggirarlo; se è dovuto al rebase prova a
correggerlo con un commit sul ramo, altrimenti fermati e riportalo.

Poi torna al ramo di partenza (`git checkout <ramo di prima>`).

## 5. CI
Se non c'è `--merge`, basta dire che la CI è ripartita e fermarti qui (vedi
Report).

Con `--merge` attendi la CI con **un solo** comando in background:
`gh pr checks <n> --watch --fail-fast` (`run_in_background`), senza cicli di
`sleep` né scheduler. Se subito dopo il push non risultano ancora check,
riprova una volta a distanza di qualche decina di secondi. Il check che decide
è `verifica`; l'e2e può richiedere 15-20 minuti.
- **Rossa**: leggi solo la parte utile (`gh run view <run-id> --log-failed`,
  ultime righe). Se è infrastruttura o instabilità evidente, un solo
  `gh run rerun <run-id> --failed`. Altrimenti **non mergiare** e riporta il
  test fallito: questo command non corregge il codice della PR.
- **Verde ma `main` si è mosso nel frattempo** (`mergeStateStatus` torna
  `BEHIND` o `DIRTY`): ripeti i passi 2-5 **una sola volta**; se succede di
  nuovo, fermati e dillo.

## 6. Merge (solo con `--merge`)
Condizioni, tutte insieme: `verifica` verde, `mergeStateStatus` `CLEAN`,
nessun conflitto. Altrimenti non mergiare e spiega quale manca.
1. Se la PR è in bozza: `gh pr ready <n>` (l'hai chiesto tu con `--merge`;
   dillo nel report).
2. `gh pr merge <n> --squash --delete-branch` (titolo in stile
   `titolo (#issue) (#pr)`). Mai `--admin`, mai bypass del ruleset di `main`,
   mai con un check rosso.
3. `git checkout main && git pull --ff-only`; controlla che la issue collegata
   si sia chiusa (`gh issue view <n> --json state`).
4. Se la PR ha la label `human-in-the-loop`, ricordalo nel report: l'hai
   mergiata perché lo hai chiesto con `--merge`, non in automatico.

## Report
Poche righe: PR e titolo · commit di `main` che mancavano · conflitti e come
sono stati risolti (o perché ti sei fermato) · nuova versione se rifatta ·
stato CI · mergiata sì/no (e perché no). Se hai lasciato la PR così com'è, dì
cosa deve fare l'umano.

## Regole dure
- Una sola PR per volta; mai rami di altre PR; mai fork.
- Mai `--force` nudo, mai `--no-verify`, mai `--admin`; mai scrivere su `main`
  se non con il merge della PR.
- Mai toccare la produzione né il DB: questo command lavora solo su git e
  GitHub.
- Non lanciare e2e locali né altri lavori sul DB di test condiviso mentre una
  CI sta girando.
- Nel dubbio fermati e chiedi.
