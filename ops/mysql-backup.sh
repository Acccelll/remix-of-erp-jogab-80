#!/usr/bin/env bash
# ops/mysql-backup.sh — Backup lógico do MySQL do host legado (OPS-006).
#
# Uso:
#   MYSQL_HOST=... MYSQL_PORT=3306 MYSQL_USER=... MYSQL_PASSWORD=... \
#   MYSQL_DATABASE=... BACKUP_DIR=/var/backups/gestaobra ./ops/mysql-backup.sh
#
# Este script NÃO contém credenciais. Ele espera-as via variáveis de ambiente,
# passadas por systemd/cron/secret-manager. Ver runbook em
# docs/modernizacao/EXECUCAO/06_CHANGESETS/OPS-006.md.

set -Eeuo pipefail

: "${MYSQL_HOST:?MYSQL_HOST obrigatório}"
: "${MYSQL_USER:?MYSQL_USER obrigatório}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD obrigatório}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE obrigatório}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/gestaobra}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/${MYSQL_DATABASE}-${timestamp}.sql.gz"

# --single-transaction + --routines + --triggers + --events dá dump consistente
# sem lock em InnoDB. --set-gtid-purged=OFF evita erros ao restaurar em outro host.
MYSQL_PWD="$MYSQL_PASSWORD" mysqldump \
  --host="$MYSQL_HOST" \
  --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  "$MYSQL_DATABASE" \
  | gzip -9 > "$out"

# Verificação de integridade mínima do gzip
gzip -t "$out"

# Rotação por retenção
find "$BACKUP_DIR" -type f -name "${MYSQL_DATABASE}-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

# Checksum para auditoria
sha256sum "$out" > "${out}.sha256"

echo "OK: $out ($(du -h "$out" | cut -f1))"
