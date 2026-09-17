#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup-board-labels.sh
# Crea le label che formano la "macchina a stati" della board di girasole.
# Gli agenti coordinano leggendo/scrivendo QUESTE label: sono il contratto.
#
# Prerequisiti: gh CLI autenticato (gh auth login) e posizionato nel repo.
# Uso:          bash scripts/setup-board-labels.sh
# Idempotente:  se una label esiste, la aggiorna invece di fallire.
# ---------------------------------------------------------------------------
set -euo pipefail

upsert() {
  local name="$1" color="$2" desc="$3"
  if gh label list --limit 200 | grep -qiE "^${name}[[:space:]]"; then
    gh label edit "$name" --color "$color" --description "$desc"
  else
    gh label create "$name" --color "$color" --description "$desc"
  fi
  echo "  ✓ $name"
}

echo "== STATO (ciclo di vita della issue) =="
upsert "status:triage"      "ededed" "Appena aperta, in attesa di triage"
upsert "status:needs-info"  "d93f0b" "Ambigua: servono chiarimenti prima di procedere"
upsert "status:ready"       "0e8a16" "Pronta da implementare (specifica chiara)"
upsert "status:in-progress" "1d76db" "Un agente ci sta lavorando (branch/PR aperta)"
upsert "status:review"      "fbca04" "PR aperta, in attesa di review"
upsert "status:blocked"     "b60205" "Bloccata da dipendenza esterna o decisione umana"
upsert "status:done"        "5319e7" "Mergiata e chiusa"

echo "== TIPO =="
upsert "type:bug"      "d73a4a" "Difetto"
upsert "type:feature"  "a2eeef" "Nuova funzionalità"
upsert "type:chore"    "cfd3d7" "Manutenzione, refactor, dipendenze, docs"
upsert "type:security" "b60205" "Tocca sicurezza: RLS, auth, migrazioni SQL"

echo "== AREA (dominio girasole) =="
upsert "area:rls-auth" "5319e7" "Policy RLS Supabase / autenticazione / ruoli"
upsert "area:db"       "0052cc" "Schema, migrazioni SQL"
upsert "area:ui"       "c5def5" "Componenti Next.js / Tailwind"
upsert "area:api"      "bfd4f2" "Route handler / server actions"

echo "== TIER MODELLO (routing costi: chi lavora la issue) =="
upsert "tier:haiku"  "c2e0c6" "Banale: classificazione, testi, fix minimi (Haiku)"
upsert "tier:sonnet" "fef2c0" "Standard: la maggior parte del lavoro (Sonnet)"
upsert "tier:opus"   "f9d0c4" "Difficile o sensibile: RLS/auth/decisioni (Opus)"

echo ""
echo "Fatto. Verifica su: Settings → Labels, oppure 'gh label list'."
