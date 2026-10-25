#!/usr/bin/env bash
# Apaga TODOS os pacientes (fictícios, da fase de testes) da PRODUÇÃO,
# com o que depende deles — ver scripts/limpar-pacientes.sql.
#
#   1. ensaio: mostra as contagens e desfaz (padrão)
#   2. com CONFIRMAR_LIMPEZA=APAGAR_PACIENTES: backup completo em
#      ~/pep_backups/, apaga e roda a verificação P0
#
# Nunca rodar depois que houver paciente real cadastrado.
# Senha lida de ~/.pep_db_producao (ou SUPABASE_PRODUCTION_DB_PASSWORD), nunca impressa.
set -euo pipefail

readonly HOST="db.vhaadfzdvhdztfrilohf.supabase.co"
readonly PSQL_URL="postgresql://postgres@${HOST}:5432/postgres?sslmode=require"

senha="${SUPABASE_PRODUCTION_DB_PASSWORD:-$(cat ~/.pep_db_producao)}"
[[ -n "$senha" ]] || { echo "ERRO: senha de produção vazia." >&2; exit 1; }
export PGPASSWORD="$senha"
trap 'unset PGPASSWORD senha' EXIT

if [[ "${CONFIRMAR_LIMPEZA:-}" != "APAGAR_PACIENTES" ]]; then
  echo "== Ensaio na produção (nada é apagado):"
  psql "$PSQL_URL" -X -P pager=off -f scripts/limpar-pacientes.sql
  echo
  echo "Se as contagens estiverem certas, rode:"
  echo "  CONFIRMAR_LIMPEZA=APAGAR_PACIENTES bash scripts/supabase-limpar-pacientes-producao.sh"
  exit 0
fi

mkdir -p ~/pep_backups && chmod 700 ~/pep_backups
backup=~/pep_backups/producao_antes_limpeza_$(date +%Y%m%d_%H%M%S).dump
echo "== Backup completo em $backup ..."
pg_dump "$PSQL_URL" --format=custom --no-owner --file="$backup"
chmod 600 "$backup"

echo "== Apagando os pacientes..."
psql "$PSQL_URL" -X -P pager=off -v executar=on -f scripts/limpar-pacientes.sql

echo "== Verificação P0..."
psql "$PSQL_URL" -X -v ON_ERROR_STOP=1 -P pager=off -f supabase_verify_security_p0.sql
echo
echo "Pacientes apagados. Depois de conferir o site, apague o backup:"
echo "  rm $backup"
