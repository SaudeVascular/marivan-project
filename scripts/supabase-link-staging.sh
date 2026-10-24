#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_STAGING_PROJECT_REF:?Defina SUPABASE_STAGING_PROJECT_REF com o ID do projeto de homologação.}"

if [[ -n "${SUPABASE_PRODUCTION_PROJECT_REF:-}" && "$SUPABASE_STAGING_PROJECT_REF" == "$SUPABASE_PRODUCTION_PROJECT_REF" ]]; then
  echo "ERRO: o ID de homologação é igual ao de produção." >&2
  exit 1
fi

npx supabase link --project-ref "$SUPABASE_STAGING_PROJECT_REF"
echo "Projeto vinculado à homologação: $SUPABASE_STAGING_PROJECT_REF"
