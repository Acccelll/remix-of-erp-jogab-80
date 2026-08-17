# 02 — Inventário do Banco de Dados (Etapa 0)

> Fontes: `supabase/migrations/*` (220 arquivos SQL, Postgres/Supabase), `migrations/*` (27 arquivos, MySQL legado `jogabcom_gestao_obras`), `src/integrations/supabase/types.ts` (5061 linhas, gerado), `docs/db/CANONICIDADE.md`, `docs/db/MYSQL_STATE.md`, `docs/db/MIGRATIONS_INDEX.md`, `supabase/tests/sec-002/*`.
>
> Método: extração de `CREATE TABLE public.<nome>` de todas as migrations Postgres (144 tabelas físicas distintas encontradas) comparada aos tipos exportados em `types.ts` (100 entradas de `Tables`, das quais 87 são tabelas reais — o restante são funções/views listadas incorretamente sob `Tables` ou nomes de RPC). Toda linha abaixo cita arquivo de migration de origem.

## 0. Achado estrutural crítico — `types.ts` está gravemente desatualizado

`types.ts` é o único artefato de schema consumido pelo código TypeScript (`Database["public"]["Tables"][...]`). Ele foi comparado à lista real de `CREATE TABLE public.*` em `supabase/migrations/`.

**55 tabelas existem no Postgres (via migration aplicada) e NÃO aparecem em `types.ts`:**

| Domínio | Tabelas ausentes de `types.ts` | Migration de origem |
| --- | --- | --- |
| Kanban / Board | `boards`, `board_listas`, `board_campos`, `board_membros` | `20260630121931_e74da603...sql` e seguintes |
| Cards (extensão) | `card_custom_fields`, `card_membros_externos` | `20260722114221_4de6dfe5...sql` |
| Suprimentos (Fase 5A) | `fornecedores`, `requisicoes`, `cotacoes`, `cotacao_propostas`, `ordens_compra`, `ordem_compra_itens`, `recebimento_materiais`, `recebimento_itens`, `estoque_saldos`, `estoque_movimentacoes` | `20260625182038_c703efa2...sql` |
| Orçamento (Fase 2.1) | `insumos`, `composicoes`, `composicao_itens`, `orcamento_itens` | `20260625123216_8927a1ea...sql` |
| RDO | `rdo`, `rdo_atividades`, `rdo_efetivo`, `rdo_fotos`, `rdo_ocorrencias` | ~`20260629*` |
| Inspeções | `inspecoes`, `inspecao_modelos`, `inspecao_perguntas`, `inspecao_respostas`, `inspecao_fotos`, `inspecao_agendas`, `inspecao_qr_alvos` | ~`20260722*` |
| Financeiro | `financeiro_evolucao_rollup`, `financeiro_matriz_rateios`, `financeiro_divergencias_matriz`, `financeiro_previsao_carrinho(+_itens/_fechado_itens)`, `financeiro_relatorio_status_atual`, `financeiro_relatorio_status_historico`, `alcadas_aprovacao` | `20260622180715...sql` e outras |
| Contratos | `contratos`, `contrato_medicoes`, `historico_medicao` | diversas ~`2026070x` |
| DP / Ponto | `ponto_registros`, `ponto_importacoes`, `ponto_tratativas`, `dp_fechamento_competencia` | `20260618153441...sql` |
| Governança/Import | `import_validation_runs`, `totvs_import_runs`, `system_events`, `audit_logins`, `feature_flags`, `user_setores`, `obra_localizacoes`, `oportunidade_historico`, `frota_apropriacao` | diversas |

**Consequência:** todo código que usa `supabase.from("board_listas")`, `.from("cards")` (parcialmente ok), repositórios de suprimentos, RDO e inspeções está **sem checagem de tipos** para essas tabelas — os arquivos `src/lib/repositories/boards.ts` e `src/lib/repositories/trelloImport.ts` referenciam `Database["public"]["Tables"]["board_listas"]`, que **não existe no tipo gerado**, então o TypeScript não pode estar validando esses campos (a única forma de compilar é `types.ts` ter drift silencioso ou esses arquivos usarem `any`/cast). Isso é o problema mais grave encontrado nesta etapa: o "contrato" de tipos que o `verify-repository-boundary.sh` tenta proteger (item (a) do escopo) na prática **não cobre 40%+ do schema físico real**.

