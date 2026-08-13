#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_STAGING_PROJECT_REF:?Defina SUPABASE_STAGING_PROJECT_REF.}"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  if [[ ! -t 0 ]]; then
    echo "ERRO: execute este comando em um terminal interativo ou defina SUPABASE_DB_PASSWORD." >&2
    exit 1
  fi

  read -r -s -p "Senha do banco de homologação: " SUPABASE_DB_PASSWORD
  echo
fi

if [[ -z "$SUPABASE_DB_PASSWORD" ]]; then
  echo "ERRO: a senha do banco não pode estar vazia." >&2
  exit 1
fi

arquivo_ref="supabase/.temp/project-ref"
if [[ ! -f "$arquivo_ref" ]]; then
  echo "ERRO: nenhum projeto vinculado. Rode npm run db:staging:link." >&2
  exit 1
fi

ref_atual="$(tr -d '[:space:]' < "$arquivo_ref")"
if [[ "$ref_atual" != "$SUPABASE_STAGING_PROJECT_REF" ]]; then
  echo "ERRO: o CLI está ligado a '$ref_atual', não à homologação esperada." >&2
  exit 1
fi

if [[ -n "${SUPABASE_PRODUCTION_PROJECT_REF:-}" && "$ref_atual" == "$SUPABASE_PRODUCTION_PROJECT_REF" ]]; then
  echo "ERRO: este comando nunca aplica migrações em produção." >&2
  exit 1
fi

npm run db:migrations:check
npx supabase db push --linked --password "$SUPABASE_DB_PASSWORD" --dry-run

if [[ "${CONFIRM_STAGING_PUSH:-}" != "APLICAR_EM_HOMOLOGACAO" ]]; then
  echo
  echo "Dry-run concluído; nada foi alterado."
  echo "Para aplicar, execute novamente com CONFIRM_STAGING_PUSH=APLICAR_EM_HOMOLOGACAO."
  exit 0
fi

npx supabase db push --linked --password "$SUPABASE_DB_PASSWORD"
npx supabase migration list --linked --password "$SUPABASE_DB_PASSWORD"
