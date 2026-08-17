# 11 — Riscos e Dívida Técnica (Consolidação Etapa 0)

> Diagnóstico apenas. Nenhum código ou migration foi alterado. Consolida evidências dos documentos 01 a 10
> (`01-inventario-kanban.md`, `02-inventario-banco-dados.md`, `03-cronograma-e-vinculos.md`,
> `04-compras-estoque-producao.md`, `05-demais-modulos.md`, `06-analise-trello.md`,
> `07-analise-cadastro-produtos.md`, `08-matriz-reaproveitamento.md`, `09-matriz-roadmap.md`,
> `10-arquitetura-alvo.md`). Não existem documentos numerados 01/06 fora dos já lidos — todos os nove
> arquivos presentes no diretório foram lidos integralmente.

## Legenda

- **Prioridade P0**: risco de perda/corrupção de dado ou brecha de segurança ativa — tratar antes de qualquer nova feature.
- **P1**: risco alto que deve ser mitigado dentro da etapa indicada, antes de expandir o uso do subsistema afetado.
- **P2**: dívida técnica relevante, mitigar durante a etapa correspondente do roadmap.
- **P3**: risco de menor impacto imediato ou já parcialmente mitigado; acompanhar.
- **Bloqueador Etapa 1**: risco que, se não tratado, invalida ou compromete diretamente o objetivo da Etapa 1 (consolidação do Kanban genérico — `boards`/`board_listas`/`cards`/`card_board_posicao`/DnD/automação de board).

---

## 1. Riscos críticos de integridade

### 1.1 Cards órfãos por perda silenciosa de vínculo com cronograma

- **Evidência**: `cards.cronograma_item_id UUID REFERENCES cronograma_itens(id) ON DELETE SET NULL` (múltiplas migrations, ex. `20260624142446`, `20260625184155`, `20260701131652`); `cronogramaRepo.removeByObra` faz `DELETE` físico incondicional por `obra_id` na reimportação de baseline (`03-cronograma-e-vinculos.md` §3-4).
- **Impacto**: card perde vínculo com cronograma sem qualquer registro/notificação; prazos em cascata (`card_recursos.prazo_*`) ficam "congelados" referenciando uma atividade que não existe mais, sem recálculo nem alerta.
- **Probabilidade**: Alta — toda reimportação de baseline aciona o caminho.
- **Prioridade**: **P1**.
- **Mitigação recomendada**: registrar histórico de vínculo perdido (tabela de auditoria dedicada), substituir `DELETE`+`INSERT` por `UPSERT` com `UNIQUE(obra_id, uid_mpp)` (proposta já desenhada em `03-cronograma-e-vinculos.md` §9), notificar responsável do card quando o vínculo cai.
- **Etapa do roadmap**: Etapa 4 (Reconciliação do cronograma).
- **Bloqueador da Etapa 1?** Não diretamente — mas se a Etapa 1 mover `cronograma_item_id` para uma extensão/vínculo polimórfico (Etapa 2), a semântica de "perda silenciosa" precisa ser resolvida antes de generalizar o padrão.

### 1.2 Cards duplicados por coexistência de gerações de cronograma sem "aposentar" a anterior

- **Evidência**: fluxo "criar nova baseline" (`CronogramaSemanalImporter.tsx:555-642`) insere itens novos sem apagar os da baseline anterior quando `obraTemCronograma` é falso; ausência de `UNIQUE(obra_id, uid_mpp)` (`03-cronograma-e-vinculos.md` §4 e §8).
- **Impacto**: linhas duplicadas de `cronograma_itens` para a mesma atividade física; cards vinculados podem duplicar-se ou apontar para gerações diferentes do mesmo item.
- **Probabilidade**: Média — hoje contida só por guard de UI (`obraTemCronograma`), não por regra de banco; falha de estado em cache ou chamada direta contorna o guard.
- **Prioridade**: **P1**.
- **Mitigação**: constraint `UNIQUE(obra_id, uid_mpp)` no banco (proteção real, não apenas de UI).
- **Etapa do roadmap**: Etapa 4.
- **Bloqueador Etapa 1?** Não.

### 1.3 Duplicidade estrutural de campos personalizados (três sistemas coexistentes)

- **Evidência**: `board_campos`+`card_campos_valores` (ativo) vs. `card_custom_fields`+`card_custom_field_valores` (trilha do importador Trello, com payload incompatível — `TODO(ARC-001/E-01)` explícito no código citado em `01-inventario-kanban.md` §5 e `06-analise-trello.md` §2-3).
- **Impacto**: importação de campos personalizados do Trello é **funcionalmente quebrada** (erro de coluna inexistente, capturado como "aviso" não bloqueante) — dado do cliente é silenciosamente perdido, relatório de importação pode alegar sucesso.
- **Probabilidade**: Alta, certa a cada importação Trello com custom fields.
- **Prioridade**: **P1** (P0 se e quando a importação real do Trello for executada em produção, pois o dado é perdido sem erro visível ao usuário).
- **Mitigação**: corrigir o mapeamento de colunas do importador (`campo_id`/`valor jsonb`) OU descontinuar a gravação em `card_custom_fields`/`card_custom_field_valores` e mapear direto para `board_campos`/`card_campos_valores`.
- **Etapa do roadmap**: Etapa 30 (Importação do Trello) — mas a correção do bug de schema é pré-requisito, não pode esperar a etapa inteira.
- **Bloqueador Etapa 1?** **Sim, parcialmente** — a Etapa 1 consolida o motor de cards/boards; se a base de campos personalizados permanecer fragmentada em três tabelas, qualquer consolidação de schema de `cards` corre risco de "herdar" a inconsistência ou de invalidar decisões de modelagem tomadas sem resolver esse ponto primeiro.

