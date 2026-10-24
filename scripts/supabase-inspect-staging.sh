#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_STAGING_PROJECT_REF:?Defina SUPABASE_STAGING_PROJECT_REF.}"

arquivo_ref="supabase/.temp/project-ref"
arquivo_pooler="supabase/.temp/pooler-url"

if [[ ! -f "$arquivo_ref" || ! -f "$arquivo_pooler" ]]; then
  echo "ERRO: vincule primeiro o projeto de homologação." >&2
  exit 1
fi

ref_atual="$(tr -d '[:space:]' < "$arquivo_ref")"
if [[ "$ref_atual" != "$SUPABASE_STAGING_PROJECT_REF" ]]; then
  echo "ERRO: o projeto vinculado não é a homologação informada." >&2
  exit 1
fi

if [[ -n "${SUPABASE_PRODUCTION_PROJECT_REF:-}" && "$ref_atual" == "$SUPABASE_PRODUCTION_PROJECT_REF" ]]; then
  echo "ERRO: inspeção recusada porque o projeto vinculado é produção." >&2
  exit 1
fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  if [[ ! -t 0 ]]; then
    echo "ERRO: execute em um terminal interativo ou defina SUPABASE_DB_PASSWORD." >&2
    exit 1
  fi
  read -r -s -p "Senha do banco de homologação: " SUPABASE_DB_PASSWORD
  echo
fi

if [[ -z "$SUPABASE_DB_PASSWORD" ]]; then
  echo "ERRO: a senha do banco não pode estar vazia." >&2
  exit 1
fi

pooler_url="$(tr -d '[:space:]' < "$arquivo_pooler")"

echo "Projeto de homologação: $ref_atual"
echo
echo "Objetos existentes no schema public:"
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$pooler_url" -X -v ON_ERROR_STOP=1 -P pager=off -c \
  "SELECT table_type AS tipo, table_name AS objeto
     FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_type, table_name;"

echo
echo "Estimativa de registros nas tabelas public:"
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$pooler_url" -X -v ON_ERROR_STOP=1 -P pager=off -c \
  "SELECT relname AS tabela, n_live_tup AS registros_estimados
     FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname;"

echo
echo "Quantidade de usuários Auth (somente contagem):"
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$pooler_url" -X -v ON_ERROR_STOP=1 -P pager=off -c \
  "SELECT count(*) AS usuarios_auth FROM auth.users;"

echo
echo "Inspeção somente-leitura concluída. Nenhum dado foi alterado."
