#!/usr/bin/env bash
# DB-001.b — Gate de regressão: falha se surgirem órfãos na fronteira legada.
#
# Requer DATABASE_URL apontando para o banco a auditar (staging/prod-readonly).
# Em ambientes sem DATABASE_URL, o script sai com código 0 e imprime "skipped"
# — isso permite rodar em PRs de contribuidores sem credenciais.

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[DB-001.b] DATABASE_URL ausente — skipped"
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[DB-001.b] psql não instalado — skipped"
  exit 0
fi

TOTAL=$(psql "$DATABASE_URL" -Atc "SELECT COALESCE(SUM(total_orfaos), 0) FROM public.vw_db001_fronteira_orfaos;")

if [ "$TOTAL" -gt 0 ]; then
  echo "[DB-001.b] FALHA: $TOTAL órfão(s) detectado(s) na fronteira legada."
  psql "$DATABASE_URL" -c "SELECT tabela, coluna, referencia_esperada, total_orfaos FROM public.vw_db001_fronteira_orfaos ORDER BY total_orfaos DESC LIMIT 20;"
  exit 1
fi

echo "[DB-001.b] OK — 0 órfãos na fronteira legada."
