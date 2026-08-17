# 01 — Inventário do Motor Kanban (JOGAB ERP)

> Auditoria técnica, etapa de diagnóstico. Nenhum código de aplicação ou migration foi alterado. Todas as afirmações abaixo são referenciadas a arquivos/tabelas reais do repositório em `/dev-server`.

## 0. Achado estrutural mais importante: **dois motores Kanban distintos e não integrados**

O repositório não tem *um* motor Kanban — tem **dois**, com modelos de dados, bibliotecas de DnD e semânticas de "coluna" completamente diferentes:

| | Motor A — "Boards genéricos" | Motor B — "Quadro Compras/Produção" |
|---|---|---|
| Entrada | `src/pages/quadros/QuadroBoard.tsx` (rota `/quadros/:boardId`), `src/pages/quadros/Board.tsx` (alocação) | `src/pages/suprimentos/QuadroCompras.tsx`, `QuadroProducao.tsx` → `src/components/cards/QuadroKanban.tsx` |
| Conceito de "quadro" | Tabela `boards` (linha real, com `id`, `nome`, `tipo`, `setor`, `obra_id`) | Não existe: é uma visão fixa por `setor` (Compras/Producao), sem linha em `boards` |
| Conceito de "lista/coluna" | Tabela `board_listas` (linha real: `nome`, `posicao`, `wip_limite`, `cor`, `arquivada`) | **Hard-coded no componente** (arrays `COLUNAS_COMPRAS` / `COLUNAS_PRODUCAO`, linhas 64-76 de `QuadroKanban.tsx`) — a "coluna" é o valor de `card_setores.status_setor`, uma string livre |
| Posição do card | Tabela `card_board_posicao` (PK composta `card_id,board_id`, colunas `lista_id`, `posicao`) | Não existe posição persistida; ordenação dentro da coluna é a ordem de retorno da query, sub-agrupada por `grupo_negociacao_id` |
| Biblioteca de DnD | `@dnd-kit/core` + `@dnd-kit/sortable` (`QuadroBoard.tsx`, import linhas 14-35) | HTML5 Drag and Drop nativo (`draggable`, `onDragStart/onDragOver/onDrop` em `QuadroKanban.tsx`, linhas ~556-580) — **sem biblioteca**, sem `DragOverlay`, sem acessibilidade de teclado |
| Automação | `src/lib/quadros/automacoes.ts` — regras + execução; ver §7 | `src/lib/cards/automacoesQuadro.ts` — regras fixas hard-coded; ver §7 |

Isso significa que **funcionalidades construídas para o Motor A (templates, automações de board, visualizações, importador Trello, WIP limit, filtros salvos, atividade de board) não existem e não se aplicam ao Motor B**, que é o quadro efetivamente usado por Compras/Produção (acoplamento a `card_setores`/`card_recursos`, tratado no `pages/suprimentos/*`). Qualquer decisão de evolução (ex.: aplicar no quadro real "214-barra") precisa primeiro decidir **qual dos dois motores** está em jogo, pois a base é incompatível.

---

## 1. Quadros (`boards`)