### 1.4 Cascades destrutivos sem soft-delete (`obras` e ~51 FKs)

- **Evidência**: 51 ocorrências de `REFERENCES public.obras(id) ON DELETE CASCADE` (`02-inventario-banco-dados.md` §4); nenhuma tabela de "lixeira"/arquivamento prévio; nenhum `ON DELETE RESTRICT` protegendo dados críticos, com exceção pontual de `ordens_compra.fornecedor_id` (RESTRICT — inconsistência de política entre módulos).
- **Impacto**: apagar uma obra apaga em cascata cards, cronograma completo, medições, notas fiscais, BMs, RDO, financeiro, restrições, riscos, aditivos — perda de dado irreversível por um único `DELETE`.
- **Probabilidade**: Baixa em uso normal de UI (obras raramente são apagadas), mas **catastrófica** se ocorrer (erro humano, bug, script de manutenção, ataque).
- **Prioridade**: **P0**.
- **Mitigação**: introduzir soft-delete (`arquivado`/`deleted_at`) em `obras` antes de qualquer exclusão física; padronizar `ON DELETE RESTRICT` como default para entidades financeiras/operacionais críticas.
- **Etapa do roadmap**: Pré-requisito transversal, tratar antes/durante Etapa 1 (schema de `cards`/`boards` já depende de `obras`) e reforçar na Etapa 32 (Performance e Segurança).
- **Bloqueador Etapa 1?** **Sim** — a Etapa 1 mexe diretamente na relação `boards.obra_id`/`cards.obra_id`; consolidar o motor genérico sem resolver a política de cascade de `obras` significa herdar o risco de exclusão em massa para a nova arquitetura.

### 1.5 Recebimento de material gravado no "local" errado (obra usada como depósito físico)

- **Evidência**: `estoque_saldos.local`/`estoque_movimentacoes.local` são `TEXT` livre; RPC `registrar_recebimento_atomico` grava `v_oc.obra_id` (UUID) diretamente como `local`; não há tabela de depósitos/almoxarifados; `card_recursos.local_entrega` (intenção declarada no card) não se conecta ao `local` real do estoque (`04-compras-estoque-producao.md` §6-7).
- **Impacto**: saldo físico sempre entra na obra da OC, mesmo que o card peça entrega em almoxarifado central; impossível representar múltiplos depósitos por obra; erro de digitação em `local` (string livre) cria "depósitos fantasma" sem detecção.
- **Probabilidade**: Alta — é o comportamento padrão de todo recebimento, não uma exceção.
- **Prioridade**: **P0** (integridade de estoque físico é dado operacional crítico e hoje sistematicamente incorreto para o cenário de compra centralizada).
- **Mitigação**: criar tabela `depositos`/`locais_estoque` com FK própria; migrar `estoque_saldos.local`/`estoque_movimentacoes.local` de `TEXT` para FK; conectar `card_recursos.local_entrega` ao destino real da movimentação.
- **Etapa do roadmap**: Etapa 11 (Estoque) e Etapa 18 (Recebimento).
- **Bloqueador Etapa 1?** Não diretamente (módulo de Suprimentos não é escopo da Etapa 1), mas relevante para a Etapa 2 (extensões de domínio), que deverá modelar o vínculo card↔estoque corretamente desde o início.

### 1.6 Estoque contado duas vezes / sem separação físico-reservado-disponível

- **Evidência**: `estoque_saldos` tem apenas `saldo`/`minimo`, sem `reservado`/`comprometido`; requisições e cards não fazem reserva de saldo existente antes de gerar nova compra (`04-compras-estoque-producao.md` §8).
- **Impacto**: risco de dupla contagem/dupla compra — o sistema não sabe quanto do saldo bruto já está comprometido para outra obra/atividade; nada impede requisitar compra nova havendo saldo físico suficiente em outro local.
- **Probabilidade**: Média-Alta em operação com múltiplas obras compartilhando insumos.
- **Prioridade**: **P1**.
- **Mitigação**: introduzir coluna/tabela de reserva antes de expandir o uso de Estoque para múltiplas obras simultâneas; checagem cruzada de saldo disponível antes de nova requisição.
- **Etapa do roadmap**: Etapa 11 (Estoque).
- **Bloqueador Etapa 1?** Não.

### 1.7 Conta a pagar potencialmente duplicada (Financeiro/TOTVS)

