#!/usr/bin/env bash
# Aplica na PRODUÇÃO as migrações pendentes (histórico já adotado em
# 23/10/2026 — ver supabase-atualizar-producao.sh).
#
#   1. backup completo (pg_dump) em ~/pep_backups/
#   2. dry-run — lista o que seria aplicado, e para
#   3. com CONFIRMAR_PUSH=SIM: aplica e roda a verificação P0
#
# Usa --db-url: o CLI continua vinculado à homologação. Senha lida de
# ~/.pep_db_producao (ou SUPABASE_PRODUCTION_DB_PASSWORD), nunca impressa.
set -euo pipefail

readonly HOST="db.vhaadfzdvhdztfrilohf.supabase.co"

senha="${SUPABASE_PRODUCTION_DB_PASSWORD:-$(cat ~/.pep_db_producao)}"
[[ -n "$senha" ]] || { echo "ERRO: senha de produção vazia." >&2; exit 1; }
senha_url="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$senha")"
DB_URL="postgresql://postgres:${senha_url}@${HOST}:5432/postgres?sslmode=require"
PSQL_URL="postgresql://postgres@${HOST}:5432/postgres?sslmode=require"
export PGPASSWORD="$senha"
trap 'unset PGPASSWORD senha senha_url DB_URL' EXIT

npm run db:migrations:check

echo "== Dry-run — o que seria aplicado:"
npx supabase db push --db-url "$DB_URL" --dry-run

if [[ "${CONFIRMAR_PUSH:-}" != "SIM" ]]; then
  echo
  echo "Parado antes de aplicar. Se a lista acima estiver certa, rode:"
  echo "  CONFIRMAR_PUSH=SIM bash scripts/supabase-push-producao.sh"
  exit 0
fi

mkdir -p ~/pep_backups && chmod 700 ~/pep_backups
backup=~/pep_backups/producao_$(date +%Y%m%d_%H%M%S).dump
echo "== Backup completo em $backup ..."
pg_dump "$PSQL_URL" --format=custom --no-owner --file="$backup"
chmod 600 "$backup"
echo "   $(du -h "$backup" | cut -f1) — contém dados de pacientes; guarde com cuidado."

echo "== Aplicando..."
npx supabase db push --db-url "$DB_URL" --yes
npx supabase migration list --db-url "$DB_URL" | tail -4

echo "== Verificação P0..."
psql "$PSQL_URL" -X -v ON_ERROR_STOP=1 -P pager=off -f supabase_verify_security_p0.sql
echo "Produção atualizada. Backup anterior: $backup"
