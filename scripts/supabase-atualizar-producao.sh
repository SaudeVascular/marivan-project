#!/usr/bin/env bash
# Atualiza a PRODUÇÃO, que nunca teve histórico de migrações.
# Diagnóstico (scripts/diagnostico-migracoes-producao.sql, 23/10/2026):
# 01–25 já estão no banco; 26–35 faltam.
#
#   1. backup completo (pg_dump) em ~/pep_backups/
#   2. registra 01–25 como aplicadas SEM reexecutar (migration repair)
#   3. dry-run do push — mostra o que seria aplicado
#   4. só com CONFIRMAR_PUSH=APLICAR_26_A_35: aplica e roda a verificação P0
#
# Usa --db-url: o CLI continua vinculado à homologação. Senha lida de
# ~/.pep_db_producao (ou SUPABASE_PRODUCTION_DB_PASSWORD), nunca impressa.
set -euo pipefail

readonly PRODUCAO_REF="vhaadfzdvhdztfrilohf"
readonly HOST="db.${PRODUCAO_REF}.supabase.co"
readonly JA_APLICADAS=(
  20260710000001 20260710000002 20260710000003 20260710000004
  20260710000005 20260710000006 20260710000007 20260710000008
  20260710000009 20260710000010 20260710000011 20260710000012
  20260710000013 20260710000014 20260710000015 20260710000016
  20260710000017 20260710000018 20260710000019 20260710000020
  20260710000021 20260812000022 20260812000023 20260813000024
  20260813000025
)

senha="${SUPABASE_PRODUCTION_DB_PASSWORD:-$(cat ~/.pep_db_producao)}"
[[ -n "$senha" ]] || { echo "ERRO: senha de produção vazia." >&2; exit 1; }
senha_url="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$senha")"
DB_URL="postgresql://postgres:${senha_url}@${HOST}:5432/postgres?sslmode=require"
PSQL_URL="postgresql://postgres@${HOST}:5432/postgres?sslmode=require"
export PGPASSWORD="$senha"
trap 'unset PGPASSWORD senha senha_url DB_URL' EXIT

echo "== Conferindo que produção ainda está como no diagnóstico (25 sim, 26 não)..."
estado="$(psql "$PSQL_URL" -X -At -c "
  SELECT (to_regclass('supabase_migrations.schema_migrations') IS NULL)::text || ',' ||
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='pacientes' AND column_name='outras_comorbidades')::text")"
# "false,false" = segunda rodada (histórico já registrado, 26 ainda não).
if [[ "$estado" != "true,false" && "$estado" != "false,false" ]]; then
  echo "ERRO: produção mudou desde o diagnóstico (estado: $estado). Nada foi feito." >&2
  exit 1
fi

mkdir -p ~/pep_backups && chmod 700 ~/pep_backups
backup=~/pep_backups/producao_$(date +%Y%m%d_%H%M%S).dump
echo "== Backup completo em $backup ..."
pg_dump "$PSQL_URL" --format=custom --no-owner --file="$backup"
chmod 600 "$backup"
echo "   $(du -h "$backup" | cut -f1) — contém dados de pacientes; guarde com cuidado."

npm run db:migrations:check

echo "== Registrando 01–25 como aplicadas (nada é reexecutado)..."
npx supabase migration repair --db-url "$DB_URL" --status applied "${JA_APLICADAS[@]}"

echo "== Dry-run — o que seria aplicado:"
npx supabase db push --db-url "$DB_URL" --dry-run

if [[ "${CONFIRMAR_PUSH:-}" != "APLICAR_26_A_35" ]]; then
  echo
  echo "Parado antes de aplicar. Se a lista acima for exatamente 26 a 35, rode de novo com:"
  echo "  CONFIRMAR_PUSH=APLICAR_26_A_35 bash scripts/supabase-atualizar-producao.sh"
  echo "(o repair é idempotente; um novo backup será feito.)"
  exit 0
fi

echo "== Aplicando 26–35..."
npx supabase db push --db-url "$DB_URL"
npx supabase migration list --db-url "$DB_URL"

echo "== Verificação P0..."
psql "$PSQL_URL" -X -v ON_ERROR_STOP=1 -P pager=off -f supabase_verify_security_p0.sql
psql "$PSQL_URL" -X -P pager=off -f scripts/diagnostico-migracoes-producao.sql
echo "Produção atualizada. Backup anterior: $backup"
