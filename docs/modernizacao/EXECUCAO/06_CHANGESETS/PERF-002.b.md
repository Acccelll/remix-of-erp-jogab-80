# PERF-002 (Fase 2) — Zero `select("*")` em consultas de lista

**Onda:** 4 — Padronização · **Achado:** PERF-002 (critério de saída)
**Status:** Concluído

## Problema

Critério de saída da Onda 4: **zero `select("*")` em consultas de lista**. Varredura encontrou 6 usos remanescentes fora dos padrões já normalizados (PERF-002 Fase 1 tratou `obras`, `financeiro-totvs`, `dpHolerite`).

## Alterações

Substituído `select("*")` por lista de colunas explícitas nos repositórios/dialogs abaixo:

- `src/lib/repositories/obraDetalhe.ts`
  - `aditivosContratoRepo.listPorObra` → `ADITIVOS_CONTRATO_COLS`
  - `cronogramaMarcosRepo.listPorObra` → `CRONOGRAMA_MARCOS_COLS`
  - `bmsPrevistasRepo.listComObras` → colunas explícitas + embed `obras(id,codigo,nome,cliente_id)`
- `src/lib/repositories/cardsExtra.ts`
  - `cardChecklistItensRepo.listByCard` → `CARD_CHECKLIST_ITENS_COLS`
  - `cardSetoresRepo.listByCard` → `CARD_SETORES_COLS`
  - `cardRecursosRepo.getByCard` → `CARD_RECURSOS_COLS`
  - `cardsExtraRepo.getFull` → `CARDS_FULL_COLS`
- `src/components/cards/AdicionarRecursoDialog.tsx` — `lead_time_templates` com colunas explícitas.
- `src/components/cards/CardRecursoDialog.tsx` — `card_comentarios` e `card_anexos` com colunas explícitas.

## Fora de escopo

`select("*", { count: "exact", head: true })` — não retorna dados, apenas contagem. Padrão idiomático mantido (2 usos em `FinImportar`, `CronogramaImporter`, `dpHolerite`).

## Verificação

- `rg 'select\("\*"\)' src` → 0 ocorrências reais (só comentários e count-heads).
- `bunx tsgo --noEmit` → verde.
- `bunx vitest run` → 437/437 verdes.

## Impacto

- Menos bytes trafegados por request (colunas não usadas eliminadas).
- Contrato de dados explícito — quebras de schema aparecem no PostgREST em vez de silenciosamente inflar payload.
- Fecha um dos critérios de saída da Onda 4.
