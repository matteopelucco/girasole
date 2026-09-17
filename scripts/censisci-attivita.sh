#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# censisci-attivita.sh — crea sulla board tutte le attività del
# docs/programma-attivita.md come issue, con label e milestone di fase.
#
# Prerequisiti: gh autenticato nel repo; label create con
#               scripts/setup-board-labels.sh (attività A00).
# Idempotente:  salta le issue il cui titolo esiste già.
# Uso:          bash scripts/censisci-attivita.sh
# ---------------------------------------------------------------------------
set -euo pipefail

DOC="docs/programma-attivita.md"

milestone() {   # nome descrizione
  if ! gh api "repos/{owner}/{repo}/milestones?state=all" --jq '.[].title' | grep -qx "$1"; then
    gh api "repos/{owner}/{repo}/milestones" -f title="$1" -f description="$2" >/dev/null
    echo "  ✓ milestone: $1"
  fi
}

crea() {        # codice titolo milestone labels corpo
  local codice="$1" titolo="$2" ms="$3" labels="$4" corpo="$5"
  local full="$codice · $titolo"
  if gh issue list --state all --search "\"$full\" in:title" --json title --jq '.[].title' | grep -qxF "$full"; then
    echo "  = $full (già presente)"; return
  fi
  gh issue create --title "$full" --milestone "$ms" --label "$labels" \
    --body "$corpo

---
Voce **$codice** di \`$DOC\`. Rianalizzare e, se serve, spezzare in sotto-issue prima di iniziare." >/dev/null
  echo "  ✓ $full"
}

echo "== Milestone =="
milestone "Fase 0 · Board"             "Label, Project, censimento (manuale, oggi)"
milestone "Fase 1 · Fondamenta"        "Solo configurazione: CI viva, PR sicure, agenti attivi"
milestone "Fase 2 · Rete di sicurezza" "Migration tracciate, e2e credibile, RLS testata (mai la prod)"
milestone "Fase 3 · Evoluzione"        "Costi, contesto, stack, service_role"

# Tutte le issue nascono già triate (status:ready): il triage Action, se attivo,
# salta le issue che hanno già uno status.
R="status:ready"

echo "== Fase 0 =="
crea A00 "Creare le label e il Project GitHub" "Fase 0 · Board" "$R,type:chore,tier:haiku" \
"**Obiettivo**: label \`status/type/area/tier\` create (\`scripts/setup-board-labels.sh\`) e Project *girasole* in vista Board con colonne Triage / Needs info / Ready / In progress / Review / Done.
**Fatto quando**: \`gh label list\` le mostra; Project con automazioni *Item added → Triage* e *PR merged → Done*.
Sforzo S · Ambiente PC/cloud · Rischio prod nessuno"

crea A01 "Censire il programma come issue" "Fase 0 · Board" "$R,type:chore,tier:haiku" \
"**Obiettivo**: ogni attività del programma è una issue con label e milestone.
**Fatto quando**: questo script eseguito; issue visibili nel Project.
Dipende da A00 · Sforzo S · Rischio prod nessuno"

crea A02 "Committare lo scaffold agenti (senza attivarlo)" "Fase 0 · Board" "$R,type:chore,tier:haiku" \
"**Obiettivo**: \`.claude/agents/*\`, \`.claude/commands/next-task.md\`, \`.github/workflows/claude-board.yml\`, \`scripts/\` nel repo. L'Action resta inerte senza secret (A03) e flusso PR (A10).
**Fatto quando**: file su main; \`npm run analyze\` verde.
Dipende da A00 · Sforzo S · Ambiente cloud · Rischio prod nessuno"

crea A03 "Secret ANTHROPIC_API_KEY e GitHub App" "Fase 0 · Board" "$R,type:chore,tier:haiku" \
"**Obiettivo**: da Claude Code \`/install-github-app\`; secret nel repo.
**Fatto quando**: secret in Settings → Secrets; un'issue di prova riceve il commento di triage.
Dipende da A02 · Sforzo S · Ambiente PC · Rischio prod nessuno"

echo "== Fase 1 =="
crea A10 "main protetto: solo PR, check obbligatori" "Fase 1 · Fondamenta" "$R,type:chore,tier:haiku" \
"**Obiettivo**: nessun push diretto su main; merge solo con check verdi; delete branch on merge.
**Perché**: 116 commit su 130 senza PR; v0.39.0 e v0.40.0 arrivate a Vercel con build rotta. Rende sicuro anche il lavoro da telefono.
**Fatto quando**: push diretto rifiutato; PR con check rossi non mergeabile.
Dipende da A12 · Sforzo S · Rischio prod nessuno"

crea A11 "Pulizia dei 18 branch claude/* orfani" "Fase 1 · Fondamenta" "$R,type:chore,tier:haiku" \
"**Obiettivo**: branch remoti \`claude/*\` mergiati o abbandonati eliminati (verificare prima se contengono lavoro mai mergiato).
**Fatto quando**: \`git branch -r\` mostra solo main e branch di PR aperte.
Sforzo S · Ambiente cloud · Rischio prod nessuno"

crea A12 "Workflow CI unificato su PR, con next build" "Fase 1 · Fondamenta" "$R,type:chore,area:api,tier:sonnet" \
"**Obiettivo**: un solo \`ci.yml\` su pull_request: tsc → lint → jscpd → vitest → **next build** → e2e. Sostituisce \`analisi-statica.yml\` e \`playwright.yml\`.
**Perché**: \`next build\` mancava ovunque: è il buco esatto di v0.39/0.40.
**Fatto quando**: PR di prova mostra i 6 step; un import server in un client component fa fallire la build.
Sforzo M · Ambiente cloud · Rischio prod nessuno"

crea A13 "Regola ESLint sul confine client/server" "Fase 1 · Fondamenta" "$R,type:chore,area:ui,tier:sonnet" \
"**Obiettivo**: \`no-restricted-imports\`: un modulo \`'use client'\` non importa \`lib/auth\` né \`lib/supabase/server\` (né \`lib/*\` che li importano).
**Perché**: la *nota per il futuro* di v0.40.1 deve diventare un errore di lint.
**Fatto quando**: reintrodurre l'import di v0.39 fa fallire \`npm run lint\`.
Sforzo S · Ambiente cloud · Rischio prod nessuno"

crea A14 "Versione da una sola fonte" "Fase 1 · Fondamenta" "$R,type:chore,tier:sonnet" \
"**Obiettivo**: \`VERSIONE_APP\` da \`npm_package_version\`, \`DATA_BUILD\` da \`VERCEL_GIT_COMMIT_SHA\` + timestamp build; via il bump manuale in \`lib/versione.ts\`.
**Fatto quando**: footer corretto su una preview Vercel senza toccare versione.ts.
Sforzo S · Ambiente cloud · Rischio prod basso"

crea A15 "next build nel pre-push hook (opzionale)" "Fase 1 · Fondamenta" "$R,type:chore,tier:haiku" \
"**Obiettivo**: il hook include la build, con flag per saltarla quando serve velocità.
**Fatto quando**: un push con build rotta è bloccato in locale.
Dipende da A12 · Sforzo S · Ambiente PC · Rischio prod nessuno"

crea A16 "Attivare triage e review dell'agente" "Fase 1 · Fondamenta" "$R,type:chore,tier:haiku" \
"**Obiettivo**: \`claude-board.yml\` gira: triage (Haiku) su issue aperta, review (Sonnet) su PR aperta.
**Fatto quando**: un'issue nuova riceve triage + label; una PR riceve la review.
Dipende da A03, A10 · Sforzo S · Ambiente CI · Rischio prod nessuno"

crea A17 "Documentare il flusso remoto (telefono)" "Fase 1 · Fondamenta" "$R,type:chore,tier:haiku" \
"**Obiettivo**: \`docs/flusso-remoto.md\`: issue → sessione cloud → draft PR → CI (build, migration su test, e2e) → review → merge dal telefono.
**Perché**: le sessioni cloud non raggiungono il DB; la CI fa ciò che la sandbox non può.
**Fatto quando**: un'attività piccola portata da issue a merge interamente da telefono.
Dipende da A10, A12, A16 · Sforzo S · Rischio prod nessuno"

echo "== Fase 2 =="
crea A20 "Supabase CLI: init e link a test e prod" "Fase 2 · Rete di sicurezza" "$R,type:chore,area:db,tier:sonnet" \
"**Obiettivo**: \`supabase/config.toml\`; \`supabase link\` verso test e verso prod (due profili).
**Perché**: 51 migration applicate a mano su due DB, senza tracciamento.
**Fatto quando**: \`supabase migration list\` risponde per entrambi.
Sforzo M · Ambiente PC · Rischio prod nessuno (sola lettura)"

crea A21 "Riconciliazione una tantum dello stato migration su test e prod" "Fase 2 · Rete di sicurezza" "$R,type:security,area:db,tier:opus" \
"**Obiettivo**: per ognuna delle 51 migration si sa se è applicata su test e su prod; le mancanti vengono applicate; \`supabase_migrations\` riflette la realtà.
**Perché**: 4 migration non applicate o fallite silenziosamente, 30 promemoria manuali, incertezza esplicita in TASKS.md.
**Fatto quando**: \`migration list\` identico e completo su test e prod; \`supabase db diff\` vuoto.
⚠️ Tocca la prod: orario di non uso, **backup prima**.
Dipende da A20 · Sforzo L · Ambiente PC · Rischio prod MEDIO"

crea A22 "db push come unico canale; aggiornare CLAUDE.md e README" "Fase 2 · Rete di sicurezza" "$R,type:chore,area:db,tier:haiku" \
"**Obiettivo**: il SQL Editor non è più un modo ammesso per applicare migration; procedura documentata.
**Fatto quando**: CLAUDE.md non cita più il SQL Editor; migration nuova in test via CI (A23), in prod via \`db push\` dopo il merge.
Dipende da A21 · Sforzo S · Rischio prod nessuno"

crea A23 "CI: DB di test pulito per ogni run (reset + migration + seed) prima della e2e" "Fase 2 · Rete di sicurezza" "$R,type:chore,area:db,tier:sonnet" \
"**Obiettivo**: ogni run e2e parte da schema pulito con seed noto.
**Perché**: il DB di test condiviso e mutabile causa i 145 \`test.skip\` e rende intestabili le azioni irreversibili.
**Fatto quando**: due run consecutivi danno lo stesso risultato; seed riproducibile.
Dipende da A20, A12 · Sforzo L · Ambiente CI · Rischio prod nessuno"

crea A24 "Account-ruolo di test e secret E2E_* completi" "Fase 2 · Rete di sicurezza" "$R,type:chore,tier:haiku" \
"**Obiettivo**: admin, maestra, assistente, genitore (+ opzionali) nel progetto di test; secret in GitHub.
**Perché**: molti skip dipendono da ruoli mancanti; il bug 0030 è passato perché i test giravano solo come admin.
**Fatto quando**: \`auth.setup.ts\` non salta nessun ruolo in CI.
Dipende da A23 · Sforzo S · Ambiente PC · Rischio prod nessuno"

crea A25 "Rendere testabili le azioni irreversibili, ridurre gli skip" "Fase 2 · Rete di sicurezza" "$R,type:chore,tier:sonnet" \
"**Obiettivo**: Rojac, conferma settimana, decisione straordinario hanno e2e che premono davvero *Conferma*; skip solo per l'ora reale.
**Perché**: 145 \`test.skip\` su 208 test.
**Fatto quando**: report Playwright con skip < 20; nessuno scenario di specs/16, 18, 19 coperto solo da unit per impossibilità.
Dipende da A23, A24 · Sforzo L · Ambiente CI · Rischio prod nessuno"

crea A26 "Grant-check meccanico in CI" "Fase 2 · Rete di sicurezza" "$R,type:security,area:db,tier:sonnet" \
"**Obiettivo**: script che confronta le tabelle usate nel codice (per ruolo) con \`information_schema.role_table_grants\` sul DB di test; fallisce se manca un GRANT.
**Perché**: 8 incidenti *permission denied*, stessa classe, rifixata sei volte.
**Fatto quando**: rimuovere un grant dal seed fa fallire la CI con il nome della tabella.
Dipende da A23 · Sforzo M · Ambiente CI · Rischio prod nessuno"

crea A27 "Test pgTAP sulle policy RLS per ruolo" "Fase 2 · Rete di sicurezza" "$R,type:security,area:rls-auth,tier:opus" \
"**Obiettivo**: test SQL per ruolo sulle tabelle sensibili (prime: presenze, pasti, profili_orari, comunicazioni_retta).
**Perché**: la RLS è la difesa primaria ma è verificata solo via UI, quasi solo come admin.
**Fatto quando**: pgTAP in CI; un test riproduce il bug 0030 e passa solo con la policy.
Dipende da A23 · Sforzo M · Ambiente CI · Rischio prod nessuno"

crea A28 "Error tracking in produzione" "Fase 2 · Rete di sicurezza" "$R,type:chore,area:api,tier:sonnet" \
"**Obiettivo**: errori di route, server action e cron arrivano a un tracker (es. Sentry free) con stack e digest.
**Perché**: oggi i bug in prod si scoprono dalle maestre e dai log Vercel letti a mano.
**Fatto quando**: errore forzato in preview compare nel tracker; nessun PII di bambini nei payload.
Sforzo S · Ambiente cloud · Rischio prod basso"

echo "== Fase 3 =="
crea A30 "Spezzare TASKS.md" "Fase 3 · Evoluzione" "$R,type:chore,tier:sonnet" \
"**Obiettivo**: backlog residuo → issue; storia → CHANGELOG.md; promemoria migration eliminati. TASKS.md rimosso o < 50 righe.
**Perché**: 180 KB (~45.000 token) caricati a ogni sessione, al 90% storia.
**Fatto quando**: CLAUDE.md non chiede più di aggiornare TASKS.md.
Dipende da A01, A22 · Sforzo M · Rischio prod nessuno"

crea A31 "CHANGELOG generato e tag git per release" "Fase 3 · Evoluzione" "$R,type:chore,tier:sonnet" \
"**Obiettivo**: commit convenzionali → CHANGELOG automatico; tag vX.Y.Z a ogni merge che bumpa la versione.
**Fatto quando**: tag e voce di changelog senza intervento manuale.
Dipende da A14, A30 · Sforzo M · Ambiente CI · Rischio prod nessuno"

crea A32 "CLAUDE.md snellito a costituzione; specs on-demand" "Fase 3 · Evoluzione" "$R,type:chore,tier:sonnet" \
"**Obiettivo**: CLAUDE.md < 1.500 token con solo regole stabili; procedure in docs/; leggere solo la spec della feature in corso.
**Perché**: stabilità = prompt caching efficace (cache hit al 10%) e istruzioni più nitide.
**Fatto quando**: sessione tipica < 10k token di contesto di governance.
Dipende da A22, A30 · Sforzo M · Rischio prod nessuno"

crea A33 "ADR per le scelte deliberate" "Fase 3 · Evoluzione" "$R,type:chore,tier:haiku" \
"**Obiettivo**: \`docs/adr/\` con le decisioni già prese (tabelle non rinominate, service_role per conteggi asilo-wide, *l'effetto è la conferma*, unit solo senza I/O…).
**Fatto quando**: almeno 6 ADR; CLAUDE.md rimanda a docs/adr/.
Dipende da A30 · Sforzo S · Rischio prod nessuno"

crea A34 "Check meccanico spec ↔ test in CI" "Fase 3 · Evoluzione" "$R,type:chore,tier:sonnet" \
"**Obiettivo**: script che verifica che ogni \`## Scenario:\` abbia un \`test()\` corrispondente nel file e2e gemello, e viceversa.
**Perché**: oggi è una regola in prosa (225 scenari vs 208 test).
**Fatto quando**: uno scenario senza test fa fallire la CI.
Dipende da A12 · Sforzo S · Ambiente CI · Rischio prod nessuno"

crea A35 "Dependabot / Renovate" "Fase 3 · Evoluzione" "$R,type:chore,tier:haiku" \
"**Obiettivo**: bump automatici via PR, raggruppati, con CI verde come gate.
**Fatto quando**: prima PR di bump mergiata con CI verde.
Dipende da A10, A12 · Sforzo S · Rischio prod basso"

crea A36 "Upgrade Next 15/16 + React 19" "Fase 3 · Evoluzione" "$R,type:chore,tier:opus" \
"**Obiettivo**: stack aggiornato, \`npm audit\` senza high, e2e verde.
**Perché**: Next 14.2.35 con vulnerabilità high; breaking change in produzione.
**Fatto quando**: PR con preview + e2e verdi, mergiata in un weekend, rollback (revert + redeploy) provato prima.
Dipende da A23, A25, A28 · Sforzo L · Ambiente PC · Rischio prod MEDIO"

crea A37 "Contenere il service_role" "Fase 3 · Evoluzione" "$R,type:security,area:rls-auth,tier:opus" \
"**Obiettivo**: conteggi asilo-wide come funzioni Postgres security definer via RPC; service_role solo in cron e gestione utenti.
**Perché**: 20 usi in 7 file, incluso una server action user-facing: l'autorizzazione migra dal DB all'app.
**Fatto quando**: \`createAdminClient\` assente da ogni server action avviata da un utente; test pgTAP sulle RPC.
Dipende da A27 · Sforzo M · Ambiente PC · Rischio prod basso"

crea A38 "Backlog funzionale residuo come issue" "Fase 3 · Evoluzione" "$R,type:feature,tier:haiku" \
"**Obiettivo**: voci aperte di TASKS.md (saldo complessivo per bambino, portale genitori) e note *Fuori scope* delle specs come issue \`type:feature\` in triage.
**Fatto quando**: TASKS.md non contiene più voci \`- [ ]\`.
Dipende da A01 · Sforzo S · Rischio prod nessuno"

echo ""
echo "Fatto. Apri il Project e trascina le issue nella colonna Ready (o attiva l'automazione)."
