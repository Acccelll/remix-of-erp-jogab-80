#!/usr/bin/env bash
# ops/mysql-migrate.sh — Trilho MySQL rastreável (DB-004).
#
# Aplica scripts idempotentes do diretório `migrations-mysql/` em ordem
# lexicográfica, registrando cada aplicação na tabela de controle
# `schema_migrations_mysql`. Um script só é reaplicado se seu conteúdo mudar
# (checksum sha256) — a decisão de reaplicar é do operador, este runner
# apenas detecta o drift e falha ruidosamente.
#
# Uso:
#   MYSQL_HOST=... MYSQL_PORT=3306 MYSQL_USER=... MYSQL_PASSWORD=... \
#   MYSQL_DATABASE=... MIGRATIONS_DIR=./migrations-mysql \
#   ./ops/mysql-migrate.sh [--dry-run]
#
# Runbook: docs/db/MYSQL_STATE.md · Changeset: docs/modernizacao/EXECUCAO/06_CHANGESETS/DB-004.md
set -Eeuo pipefail

: "${MYSQL_HOST:?MYSQL_HOST obrigatório}"
: "${MYSQL_USER:?MYSQL_USER obrigatório}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD obrigatório}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE obrigatório}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-./migrations-mysql}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

mysql_cmd() {
  MYSQL_PWD="$MYSQL_PASSWORD" mysql \
    --host="$MYSQL_HOST" --port="$MYSQL_PORT" --user="$MYSQL_USER" \
    --default-character-set=utf8mb4 --batch --raw --silent \
    "$MYSQL_DATABASE" "$@"
}

# Bootstrap idempotente da tabela de controle.
mysql_cmd <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations_mysql (
  filename       VARCHAR(255) NOT NULL PRIMARY KEY,
  checksum_sha256 CHAR(64)    NOT NULL,
  applied_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_by     VARCHAR(128) NOT NULL DEFAULT (CURRENT_USER())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "MIGRATIONS_DIR '$MIGRATIONS_DIR' não existe" >&2
  exit 2
fi

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if ((${#files[@]} == 0)); then
  echo "Nenhum script em $MIGRATIONS_DIR — nada a fazer."
  exit 0
fi

applied_before=0
applied_now=0
drifted=0

for f in "${files[@]}"; do
  name="$(basename "$f")"
  sum="$(sha256sum "$f" | awk '{print $1}')"
  recorded="$(mysql_cmd -e "SELECT checksum_sha256 FROM schema_migrations_mysql WHERE filename='${name//\'/\'\'}'" || true)"

  if [[ -z "$recorded" ]]; then
    if ((DRY_RUN)); then
      echo "PENDENTE  $name"
    else
      echo "APLICANDO $name"
      MYSQL_PWD="$MYSQL_PASSWORD" mysql \
        --host="$MYSQL_HOST" --port="$MYSQL_PORT" --user="$MYSQL_USER" \
        --default-character-set=utf8mb4 "$MYSQL_DATABASE" < "$f"
      mysql_cmd -e "INSERT INTO schema_migrations_mysql (filename, checksum_sha256) VALUES ('${name//\'/\'\'}', '$sum')"
      applied_now=$((applied_now + 1))
    fi
  elif [[ "$recorded" != "$sum" ]]; then
    echo "DRIFT     $name (checksum diverge: registrado=$recorded, arquivo=$sum)" >&2
    drifted=$((drifted + 1))
  else
    applied_before=$((applied_before + 1))
  fi
done

echo "--"
echo "já aplicados: $applied_before · aplicados agora: $applied_now · drift: $drifted"
((drifted == 0)) || exit 3
