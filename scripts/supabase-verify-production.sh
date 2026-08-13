#!/usr/bin/env bash
set -euo pipefail

readonly PRODUCAO_REF="vhaadfzdvhdztfrilohf"
readonly HOMOLOGACAO_REF="snhmydckyypgucwbsaus"
readonly PRODUCAO_POOLER="postgresql://postgres.${PRODUCAO_REF}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
readonly ARQUIVO_REF="supabase/.temp/project-ref"

if [[ -f "$ARQUIVO_REF" ]]; then
  ref_atual="$(tr -d '[:space:]' < "$ARQUIVO_REF")"
  if [[ "$ref_atual" != "$HOMOLOGACAO_REF" ]]; then
    echo "ERRO: antes do preflight, o CLI deve permanecer vinculado à homologação." >&2
    exit 1
  fi
fi

echo "Preflight somente-leitura da produção: $PRODUCAO_REF"
echo "O CLI permanecerá vinculado à homologação: $HOMOLOGACAO_REF"

if [[ -z "${SUPABASE_PRODUCTION_DB_PASSWORD:-}" ]]; then
  read -r -s -p "Senha do banco de PRODUÇÃO: " SUPABASE_PRODUCTION_DB_PASSWORD
  echo
fi

if [[ -z "$SUPABASE_PRODUCTION_DB_PASSWORD" ]]; then
  echo "ERRO: a senha do banco de produção não pode estar vazia." >&2
  exit 1
fi
trap 'unset SUPABASE_PRODUCTION_DB_PASSWORD' EXIT

echo "Confirmando a conexão e a versão do PostgreSQL..."
PGPASSWORD="$SUPABASE_PRODUCTION_DB_PASSWORD" \
  psql "$PRODUCAO_POOLER" -X -v ON_ERROR_STOP=1 -P pager=off -c \
  "SELECT current_database() AS banco, current_user AS usuario, current_setting('server_version') AS versao;"

echo "Executando verificação P0 somente-leitura..."
PGPASSWORD="$SUPABASE_PRODUCTION_DB_PASSWORD" \
  psql "$PRODUCAO_POOLER" -X -v ON_ERROR_STOP=1 -P pager=off \
  -f supabase_verify_security_p0.sql

echo "Preflight da produção concluído; nenhum dado foi alterado."