- **Evidência**: `financeiro_lancamentos`, `solicitacoes_financeiras`, `financeiro_snapshots` aparecem recriadas em pelo menos duas migrations próximas (`20260616112645`, `20260618151913` — `05-demais-modulos.md` §2 e §10); edge function `totvs-import-validar` **apenas valida e registra a run, não faz o upsert real do snapshot** (comentário explícito no código); múltiplas fontes de lançamento (manual + importação TOTVS + solicitações) sem constraints de unicidade confirmadas.
- **Impacto**: sem confirmação de chave natural única (ex. `arquivo_hash`) nas três tabelas, reimportações ou lançamentos concorrentes podem duplicar conta a pagar.
- **Probabilidade**: Não confirmada nesta etapa (auditoria de constraints pendente) — tratada como risco em aberto, não descartado.
- **Prioridade**: **P0** (potencial, dado o volume financeiro envolvido) até confirmação; rebaixar para P2 se auditoria de constraints confirmar unicidade adequada.
- **Mitigação**: auditoria dedicada de índices únicos em `financeiro_lancamentos`/`solicitacoes_financeiras`/`financeiro_snapshots`; localizar e documentar onde de fato ocorre o upsert do snapshot TOTVS (não localizado em `totvs-import-validar`).
- **Etapa do roadmap**: Etapa 15 (Espelho da OC do TOTVS) / Etapa 23 (Financeiro).
- **Bloqueador Etapa 1?** Não.

### 1.8 Valor de OC duplicado/denormalizado no card (`card_recursos.valor_oc`)

- **Evidência**: `valor_oc` é preenchido por trigger `fn_oc_atualizar_valor_oc`, somando `ordem_compra_itens.valor_total` de OCs `emitida`s vinculadas via `requisicoes`; a trigger só recalcula em `INSERT/UPDATE OF status` quando `NEW.status = 'emitida'` — **não há ramo para recomputar quando uma OC emitida é cancelada ou seus itens alterados** (`04-compras-estoque-producao.md` §4).
- **Impacto**: `valor_oc` pode ficar "preso" com valor desatualizado após cancelamento/edição pós-emissão — dado de custo comprometido (EVM) incorreto sem qualquer sinal de erro.
- **Probabilidade**: Média — depende de cancelamentos pós-emissão ocorrerem na operação real.
- **Prioridade**: **P1**.
- **Mitigação**: estender a trigger para cobrir cancelamento/alteração pós-emissão, ou tratar `valor_oc` como campo sempre recalculado sob demanda (view/RPC) em vez de denormalizado.
- **Etapa do roadmap**: Etapa 13/14 (Fila de Compras/Cotações) e Etapa 18 (Recebimento).
- **Bloqueador Etapa 1?** Não.

---

## 2. Segurança / RLS

### 2.1 Drift de `types.ts` — 55 tabelas reais ausentes do contrato de tipos

- **Evidência**: comparação de `CREATE TABLE public.*` nas migrations (144 tabelas físicas) contra `types.ts` (87 tabelas reais expostas) — 55 tabelas ausentes, incluindo **todo o domínio Kanban** (`boards`, `board_listas`, `board_campos`, `board_membros`), todo Suprimentos Fase 5A, RDO, Inspeções, parte do Financeiro (`02-inventario-banco-dados.md` §0). Repositórios afetados usam `@ts-nocheck` (`boards.ts`, `01-inventario-kanban.md` §1).
- **Impacto**: nenhuma checagem estática de tipos nas operações de banco desses domínios — regressões silenciosas (campo renomeado, tipo trocado) não são pegas em compilação; o gate `verify-repository-boundary.sh` (ARC-003.d) opera sobre uma base de tipos que não cobre 40%+ do schema físico, dando falso senso de segurança arquitetural.
- **Probabilidade**: Certa — já é o estado atual.
- **Prioridade**: **P0** — é justamente o domínio-alvo da Etapa 1.
- **Mitigação**: rodar `supabase gen types` contra o schema real antes de qualquer mudança estrutural em `boards`/`cards`; comparar diff; eliminar `@ts-nocheck` nos repositórios afetados.
- **Etapa do roadmap**: Pré-requisito da Etapa 1 (já assim classificado em `08-matriz-reaproveitamento.md`).
- **Bloqueador Etapa 1?** **SIM — bloqueador real e direto.** Consolidar o motor Kanban genérico sem tipos corretos para `boards`/`board_listas`/`board_campos`/`board_membros` significa construir/refatorar sobre uma base sem qualquer rede de segurança de compilação.

### 2.2 RLS ausente em todo o módulo de Suprimentos (Fase 5A)

- **Evidência**: nenhuma migration com `ENABLE ROW LEVEL SECURITY` localizada para `fornecedores`, `requisicoes`, `cotacoes`, `cotacao_propostas`, `ordens_compra`, `ordem_compra_itens`, `recebimento_materiais`, `recebimento_itens`, `estoque_saldos`, `estoque_movimentacoes`, `user_setores` (`02-inventario-banco-dados.md` §8). Suite `sec-002` cobre apenas boards/cards/obras/empresas — nenhum lote para Suprimentos.
- **Impacto**: se confirmado em produção, qualquer usuário `authenticated` pode ler/escrever essas tabelas sem restrição de obra/setor — exposição de dados comerciais (preços de fornecedor, valores de OC) e risco de escrita indevida.
- **Probabilidade**: Alta — ausência confirmada por leitura direta das migrations; só não é "certa" porque não foi confirmada contra o banco de produção real (poderia haver policy aplicada fora do trilho de migrations versionadas, o que seria por si só outro risco de governança).
- **Prioridade**: **P0**.
- **Mitigação**: aplicar RLS por obra/setor equivalente ao padrão já usado em `cards`/`boards`; criar lote `sec-002` dedicado a Suprimentos.
- **Etapa do roadmap**: Pré-requisito transversal / Etapa 13 (Fila de Compras) antes de expandir uso.
- **Bloqueador Etapa 1?** Não diretamente (fora do escopo de boards/cards), mas é o achado de segurança mais grave do levantamento e deve correr em paralelo, pois a Etapa 2 (vínculos) conectará cards a essas tabelas.

