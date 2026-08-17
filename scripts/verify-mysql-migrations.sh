#!/usr/bin/env bash
# DB-004 · Conferência do trilho MySQL — repositório × banco.
#
# NÃO conecta ao MySQL (o host é privado). Consome um dump TSV
# `schema_migrations.tsv` exportado no host:
#
#   mysql -e "SELECT filename FROM schema_migrations ORDER BY filename" \
#     jogabcom_gestao_obras --batch --raw --skip-column-names \
#     > docs/modernizacao/inventarios/schema_migrations.tsv
#
# O operador comita o TSV; o script compara com o inventário
# `migrations/*.sql` do repositório e imprime pendências.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$ROOT/migrations"
DUMP="$ROOT/docs/modernizacao/inventarios/schema_migrations.tsv"

if [ ! -d "$REPO_DIR" ]; then
  echo "erro: diretório $REPO_DIR não existe" >&2
  exit 2
fi

REPO_LIST="$(cd "$REPO_DIR" && ls -1 *.sql 2>/dev/null | sort)"

if [ ! -f "$DUMP" ]; then
  echo "aviso: dump do host ausente em $DUMP" >&2
  echo "  · Registre no host e comite o TSV para habilitar a conferência."
  echo "  · Inventário local (repositório):"
  echo "$REPO_LIST" | sed 's/^/    - /'
  exit 0
fi

APPLIED_LIST="$(sort -u "$DUMP")"

FALTA_APLICAR="$(comm -23 <(echo "$REPO_LIST") <(echo "$APPLIED_LIST") || true)"
FALTA_REGISTRAR="$(comm -13 <(echo "$REPO_LIST") <(echo "$APPLIED_LIST") || true)"

STATUS=0

if [ -n "$FALTA_APLICAR" ]; then
  echo "PENDENTES no host (existem em migrations/, faltam em schema_migrations):"
  echo "$FALTA_APLICAR" | sed 's/^/  - /'
  STATUS=1
fi

if [ -n "$FALTA_REGISTRAR" ]; then
  echo "DIVERGÊNCIA (existem em schema_migrations mas não em migrations/):"
  echo "$FALTA_REGISTRAR" | sed 's/^/  - /'
  STATUS=1
fi

if [ "$STATUS" = 0 ]; then
  echo "OK: trilho MySQL sincronizado (repositório == schema_migrations)."
fi

exit "$STATUS"
