# Repository Layer

Cada arquivo aqui abstrai `supabase.from("<tabela>")` para um domínio.

Regras:

- Páginas/componentes não devem chamar `supabase.from` para tabelas cobertas por um repository.
- Funções retornam `data` desembrulhado e lançam `Error` em caso de falha.
- Nomes por intenção: `listResumo`, `getById`, `update`, `create`, `remove`.

Repositórios ativos:

- `obras.ts`
- `fornecedores.ts`
- `insumos.ts`
- `requisicoes.ts`
- `cronograma.ts` — `cronograma_itens` (listByObra, listDashboard, insertMany, remove/removeByObra…)
- `cards.ts` — updates simples em `cards`, incluindo atribuição em lote de grupo de negociação
- `boards.ts` — `board_listas` (create/insertMany/update)
- `romaneios.ts` — `romaneios`, `romaneio_itens_estoque`, `romaneio_itens_patrimonio` (CRUD de rascunho + RPC `fn_romaneio_confirmar_estoque` para a leg atômica de estoque; mobilização de patrimônio/veículo é orquestrada fora daqui, em `src/hooks/logisticaAtivos/useConfirmarRomaneio.ts`)