- Tabela `public.boards` criada em `supabase/migrations/20260630121931_...sql` (linha 7) e re-criada com colunas adicionais em `20260707150224_...sql` (linha 64). Colunas observadas nas migrations: `id`, `nome`, `tipo` (`custom | setor | obra`, ver `CHECK boards_tipo_ref_chk`), `setor`, `obra_id`, `owner_id`, `arquivado`, `template_id` (usado por `useCreateCustomBoard`/`ImportarTrelloDialog`).
- Índices únicos parciais: `uq_boards_setor` (um board por setor) e `uq_boards_obra` (um board por obra) — ou seja, só pode existir **um** board tipo `setor` ou `obra` por entidade; boards `custom` não têm essa restrição.
- RLS: policies `boards select`/`boards write` (linha 30-52) liberam para `authenticated` de forma ampla; há uma migration dedicada de refinamento em `20260717000001_boards_insert_owner_policy.sql`.
- Repositório: `src/lib/repositories/boards.ts` — `boardsRepo.getNome`, `getBoardInfo`, `listListasAtivas`, `listAllRefs`, `listAtivosMin`, `listIndex`, `createCustomReturningId`, `itemsResumo` (chama RPC `board_items_resumo`), `setArquivado`, `subscribeBoardChanges` (canal Realtime nas tabelas `card_board_posicao` e `board_listas`).
- **⚠️ Drift de tipos**: `src/integrations/supabase/types.ts` (gerado do schema) **não contém as tabelas `boards`, `board_listas`, `board_campos`, `board_membros`** — buscas por `^      boards` e `boards:` no arquivo geram zero resultados, apesar de as tabelas existirem em `supabase/migrations`. Todos os repositórios que tocam essas tabelas (`boards.ts`) usam `// @ts-nocheck` para contornar a ausência de tipos — ou seja, **não há checagem de tipo estática nessas operações de banco**, um risco real de regressão silenciosa.
- Páginas: `src/pages/quadros/Quadros.tsx` (listagem/criação), `QuadroMeus.tsx` (cards do usuário via `card_membros`/`responsavel_id`), `QuadroBoard.tsx` (o quadro em si).

## 2. Listas — nome visível vs. estado operacional

- Tabela `board_listas` (`board_id`, `nome`, `posicao`, `wip_limite`, `cor`, `arquivada`, `origem_externa`, `origem_id` — as duas últimas usadas pelo importador Trello, ver 06).
- **O nome da lista é livre-texto e não carrega semântica de status.** Diferente de um "status enum", mover um card de lista para lista é apenas mudar `card_board_posicao.lista_id`; não há coluna "estado operacional" separada. Isso é adequado ao padrão Trello, mas significa que qualquer regra de negócio (ex.: "bloqueado", "concluído") depende de **nome de lista como string** — frágil a rename (mitigado parcialmente por automações que referenciam `listaId`, não `nome`, ver `automacoes.ts`).
- Em contraste, no Motor B (`card_setores`), a coluna **é** o estado operacional: `status_setor` é um enum informal (`identificado`, `em_cotacao`, `pedido_emitido`, `materia_entregue` para Compras; `aguardando_material`, `em_fabricacao`, `produzido`, `entregue_obra` para Produção), fixado em código (`QuadroKanban.tsx` linhas 64-76) e não editável via UI de administração de quadro — para adicionar/renomear uma coluna aqui seria necessário alterar o componente, não apenas configurar o board.
- WIP limit (`wip_limite`) só existe no Motor A (`board_listas`); repositório expõe `boardListasRepo.setWip`, mas **não localizei nenhum ponto de UI/lógica que bloqueie ou avise ao exceder o limite** (não há leitura de `wip_limite` para gate de drop em `QuadroBoard.tsx` além de exibição, a confirmar em detalhe de UI — ver observação em §9).

## 3. Cards — modelo de dados completo

Tabela `cards` (`src/integrations/supabase/types.ts`, linhas 1038-1123): `id`, `numero` (sequencial, `not null`), `tipo`, `titulo` (`not null`), `descricao`, `status`, `obra_id`, `responsavel_id`, `criado_por`, `data_inicio`, `prazo`, `lembrete`, `due_complete`, `arquivado` (`boolean not null default false`), `posicao`, `capa_cor`/`capa_url` (legado) e `cover_color`/`cover_url` (atual — **duplicidade de campos de capa mantida por compatibilidade**, ambos preenchidos em paralelo pelo importador Trello, ver `trello-import.ts` linha 410-413), `cronograma_item_id` (FK lógica para Compras/Produção — ver §11), `grupo_negociacao_id`, `origem_externa`/`origem_id`/`origem_url` (rastreio de importação externa, ex. Trello), `created_at`/`updated_at`.

