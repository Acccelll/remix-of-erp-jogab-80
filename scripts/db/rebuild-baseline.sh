#!/usr/bin/env bash
# DB-BASELINE (Onda 1 · critério de saída):
# Reconstrói um banco Postgres vazio aplicando TODAS as migrations do
# repositório em ordem cronológica (prefixo timestamp).
#
# Uso:
#   DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/db/rebuild-baseline.sh
#
# O script:
#   1. Verifica que o banco-alvo está vazio (sem tabelas em `public`).
#   2. Aplica migrations em ordem alfabética (== ordem cronológica).
#   3. Aborta na primeira falha (`set -euo pipefail` + `psql -v ON_ERROR_STOP=1`).
#   4. Emite um resumo (nº aplicadas, tempo total).
#
# Pré-requisitos: `psql` no PATH. Nenhuma dependência do CLI Supabase — o
# Lovable Cloud não expõe `supabase db reset`, então usamos psql direto.

set -euo pipefail

: "${DATABASE_URL:?defina DATABASE_URL apontando para um banco VAZIO}"

MIG_DIR="$(cd "$(dirname "$0")/../../supabase/migrations" && pwd)"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -q)

echo "→ Verificando que o banco-alvo está vazio…"
count=$("${PSQL[@]}" -Atc "select count(*) from information_schema.tables where table_schema='public'")
if [[ "$count" != "0" ]]; then
  echo "✗ banco-alvo já tem $count tabela(s) em public — aborte ou use um banco novo." >&2
  exit 2
fi

files=("$MIG_DIR"/*.sql)
total=${#files[@]}
echo "→ Aplicando $total migrations de $MIG_DIR…"

start=$SECONDS
i=0
for f in "${files[@]}"; do
  i=$((i+1))
  printf "  [%3d/%3d] %s\n" "$i" "$total" "$(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null
done
elapsed=$((SECONDS - start))

echo "✓ Baseline reconstruído: $total migrations em ${elapsed}s."
