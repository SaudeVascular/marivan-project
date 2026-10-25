#!/usr/bin/env bash
# Testes de navegador (Playwright) contra o Supabase LOCAL, com login e
# banco de verdade — nunca contra homologação ou produção.
#
#   npx supabase start          (ou o CI, no job "Navegador")
#   npm run test:e2e
#
# Cria contas e pacientes fictícios no banco local (e2e/preparar.mjs).
set -euo pipefail
cd "$(dirname "$0")/.."

eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)=')"
for v in API_URL DB_URL; do
  case "${!v}" in
    http://127.0.0.1:*|postgresql://postgres:postgres@127.0.0.1:*) ;;
    *) echo "ERRO: $v não é local (${!v%%@*}…). Os testes de navegador só rodam no Supabase local." >&2; exit 1 ;;
  esac
done
export E2E_API_URL="$API_URL" E2E_ANON_KEY="$ANON_KEY" E2E_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" E2E_DB_URL="$DB_URL"

REACT_APP_SUPABASE_URL="$API_URL" REACT_APP_SUPABASE_ANON_KEY="$ANON_KEY" npx vite build --outDir build-e2e --emptyOutDir >/dev/null
npx playwright test -c e2e/playwright.config.mjs "$@"
