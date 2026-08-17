# Banco de dados — Convenções e reconstruibilidade

**DB-003 · Onda 1 · Programa de Modernização.**

Este diretório consolida as convenções de banco cuja evidência textual
o Lovable Cloud não permite manter dentro de `supabase/migrations/`.

## 1. Convenção de nomes

Todo arquivo em `supabase/migrations/` segue o padrão gerado
automaticamente pelo Lovable Cloud:

```
<YYYYMMDDHHMMSS>_<uuid-curto>.sql
```

O timestamp é o único mecanismo de ordenação; **não renomeie**
arquivos já commitados — quebra o ledger do banco.

## 2. Ementa obrigatória (nova convenção — DB-003)

A **primeira linha** de toda nova migration DEVE ser um comentário
`-- <ID_Achado?>: <resumo em uma linha>`.

Exemplos:

```sql
-- DB-005: canonicidade colaboradores/obras; players/centros_custo_totvs viram views read-only
```

```sql
-- ARC-009: RLS estrita por empresa+role em public.obra_membros
```

O script `scripts/db/gen-migrations-index.py` lê essa linha e alimenta o
[MIGRATIONS_INDEX.md](./MIGRATIONS_INDEX.md). Migrations legadas (pré-DB-003)
usam a primeira sentença DDL como fallback automático.

## 3. Índice cronológico

Sempre atualizado por:

```bash
python3 scripts/db/gen-migrations-index.py
```

Rode o script após aplicar novas migrations e commite o
`MIGRATIONS_INDEX.md` junto. Ver
[MIGRATIONS_INDEX.md](./MIGRATIONS_INDEX.md) para a listagem completa.

## 4. Reconstruibilidade

O banco pode ser reconstruído do zero aplicando os arquivos em ordem
alfabética (equivalente à ordem cronológica pelo prefixo timestamp).

Baseline automatizado (Onda 1 · critério de saída):

```bash
DATABASE_URL=postgres://user:pass@host:5432/db_vazio \
  ./scripts/db/rebuild-baseline.sh
```

O script `scripts/db/rebuild-baseline.sh` valida que o banco-alvo está
vazio, aplica todas as migrations de `supabase/migrations/` em ordem
cronológica com `psql -v ON_ERROR_STOP=1` e aborta na primeira falha.
Não depende do CLI Supabase (indisponível no Lovable Cloud).

- Toda migration é **idempotente onde possível** — use `IF NOT EXISTS`,
  `CREATE OR REPLACE`, `DROP … IF EXISTS`.
- Toda `CREATE TABLE` no schema `public` é acompanhada, na mesma
  migration, dos `GRANT`s + `ALTER … ENABLE ROW LEVEL SECURITY` +
  `CREATE POLICY` — regra do Contrato de Execução §4.2.
- Migrations que renomeiam/removem objetos devem incluir comentário
  citando o Achado ou a Decisão (D-x) que autorizou a mudança.

## 5. Governança

- Referencie o ID do Catálogo (ex.: `DB-005`, `ARC-009`) na primeira
  linha de toda migration produzida durante o programa de modernização.
- Migrations que respondem a Decisões pendentes citam o número da
  Decisão (`D-2`, `D-3`, etc.) — ver
  [07_DECISOES.md](../modernizacao/EXECUCAO/00_EXECUTIVO/07_DECISOES.md).
- Migrations que introduzem tabelas hoje listadas em `MissingTables`
  (Descoberta [E-01](../modernizacao/EXECUCAO/00_EXECUTIVO/08_DESCOBERTAS.md#e-01--36-tabelasviews-fantasmas-referenciadas-por-código))
  DEVEM remover a entrada correspondente do augment no mesmo commit.