### 2.3 Regressão de RLS em `cards` (`USING(true)`)

- **Evidência**: `cards` tem RLS habilitado, mas a policy final é `USING(true)/WITH CHECK(true)` para `authenticated` (migration `20260707150224`) — qualquer autenticado lê/escreve/apaga qualquer card. Migration anterior (`20260624190006`) havia criado funções de escopo mais finas (`current_is_gm()`, `current_setores()`, `has_card_setor()`, `has_card_access()`) que parecem ter sido sobrescritas por policies mais permissivas em migrations posteriores (`02-inventario-banco-dados.md` §8). O teste `sec-002/batch-C/cards_rls.sql` testa `user_in_card()` como se houvesse escopo real por membro.
- **Impacto**: isolamento por obra/board/setor não é de fato imposto no banco — a única barreira de fato é client-side (`useCardPermissions.ts`, que o próprio código documenta como "gating de UI, banco é a última linha de defesa" — linha de defesa hoje **não existe**).
- **Probabilidade**: Certa.
- **Prioridade**: **P0**.
- **Mitigação**: reativar/reconciliar as policies de escopo fino (`has_card_setor`/`has_card_access`) com a policy vigente; adicionar teste `sec-002` que falhe explicitamente se a policy voltar a `USING(true)`.
- **Etapa do roadmap**: Pré-requisito da Etapa 1.
- **Bloqueador Etapa 1?** **SIM.** A Etapa 1 consolida exatamente o modelo de acesso a `cards`/`boards`; endurecer RLS depois de reestruturar o schema exige retrabalho — deve ser corrigido como parte do mesmo esforço, não depois.

### 2.4 Permissões excessivas / exposição de dados

