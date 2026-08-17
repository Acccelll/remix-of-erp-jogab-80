# Trilho MySQL — Migrations (backend PHP legado)

Banco: `jogabcom_gestao_obras` (MySQL do host). Este diretório versiona
todas as mudanças de schema do trilho legado até seu desligamento
programado (ver Onda 4 do plano de modernização).

## Política (DB-004)

1. **Nome do arquivo:** `YYYY_MM_DD_descricao_curta.sql`. Datas no fuso
   local; descrição em `snake_case` e verbal (o que muda).
2. **Cabeçalho obrigatório:**
   ```sql
   -- ============================================================
   -- Migração: <descrição em uma linha>
   -- Data: YYYY-MM-DD
   -- Executar no banco: jogabcom_gestao_obras (MySQL)
   -- ============================================================
   ```
3. **Idempotência:** toda `ALTER/CREATE/DROP` deve suportar reexecução
   segura (`IF NOT EXISTS`, `IGNORE`, ou instrução explícita: "ignore
   erro Duplicate column name se já existir").
4. **Registro obrigatório:** após aplicar no host, o operador executa
   dentro da mesma sessão:
   ```sql
   INSERT INTO schema_migrations (filename, checksum_sha256, applied_by, notes)
   VALUES ('<nome_do_arquivo>.sql',
           '<sha256 do arquivo>',
           '<login do operador>',
           '<contexto/ticket>');
   ```
   O `sha256` é gerado localmente com `shasum -a 256 <arquivo>` antes
   do envio; qualquer divergência posterior indica edição pós-aplicação.
5. **Conferência periódica:** rodar
   `scripts/verify-mysql-migrations.sh` compara o inventário de
   `migrations/*.sql` com o esperado em `schema_migrations` e imprime
   o que falta registrar/aplicar. O script **não conecta ao MySQL** —
   consome um dump `schema_migrations.tsv` gerado no host e comitado
   em `docs/modernizacao/inventarios/`.

## Bootstrap

A tabela de controle é criada pela migração
[`0000_schema_migrations_control.sql`](./0000_schema_migrations_control.sql),
que também faz o **backfill** do histórico já aplicado em produção
(11 migrações listadas até 2026-07-04). Deve ser a primeira aplicada
no host; reexecuções são no-op (`CREATE TABLE IF NOT EXISTS` +
`INSERT IGNORE`).

## Extinção programada

O trilho MySQL é temporário: cada migração aqui é justificada como
custo de manutenção do backend PHP até que o domínio correspondente
seja migrado para Postgres/Lovable Cloud (ver DB-005 · matriz de
canonicidade). Novas migrações devem **preferir** o trilho Postgres
sempre que o domínio já esteja canonizado no cloud.

## Inventário atual (11 migrações + 1 controle)

Registro consolidado em
`docs/modernizacao/inventarios/mysql-migrations.md`.
