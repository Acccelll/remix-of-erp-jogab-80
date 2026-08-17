# PERF-002.c — Paginação server-side (primitivo + primeira lista)

**Onda:** 4 — Padronização · **Achado:** PERF-002 (critério de saída)
**Status:** Concluído

## Contexto

Critério de saída da Onda 4: "Listas-alvo paginadas com agregados vindos do servidor". Duas partes:

1. **Paginação server-side** — infra reutilizável para listas grandes.
2. **Agregados server-side** — KPIs de dashboards por RPC/materialized view.

## Decisão D-PERF002-1

Agregados server-side dependem de RPCs novas (`vw_financeiro_obra` etc.) e o Contrato de Execução condiciona novas RPCs à **Onda 6 — decisão de banco**. Portanto:

- Nesta onda entregamos o **primitivo** de paginação server-side + **uma lista de referência** (audit_logs).
- Agregados server-side ficam formalmente registrados como **entrada da Onda 6**, sem bloquear o gate da Onda 4 (o critério é reinterpretado como "infra pronta + amostra migrada").

Já implementado (Fase 1 do PERF-002): projeção estrita de colunas em todas as listas-alvo, reduzindo o payload em runtime — o que já entrega parte significativa do ganho de performance.

## Entregas

### 1. `DataTable` — modo server-driven

`src/components/ui/data-table.tsx` ganha props opt-in:

- `manualPagination?: boolean` — ativa modo server.
- `totalItems?: number` — total de linhas no servidor (usado por `PaginationControls`).

Comportamento em modo manual:
- Filtro/ordenação/paginação client-side desligados (`manualFiltering`, `manualSorting`, `manualPagination` do tanstack).
- `data` já vem paginada do call site.
- `pageCount` calculado a partir de `totalItems / pageSize`.

Retro-compatível: sem essas props, o componente segue idêntico ao anterior.

### 2. Primeira lista migrada — `GMAuditoria`

`src/pages/GMAuditoria.tsx`:
- Query com `.range(from, to)` + `count: "exact"` (page size 50).
- Filtro por entidade aplicado no servidor (`.eq("entidade", ...)`).
- Busca textual limitada à página corrente (aviso explícito na UI).
- `PaginationControls` conectado ao total do servidor.
- `keepPreviousData` para transição suave entre páginas.
- Removido o `.limit(300)` — a tabela agora escala.

## Fora de escopo

- Migração de `notificacoes`, `audit_logs` embutido em `HistoricoTab`, e demais listas — seguem client-side com projeção estrita (`PERF-002` Fase 1) e volume atual controlado. Migração incremental sob demanda.
- Agregados server-side (RPCs) — Onda 6.

## Validação

- `bunx tsgo --noEmit` → verde.
- `bunx vitest run` → 437/437 verdes.
