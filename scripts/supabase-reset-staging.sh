#!/usr/bin/env bash
set -euo pipefail

readonly HOMOLOGACAO_REF="snhmydckyypgucwbsaus"
readonly PRODUCAO_REF="vhaadfzdvhdztfrilohf"
readonly CONFIRMACAO="APAGAR_HOMOLOGACAO_${HOMOLOGACAO_REF}"
readonly ARQUIVO_REF="supabase/.temp/project-ref"
readonly ARQUIVO_POOLER="supabase/.temp/pooler-url"

if [[ ! -f "$ARQUIVO_REF" || ! -f "$ARQUIVO_POOLER" ]]; then
  echo "ERRO: nenhum projeto Supabase vinculado." >&2
  exit 1
fi

ref_atual="$(tr -d '[:space:]' < "$ARQUIVO_REF")"
if [[ "$ref_atual" == "$PRODUCAO_REF" ]]; then
  echo "ERRO CRÍTICO: reset recusado porque o projeto vinculado é produção." >&2
  exit 1
fi

if [[ "$ref_atual" != "$HOMOLOGACAO_REF" ]]; then
  echo "ERRO: projeto vinculado '$ref_atual' não é a homologação autorizada." >&2
  exit 1
fi

echo "ATENÇÃO: esta ação apagará os dados antigos da homologação $HOMOLOGACAO_REF."
echo "A produção $PRODUCAO_REF não será acessada."
read -r -p "Digite $CONFIRMACAO para continuar: " resposta

if [[ "$resposta" != "$CONFIRMACAO" ]]; then
  echo "Cancelado; nenhum dado foi alterado."
  exit 1
fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  read -r -s -p "Senha do banco de homologação: " SUPABASE_DB_PASSWORD
  echo
fi

if [[ -z "$SUPABASE_DB_PASSWORD" ]]; then
  echo "ERRO: a senha do banco não pode estar vazia." >&2
  exit 1
fi

trap 'unset SUPABASE_DB_PASSWORD' EXIT

npm run db:migrations:check

echo "Recriando exclusivamente a homologação a partir das migrações locais..."
SUPABASE_DB_PASSWORD="$SUPABASE_DB_PASSWORD" \
  npx supabase db reset --linked --no-seed

echo "Validando as proteções P0 no banco recriado..."
pooler_url="$(tr -d '[:space:]' < "$ARQUIVO_POOLER")"
PGPASSWORD="$SUPABASE_DB_PASSWORD" \
  psql "$pooler_url" -X -v ON_ERROR_STOP=1 -f supabase_verify_security_p0.sql

echo "Conferindo o histórico remoto..."
npx supabase migration list --linked --password "$SUPABASE_DB_PASSWORD"

echo "Homologação recriada e validada com sucesso."
