# 00 — Resumo Executivo · Auditoria Etapa 0 (JOGAB ERP)

> Etapa exclusivamente de diagnóstico. **Nenhum código de aplicação, migration ou dado foi alterado.**
> Únicos arquivos criados: os 13 documentos desta pasta.

## 1. Visão geral

O JOGAB ERP é uma aplicação React 18 + Vite + TypeScript sobre Supabase/Postgres, com ~220 migrations
Supabase e um trilho paralelo de 27 migrations MySQL. A base é grande, madura em vários módulos
(cronograma/CPM, DP, financeiro, contratos) e possui governança formal (SEC-002, gates de
`repository boundary`, `query-keys`, `lib-purity`, testes SEC-002 de RLS, e2e Playwright).
Typecheck passa limpo e 1160 testes unitários passam.

Porém, **para o fluxo-alvo (cronograma → necessidade → engenharia → estoque → compra → produção → obra)
o projeto está em estado heterogêneo**: partes reais e persistidas convivem com partes simuladas,
duplicadas ou presas ao navegador.

## 2. Cinco conclusões estruturais

1. **Existem dois motores Kanban não integrados.**
   *Motor A* (`boards`, `board_listas`, `card_board_posicao`, `@dnd-kit`, templates, views, importador Trello) e
   *Motor B* (`QuadroKanban.tsx` de Compras/Produção, colunas hard-coded, DnD HTML5 nativo, sem posição persistida).
   O quadro efetivamente usado pela operação é o **B**, que é justamente o que **não** tem as capacidades genéricas.
   → Detalhe em `01-inventario-kanban.md`.

2. **`src/integrations/supabase/types.ts` está em drift grave** — ~55 tabelas reais ausentes, incluindo
   `boards`, `board_listas`, `board_campos`, `board_membros` e todo o módulo de Suprimentos.
   Consequência: repositórios inteiros com `// @ts-nocheck` — **zero checagem de tipo nas operações de banco do Kanban**.
   → `02-inventario-banco-dados.md`.

3. **Automações e configurações operacionais vivem em `localStorage`** (`gestaobra:board:automacoes`,
   controle de idempotência de automações). Não sincronizam entre usuários e se perdem ao limpar o navegador —
   não é recurso incompleto, é arquitetura que não funciona em equipe.

4. **O modelo de necessidade (`card_recursos`) não suporta o fluxo decidido**: `valor_oc` digitado no card
   (fonte concorrente com a OC), um subsetor por card (não suporta Corte e Dobra → Solda), sem atendimento
   parcial estruturado, sem N:N entre necessidade e OC, recebimento gravando `obra_id` como local físico,
   e estoque sem separação físico/reservado/disponível. → `04-compras-estoque-producao.md`.

5. **A reconciliação semanal do cronograma ainda não é segura**: falta chave estável de MS Project
   (UID/GUID) como âncora de upsert; há risco real de cards órfãos e duplicados a cada importação.
   → `03-cronograma-e-vinculos.md` (com proposta técnica de reconciliação idempotente).

## 3. Maiores riscos (P0)

| # | Risco | Evidência |
|---|---|---|
| 1 | Drift de `types.ts` → Kanban sem tipagem de banco | `types.ts` vs `supabase/migrations`, `@ts-nocheck` em `repositories/boards.ts` |
| 2 | RLS regredida em `cards` (`USING(true)`) e ausente no módulo Suprimentos | migrations Fase 5A / policies de `cards` |
| 3 | Cascades destrutivos a partir de `obras` (~51 FKs, sem soft-delete) | `02-inventario-banco-dados.md` §4 |
| 4 | Posição de card sem transação/rank estável (Motor A) e inexistente (Motor B) | `card_board_posicao`, `QuadroKanban.tsx` |
| 5 | Criação de card + extensões sem transação (registros parcialmente criados) | `11-riscos-e-divida-tecnica.md` §4.1 |
| 6 | `valor_oc` no card → duplicidade financeira e valor sem fonte oficial | `card_recursos.valor_oc` |
| 7 | Recebimento no local errado (obra usada como depósito) | `recebimentos` |

Lista completa, com probabilidade, prioridade P0–P3 e etapa de tratamento: `11-riscos-e-divida-tecnica.md`.

## 4. O que reaproveitar

`cards` + `card_comentarios` + `card_checklist_itens` + `card_anexos` + `card_membros` + `card_labels`/`card_label_links`
+ `card_atividades` + `card_views_salvas` (persistência real, ponta a ponta) + camada de repositories + TanStack Query
+ query-keys padronizadas + gates de CI. O Motor A é a base correta do Kanban genérico.

## 5. Recomendação de sequência

1. **Etapa 0.5 (pré-requisito, curta):** regenerar `types.ts`, remover `@ts-nocheck` dos repositórios de board,
   restaurar RLS de `cards` e cobrir Suprimentos, e migrar automações de `localStorage` para banco.
2. **Etapa 1:** consolidar o Motor A como único motor Kanban e reescrever o quadro de Compras/Produção
   como *visão* do Motor A (listas reais + estado operacional separado do nome visível).
3. Só então: extensões de domínio, eventos, reconciliação de cronograma, necessidades, compras, produção.

Ordem detalhada por etapa: `09-matriz-roadmap.md`. Plano da Etapa 1: `12-plano-etapa-1.md`.

## 6. Adendo (31/07/2026) — anexos reais recebidos e processados

Três dos quatro anexos foram disponibilizados e analisados contra o código real:

- **XML MS Project `RAÍZEN BARRA REV00`** (`OBRA 214 - PÁTIOS`, 147 tarefas): `parseMppXml` +
  `validateMpp` rodam **sem erros nem avisos**. Achados novos: **75 tarefas com nome duplicado**
  (fallback de reconciliação por nome é inviável), **107 atribuições de recurso descartadas** pelo
  parser, **108 ExtendedAttributes ignorados** (SPI/CPI/CAPEX/Centro de Custo do cliente),
  `percentComplete` = 0 em 100% das tarefas. Detalhe: `03-cronograma-e-vinculos.md` §0.
- **Trello `214 - BARRA`** (14 listas, 49 cartões abertos, 49 checklists): o parser **lê o quadro
  sem quebrar**. O risco é perda semântica — checklists `Material p/ compra` são **itens
  multi-material por cartão** (confirma o bloqueio de `card_recursos`), e labels codificam **estado
  de suprimento** (LIBERADO COMPRA / PENDENTE FINANCEIRO / EM ESTOQUE), não só prioridade.
  Detalhe: `06-analise-trello.md`.
- **Planilha XLSX**: **não é cadastro de produtos** — é base de **RH / folha / custo de mão de obra**
  (6 abas, 2.441 lançamentos, aba de divergências com 3 listas nominais conflitantes). Não há módulo
  no ERP que a consuma. Detalhe: `07-analise-cadastro-produtos.md`.
- **ZIP do projeto**: não recebido (irrelevante — o repositório é a fonte da verdade).

Nenhum dos anexos altera o veredito; dois deles o **reforçam** (multi-item em `card_recursos`;
reconciliação obrigatoriamente por `uid_mpp`).

## 7. Veredito

**O projeto NÃO está pronto para iniciar a Etapa 1 sem uma etapa preparatória curta (0.5).**
Os bloqueadores são poucos, conhecidos e de baixo risco de resolver — mas iniciar a consolidação do
Kanban genérico com `types.ts` em drift, RLS regredida em `cards` e automações em `localStorage`
garantiria retrabalho.