Tabelas satélite (todas com FK para `cards.id`, a maioria `ON DELETE CASCADE` via schema):

| Tabela | Papel | Repositório |
|---|---|---|
| `card_setores` | Setor/subsetor + status operacional (Motor B) | `cardSetoresRepo` (`cardsExtra.ts`) |
| `card_recursos` | Dados de suprimento/produção: `tipo_recurso`, prazos em cascata, `valor_estimado`, `valor_oc` | `cardRecursosRepo` |
| `card_board_posicao` | Posição do card dentro de um board/lista (Motor A) | `cardBoardPosicaoRepo` |
| `card_labels` / `card_label_links` | Etiquetas (catálogo global + link N:N) | `cardLabelsRepo`, `cardLabelLinksRepo` |
| `card_membros` | Membros atribuídos ao card | `cardMembrosRepo` |
| `card_checklist_itens` | Itens de checklist com `grupo`, `ordem`, `responsavel_id`, `prazo` | `cardChecklistItensRepo` |
| `card_comentarios` | Comentários com `autor_id`/`autor_nome`, `parent_id`/`reply_to` (thread) | `cardComentariosRepo` |
| `card_atividades` | Timeline/log de eventos (`evento`, `detalhe: jsonb`) | `cardAtividadesRepo` |
| `card_anexos` | Anexos (`storage_path`, `mime`, `tamanho`) | `cardAnexosRepo` |
| `card_local` | Endereço/lat/lng (1:1 com card) | `cardLocalRepo` |
| `card_secoes_visiveis` | Quais seções do dialog de card estão visíveis (config de UI persistida) | `cardSecoesVisiveisRepo` |
| `card_campos_valores` | Valores de campos personalizados **efetivamente usados** | `cardCamposValoresRepo` |
| `card_custom_field_valores` | Valores de campos personalizados **legado/órfão** | `cardCustomFieldValoresRepo` (só `removeByCard`) |
| `card_grupos_negociacao` | Agrupamento usado só no Motor B | `cardGruposNegociacaoRepo` |
| `card_views_salvas` | Filtros salvos por setor (JSONB) | `cardViewsSalvasRepo` |
| `card_membros_externos` | Membros do Trello sem correspondência em `profiles` | `trelloImportRepo` |
| `card_custom_fields` | Definições de campo personalizado importadas do Trello (schema separado de `board_campos`) | `trelloImportRepo` |

**Card genérico vs. card de recurso**: `CardGenericoDialog.tsx` é o editor para cards do Motor A; `CardRecursoDialog.tsx` é o editor específico do Motor B (Compras/Produção), com seções de recurso/prazos que não existem no genérico.

## 4. Drag-and-drop

### Motor A — `@dnd-kit`
- `QuadroBoard.tsx` usa `DndContext` com `collisionDetection` customizado (`pointerWithin` com fallback `rectIntersection`, comentado como necessário por causa de zonas de drop sobrepostas), `SortableContext` para reordenar listas e cards, `DragOverlay` para o card "fantasma", anúncios de acessibilidade (`dndAnnouncementsPtBR`) — **implementação relativamente madura**.
- **Persistência de posição**: `onDragEnd` (linhas ~865+) resolve lista/índice destino, reconstrói o array afetado em memória e dispara **N mutações individuais** (`updateCardBoardPosicaoPosicaoMut` / `updateCardBoardPosicaoListaEPosicaoMut`) via `Promise.all` — uma call por card cuja posição relativa mudou. Não há `UPDATE` em lote/RPC transacional: um board com lista de 50 cards reordenada no topo gera até 50 updates concorrentes.
- **Otimismo/rollback**: `useMutation` de `useUpdateCardBoardPosicaoPosicao`/`ListaEPosicao` (em `useCards.ts`) **não implementa `onMutate` com atualização otimista de cache nem `onError` com rollback explícito** — apenas `onSettled` chamando `invalidateBoardItems` (refetch). Ou seja, a UI já havia sido re-renderizada otimisticamente pelo próprio `@dnd-kit` (estado local `porLista`/`items.data` recalculado via `useMemo`) mas **não há reversão automática coordenada com o React Query cache** se a mutação falhar — o erro é tratado ad-hoc (`toast.error(erro.error.message)` visto no reorder de listas), e a consistência final depende do refetch subsequente.
- **Concorrência**: cada card recebe um `posicao` numérico simples (não é 1024-based/rank string como no importador Trello, que usa `(i+1)*1024`). Isso implica que dois usuários movendo cards simultaneamente no mesmo board podem gerar **updates de posição conflitantes** (last-write-wins, sem verificação de versão/`updated_at` otimista); não há uso de `select ... for update`, trigger de renumeração ou coluna de versão. O único mecanismo "distribuído" é a subscription Realtime (`boardsRepo.subscribeBoardChanges`) que dispara refetch quando outra sessão altera `card_board_posicao`/`board_listas` — mas isso é *após o fato*, não previne a corrida.
- Reordenar **listas** usa a mesma estratégia (grava todas as posições em sequência 0..n, comentário no código admite "simples e idempotente", sem otimização).

