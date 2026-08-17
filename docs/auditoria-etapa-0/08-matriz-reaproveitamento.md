# 08 — Matriz de Reaproveitamento (Kanban / Compras / Cronograma)

> Base: leitura de `src/`, `supabase/migrations/`, `supabase/functions/` em 2024. Métricas via `wc -l` e `rg` (comandos documentados no rodapé).

## Legenda de Decisão
- **Reaproveitar**: usar como está.
- **Adaptar**: manter a base, ajustar contrato/assinatura.
- **Consolidar**: unificar com outra estrutura equivalente (duplicidade hoje).
- **Substituir**: nova implementação assume o papel, estrutura atual sai de uso.
- **Depreciar**: mantida temporariamente por compatibilidade, sem novos usos.
- **Remover futuramente**: sem função após migração completa.

## Tabelas

| Estrutura | Localização | Estado atual | Decisão | Justificativa | Dependência | Etapa futura |
|---|---|---|---|---|---|---|
| `public.boards` | `supabase/migrations/20260630121931_*.sql`, `20260707150224_*.sql` | Recriada em pelo menos 2 migrações distintas (`CREATE TABLE IF NOT EXISTS`), sem versionamento claro de schema único | Consolidar | Duas definições concorrentes no histórico de migrações indicam schema não estabilizado; risco de drift entre ambientes | `src/lib/repositories/boards.ts` (223 linhas) | Etapa 1 — Consolidação do Kanban genérico |
| `public.cards` | `supabase/migrations/20260624142446_*.sql`, `20260722110359_*.sql`, `20260707150224_*.sql` | Tabela "Trello-like" recriada 3x no histórico; contém colunas genéricas (`titulo`,`status`,`posicao`) e colunas de domínio específico já misturadas (`cronograma_item_id`, `grupo_negociacao_id`, `origem_externa`) | Adaptar | Núcleo genérico é reaproveitável, mas colunas de domínio (cronograma, negociação) violam separação motor/extensão e precisam migrar para tabelas de extensão por domínio | `CardGenericoDialog.tsx` (2306 linhas), `src/lib/repositories/cards.ts`, `cardsExtra.ts` | Etapa 1 e 2 — Kanban genérico + Extensões e vínculos |
| Colunas de domínio dentro de `cards` (`cronograma_item_id`, `grupo_negociacao_id`, `origem_externa`, `origem_id`, `origem_url`) | mesma migração de `cards` | Acoplamento direto card↔domínio via FK solta (sem tabela de vínculo), sem tipo/constraint polimórfica | Substituir | Impede que um mesmo "assunto" apareça em múltiplos quadros sem duplicar linha; models de vínculo polimórfico inexistem hoje | Tabela nova `card_vinculos` (não existe ainda — 0 ocorrências de `vinculo_polimorfico`/`entidade_tipo` no código) | Etapa 2 — Extensões e vínculos com o ERP |
| Tabelas específicas referenciando `card_id` (41 arquivos de migração com `card_id`) | `supabase/migrations/*` | Cada módulo (compras, produção, recebimento etc.) cria sua própria FK direta para `cards.id`, sem tabela de junção comum | Consolidar | Padrão repetido 41x sem abstração comum — todo novo domínio reimplementa o mesmo relacionamento 1:N card→registro | — | Etapa 2 — Extensões e vínculos com o ERP |
| Eventos de domínio / outbox | inexistente | 0 ocorrências de `domain_event`, `evento_dominio` ou `outbox` em `src` e `supabase` | Substituir (criar do zero) | Não há barramento de eventos; toda reação a mudança de card é feita via `useEffect`/hooks no frontend ou triggers pontuais em RPC | RPCs atômicas existentes (`emitir_oc_atomico`, `registrar_recebimento_atomico`, etc.) | Etapa 3 — Eventos de domínio |
| RPCs atômicas de negócio (`emitir_oc_atomico`, `salvar_nf_atomica`, `registrar_recebimento_atomico`, `fechar_bms_atomica`, `criar_medicao_atomica`, `fn_oc_aprovar`, `excluir_nf_atomica`, `fn_estoque_transferir`, `aprovar_orcamento_obra`) | `supabase/migrations/*` (chamadas via `supabase.rpc(...)`, 29 ocorrências em `src`) | Já encapsulam transação + validação server-side para os fluxos críticos de compras/financeiro/estoque | Reaproveitar | Padrão correto (lógica sensível no banco, não no frontend); é o modelo a replicar para novos domínios | `src/lib/repositories/*` | Etapa 4-16 (Compras, Estoque, Cotações, Recebimento) |
| Migrações de schema (110+ arquivos em `supabase/migrations/`) | `supabase/migrations/` | Alto volume de migrações incrementais sem consolidação (nomes hash-only, sem agrupamento por domínio) | Reaproveitar com adaptação | Histórico funcional é reaproveitável como fonte de verdade, mas precisa de migração de "squash"/documentação de schema atual antes da Etapa 1 | — | Pré-requisito da Etapa 1 |