- **Evidência**: `profiles` com policy de select `USING(true)` para qualquer autenticado, expondo dados de todos os usuários (`02-inventario-banco-dados.md` §3); duplicação de allowlist de normalização de setor entre `src/lib/authz/paginas.ts` (client) e edge function `sync-player-auth` (`05-demais-modulos.md` §9, achado #4); card sem setor associado é liberado para qualquer autenticado em `useCardPermissions.ts` (`01-inventario-kanban.md` §11).
- **Impacto**: exposição de dados de perfil não documentada como decisão intencional; risco de usuário ficar com setor "fantasma" (aceito no client, rejeitado no servidor ou vice-versa); card mal configurado (sem setor) vira uma brecha de acesso.
- **Probabilidade**: Média.
- **Prioridade**: **P2**.
- **Mitigação**: confirmar intencionalidade da exposição de `profiles`; unificar fonte única da allowlist de setores (idealmente só no servidor); tratar "card sem setor" como acesso restrito por padrão (fail-closed), não liberado.
- **Etapa do roadmap**: Etapa 29 (Permissões).
- **Bloqueador Etapa 1?** Parcial — o caso "card sem setor libera geral" é relevante para qualquer card criado durante a consolidação; recomenda-se endereçar junto com 2.3.

---

## 3. Performance

### 3.1 Ausência de paginação/virtualização em listas de alto volume

- **Evidência**: apenas 8 usos de `.range()` em todo `src`; zero ocorrências de `react-window`/`react-virtual`/`Virtuoso` (`08-matriz-reaproveitamento.md`, comandos de evidência); `ContagensCiclicas.tsx` (1960 linhas, maior página do repositório) não usa `.range()` (`08-matriz-reaproveitamento.md`, `09-matriz-roadmap.md` etapa 11 e observações transversais).
- **Impacto**: telas com milhares de registros (estoque, lista consolidada futura) tendem a carregar tudo de uma vez — degradação de performance e possível trava do navegador em obras grandes.
- **Probabilidade**: Alta conforme o volume de dados crescer (multiplicado pelas Etapas 11 e 22 do roadmap).
- **Prioridade**: **P1** (torna-se P0 assim que qualquer quadro/lista ultrapassar alguns milhares de linhas em produção).
- **Mitigação**: adotar paginação/`.range()` e virtualização como padrão obrigatório antes de qualquer tela nova de listagem; retrofit prioritário em `ContagensCiclicas.tsx`.
- **Etapa do roadmap**: Etapa 11 (Estoque), Etapa 22 (Lista consolidada), Etapa 32 (Performance e Segurança).
- **Bloqueador Etapa 1?** **Sim, parcialmente.** O Motor A (`QuadroBoard.tsx`) já não pagina cards dentro de uma lista; um board de produção com milhares de cards no mesmo quadro Kanban (`QuadroKanban.tsx`, Motor B, é o uso real predominante hoje) pode degradar performance de imediato ao consolidar os dois motores em um só sem introduzir paginação/virtualização nas colunas.

### 3.2 Índices ausentes em tabela de auditoria de alto volume

- **Evidência**: `audit_logs` sem índice além da PK, `Relationships: []`, tabela de log que cresce indefinidamente e é consultada por `entidade_id`/`obra_id` (`02-inventario-banco-dados.md` §7).
- **Impacto**: consultas de histórico por registro (ex. timeline de um card específico) degradam conforme o log cresce.
- **Probabilidade**: Alta a médio prazo.
- **Prioridade**: **P2**.
- **Mitigação**: adicionar índice composto `(entidade, entidade_id)`.
- **Etapa do roadmap**: Pré-requisito de qualquer etapa que amplie uso de `audit_logs` (Etapa 3 — Eventos de domínio, que propõe derivar histórico do stream de eventos).
- **Bloqueador Etapa 1?** Não.

### 3.3 Atualização de posição de card via N mutações individuais (sem RPC em lote)

- **Evidência**: `onDragEnd` do Motor A dispara N mutações individuais via `Promise.all` (uma call por card cuja posição relativa mudou) em vez de um `UPDATE` em lote/RPC transacional; sem coluna de versão/rank estável (posição numérica simples, não 1024-based) — risco de corrida em edição concorrente (`01-inventario-kanban.md` §4).
- **Impacto**: reordenar um board com muitos cards gera até N updates concorrentes; dois usuários movendo cards simultaneamente podem gerar updates de posição conflitantes (last-write-wins sem verificação de versão).
- **Probabilidade**: Média-Alta em boards com múltiplos usuários simultâneos.
- **Prioridade**: **P1**.
- **Mitigação**: RPC transacional de reordenação em lote; adotar rank string/posição 1024-based (já usado no importador Trello) em vez de posição inteira simples.
- **Etapa do roadmap**: Etapa 1 (é o próprio motor de DnD que está sendo consolidado).
- **Bloqueador Etapa 1?** **Sim — deve ser corrigido durante a consolidação**, não depois, pois é exatamente o mecanismo de persistência de posição que a Etapa 1 está unificando entre os dois motores.

---

## 4. Transacionalidade / Idempotência

### 4.1 Criação de card + itens sem transação (padrão predominante fora das RPCs atômicas)

- **Evidência**: apenas 8 RPCs atômicas identificadas no sistema inteiro (`emitir_oc_atomico`, `salvar_nf_atomica`, `registrar_recebimento_atomico`, `fechar_bms_atomica`, `criar_medicao_atomica`, `fn_oc_aprovar`, `fn_estoque_transferir`, `aprovar_orcamento_obra` — `08-matriz-reaproveitamento.md`); a criação de card e suas tabelas satélite (`card_setores`, `card_recursos`, `card_labels`, checklist inicial etc.) **não está entre elas** — é uma sequência de chamadas de repositório do frontend, cada uma podendo falhar independentemente.
- **Impacto**: card pode ser criado sem seus itens de setor/recurso associados se uma chamada intermediária falhar (rede, timeout) — estado parcialmente criado sem rollback automático.
- **Probabilidade**: Média — depende de falhas de rede/timeout durante o fluxo multi-step de criação.
- **Prioridade**: **P1**.
- **Mitigação**: encapsular criação de card+extensões em RPC transacional única, seguindo o padrão já validado nas 8 RPCs existentes (recomendação central de `10-arquitetura-alvo.md` §13).
- **Etapa do roadmap**: Etapa 1 (para o núcleo genérico) e Etapa 2 (para as extensões de domínio).
- **Bloqueador Etapa 1?** **Sim, recomendado tratar durante a Etapa 1** — é o momento de estabelecer o padrão transacional para toda criação de card antes de generalizar para os 41 pontos de `card_id` mapeados na Etapa 2.

### 4.2 Automações executadas duas vezes / configuração não compartilhada

- **Evidência**: Motor A — regras de automação persistidas em **`localStorage`** (`gestaobra:board:automacoes`), sem tabela de banco (`01-inventario-kanban.md` §7); Motor B — regras hard-coded, mas a **idempotência de disparo** (evitar repetir a mesma automação) também é rastreada em `localStorage` (`lerAutomacoesExecutadas`/`salvarAutomacoesExecutadas`); toggle de ativação (`useQuadroAutomacoesConfig.ts`, chave `quadroAutomacoesDesativadas`) igualmente em `localStorage` (`08-matriz-reaproveitamento.md`, `09-matriz-roadmap.md` Etapa 27, `10-arquitetura-alvo.md` §10).
- **Impacto**: (a) automação configurada por um usuário é invisível aos demais e se perde ao trocar de navegador/limpar dados; (b) idempotência de execução sendo local, o **mesmo evento pode disparar a mesma automação múltiplas vezes** em dispositivos/sessões diferentes do mesmo usuário, ou re-executar após limpeza de `localStorage`, gerando comentários/etiquetas duplicados sem controle central.
- **Probabilidade**: Alta — é o comportamento garantido do desenho atual, não uma falha eventual.
- **Prioridade**: **P1** (arquitetura "não pode funcionar em equipe tal como está", nas palavras do próprio doc 01).
- **Mitigação**: migrar configuração e controle de idempotência de automação para tabela server-side com chave de deduplicação por evento+regra+card, antes de qualquer nova regra de automação.
- **Etapa do roadmap**: Etapa 27 (Automações), após Etapa 3 (Eventos de domínio).
- **Bloqueador Etapa 1?** Não diretamente, mas se a Etapa 1 mantiver o mecanismo de automação do Motor A como está (localStorage) ao consolidar os dois motores, o problema apenas se propaga para o motor unificado — recomenda-se, no mínimo, não estender esse padrão a novos casos durante a Etapa 1.

### 4.3 `fn_atualizar_cpm` degrada silenciosamente se a RPC não existir

- **Evidência**: `cronogramaRepo.rpcAtualizarCpm` faz `logger.warn` e segue adiante se a função não existir (`03-cronograma-e-vinculos.md` §9).
- **Impacto**: falha de deploy de migration é mascarada — CPM pode ficar sistematicamente desatualizado sem qualquer erro visível ao usuário ou ao time.
- **Probabilidade**: Baixa (depende de falha de deploy), mas de detecção muito difícil quando ocorre.
- **Prioridade**: **P2**.
- **Mitigação**: transformar degradação silenciosa em alerta visível (toast de erro ou registro em `audit_logs`/monitoramento), não apenas log técnico.
- **Etapa do roadmap**: Etapa 4 (Reconciliação do cronograma).
- **Bloqueador Etapa 1?** Não.

---

## 5. Dados críticos em `localStorage`

| Dado | Chave/local | Deveria estar em | Risco | Prioridade |
|---|---|---|---|---|
| Regras de automação do Motor A | `gestaobra:board:automacoes` | Tabela server-side | Não sincroniza entre usuários; perdido ao limpar navegador | **P1** |
| Idempotência de execução de automação (Motor B) | `STORAGE_KEYS.quadroAutomacoesExecutadas` | Tabela server-side com chave de deduplicação | Automação pode re-executar (duplicar comentário/etiqueta) | **P1** |
| Ativação/desativação de automação por quadro | `quadroAutomacoesDesativadas` (`useQuadroAutomacoesConfig.ts`) | Tabela server-side | Config de negócio não auditável nem compartilhada | **P1** |
| Cadência/status de importação TOTVS | `totvs.cadencia...` (`useTotvsImportStatus.ts`) | Cópia server-side auditável (cadência pode ficar client-side) | Perda de status entre dispositivos | **P2** |
| Baseline de performance de RPC (`rpc-baseline.ts`) | localStorage, uso restrito a `/gm/saude` | Aceitável manter local — é cache de observabilidade do operador, não dado operacional | Baixo | **P3** |
| Estado de filtro não salvo (URL/base64) | Serializado na URL, não localStorage | — | Aceitável (não persiste dado de negócio) | **P3** |

- **Evidência agregada**: 195 ocorrências de `localStorage` em `src` (`08-matriz-reaproveitamento.md`, comando de evidência).
- **Mitigação geral**: separar explicitamente "preferência de UI" (pode ficar local) de "estado operacional/dado de negócio" (deve ser server-side) — critério já proposto em `10-arquitetura-alvo.md` §1.
- **Etapa do roadmap**: Etapa 27 (Automações) e Etapa 15 (Espelho da OC do TOTVS) para os itens P1/P2 acima.
- **Bloqueador Etapa 1?** Não diretamente, mas a automação de board (Motor A) é parte do escopo funcional herdado pela Etapa 1 — recomenda-se não aumentar a superfície desse padrão durante a consolidação.

---

## 6. Mocks em fluxos tidos como concluídos

| Fluxo | Evidência | Classificação real | Prioridade |
|---|---|---|---|
| Importação de campos personalizados do Trello | `TODO(ARC-001/E-01)` no código-fonte, mismatch de schema confirmado (`06-analise-trello.md` §3) | **Quebrado**, não "mock" propositalmente rotulado — pior: reporta sucesso parcial | **P1** |
| Badge de Riscos no card | `TODO(ARC-001/E-01)`: coluna `card_id` ausente em `riscos`; badge pode estar inoperante retornando `null` silenciosamente (`05-demais-modulos.md` §5) | **Parcial/mock** — UI pronta, dado não confirmadamente conectado | **P1** (badge "sem riscos" falso-negativo é grave para segurança operacional de obra) |
| Ordem de produção / roteiro multi-etapa (Corte→Dobra→Solda) | Nenhuma tabela `ordem_producao` encontrada; `card_setores` PK impede múltiplas etapas simultâneas por card (`04-compras-estoque-producao.md` §10-12) | **Parcial/mock de processo** — card cumpre papel informal de OP sem estrutura real | **P2** |
| Administração do catálogo de etiquetas (criar/editar/excluir) | Não localizado dialog de gestão; só aplicar/remover etiqueta existente (`01-inventario-kanban.md` §6, §13) | **Ausente/mock** | **P3** |
| Notificação real a partir de menção em comentário | `extrairMencoes` testado, mas disparo de notificação real ao mencionar não confirmado como conectado (`01-inventario-kanban.md` §13) | **Não confirmado — possível mock parcial** | **P2** |
| Central de Documentos unificada | Não existe como módulo — fragmentado por domínio, sem dedup/versionamento (`05-demais-modulos.md` §3) | **Inexistente**, apesar de ser esperado como conceito de produto | **P2** |
| Upsert real do snapshot financeiro TOTVS | Comentário explícito no código: função de validação "não faz o upsert real" (`05-demais-modulos.md` §2) | **Não localizado/possivelmente incompleto** | **P1** |

- **Bloqueador Etapa 1?** Apenas indiretamente — nenhum destes é do núcleo Kanban genérico, mas o padrão recorrente de "UI construída antes do dado real existir" (riscos, campos custom Trello) é um sinal de processo a evitar durante a própria Etapa 1 (não declarar "pronto" sem confirmar ponta a ponta).

---

## 7. Falta de auditoria (trilha de mudança)

- **Evidência**: `audit_logs.user_id`/`obra_id` nullable, sem índice em `entidade_id` (`02-inventario-banco-dados.md` §3, §7); `cards.criado_por` é `TEXT` livre, não FK para `auth.users`/`profiles`, quebrando rastreabilidade confiável de "quem criou o card" (`02-inventario-banco-dados.md` §6); padrão sistemático de `CREATE TABLE` duplicado em ~9 tabelas de 6+ módulos (`financeiro_lancamentos`, `riscos`, `solicitacoes_financeiras`, `financeiro_snapshots`, `pacotes_trabalho`, `restricoes`, `pacote_restricoes`, `audit_logs`, `card_atividades`, `security_events`) sem confirmação de diff de schema entre as versões (`05-demais-modulos.md` §10); quatro tabelas de log/evento sem contrato unificado (`security_events`/`system_events`/`audit_logins`/`audit_logs`, `02-inventario-banco-dados.md` §9).
- **Impacto**: impossível garantir hoje uma reconstrução confiável e completa de "quem fez o quê, quando" em todos os módulos; risco de a versão vigente de uma tabela crítica (ex. `audit_logs`) não ser a que se espera, por conta das recriações não documentadas.
- **Probabilidade**: Certa quanto à fragmentação; incerta quanto à consistência real do schema em produção (requer `supabase db diff`).
- **Prioridade**: **P1**.
- **Mitigação**: rodar `supabase db diff`/comparação de schema real antes de qualquer alteração estrutural nos módulos afetados; tornar `user_id` `NOT NULL` para novas escritas de auditoria; migrar `cards.criado_por` para FK real.
- **Etapa do roadmap**: Pré-requisito transversal / Etapa 3 (Eventos de domínio, que propõe unificar histórico como projeção de eventos).
- **Bloqueador Etapa 1?** Parcial — `cards.criado_por` como texto livre é uma lacuna de rastreabilidade que a consolidação do motor genérico deveria corrigir (é uma coluna do próprio `cards`, núcleo da Etapa 1).

---

## 8. Tabela-síntese de todos os riscos (ordenada por prioridade)

| # | Risco | Categoria | Evidência (arquivo) | Prioridade | Bloqueador Etapa 1? |
|---|---|---|---|---|---|
| 2.1 | `types.ts` sem 55 tabelas reais, incl. todo domínio `boards`/`board_*` | Segurança/Tipos | 02 §0 | **P0** | **SIM** |
| 2.2 | RLS ausente em todo módulo de Suprimentos | Segurança | 02 §8 | **P0** | Não |
| 2.3 | RLS de `cards` regredida para `USING(true)` | Segurança | 02 §8 | **P0** | **SIM** |
| 1.4 | Cascade destrutivo em `obras` sem soft-delete (51 FKs) | Integridade | 02 §4 | **P0** | **SIM** |
| 1.5 | Recebimento grava `obra_id` como "local" de estoque | Integridade | 04 §6-7 | **P0** | Não |
| 1.7 | Possível duplicidade de conta a pagar (constraints não confirmadas) | Integridade/Financeiro | 05 §2 | **P0 (potencial)** | Não |
| 1.1 | Cards órfãos por `ON DELETE SET NULL` silencioso em cronograma | Integridade | 03 §4 | P1 | Não |
| 1.2 | Cards/itens de cronograma duplicados sem `UNIQUE(obra_id, uid_mpp)` | Integridade | 03 §4, §8 | P1 | Não |
| 1.3 | Campos personalizados Trello quebrados (3 sistemas paralelos) | Integridade/Import | 01 §5, 06 §3 | P1 | Parcial |
| 1.6 | Estoque sem separação físico/reservado/disponível | Integridade | 04 §8 | P1 | Não |
| 1.8 | `card_recursos.valor_oc` denormalizado sem recomputo em cancelamento | Integridade | 04 §4 | P1 | Não |
| 3.1 | Ausência de paginação/virtualização em listas de alto volume | Performance | 08, 09 | P1 | Parcial (SIM para colunas do Kanban) |
| 3.3 | Reordenação de card via N mutações sem RPC em lote | Performance/Transação | 01 §4 | P1 | **SIM** |
| 4.1 | Criação de card+itens sem transação | Transacionalidade | 08 | P1 | **SIM (recomendado)** |
| 4.2 | Automações executadas em duplicidade / config em localStorage | Transacionalidade/localStorage | 01 §7, 09, 10 §10 | P1 | Não (evitar ampliar) |
| 6 (riscos badge) | Badge de Riscos possivelmente inoperante (`card_id` ausente) | Mock/Dado | 05 §5 | P1 | Não |
| 6 (TOTVS upsert) | Upsert real do snapshot financeiro TOTVS não localizado | Mock/Dado | 05 §2 | P1 | Não |
| 7 | Falta de auditoria uniforme (`criado_por` texto livre, schema duplicado) | Auditoria | 02 §3,§6,§9; 05 §10 | P1 | Parcial |
| 2.4 | Exposição de `profiles`, allowlist de setor duplicada, card sem setor libera geral | Segurança | 02 §3; 05 §9; 01 §11 | P2 | Parcial |
| 3.2 | `audit_logs` sem índice em `entidade_id` | Performance | 02 §7 | P2 | Não |
| 4.3 | `fn_atualizar_cpm` degrada silenciosamente | Transacionalidade | 03 §9 | P2 | Não |
| 6 (produção) | Ordem de produção/roteiro multi-etapa inexistente | Mock/Processo | 04 §10-12 | P2 | Não |
| 6 (documentos) | Central de Documentos inexistente | Mock/Produto | 05 §3 | P2 | Não |
| 6 (menções) | Notificação real de menção não confirmada | Mock/Dado | 01 §13 | P2 | Não |
| 6 (etiquetas) | Administração de catálogo de etiquetas ausente | Mock/UI | 01 §6,§13 | P3 | Não |
| 5 (baseline RPC) | `rpc-baseline.ts` em localStorage (aceitável) | localStorage | 08 | P3 | Não |

---

## 9. Confirmação final — o que é BLOQUEADOR real da Etapa 1

A Etapa 1 ("Consolidação do Kanban genérico") tem como escopo `boards`, `board_listas`, `board_campos`,
`board_membros`, `cards` (núcleo genérico), `card_board_posicao`, DnD e automação de board — conforme
`08-matriz-reaproveitamento.md` e `09-matriz-roadmap.md` (item 1, prontidão 2).

Com base na evidência consolidada acima, os riscos a seguir são classificados como **BLOQUEADORES
REAIS** — isto é, iniciar/concluir a Etapa 1 sem tratá-los produz uma consolidação estruturalmente
inválida ou insegura, exigindo retrabalho:

1. **`types.ts` não cobre `boards`/`board_listas`/`board_campos`/`board_membros`** (2.1) — sem isso, toda
   e qualquer refatoração do schema de boards durante a Etapa 1 é feita "às cegas", sem checagem de tipo.
   **Bloqueador confirmado.**
2. **RLS de `cards` efetivamente inexistente (`USING(true)`)** (2.3) — consolidar o modelo de acesso do
   motor genérico sobre uma policy que já demonstrou regressão histórica (foi mais restritiva e foi
   afrouxada) sem corrigi-la primeiro perpetua a falha de isolamento na nova arquitetura.
   **Bloqueador confirmado.**
3. **Cascade destrutivo de `obras` sem soft-delete** (1.4) — `boards.obra_id`/`cards.obra_id` dependem
   diretamente dessa política; qualquer exclusão de obra durante ou logo após a consolidação apaga em
   cascata o próprio objeto que está sendo consolidado, sem possibilidade de recuperação.
   **Bloqueador confirmado.**
4. **Persistência de posição via N mutações sem RPC transacional/rank estável** (3.3) — é o próprio
   mecanismo de DnD que a Etapa 1 está unificando entre os dois motores; consolidar sem corrigir
   significa formalizar um padrão de corrida de concorrência como definitivo.
   **Bloqueador confirmado (deve ser corrigido dentro do escopo da própria etapa, não é pré-requisito
   externo).**
5. **Criação de card+extensões sem transação** (4.1) — recomendado, não estritamente obrigatório para
   "iniciar" a Etapa 1, mas deve ser resolvido **durante** a etapa, pois a Etapa 2 (41 pontos de
   `card_id`) herdará qualquer padrão não-transacional estabelecido agora.
   **Bloqueador recomendado (mitigável dentro do próprio escopo da etapa).**

Risco adicional a monitorar mas **não bloqueador direto**: duplicidade de campos personalizados (1.3) e
ausência de paginação/virtualização no board (3.1) — ambos devem ser corrigidos antes de expandir o uso
do quadro consolidado em produção com volume real, mas não impedem tecnicamente iniciar a consolidação
estrutural do schema (podem ser tratados como itens finais da mesma etapa, antes do "go-live" da Etapa
1, e não necessariamente antes do primeiro commit de refatoração).

Todos os demais riscos listados neste documento (Suprimentos sem RLS, estoque sem reserva, valor de OC
denormalizado, automações em localStorage, mocks de riscos/produção/documentos, falta de auditoria
uniforme) **não bloqueiam a Etapa 1** por estarem fora do seu escopo direto (`boards`/`cards` genéricos),
mas devem permanecer no backlog de dívida técnica com as prioridades e etapas do roadmap indicadas nas
seções 1 a 8, para que não sejam esquecidos ao se declarar a Etapa 1 "concluída".
