# 12 — Plano da Etapa 1 · Consolidação do Kanban como plataforma genérica

> Documento de planejamento. Nada aqui foi implementado.

## 1. Pré-condições (Etapa 0.5 — obrigatória antes da Etapa 1)

| # | Pré-condição | Motivo | Esforço |
|---|---|---|---|
| P1 | Regenerar `src/integrations/supabase/types.ts` a partir do schema real | ~55 tabelas ausentes; `boards`/`board_listas`/`board_campos`/`board_membros` invisíveis ao TS | Baixo |
| P2 | Remover `// @ts-nocheck` de `src/lib/repositories/boards.ts` e `cards.ts` e corrigir o que aparecer | sem isso não há rede de segurança para refatorar o Kanban | Médio |
| P3 | Restaurar RLS de `cards` (hoje `USING(true)`) e cobrir tabelas de Suprimentos | segurança e testes SEC-002 | Médio |
| P4 | Migrar automações de board de `localStorage` → tabela | regra de equipe não pode viver no navegador | Médio |
| P5 | Definir soft-delete/`ON DELETE RESTRICT` nos cascades a partir de `obras` | evitar perda em massa durante a refatoração | Médio |

## 2. Objetivo da Etapa 1

Existir **um único motor Kanban** (Motor A), genérico, com paridade Trello, sobre o qual
Compras e Produção passam a ser **visões configuradas**, não telas próprias.

## 3. Problemas que a Etapa 1 deve resolver

1. Eliminar o Motor B como motor: `QuadroKanban.tsx` deixa de ter colunas hard-coded
   (`COLUNAS_COMPRAS`/`COLUNAS_PRODUCAO`) e passa a ler `board_listas`.
2. Separar **nome visível da lista** do **estado operacional interno**
   (ex.: `board_listas.nome = "PEDIDO FECHADO"`, `board_listas.estado_operacional = "OC_EMITIDA"`),
   substituindo `card_setores.status_setor` (string livre) como fonte de status.
3. Unificar campos personalizados — hoje coexistem `card_campos_valores`, `card_custom_field_valores`
   e `board_campos`; escolher uma fonte e depreciar as demais.
4. Posição de card estável e transacional: rank fracionário ou RPC de reordenação em lote,
   com atualização otimista **e rollback**.
5. DnD acessível e único (`@dnd-kit`), eliminando o DnD HTML5 nativo.
6. Catálogo de etiquetas administrável por quadro (hoje só o importador Trello cria etiquetas).
7. Permissões do Kanban validadas no servidor (RLS), não apenas em `useCardPermissions`.

## 4. Fora do escopo da Etapa 1

Extensões de domínio ERP, eventos de domínio, necessidades, reconciliação de cronograma,
espelho de OC, estoque, produção multi-etapa, subcards, importação do Trello real, integração TOTVS.

## 5. Arquivos afetados (previsão)

**Núcleo:** `src/pages/quadros/QuadroBoard.tsx`, `src/pages/quadros/Quadros.tsx`,
`src/components/cards/QuadroKanban.tsx`, `src/pages/suprimentos/QuadroCompras.tsx` e `QuadroProducao.tsx`,
`src/lib/repositories/boards.ts` e `cards.ts`, `src/hooks/quadros/*`,
`src/lib/quadros/{automacoes,templates,boardConfig}.ts`, `src/lib/cards/automacoesQuadro.ts`.

**Banco (nova migration na Etapa 1, não agora):** coluna de estado operacional em `board_listas`,
tabela de automações de board, consolidação de campos personalizados, índices de `card_board_posicao`.

## 6. Componentes a preservar (não reescrever)

`CardGenericoDialog`, `CommentEditor`/`RichTextEditor`/`MarkdownView`, `FiltrosCardsPanel` +
`src/lib/cards/filtrosCards.ts`, `QuadroTabelaView`, `QuadroCalendarView`, `QuadroViewsSalvas` +
`card_views_salvas`, `MoverCopiarCardMenu`, `BoardAtividadeSidebar` + `card_atividades`,
`src/lib/cards/mencoes.ts`, camada de repositories e as query-keys.

## 7. Critérios de aceite recomendados

- [ ] `rg 'COLUNAS_COMPRAS|COLUNAS_PRODUCAO' src` retorna vazio.
- [ ] `rg '@ts-nocheck' src/lib/repositories` retorna vazio.
- [ ] `rg 'localStorage' src/lib/quadros src/lib/cards` não retorna nada de automação/estado operacional.
- [ ] Toda coluna exibida no quadro de Compras e de Produção vem de `board_listas`.
- [ ] Mover card entre listas persiste posição e sobrevive a reload e a dois usuários simultâneos.
- [ ] Falha na mutação de posição faz rollback visual (teste automatizado).
- [ ] Uma automação criada por um usuário é vista por outro usuário no mesmo board.
- [ ] Testes SEC-002 de `cards`/`boards` passando com RLS restritiva.
- [ ] Typecheck limpo, suíte Vitest verde, e2e de quadro passando.
- [ ] Nenhuma capacidade atual do Kanban removida (checklist de paridade de `01-inventario-kanban.md` §13).