## Componentes

| Estrutura | Localização | Estado atual | Decisão | Justificativa | Dependência | Etapa futura |
|---|---|---|---|---|---|---|
| `CardGenericoDialog.tsx` | `src/components/cards/CardGenericoDialog.tsx` | 2306 linhas — maior componente do repositório; concentra formulário, regras de exibição por tipo de card, subcomponentes de anexos/comentários/checklist inline | Substituir (decompor) | Componente monolítico "god component"; mistura motor genérico (título, prazo, comentários) com lógica condicional de domínio (`tipo === ...`) | `CommentEditor.tsx` (609), `CardRecursoDialog.tsx` (704), `useCards.ts` | Etapa 1 — Consolidação do Kanban genérico |
| `QuadroKanban.tsx` | `src/components/cards/QuadroKanban.tsx` | 676 linhas — engine de drag-and-drop e colunas | Adaptar | Base de renderização de quadro é aproveitável como motor genérico, mas hoje mistura fetch de dados de múltiplos domínios diretamente | `src/pages/quadros/QuadroBoard.tsx` (1583), `Board.tsx` (984) | Etapa 1 |
| `QuadroBoard.tsx` (page) | `src/pages/quadros/QuadroBoard.tsx` | 1583 linhas — maior página do sistema; orquestra board + drawer + automações + permissões no mesmo arquivo | Substituir (decompor) | Página deveria orquestrar; hoje concentra lógica de UI, chamadas e regra de automação | `AllocationBoard.tsx` (858), `useQuadroAutomacoesConfig.ts` | Etapa 1 e 27 (Automações) |
| `AllocationBoard.tsx` | `src/components/quadros/AllocationBoard.tsx` | 858 linhas — quadro de alocação (visão especializada, aparenta ser "quadro virtual" ad-hoc) | Consolidar | Candidato natural a virar uma das "visões consolidadas/quadros virtuais" formais da arquitetura alvo, hoje é implementação paralela e específica | Novo módulo de visões consolidadas | Etapa 21 — Visões por setor / 22 — Lista consolidada |
| `ImportarTrelloDialog.tsx` + `BmsImporter.tsx` + `CronogramaImporter.tsx` + `CronogramaSemanalImporter.tsx` | `src/components/import/*`, `src/components/cards/ImportarTrelloDialog.tsx` | 479+844+743+815 linhas — quatro importadores independentes sem núcleo comum de parsing/preview/rollback | Consolidar | Lógica de import (parse → preview → validação → gravação) se repete; sem serviço de importação genérico | `src/pages/*Importar*`, edge function `totvs-import-validar` | Etapa 30 — Importação do Trello (e reaproveitável para outras importações) |
| `PrevisaoTab.tsx`, `RevisoesTab.tsx`, `MedicoesTab.tsx`, `CronogramaPrincipalTab.tsx` | `src/components/obra-detalhe/*`, `src/components/obra/*` | 1329, 1439, 1155, 904 linhas — abas monolíticas de obra com fetch, cálculo e render juntos | Adaptar | Núcleo de dados (cronograma/medições) é fonte real de verdade a preservar; UI precisa ser quebrada em subcomponentes menores para viabilizar reconciliação automática | `useCronograma.ts`, `src/lib/repositories/cronograma.ts`, `medicoes.ts` | Etapa 4 — Reconciliação do cronograma |
| `ContagensCiclicas.tsx` | `src/pages/suprimentos/ContagensCiclicas.tsx` | 1960 linhas — maior página do repositório | Substituir (decompor) | Mistura contagem física de estoque, divergência e ajuste em um único arquivo sem paginação (não usa `.range()`) | `src/lib/repositories/insumos.ts` | Etapa 11 — Estoque |
| `AprovacaoFinanceira.tsx` | `src/pages/financeiro/AprovacaoFinanceira.tsx` | 1541 linhas | Adaptar | Fluxo de aprovação é fonte de verdade financeira válida; precisa decompor para plugar no motor de automações/notificações | `useMutation` sem `onError` em parte dos fluxos (ver 07-riscos) | Etapa 23 — Financeiro |
| `NotificationBell.tsx` | `src/components/layout/NotificationBell.tsx` | 993 linhas | Consolidar | Concentra polling, agrupamento e regras de notificação no componente de UI; deveria consumir um serviço de notificações central | `src/lib/repositories/notificacoes.ts` | Etapa 28 — Notificações |