### Motor B — DnD nativo HTML5
- Sem biblioteca; usa `draggable`, `onDragStart` (guarda `draggedIds` em `useState`), `onDragOver`/`onDrop` no container da coluna. Suporta **drag múltiplo** quando há seleção prévia (`selecionados`).
- **Não há coluna de posição** — mover apenas faz `UPDATE card_setores SET status_setor = X` (via `cardSetoresRepo.updateStatusComSubsetor`). A ordem visual dentro da coluna não é persistida (recalculada a cada fetch, agrupada por `grupo_negociacao_id`).
- **Sem otimismo**: a UI só atualiza após o `await updateSetorStatusMut.mutateAsync(...)` resolver e o `invalidateQueries` disparar refetch — o card "volta" para a lista antiga durante a chamada de rede (nenhum `onMutate`).
- Regra de negócio de bloqueio embutida na UI: card manufaturado só avança em Produção se Compras já entregou (comparação de `status_setor` "espelhado" via query cruzada `listStatusSetoresPorCardsESetor`) — regra de acoplamento client-side, sem constraint de banco equivalente encontrada (checar RLS/trigger específico não localizado nas migrations revisadas).
- **Sem acessibilidade de teclado** para mover cards (HTML5 DnD nativo não suporta teclado nativamente e o componente não adiciona fallback).

## 5. Campos personalizados — duplicidade confirmada

Existem **três** sistemas de campo dinâmico coexistindo, dois deles com nomes quase idênticos:

1. **`board_campos` + `card_campos_valores`** — sistema **ativo e usado pela UI** (`CardCamposCustom.tsx`): define campo por board (`nome`, `tipo` ∈ `texto|numero|data|dropdown|checkbox`, `opcoes`) via `boardCamposRepo`, e grava valor por card em `card_campos_valores` (`campo_id`, `card_id`, `valor jsonb`, upsert por `card_id,campo_id`) via `cardCamposValoresRepo.upsertOne`. Único fluxo de leitura+escrita real.
2. **`card_custom_field_valores`** — tabela do schema com colunas `campo_id`, `card_id`, `valor jsonb`, **mas o repositório (`cardCustomFieldValoresRepo`) só expõe `removeByCard`** (chamado, plausivelmente, ao excluir um card, para limpeza de um esquema legado). **Não há nenhuma leitura nem escrita de valores nesta tabela em nenhum ponto do código de aplicação além do importador Trello (ver item 3)** — é uma tabela órfã do ponto de vista do produto atual.
3. **`card_custom_fields`** — tabela separada usada **exclusivamente pelo importador Trello** (`trello-import.ts`, `trello-import` grava definição de campo com `fonte`, `external_id`, `nome`, `tipo`, `options jsonb`) e **grava valores em `card_custom_field_valores` com um payload incompatível com o schema real**: o código insere `{ card_id, field_id, valor_texto, valor_numero, valor_data, valor_bool, valor_option }`, enquanto a tabela real (conforme `types.ts`) tem apenas `{ card_id, campo_id, valor jsonb }`. Há um `TODO` explícito no próprio código confirmando a inconsistência: *"TODO(ARC-001/E-01): card_custom_field_valores schema usa `campo_id`+`valor`; código usa `field_id`+valor_\*."* — **ou seja, a importação de custom fields do Trello está de fato quebrada/gerará erro de coluna inexistente em produção**, silenciado apenas pelo padrão de captura de erro (`erros.push(...)`, best-effort) do importador.

