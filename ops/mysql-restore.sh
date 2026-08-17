#!/usr/bin/env bash
# ops/mysql-restore.sh — Restore de backup lógico do MySQL (OPS-006).
#
# Uso:
#   MYSQL_HOST=... MYSQL_USER=... MYSQL_PASSWORD=... MYSQL_DATABASE=... \
#   ./ops/mysql-restore.sh /caminho/para/dump.sql.gz
#
# SEMPRE restaure primeiro em base de staging (MYSQL_DATABASE=gestaobra_restore_test)
# e valide contagens antes de tocar produção. Ver runbook OPS-006.

set -Eeuo pipefail

: "${MYSQL_HOST:?MYSQL_HOST obrigatório}"
: "${MYSQL_USER:?MYSQL_USER obrigatório}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD obrigatório}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE obrigatório}"
MYSQL_PORT="${MYSQL_PORT:-3306}"

dump="${1:?dump.sql.gz obrigatório}"
[ -f "$dump" ] || { echo "arquivo não existe: $dump"; exit 1; }

# Verifica checksum se disponível
if [ -f "${dump}.sha256" ]; then
  sha256sum -c "${dump}.sha256"
fi

# Confirmação obrigatória se destino for "prod" no nome
case "$MYSQL_DATABASE" in
  *prod*|gestaobra)
    read -r -p "Restaurar em $MYSQL_DATABASE@$MYSQL_HOST? Digite 'RESTAURAR' para confirmar: " ans
    [ "$ans" = "RESTAURAR" ] || { echo "abortado"; exit 1; }
    ;;
esac

gunzip -c "$dump" | MYSQL_PWD="$MYSQL_PASSWORD" mysql \
  --host="$MYSQL_HOST" \
  --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" \
  --default-character-set=utf8mb4 \
  "$MYSQL_DATABASE"

echo "OK: restore em $MYSQL_DATABASE concluído"