## Hooks

| Estrutura | Localização | Estado atual | Decisão | Justificativa | Dependência | Etapa futura |
|---|---|---|---|---|---|---|
| `useCards.ts` | `src/hooks/quadros/useCards.ts` | Hook central de leitura/escrita de cards, usado por múltiplos quadros | Adaptar | Deve virar a porta de entrada única do motor Kanban genérico, hoje já concentra a maior parte do acesso mas ainda expõe campos de domínio específico | `cards.ts`, `cardsExtra.ts` (519 linhas) | Etapa 1 |
| `useCardPermissions.ts` | `src/hooks/quadros/useCardPermissions.ts` | Hook dedicado de permissão por card | Reaproveitar | Já isola a regra de permissão do componente visual — padrão correto a replicar | Módulo de permissões (Etapa 29) | Etapa 29 — Permissões |
| `useCardCovers.ts` | `src/hooks/quadros/useCardCovers.ts` | Hook de capa/cover de card | Reaproveitar | Recurso de UI simples, sem acoplamento de negócio | — | Etapa 1 |
| `useQuadroAutomacoesConfig.ts` | `src/hooks/quadros/useQuadroAutomacoesConfig.ts` | Configuração de automações **persistida em `localStorage`** (chave `quadroAutomacoesDesativadas`) | Substituir | Configuração operacional (quais automações estão ativas) não pode viver só no navegador — é estado de negócio por quadro/usuário, precisa ir para tabela server-side | Motor de automações (Etapa 27) | Etapa 27 — Automações |
| `useCronograma.ts` | `src/hooks/obras/useCronograma.ts` | Hook único de cronograma de obra, consumido por abas grandes (900+ linhas) | Adaptar | Fonte de dados é válida; falta separar leitura (visão) de reconciliação (escrita) para suportar o novo motor de reconciliação automática | `src/lib/repositories/cronograma.ts` | Etapa 4 — Reconciliação do cronograma |
| `useTotvsImportStatus.ts` | `src/hooks/financeiro/useTotvsImportStatus.ts` | Cadência de importação TOTVS guardada em `localStorage` (chave `totvs.cadencia...`) | Adaptar | Preferência de cadência pode ficar client-side, mas o **status/snapshot da última importação** deveria ter cópia server-side auditável para não se perder entre dispositivos | Edge function `totvs-import-validar` | Etapa 15 — Espelho da OC do TOTVS |

## Serviços / Repositórios