**Conclusão da duplicidade**: `card_campos_valores` (ligado a `board_campos`) é o sistema real do produto; `card_custom_field_valores`/`card_custom_fields` é uma trilha paralela criada para/pelo importador Trello, desalinhada do schema e não conectada ao editor de campos personalizados do card (`CardCamposCustom.tsx` não lê `card_custom_field_valores` nem `card_custom_fields`). Um board importado do Trello com campos personalizados **não os exibirá** na UI de campos custom do ERP.

## 6. Etiquetas

- `card_labels` (catálogo global, não por board — `nome`, `cor`) e `card_label_links` (N:N `card_id`/`label_id`).
- CRUD: `cardLabelsRepo.listResumo` (sem create/update/delete visível no repositório revisado — a criação de etiquetas parece ocorrer apenas via importador Trello, `upsertLabels` em `trello-import.ts`, que faz dedupe por `nome+cor`). Não localizei um dialog de gestão de etiquetas (criar/editar/excluir etiqueta) nos componentes de `src/components/cards`/`quadros` revisados — a funcionalidade "Labels" do Trello parece **parcial**: aplicar/remover etiqueta existe (`useInsertCardLabelLink`/link em automação), mas administrar o catálogo de etiquetas não foi localizado na superfície de UI auditada.
- Automação pode adicionar etiqueta automaticamente ao mover card (`adicionar_label`, Motor A, ver §7).

## 7. Automações — persistência real (achado crítico)

| Motor | Arquivo | Persistência | Alcance |
|---|---|---|---|
| A (boards genéricos) | `src/lib/quadros/automacoes.ts` + `src/components/quadros/BoardAutomacoesDialog.tsx` | **`localStorage`**, chave fixa `gestaobra:board:automacoes` (linha 33 de `automacoes.ts`) — **não há tabela de banco** para regras de automação | Por navegador/dispositivo; **não sincroniza entre usuários nem persiste em outro computador/sessão**. Regras: gatilho `card_movido_para_lista` ou `card_vencendo`; ações `notificar` (toast local) ou `adicionar_label` (esta sim grava em `card_label_links`, efeito real no banco) |
| B (Compras/Produção) | `src/lib/cards/automacoesQuadro.ts` | **Hard-coded em código-fonte** (array `REGRAS_AUTOMACAO_QUADRO`), não editável pelo usuário exceto ativar/desativar | Toggle de ativa/desativada persiste em... (ver `useQuadroAutomacoesConfig.ts`) e a idempotência de disparo (não repetir a mesma automação) é rastreada também em **`localStorage`** (`lerAutomacoesExecutadas`/`salvarAutomacoesExecutadas`, chave `STORAGE_KEYS.quadroAutomacoesExecutadas`) |

Em ambos os casos a "ação" de automação mais substantiva que persiste em banco é **inserir um comentário de sistema** (`card_comentarios`, autor "Automação") ou vincular uma etiqueta (`card_label_links`) — não há automações que, por exemplo, movam o card automaticamente para outra lista, disparem webhook, ou enviem notificação real a outro usuário (`notificacoes` só é usado no contexto de `useInsertNotificacao`, aparentemente não conectado ao motor de automação diretamente).

