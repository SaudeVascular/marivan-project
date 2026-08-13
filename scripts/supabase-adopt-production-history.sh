#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_PRODUCTION_PROJECT_REF:?Defina SUPABASE_PRODUCTION_PROJECT_REF.}"

arquivo_ref="supabase/.temp/project-ref"
if [[ ! -f "$arquivo_ref" ]]; then
  echo "ERRO: vincule deliberadamente o projeto de produção antes de adotar o histórico." >&2
  exit 1
fi

ref_atual="$(tr -d '[:space:]' < "$arquivo_ref")"
if [[ "$ref_atual" != "$SUPABASE_PRODUCTION_PROJECT_REF" ]]; then
  echo "ERRO: projeto vinculado '$ref_atual' difere da produção informada." >&2
  exit 1
fi

if [[ "${CONFIRM_PRODUCTION_HISTORY:-}" != "REGISTRAR_HISTORICO_SEM_REAPLICAR" ]]; then
  echo "Nenhuma alteração realizada."
  echo "Antes de continuar, execute supabase_verify_security_p0.sql na produção."
  echo "Depois use CONFIRM_PRODUCTION_HISTORY=REGISTRAR_HISTORICO_SEM_REAPLICAR."
  exit 0
fi

npm run db:migrations:check
npx supabase migration repair --linked --status applied \
  20260710000001 20260710000002 20260710000003 20260710000004 \
  20260710000005 20260710000006 20260710000007 20260710000008 \
  20260710000009 20260710000010 20260710000011 20260710000012 \
  20260710000013 20260710000014 20260710000015 20260710000016 \
  20260710000017 20260710000018 20260710000019 20260710000020 \
  20260710000021 20260812000022 20260812000023

npx supabase migration list --linked
echo "Histórico inicial registrado. Nenhuma migração foi reexecutada."