| Estrutura | Localização | Estado atual | Decisão | Justificativa | Dependência | Etapa futura |
|---|---|---|---|---|---|---|
| `src/lib/repositories/*` (28 arquivos, 207 chamadas `supabase.from`) | `src/lib/repositories/` | Camada de repositório já existe e é respeitada: **0 ocorrências** de `supabase.from(` em `src/pages` ou `src/components` — todo acesso a dado passa pelo repositório | Reaproveitar | Padrão de arquitetura já correto e a ser preservado/estendido para novos domínios; é a maior força a favor de evolução incremental | — | Todas as etapas |
| `boards.ts` | `src/lib/repositories/boards.ts` (223 linhas) | Inclui chamada a RPC (`board_atividades_recentes`) misturada com CRUD simples | Adaptar | Separar leitura de atividades (deveria vir do futuro log de eventos de domínio) do CRUD de board | Etapa 3 — Eventos de domínio | Etapa 1 e 3 |
| `cards.ts` + `cardsExtra.ts` | `src/lib/repositories/cards.ts` (159), `cardsExtra.ts` (519) | Split em dois arquivos sem critério claro de fronteira (extra = domínio? ou só volume?) | Consolidar | Nomeação "Extra" sugere débito técnico de organização; deve ser reorganizado por domínio quando as extensões forem formalizadas | Etapa 2 | Etapa 2 |
| `rpc-baseline.ts` | `src/lib/rpc-baseline.ts` (100 linhas) | Monitoramento de degradação de performance de RPC via EWMA, com estado em `localStorage`, consumido só em `/gm/saude` | Reaproveitar | Ferramenta de observabilidade útil e isolada; localStorage é aceitável aqui pois é apenas cache de baseline por navegador do operador de GM, não dado operacional | `src/lib/core/storage/keys.ts` | Etapa 31 — Performance e segurança |
| Edge Functions (`supabase/functions/*`, 7 funções, 840 linhas) | `supabase/functions/` | Escopo estreito e correto: autenticação (`provision-auth-user`, `sync-player-auth`), notificação (`alertas-operacao`, `card-prazo-lembrete`), integração externa (`cnpj-lookup`), import/seed (`totvs-import-validar`, `seed-obra-demo`) | Reaproveitar | Nenhuma regra de negócio pesada indevidamente no frontend nessas funções; padrão a manter para novas integrações externas/agendadas | `_shared/cors.ts`, `_shared/sentry.ts` | Etapa 27 (Automações), 28 (Notificações) |
| RPCs atômicas de negócio | ver tabela de Tabelas acima | 8 RPCs de escrita transacional identificadas (`emitir_oc_atomico` 3x, `salvar_nf_atomica` 2x, `registrar_recebimento_atomico` 2x, `fechar_bms_atomica` 2x, `criar_medicao_atomica` 2x, `fn_lancamento_solicitacao_aprovada` 2x, + 4 usadas 1x) | Reaproveitar | Já resolvem atomicidade/validação server-side para os fluxos mais críticos; modelo a generalizar | Testes: `src/lib/__tests__/rpcs-atomicos.test.ts`, `integracao/cadeias-criticas.test.ts` | Etapa 4-16 |

---

### Comandos de evidência usados
```
wc -l src/components/**/*.tsx src/pages/**/*.tsx | sort -rn | head -35
rg -n "localStorage" src | wc -l   # 195
rg -n "supabase\.from\(" src/pages src/components | wc -l   # 0
rg -n "supabase\.from\(" src -g "*.ts" -g "*.tsx" | grep -c repositories   # 207
rg -n "supabase\.rpc\(" src | wc -l   # 29
rg -n "useMutation" src -l | wc -l   # 46 arquivos
rg -n "onError" src | wc -l   # 105
rg -n "react-window|react-virtual|Virtuoso" src | wc -l   # 0
rg -n "\.range\(" src | wc -l   # 8
rg -ln "card_id" supabase/migrations | wc -l   # 41
```
