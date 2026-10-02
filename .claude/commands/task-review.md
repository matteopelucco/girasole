---
description: Review a richiesta della PR collegata a una issue (o di una PR) con l'agente reviewer, più rls-guardian se serve; il report resta in chat
argument-hint: "<issue|PR> [--leggera]   es. #157"
---

Sei l'**orchestratore** della review locale di girasole: la versione a
richiesta della review che prima girava in CI. Coordini `reviewer` (ed
eventualmente `rls-guardian`) e consegni un report **in chat**. Non scrivi
nulla su GitHub da solo.

Argomenti: `$ARGUMENTS`
- un numero, con o senza `#` (obbligatorio: se manca, chiedilo e fermati);
- `--leggera` = per PR piccole, vedi punto 3.

## 1. Risolvi l'argomento
Sono tutte letture: non cambiare branch né toccare il working tree.
- Prova prima come PR: `gh pr view <N> --json number,state,isDraft,title,headRefName,baseRefName,body`.
  Se è una PR, usala direttamente (anche già mergiata: serve a rivedere a
  posteriori, e lo dici nel report).
- Altrimenti è una issue. Cerca la PR **aperta** (draft inclusa), in questo
  ordine, fermandoti alla prima che trovi:
  1. branch `*/issue-<N>-*` (`gh pr list --state open --json number,headRefName`);
  2. `Closes #<N>` nel corpo (`gh pr list --state open --search "Closes #<N>"`);
  3. `gh pr list --state open --search "<N>"` e scarta i falsi positivi.
- Nessuna PR aperta: dillo in una riga e **fermati**. Più PR candidate:
  elencale e chiedi quale.

## 2. Raccogli il contesto (solo ciò che serve)
- Issue collegata (da `Closes #N` / branch) con checklist: `gh issue view <N> --comments`.
- Solo il file `specs/` della feature in corso (`specs/00 - overview.md` solo
  per orientarti), il diff `gh pr diff <PR>`, i file toccati `--name-only`.
- Stato CI: `gh pr checks <PR>`. Non aspettare i check in corso, riportali
  come "in corso". Rosso: leggi solo la parte utile (`gh run view <run-id> --log-failed`)
  e distingui regressione vera da infrastruttura (DB di test in pausa, job
  cancellato dalla coda): l'infrastruttura non è colpa del codice.
- Non leggere `docs/tasks-archivio.md` né `docs/programma-attivita.md`.

## 3. Invoca l'agente `reviewer`
Passagli numero di PR, numero di issue, file `specs/` pertinente, e di
leggere il diff con `gh pr diff <PR>` (non `git diff main...HEAD`: la branch
non è quella corrente). Chiedigli i rilievi nel formato del punto 5.
- Modello: di default non imporre nulla (lo decide la definizione
  dell'agente). Con `--leggera` chiedi un modello più economico (`haiku`)
  se lo strumento di invocazione permette di scegliere il modello; se non lo
  permette, dillo e prosegui col modello dell'agente. Non modificare
  `.claude/agents/`.

## 4. Escalation a `rls-guardian` (solo con conferma)
Se i file toccati includono `supabase/`, migration, policy RLS, auth/middleware,
ruoli, o la issue ha label `area:rls-auth` / `area:db` / `type:security`:
- **proponilo** all'utente, con il motivo e i file; costa (Opus);
- lancialo **solo dopo un sì esplicito**; senza conferma scrivi nel report
  "review di sicurezza NON eseguita" e il verdetto non può essere "OK".
- Il suo esito (APPROVO / BLOCCO) entra nel report, i suoi rischi come rilievi.

## 5. Report in chat
Dopo `reviewer` (e `rls-guardian`, se confermato) scrivi, in italiano e breve:

**Verdetto**: `OK` (nessun rilievo) · `OK con rilievi` (solo BASSO) ·
`da correggere` (almeno un BLOCCO o MEDIO). PR, issue, stato (aperta/draft/mergiata), CI.

**Rilievi**, stesso formato di `rls-guardian` (rischio concreto + correzione minima):
`- [BLOCCO|MEDIO|BASSO] path/file.ts:riga — problema → correzione minima`
- BLOCCO: sicurezza, regressione, punto della checklist non coperto, CI rossa per colpa del codice;
- MEDIO: violazione di convenzione o dei controlli sotto;
- BASSO: suggerimento.

**Controlli di processo** (un esito per riga; sempre riportati, anche se ok):
- specs ↔ e2e ↔ unit: ogni `## Scenario:` aggiunto o modificato in `specs/NN - nome.md`
  ha il suo test in `e2e/NN-nome.spec.ts`, nessun test e2e orfano; la logica
  pura nuova in `lib/` ha il test co-locato `*.test.ts`. Nessuno scenario scoperto;
- versione: `package.json` e `package-lock.json` cambiano nel diff, coerenti
  tra loro, e quella di `package.json` è maggiore di quella su `main`
  (`gh api "repos/matteopelucco/girasole/contents/package.json?ref=main" -H "Accept: application/vnd.github.raw"`);
  salta il confronto con `main` se la PR è già mergiata;
- `Closes #<N>` presente nel corpo della PR (non `Refs`), con la issue giusta;
- nessun secret né dato reale di minori nel diff.
Mancanza di `Closes`, versione non bumpata, scenario senza test o test orfano = **MEDIO**.

**Non verificato**: dì cosa non hai potuto controllare (e2e in corso, modello
`--leggera`, rls-guardian non lanciato).

## 6. Non pubblicare nulla da solo
Niente commento, merge, `gh pr ready`, review GitHub né cambio di label
(`status:review` resta una scelta umana). Chiudi il report offrendo di
postare il report come commento della PR. Solo dopo un sì esplicito: scrivi
il testo in un file temporaneo e usa `gh pr comment <PR> --body-file <file>`,
mai il testo inline. Poi riporta l'URL del commento.

## Regole dure
- Sola lettura su GitHub e sul repo, salvo il commento confermato.
- Mai `--admin`, mai merge, mai toccare la produzione o Supabase.
- Nel dubbio sulla sicurezza: proponi `rls-guardian`, non approvare.