Classificação: **Investigar/Substituir com urgência** — recomenda-se rodar `supabase gen types` contra o banco real e comparar diff antes de qualquer nova feature.

## 1. Item (a) — insumos, requisicoes, fornecedores, ordens_compra, estoque

Essas 5 tabelas são citadas em `scripts/verify-repository-boundary.sh` (`COVERED_TABLES`) mas **não existem em `types.ts`**. Investigação:

| Tabela | Existe? | Banco | Migration | Observação |
| --- | --- | --- | --- | --- |
| `insumos` | Sim | **Postgres** | `supabase/migrations/20260625123216_8927a1ea-1dab-45fe-bca2-fd6761d01ef1.sql` | Catálogo de insumos (material/mão de obra/equipamento/serviço); RLS habilitado, policies por `current_is_gm()`/setor Engenharia. |
| `fornecedores` | Sim | **Postgres** | `supabase/migrations/20260625182038_c703efa2-2039-488c-a3db-2231a4b04740.sql` | **Sem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`** localizado nas migrations — ver seção RLS abaixo. |
| `requisicoes` | Sim | **Postgres** | idem | FK para `obras`, `cards`, `orcamento_itens`, `insumos`. **Sem RLS localizado.** |
| `ordens_compra` | Sim | **Postgres** | idem | Tem `numero bigint generated always as identity`; **sem RLS localizado**; possui `status` e `status_aprovacao` — dois campos de status na mesma linha (ver duplicidade §5). |
| `estoque` (como tal) | **Não existe tabela `estoque`** — existem `estoque_saldos` e `estoque_movimentacoes` | **Postgres** | `20260625182038...sql` | O nome no script de fronteira (`estoque`) não bate com o nome físico real (`estoque_saldos`/`estoque_movimentacoes`); o gate de arquitetura `verify-repository-boundary.sh` está checando um nome de tabela que **nunca existiu**, portanto nunca vai disparar bypass real para esse domínio. |

**Não há segunda fonte de verdade em MySQL para esse conjunto** — não foi encontrada nenhuma menção a `insumos`, `requisicoes`, `fornecedores`, `ordens_compra` ou `estoque` nos 27 arquivos de `migrations/*` (trilho MySQL). O domínio de suprimentos é 100% Postgres. Isso contradiz a leitura possível do enunciado do script de fronteira: não há duplicidade de fonte de dados aqui, mas há **duplicidade de intenção**: o script de boundary lista tabelas que hoje não têm `types.ts` nem RLS completo, ou seja, o gate arquitetural (ARC-003.d) está sendo aplicado sobre uma base de tipos que não reflete o schema — falso senso de segurança.

## 2. Trilho MySQL (`migrations/*`, 27 arquivos)

Confirmado por `docs/db/MYSQL_STATE.md` e `docs/db/CANONICIDADE.md`: existe um **segundo banco de produção real** (MySQL `jogabcom_gestao_obras`, acessado via `api.php`) para os domínios **Colaborador** (RH/mobilização), **Patrimônio**, **Contrato** (legado, `contratos.historico` congelado) e **CRM completo** (`leads`/`oportunidades`, `funil_estagios`, `lead_comentarios`). A `CANONICIDADE.md` já registra formalmente que a matriz declarada (Postgres canônico para Colaborador) **diverge do runtime real** (MySQL é quem manda), e cita um incidente concreto: `ExportMovimentacoesDialog`/`RdoTab` liam a tabela Postgres espelho `mobilizacoes_periodos` (vazia, nunca escrita) enquanto a escrita real ocorria no MySQL — dados "sumidos" sem erro.

Tabelas MySQL relevantes por migration: `obras` (campos financeiros complementares), `veiculos`, `clientes`, `leads`/`oportunidades`, `lead_comentarios`, `documento_tipos`, `vencimentos` (consolidação de `documentos_colaborador`), `usuarios`/matriz de permissões, `movimentacoes`/`movimentacoes_patrimonios`/`movimentacoes_contratos` (logs de evento tipados), `colaboradores` (cidade/uf normalizados).

**Achado crítico adicional:** `obras`, `clientes` e `colaboradores`/`veiculos` **existem simultaneamente em Postgres (`types.ts`) e em MySQL**, mas com colunas e finalidades distintas (Postgres = módulo Kanban/Cronograma/Financeiro; MySQL = módulo legado PHP de cadastro/RH/CRM). Não há chave de sincronização automática confiável — `docs/db/CANONICIDADE.md` reconhece que o job de sync `colaboradores → players` **ainda não foi implementado**.

Classificação do trilho MySQL: **Investigar/Substituir** (migração planejada, mas hoje é fonte de verdade operacional viva, não legado morto).

## 3. Inventário por tabela — escopo core (cards, board, cronograma, obras, restrições, riscos, pacotes, notificações, financeiro, auditoria, papéis)

| Tabela | Finalidade | Campos-chave | PK/FKs | Índices | RLS | Triggers/Funções | Estado de uso | Riscos/Duplicidade | Classificação |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cards` | Pool único de cards (recurso/genérico) do Kanban | `numero` (seq), `tipo`, `status` (texto livre, não enum), `obra_id`, `cronograma_item_id`, `grupo_negociacao_id`, `arquivado` | PK `id`; FK `obras` **ON DELETE CASCADE**, FK `cronograma_itens`/`card_grupos_negociacao` **ON DELETE SET NULL** | `idx_cards_obra_arq`, `idx_cards_crono_item`, `idx_cards_status`, `idx_cards_tipo`, `idx_cards_grupo_neg`, `idx_cards_responsavel`, `idx_cards_origem` (`20260624142446`, `20260701024743`, `20260707150224`) | Habilitado, mas **política final é `USING(true)/WITH CHECK(true)` para `authenticated`** (`cards_auth_select/insert/update/delete`, `20260707150224`), i.e. qualquer usuário autenticado lê/escreve/apaga qualquer card, apesar de o SEC-002 batch-C testar `user_in_card` como se houvesse escopo por membro | `fn_card_recurso_sync_crono`, `trg_cards_sync_crono` (sync com cronograma) | Ativo, tabela central do produto | **`status` é `text` livre sem `CHECK`/enum** (diferente de `board_listas`, que tem `origem_externa/origem_id` para import Trello) — risco de strings inconsistentes; RLS "true" é falha de isolamento por obra/board citada no SEC-002 | **Manter e adaptar** (endurecer RLS por board/obra e migrar `status` para enum) |
| `card_anexos`, `card_atividades`, `card_checklist_itens`, `card_comentarios`, `card_custom_field_valores`, `card_label_links`, `card_labels`, `card_local`, `card_membros`, `card_recursos`, `card_secoes_visiveis`, `card_setores`, `card_views_salvas`, `card_board_posicao`, `card_campos_valores` | Satélites 1:N do card (anexos, checklist, comentários, labels, membros, posição no board) | `card_id` FK obrigatória | Todas com **`card_id ... ON DELETE CASCADE`** (`20260624142446`, `20260722114221`) — cascata correta para não deixar órfãos quando um card é apagado | Índices por `card_id` presentes nas mais recentes; nem todas as tabelas satélite antigas têm índice explícito (`card_local`, `card_secoes_visiveis` não confirmados) | Em geral RLS habilitado; herdam o mesmo padrão permissivo de `cards` em parte das migrations (`USING(true)`) | — | Ativo | `card_custom_fields`/`card_membros_externos` **não estão em `types.ts`** (ver §0) | Manter (revisar RLS em conjunto com `cards`) |
| `boards`, `board_listas`, `board_campos`, `board_membros` | Estrutura de quadro Kanban (colunas/WIP/import Trello) | `board_listas.posicao`, `wip_limite`, `cor`, `origem_externa/origem_id` (import) | FK `board_id`; índice único `uq_board_listas_origem` para idempotência de import | `idx_board_listas_board`, `idx_board_listas_origem` | RLS habilitado com política ligada a `board_id`/`current_setores()` (`20260701195325`) | — | Ativo — usado por `src/lib/repositories/boards.ts` e `trelloImport.ts` | **Ausente de `types.ts` inteiro** (§0) — maior risco de tipo do domínio Kanban | **Investigar/Substituir tipos** (schema ok, geração de tipos quebrada) |
| `cronograma_itens`, `cronograma_dependencias`, `cronograma_baselines`, `cronograma_item_baseline`, `cronograma_item_revisoes`, `cronograma_revisoes`, `cronograma_marcos`, `cronograma_calendarios`, `cronograma_calendario_excecoes`, `cronograma_cenarios`, `cronograma_cenario_itens` | Cronograma/CPM, baselines, calendários de trabalho, cenários what-if | `obra_id` FK **ON DELETE CASCADE** | — | RLS presente (`fn_atualizar_cpm` roda como SECURITY DEFINER) | `fn_atualizar_cpm`, `fn_backfill_cronograma_dep_item_id`, `fn_reverter_revisao_cronograma` | Ativo, módulo maduro (Fase 3+) | Alta contagem de tabelas (11) para um único domínio — risco de fragmentação/dívida de modelagem; `cronograma_item_revisoes` x `cronograma_revisoes` têm nomes quase idênticos e podem confundir manutenção | Manter (considerar consolidar revisões/baselines em Onda futura) |
| `obras` | Entidade raiz de tenant/projeto | Presente em **Postgres e MySQL** simultaneamente com colunas distintas | Referenciada por ~51 FKs com `ON DELETE CASCADE` no Postgres (ver §4) | — | RLS habilitado; é o pivô de `current_obra_id()`/policies em cascata | Múltiplas | Ativo, entidade mais crítica do sistema | Ver §4: apagar uma `obra` no Postgres cascade-apaga cronograma, financeiro, cards, medições, notas fiscais, RDO etc. sem soft-delete | Manter e adaptar (avaliar soft-delete antes de qualquer cascade destrutivo) |
| `restricoes` | Restrições (Last Planner) ligadas a pacotes de trabalho | `pacote_restricoes` como tabela de junção | FK `obras` CASCADE | — | RLS | — | Ativo | Nome semelhante a `nao_conformidades`/`ocorrencias`/`riscos` — múltiplas tabelas de "problema" sem taxonomia unificada (ver §5) | Manter |
| `riscos` | Registro de riscos de obra | `causas_nao_conclusao` como tabela correlata | FK `obras` CASCADE | — | RLS | — | Ativo | Mesma observação de sobreposição conceitual com `restricoes`/`ocorrencias`/`nao_conformidades`/`licoes_aprendidas` | Manter (consolidar taxonomia de "eventos negativos" seria ganho de médio prazo) |
| `pacotes_trabalho` | Pacotes de trabalho do Last Planner | liga a `pacote_restricoes` | FK `obras` CASCADE | — | RLS | — | Ativo | — | Manter |
| `notificacoes` | Notificações de usuário | — | 1 migration de criação encontrada | — | RLS | — | Ativo, mas isolado — não há FK cruzando com `feature_flags` (tabela irmã em `docs/db`, ausente de `types.ts`) | `feature_flags`/`notificacoes` citadas juntas em `migrations/2026_07_20_feature_flags_notificacoes_mysql.sql` — **indício de que notificações também têm trilho MySQL paralelo** para outro módulo (a confirmar) | Investigar (possível segunda fonte de verdade MySQL para notificações/feature flags) |
| `financeiro_lancamentos`, `financeiro_rateios`, `financeiro_snapshots`, `financeiro_evolucao_rollup`, `financeiro_matriz_rateios`, `financeiro_divergencias_matriz`, `financeiro_previsao_carrinho(+itens)`, `financeiro_relatorio_status_atual/historico` | Núcleo financeiro (lançamentos, rateio por centro de custo, importação TOTVS, previsão) | `versao_otimista` (controle de concorrência otimista) presente em várias tabelas financeiras (`aditivos_contrato`, `bms_previstas`) | FK `obras` CASCADE | — | Muitas funções: `fn_importar_financeiro_snapshot`, `fn_lancamento_solicitacao_aprovada`, `fn_recalcular_apos_faturamento`, `fn_recalcular_previsao_nf`, `fn_reverter_faturamento_bms`, `fn_sync_medicao_para_bms_prevista`, `fn_importar_matriz`, `fn_importar_relatorio_totvs` | Ativo, módulo grande e crítico (rollups, carrinho de previsão) | `financeiro_evolucao_rollup`, `financeiro_matriz_rateios`, `financeiro_previsao_carrinho*` e `financeiro_relatorio_status_*` **ausentes de `types.ts`** (§0) — módulo financeiro inteiro de rollup roda sem checagem de tipos | Manter e adaptar (prioridade alta em regenerar tipos) |
| `audit_logs` | Log de auditoria genérico (`entidade`, `entidade_id`, `before`/`after` JSON) | `obra_id`, `user_id` nullable | Nenhuma FK declarada (`Relationships: []` em `types.ts`) | — | Presumido RLS via `fn_audit_row` (trigger genérico) | `fn_audit_row` SECURITY DEFINER dispara auditoria em múltiplas tabelas | Ativo | `user_id`/`obra_id` nulos são permitidos — auditoria pode perder rastreabilidade de quem/onde; sem índice explícito em `entidade_id` localizado, o que penaliza consultas de histórico por registro em tabelas de alto volume (`cards`, `financeiro_lancamentos`) | Manter e adaptar (adicionar índice `(entidade, entidade_id)` e `NOT NULL` em `user_id` para novas escritas) |
| `security_events` / `system_events` / `audit_logins` | Eventos de segurança/login | — | — | — | — | `system_events` e `audit_logins` **não estão em `types.ts`**; `security_events` está | Overlap de três tabelas de log de segurança/eventos sem contrato único documentado | Investigar/Consolidar |
| `user_roles` | RBAC — papel por usuário (`app_role` enum: gm/engenharia/dp/financeiro/compras/seguranca/comum) + `nivel` | PK `id`, FK `auth.users(id)` **ON DELETE CASCADE**, `UNIQUE(user_id, role)` | — | RLS habilitado | `has_role(uid, role)` SECURITY DEFINER (evita recursão de RLS — padrão correto Supabase) | Ativo, base de toda a autorização | `user_setores` (tabela irmã, setor x usuário) **não está em `types.ts`** — `current_setores()` depende dela e não é auditável via tipos | Manter |
| `profiles` | Perfil por usuário autenticado | `player_id` (ponte para MySQL `players`) | FK `auth.users` CASCADE | — | Política de select `USING(true)` para qualquer autenticado — **exposição de todos os perfis a todos os usuários** | `handle_new_user` trigger em `auth.users` | Ativo | Select aberto pode expor `login`/`nome` de todos usuários a qualquer autenticado; aceitável se for só nome interno, mas não documentado como decisão | Manter e adaptar (confirmar se exposição é intencional) |

## 4. Item (b) — FKs ausentes e `ON DELETE CASCADE` perigosos

- 51 ocorrências de `REFERENCES public.obras(id) ON DELETE CASCADE` nas migrations Postgres. Isso significa que **apagar uma obra apaga em cascata**: cards, cronograma completo (itens/baselines/marcos/dependências), medições, notas fiscais, BMs, RDO, financeiro, restrições, riscos, aditivos de contrato — sem soft delete e sem tabela de "lixeira"/arquivamento prévio. Não há trigger de bloqueio (`ON DELETE RESTRICT`) em nenhuma dessas FKs críticas.
- `card_grupos_negociacao`/`cronograma_itens` referenciados por `cards` usam `ON DELETE SET NULL` — cards órfãos de cronograma são esperados, mas **não há alerta/monitoramento** para cards cujo `cronograma_item_id` virou `NULL` silenciosamente após exclusão upstream.
- `audit_logs.entidade_id` **não é FK** de propósito (é log polimórfico) — correto por design, mas sem índice dedicado é achado de performance (ver item e).
- `ordens_compra.fornecedor_id ... ON DELETE RESTRICT` — correto (impede apagar fornecedor com OC ativa) e contrasta com o padrão CASCADE agressivo do resto do banco; **inconsistência de política de integridade entre módulos**.

## 5. Item (c) — status duplicados entre tabelas

- `status` aparece como coluna livre (`TEXT`, sem enum/check) em `cards`, `bms_previstas`, `requisicoes`, `cotacoes`, `ordens_compra` (que ainda tem um segundo campo `status_aprovacao` paralelo). Nenhuma tabela de domínio ("lookup") central de status é usada — diferente do padrão adotado em `cronograma` (`app_role` como enum) e em `aditivos_contrato`/`antecipacao_operacoes` (que usam `Database["public"]["Enums"]`).
- Overlap semântico entre `restricoes`, `riscos`, `nao_conformidades`, `ocorrencias`, `causas_nao_conclusao`, `licoes_aprendidas`: todas modelam "evento/problema associado a obra" com campos de status/gravidade próprios e não compartilham vocabulário. Risco de relatórios divergentes (dashboards que somam "pendências" vão precisar UNION manual dessas 6 tabelas).
- `ordens_compra.status` (rascunho/emitida/...) x `ordens_compra.status_aprovacao` (pendente/aprovada/...) — dois eixos de estado na mesma tabela sem máquina de estados documentada; risco de estado inconsistente (`status = 'emitida'` com `status_aprovacao = 'pendente'`).

## 6. Item (d) — timestamps, usuário responsável e auditoria

- Padrão bom: a maioria das tabelas recentes (Fase 5A/RDO/Financeiro) tem `created_at`/`updated_at timestamptz default now()` com trigger `touch_updated_at`.
- Falhas pontuais: `bms_redistribuicao`, `antecipacao_liquidacoes` **não têm `updated_at`** (só `created_at`), mesmo sendo registros financeiros sujeitos a correção.
- `owner_id uuid default auth.uid()` aparece em `requisicoes`/`ordens_compra`, mas **não em `cards`** (`criado_por` é `TEXT` livre, não FK para `auth.users`/`profiles`) — quebra de rastreabilidade e impossibilita join confiável para "quem criou o card".
- `audit_logs` é o único mecanismo central de trilha de auditoria "quem fez o quê", mas depende de `user_id` opcional e de triggers (`fn_audit_row`) aplicados manualmente tabela a tabela — não há garantia de cobertura total (não confirmado se cobre `board_listas`, `requisicoes`, `ordens_compra`, `rdo`).

## 7. Item (e) — índices ausentes em consultas de alto volume

- `cards`: bem indexado (`obra_id+arquivado`, `status`, `tipo`, `cronograma_item_id`, `responsavel_id`, `origem`) — ok para volume de milhares de cards.
- `audit_logs`: **nenhum índice localizado** além da PK — em uma tabela de log que cresce indefinidamente e é consultada por `entidade_id`/`obra_id`, isso é risco real de degradação (`Relationships: []` confirma zero FK/índice de apoio).
- `requisicoes`, `ordens_compra`, `cotacoes`: têm índices por `obra_id`/`status`/FK — adequados, mas por não terem RLS (ver §8) e não estarem em `types.ts`, o risco não é performance e sim segurança/tipo.
- `notificacoes`: não foi possível confirmar índice por `user_id`/lido/não lido — tabela tipicamente de alto volume de leitura por usuário; **recomenda-se investigar diretamente no dump do banco**, pois só uma migration de criação foi localizada.

## 8. Item (f) — RLS: cobertura, security definer, has_role, SEC-002

- **Tabelas sem `ENABLE ROW LEVEL SECURITY` localizado em nenhuma migration:** `fornecedores`, `requisicoes`, `cotacoes`, `cotacao_propostas`, `ordens_compra`, `ordem_compra_itens`, `recebimento_materiais`, `recebimento_itens`, `estoque_saldos`, `estoque_movimentacoes`, `user_setores`. Ou seja, **todo o módulo de Suprimentos (Fase 5A) parece ter RLS ausente** — se confirmado em produção, qualquer usuário `authenticated` (ou mesmo `anon`, a depender de GRANT) pode ler/escrever essas tabelas sem restrição de obra/setor. Isso é o achado de segurança mais grave da auditoria além do drift de `types.ts`.
- **`cards` tem RLS habilitado mas com policy final `USING(true)/WITH CHECK(true)`** para `authenticated` (`20260707150224`), i.e. na prática equivalente a não ter RLS por membro — apesar de `supabase/tests/sec-002/batch-C/cards_rls.sql` testar `user_in_card()` (helper de escopo por membro) como se a policy de fato restringisse por card/board. Há uma migration anterior (`20260624190006`) que criou `current_is_gm()`, `current_setores()`, `has_card_setor()`, `has_card_access()` — funções de escopo mais finas que **parecem ter sido revertidas/sobrescritas** por policies mais permissivas em migrations posteriores (`20260701195325`, `20260707150224`, `20260722110359` — "auth read cards"/"auth write cards" com `USING(true)`). Isso é evidência de **regressão de segurança ao longo do tempo**: RLS ficou mais restritiva e depois foi afrouxada de novo.
- `has_role(user_id, role)` está corretamente implementada como função `SECURITY DEFINER` isolada (padrão recomendado pelo Supabase para evitar recursão infinita de RLS em policies que checam papel).
- 73 ocorrências de `SECURITY DEFINER` nas migrations — volume alto; não foi possível, no escopo desta auditoria, confirmar individualmente que todas fixam `search_path` (prática recomendada contra hijacking de função). Recomenda-se auditoria dedicada de `search_path` nessas 73 funções.
- Suite `supabase/tests/sec-002/` cobre 4 lotes: **B (boards)**, **C (cards)**, **D (obras)**, **E (cross-tenant/empresas)** com helpers `user_in_board`, `user_in_card`, `user_in_empresa`, `user_in_obra`. Cobertura testada é boa nesses 4 domínios, mas **não há lote SEC-002 para Suprimentos, Financeiro, RDO ou Inspeções** — os domínios sem teste automatizado de RLS coincidem exatamente com os domínios onde a auditoria encontrou RLS ausente/desatualizada.

## 9. Duplicidades e tabelas "espelho" identificadas

| Par/grupo duplicado | Observação |
| --- | --- |
| `colaboradores` (Postgres) × `players` (Postgres) × `colaboradores` (MySQL) | `players` é espelho read-only declarado; MySQL é a fonte real operacional (ver `CANONICIDADE.md`) |
| `obras` (Postgres) × `obras` (MySQL) × `centros_custo_totvs` (Postgres) | Três representações de "obra"; `centros_custo_totvs` é espelho do TOTVS |
| `mobilizacoes_periodos` (Postgres, nunca escrita) × `movimentacoes`/`movimentacoes_patrimonios`/`movimentacoes_contratos` (MySQL, fonte real) | Incidente documentado de leitura da fonte errada |
| `documentos_colaborador` × `vencimentos` (ambas MySQL) | Bug histórico documentado e corrigido: escrita e leitura em tabelas diferentes |
| `cronograma_revisoes` × `cronograma_item_revisoes` | Nomes quase idênticos, funções distintas — risco de confusão em manutenção futura |
| `restricoes`/`riscos`/`ocorrencias`/`nao_conformidades`/`causas_nao_conclusao`/`licoes_aprendidas` | Seis tabelas para o mesmo conceito genérico de "evento/problema de obra" |
| `security_events` × `system_events` × `audit_logins` × `audit_logs` | Quatro tabelas de log/evento sem contrato unificado documentado |

## 10. Classificação-resumo

| Classificação | Tabelas/domínios |
| --- | --- |
| **Manter** | `user_roles`, `pacotes_trabalho`, `restricoes`, `riscos`, `cronograma_*` |
| **Manter e adaptar** | `cards` (RLS + status enum), `obras` (soft delete), `audit_logs` (índice + NOT NULL), `financeiro_*` (regerar tipos), `profiles` (revisar exposição) |
| **Consolidar** | `restricoes`/`riscos`/`ocorrencias`/`nao_conformidades`/`causas_nao_conclusao`/`licoes_aprendidas`; `security_events`/`system_events`/`audit_logins` |
| **Investigar** | `notificacoes`/`feature_flags` (possível trilho MySQL paralelo), `boards`/`board_*` (tipos ausentes), módulo Suprimentos inteiro (RLS ausente), `contratos.historico` (legado congelado) |
| **Substituir** | Geração de `types.ts` (processo atual está quebrado — 55 tabelas fora do contrato) |
| **Depreciar** | Nenhuma tabela candidata clara identificada nesta rodada sem confirmação de uso real em produção (recomenda-se telemetria antes de depreciar qualquer uma das 6 tabelas de "evento/problema") |