**Implicação de produto**: qualquer automação configurada por um usuário no Motor A é invisível para os demais usuários do mesmo board (fica presa no `localStorage` daquele navegador) e é perdida ao limpar dados do navegador — isto não é um "recurso incompleto", é uma **arquitetura que não pode funcionar em equipe** tal como está.

## 8. Visualizações

- **Kanban**: `QuadroBoard.tsx` (Motor A) e `QuadroKanban.tsx` (Motor B) — nativas, funcionais.
- **Tabela**: `QuadroTabelaView.tsx` (188 linhas) — consome os mesmos `itemsFiltrados` do board; existe e é alternável via `ToggleGroup` em `QuadroBoard.tsx`.
- **Calendário**: `QuadroCalendarView.tsx` (156 linhas) — idem, alternável.
- **Views salvas**: `QuadroViewsSalvas.tsx` + tabela `card_views_salvas` — **persistidas em banco corretamente** (nome, setor, filtros JSONB, `criado_por`), este é um dos poucos subsistemas do Kanban com persistência de banco real e completa ponta a ponta.
- Não há visualização "linha do tempo/Gantt" nem "mapa" dedicados ao Kanban (existe `card_local` com lat/lng mas não localizei um mapa agregando múltiplos cards).

## 9. Filtros

- `FiltrosCardsPanel.tsx` + `src/lib/cards/filtrosCards.ts`: etiqueta, responsável, setor, prazo (vencido/hoje/semana/sem-prazo), sem responsável, checklist incompleto. Estado do filtro é serializado na URL (`encodeFiltros`/`decodeFiltros`, base64 do JSON) pelo componente pai (`QuadroBoard.tsx`) — **não é persistido em banco por padrão**, só quando o usuário explicitamente salva como "view" (`card_views_salvas`).
- `ColumnFilter` (`src/components/common/ColumnFilter.tsx`, usado em `QuadroKanban.tsx`) permite ocultar colunas — estado local (`useState`), não persistido.

## 10. Templates e arquivamento

- `src/lib/quadros/templates.ts`: 4 templates puros (`generico`, `obra`, `compras`, `producao`) que retornam apenas a lista de nomes de lista + WIP sugerido — função pura sem I/O, o `useCreateCustomBoard` materializa em `board_listas` na criação do board.
- Presets de automação por template existem em `presetsForTemplate` (`automacoes.ts`) — mas, por serem do Motor A com automações em localStorage, o "template" de automação nunca se torna um dado compartilhado do board.
- **Arquivamento**: existe em duas granularidades — `boards.arquivado` (quadro inteiro, `boardsRepo.setArquivado`) e `board_listas.arquivada` (lista, `boardListasRepo.setArquivada`, disparado via `setBoardListaArquivadaMut` em `QuadroBoard.tsx` linha 1039, com confirmação via `AlertDialog`) e `cards.arquivado` (card individual). Não há "papel de reciclagem" com restauração assistida nem purge automático — arquivamento é um flag booleano, reversível manualmente.

## 11. Permissões (`useCardPermissions`)

- `src/hooks/quadros/useCardPermissions.ts`: regra client-side que **espelha** (conforme o próprio comentário do arquivo) uma policy de RLS chamada `has_card_setor`. GM (`currentPlayer.isGM`) sempre pode editar/arquivar/comentar. Usuário comum só pode se algum dos `card_setores` do card intersectar `userSetoresRepo.listByUser`. Card **sem setor associado** é liberado para qualquer autenticado (potencial brecha se o setor não for atribuído corretamente na criação).
- Está explicitamente marcado como **"só é para gating de UI — o banco continua sendo a última linha de defesa"** — ou seja, depende de uma policy correspondente no banco que não foi localizada nominalmente como `has_card_setor` nas migrations varridas neste diagnóstico (recomenda-se validação direta no Postgres/policies na próxima etapa, pois o nome da function/policy não apareceu nos greps realizados sobre `supabase/migrations`).
- Não há um sistema de permissão por papel dentro do board (ex.: "admin do board" vs "membro" vs "observador") no Motor A além de `board_membros.papel` (coluna existe, mas não localizei enforcement de UI/RLS específico por papel nos arquivos revisados — `boardMembrosRepo.updatePapel` existe, seu efeito sobre permissões não foi confirmado).

