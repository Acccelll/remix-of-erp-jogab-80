# Trilho MySQL — Registro de Estado (DB-004)

> Ficha operacional do trilho MySQL do host legado. Complementa `docs/db/README.md` (Postgres/Supabase) e `docs/db/MIGRATIONS_INDEX.md` (baseline reconstruível).

## Problema histórico

Scripts SQL do MySQL eram bem escritos (idempotência explícita, comentários de intenção) mas **aplicados manualmente sem registro do que foi aplicado**. Drift entre repositório e banco era questão de tempo — Achado **DB-004** (Etapa 8).

## Trilho atual

1. **Diretório canônico:** `migrations-mysql/` (a criar no repo espelho; ainda não existe na sandbox). Um arquivo por mudança, prefixo `AAAA_MM_DD_<slug>.sql`, ordem lexicográfica = ordem de aplicação.
2. **Tabela de controle no MySQL:** `schema_migrations_mysql` (criada automaticamente pelo runner).

   | coluna            | tipo         | função                                          |
   | ----------------- | ------------ | ----------------------------------------------- |
   | `filename`        | VARCHAR(255) | PK; nome do arquivo aplicado                    |
   | `checksum_sha256` | CHAR(64)     | hash do conteúdo no momento da aplicação       |
   | `applied_at`      | DATETIME     | timestamp da aplicação                          |
   | `applied_by`      | VARCHAR(128) | `CURRENT_USER()` do MySQL                       |
3. **Runner:** [`ops/mysql-migrate.sh`](../../ops/mysql-migrate.sh) — aplica pendentes em ordem, registra checksum, detecta **drift** (arquivo editado depois de aplicado) e falha ruidosamente (exit 3).
4. **Backup/restore:** [`ops/mysql-backup.sh`](../../ops/mysql-backup.sh) e [`ops/mysql-restore.sh`](../../ops/mysql-restore.sh) (OPS-006). Sempre rodar backup **antes** de `mysql-migrate.sh` em produção.

## Uso

```bash
# Dry-run: lista pendentes sem tocar no banco
MYSQL_HOST=... MYSQL_USER=... MYSQL_PASSWORD=... MYSQL_DATABASE=gestaobra \
  ./ops/mysql-migrate.sh --dry-run

# Aplicar
MYSQL_HOST=... MYSQL_USER=... MYSQL_PASSWORD=... MYSQL_DATABASE=gestaobra \
  ./ops/mysql-migrate.sh
```

Exit codes:

- `0` — nada pendente ou tudo aplicado com sucesso.
- `2` — `MIGRATIONS_DIR` inexistente.
- `3` — drift detectado (checksum diverge do registrado).

## Regras de escrita dos scripts

1. **Idempotentes** — `CREATE TABLE IF NOT EXISTS`, `ALTER … ADD COLUMN IF NOT EXISTS` (MySQL 8+), `INSERT … ON DUPLICATE KEY UPDATE`.
2. **Uma migração = uma intenção.** Não emendar mudanças posteriores no mesmo arquivo — o checksum mudaria e o runner acusaria drift.
3. **Sem `USE`, sem credenciais, sem `DELIMITER` sem necessidade.** O runner já entra no `MYSQL_DATABASE`.
4. **Reversão:** documentar no cabeçalho do arquivo (comentário). Se o rollback exigir script, criar `AAAA_MM_DD_<slug>_rollback.sql` **fora** da pasta de migrações (não roda no trilho).

## Convivência com Postgres/Supabase

- Postgres/Supabase permanece a fonte canônica dos domínios `colaboradores` e `obras` (D-3).
- MySQL segue como backend do legado PHP até o cutover final (Onda 2/6). Este trilho garante que o legado não drifte silenciosamente durante a travessia.

## Referências

- Achado: [DB-004 — Etapa 8](../modernizacao/GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)
- Changeset: [DB-004](../modernizacao/EXECUCAO/06_CHANGESETS/DB-004.md)
- Backup/restore: [OPS-006](../modernizacao/EXECUCAO/06_CHANGESETS/OPS-006.md)
