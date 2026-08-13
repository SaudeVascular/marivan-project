#!/usr/bin/env bash
set -euo pipefail

readonly HOMOLOGACAO_REF="snhmydckyypgucwbsaus"
readonly PRODUCAO_REF="vhaadfzdvhdztfrilohf"
readonly ARQUIVO_REF="supabase/.temp/project-ref"
readonly ARQUIVO_POOLER="supabase/.temp/pooler-url"

if [[ ! -f "$ARQUIVO_REF" || ! -f "$ARQUIVO_POOLER" ]]; then
  echo "ERRO: nenhum projeto Supabase vinculado." >&2
  exit 1
fi

ref_atual="$(tr -d '[:space:]' < "$ARQUIVO_REF")"
if [[ "$ref_atual" == "$PRODUCAO_REF" ]]; then
  echo "ERRO CRÍTICO: provisionamento recusado porque o projeto vinculado é produção." >&2
  exit 1
fi
if [[ "$ref_atual" != "$HOMOLOGACAO_REF" ]]; then
  echo "ERRO: o projeto vinculado não é a homologação configurada." >&2
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

echo "Criando ou renovando as quatro contas fictícias no Auth..."
contas_json="$(node scripts/provision-staging-auth-users.mjs)"

pooler_url="$(tr -d '[:space:]' < "$ARQUIVO_POOLER")"
echo "Ativando os perfis fictícios com as funções de homologação..."
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$pooler_url" -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
ALTER TABLE public.perfis DISABLE TRIGGER trg_proteger_campos_seguranca_perfil;
UPDATE public.perfis
SET funcao = CASE email
  WHEN 'pep.admin@example.com' THEN 'Administrador'
  WHEN 'pep.medico@example.com' THEN 'Médico'
  WHEN 'pep.enfermagem@example.com' THEN 'Enfermeiro(a)'
  WHEN 'pep.recepcao@example.com' THEN 'Recepcionista'
END,
ativo = true
WHERE email IN (
  'pep.admin@example.com',
  'pep.medico@example.com',
  'pep.enfermagem@example.com',
  'pep.recepcao@example.com'
);
ALTER TABLE public.perfis ENABLE TRIGGER trg_proteger_campos_seguranca_perfil;
COMMIT;
SQL

echo
echo "Contas fictícias criadas. Guarde estas senhas somente para homologação:"
printf '%s' "$contas_json" | node -e '
  let texto = "";
  process.stdin.on("data", (parte) => { texto += parte; });
  process.stdin.on("end", () => {
    for (const conta of JSON.parse(texto)) {
      console.log(`- ${conta.funcao}: ${conta.email} | ${conta.senha}`);
    }
  });
'

echo
echo "Validação dos perfis:"
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$pooler_url" -X -v ON_ERROR_STOP=1 -P pager=off -c \
  "SELECT email, funcao, ativo FROM public.perfis
    WHERE email LIKE 'pep.%@example.com' ORDER BY funcao;"