## 12. Acoplamento a Compras/Produção

- `card_setores` (`setor`, `subsetor`, `status_setor`) e `card_recursos` (`tipo_recurso`, `prazo_notif_compras`, `prazo_pedido`, `prazo_prod_iniciar`, `prazo_notif_producao`, `data_necessidade_obra`, `valor_estimado`, `valor_oc`) são o coração do Motor B, consumidos por `cardSetoresRepo`/`cardRecursosRepo`, e são a base de `QuadroCompras.tsx`/`QuadroProducao.tsx`/`TabelaConsolidadaCompras.tsx`/`CascataPrazosBar.tsx`.
- `cards.cronograma_item_id` conecta o card a um item do cronograma (`cronograma_itens`), usado em `cardsRepo.listComRecursosPorObra`/`listByCronogramaItem` — a "cascata de prazos" (compras→produção→obra) depende dessa cadeia de FKs lógicas.
- `RestricoesDoCardBadge.tsx`/`RiscosDoCardBadge.tsx`/`UltimoRdoBadge.tsx` são badges que injetam dados de outros módulos (restrições, riscos, RDO) dentro do card, mas fora do escopo estritamente Kanban.
- Regra de negócio cross-setor client-side (Produção não avança card manufaturado sem entrega de Compras) descrita em §4 — é **regra de UI**, não confirmei constraint de banco equivalente.

## 13. O que falta / está parcial (síntese)

| Item | Status |
|---|---|
| Kanban DnD com posição persistida (Motor A) | Funcional, mas sem UPDATE em lote/transacional e sem otimismo/rollback formal |
| Kanban DnD (Motor B) | Funcional só como transição de status; sem posição/ordem persistida, sem acessibilidade |
| Campos personalizados (`board_campos`/`card_campos_valores`) | Funcional |
| Campos personalizados via Trello (`card_custom_fields`/`card_custom_field_valores`) | **Quebrado** (mismatch de schema confirmado por TODO no próprio código) |
| Etiquetas — aplicar/remover | Funcional |
| Etiquetas — administrar catálogo (criar/editar/excluir) | Não localizado na UI (mock/ausente) |
| Checklists | Funcional (CRUD completo incl. grupos) |
| Comentários + menções | Funcional (`extrairMencoes` puro testado; falta confirmar disparo de notificação real ao mencionar — não localizado) |
| Anexos | Funcional para upload interno; anexos do Trello são só URL externa copiada (`storage_path = a.url`), não há download/re-hospedagem |
| Automações (Motor A) | **Mock/local** — localStorage, não persiste em banco, não é compartilhado entre usuários |
| Automações (Motor B) | Regras fixas em código; execução registrada só como comentário; toggle e idempotência em localStorage |
| Visualizações (kanban/tabela/calendário) | Funcional |
| Views salvas | Funcional (banco real) |
| Filtros | Funcional (URL-based) |
| Templates de board | Funcional (lista de listas), mas sem persistência do template escolhido no board (`boards.template_id` existe no schema, uso para automações de sugestão) |
| Arquivamento (board/lista/card) | Funcional, flag simples |
| Permissões por setor | Parcial — client-side only, banco não auditado nesta etapa |
| Permissões por papel de board (`board_membros.papel`) | Existência de dado confirmada; enforcement não confirmado (pendente) |
| Acoplamento Compras/Produção | Funcional e é o uso real predominante do "Kanban" no produto hoje |
| `types.ts` como fonte de verdade do schema | **Defasado** — não inclui `boards`, `board_listas`, `board_campos`, `board_membros` (confirmado por busca direta) |

