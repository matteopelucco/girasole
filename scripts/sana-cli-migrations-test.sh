#!/usr/bin/env bash
# Girasole — sana i metadati del CLI Supabase sul progetto di TEST
# (girasole_dev, ref aehukkmiwgddsilodxzz), dopo che tutte le 51 migration
# sono state applicate a mano via SQL Editor (2026-09-23).
#
# `supabase migration repair --status applied` scrive SOLO nella tabella
# di tracciamento `supabase_migrations.schema_migrations`: non esegue
# nessuno statement DDL, non tocca lo schema reale. Rischio nullo.
#
# Prerequisito: `supabase link --project-ref aehukkmiwgddsilodxzz` già
# fatto in questa sessione/macchina (CLI già autenticato).
#
# Uso: bash scripts/sana-cli-migrations-test.sh

set -euo pipefail

VERSIONI=$(printf '%04d ' $(seq 1 51))

echo "Marco come 'applied' le migration: $VERSIONI"
supabase migration repair --status applied $VERSIONI --linked

echo
echo "Verifica finale:"
supabase migration list
