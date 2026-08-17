# Auditoria Etapa 0 — Demais Módulos do JOGAB ERP

> Diagnóstico técnico apenas. Nenhum código ou migration foi alterado. Todas as evidências abaixo referenciam arquivos reais do repositório em `/dev-server` na data da auditoria.

---

## 1. Orçamento

**Estrutura**
- Lógica de domínio: `src/lib/orcamento/orcamento.ts` (+ testes em `src/lib/orcamento/__tests__`).
- Hook de acesso: `src/hooks/suprimentos/useOrcamento.ts` — usa TanStack Query sobre `suprimentosRepo`, trabalhando com `Atividade`, `OrcItem`, `Composicao`, `CompItem`, `Insumo`, `DemandaMaoObraOrcamento`.
- Não existe hook dedicado de orçamento fora de Suprimentos; o orçamento vive acoplado ao módulo de Suprimentos (composições, insumos, itens de cronograma).

**Estado real**
- **Funcional em leitura**: consultas de composições ativas, itens de composição, atividades por obra e itens de orçamento por obra estão implementadas via React Query com `staleTime`.
- Depende de dados de `insumos` (preço unitário) e `suprimentos_composicoes`/`suprimentos_composicao_itens` — qualquer inconsistência de preço nos insumos se propaga diretamente ao orçamento (ver módulo 07 sobre cadastro de insumos).
- A relação `orcamento_itens` ⇄ `cronograma_item_id` existe no tipo (`OrcItem.cronograma_item_id`), indicando vínculo pretendido com cronograma, mas não foi auditado aqui se 100% dos itens de orçamento possuem esse vínculo preenchido (checagem de dados fica para etapa de auditoria de dados/produção).

**Vínculo com cards e cronograma**
- Vínculo indireto via `cronograma_item_id` em `OrcItem` e via `Atividade.obra_id`. Não há evidência de vínculo direto orçamento→card do quadro Kanban.

**Lacunas / riscos**
- Módulo concentrado em um único arquivo de hooks (`useOrcamento.ts`) que mistura orçamento, composições e insumos — acoplamento alto entre domínios que dificulta auditoria de permissão fina por sub-área.
- Baseline de custo (`custo_baseline` em `Atividade`) existe no tipo, mas não foi confirmado neste diagnóstico se há tela de comparação orçado x realizado consumindo esse campo.

---

## 2. Financeiro

**Estrutura**
- Domínio de confronto/TOTVS: `src/lib/financeiro-totvs/` (agregacoes, agrupamentos, centros, colunas, confronto, evolucao, labels, parse, queries, status-bucket, types) — módulo maduro e bem decomposto, com testes (`__tests__`).
- Hooks: `src/hooks/financeiro/` — `useDespesas`, `useFormasPagamento`, `useMedicoesAguardandoAprovacao`, `useObrasFinanceiro`, `useSnapshotVelho`, `useSolicitacaoStatusWatcher`, `useSolicitacoesFinanceiras`, `useTotvsImportStatus`, `useValidadorPix`.
- Tabelas: `financeiro_lancamentos`, `solicitacoes_financeiras`, `financeiro_snapshots` criadas em múltiplas migrations (`20260616112645_*`, `20260618151913_*`) — **estas duas migrations recriam as mesmas tabelas** (`CREATE TABLE public.financeiro_lancamentos`, `solicitacoes_financeiras`, `financeiro_snapshots`, `audit_logs`, `riscos` aparecem duas vezes no histórico de migrations, em datas próximas). Isso é compatível com um padrão de "baseline squash"/reset de schema, mas **não foi possível confirmar neste diagnóstico, sem rodar migrations, se ambas coexistem sem conflito ou se uma delas é vestigial**. Fica como ponto de atenção para a auditoria de schema (Etapa 0 — item de banco).
- Importação TOTVS: edge function `supabase/functions/totvs-import-validar/index.ts` — **apenas valida** o payload recebido (colunas obrigatórias `centro_custo`, `natureza`, `valor`) e registra em `totvs_import_runs`; o comentário no próprio código afirma explicitamente: *"NÃO faz o upsert real do snapshot — apenas valida e registra a run, deixando o pipeline existente intacto."* Ou seja, o pipeline real de gravação do snapshot financeiro TOTVS **fica fora desta função** e não foi localizado nela — precisa ser rastreado em outro ponto (client-side via `useTotvsImportStatus`/repos) para confirmar onde o upsert efetivo acontece.

**Estado real**
- **Parcial/misto**: confronto orçado × TOTVS parece maduro (módulo `financeiro-totvs` bem testado). Já o fluxo de solicitações financeiras (`useSolicitacoesFinanceiras`, `useSolicitacaoStatusWatcher`) e o de despesas (`useDespesas`) não foram lidos em profundidade neste corte, mas existem e têm hooks próprios de "watcher" de status, sugerindo fluxo de aprovação assíncrono.
- Validação PIX (`useValidadorPix`) sugere conferência de dados bancários antes de pagamento — funcionalidade de controle, não meramente informativa.

**Vínculo com cards e cronograma**
- Não foi encontrada relação direta entre `financeiro_lancamentos`/`solicitacoes_financeiras` e cards do Kanban. O vínculo financeiro é com obra (`obra_id`) e centro de custo, não com card individual.

**Lacunas / riscos**
- **Risco de duplicidade de conta a pagar**: como o upsert real do snapshot TOTVS não está na função de validação, e existem múltiplas fontes de lançamento (`financeiro_lancamentos` manual + importação TOTVS + `solicitacoes_financeiras`), o risco de duplicidade depende inteiramente de constraints de banco (unicidade por `arquivo_hash`/chave natural) que **não foram auditadas neste corte** — recomenda-se auditoria dedicada de constraints/índices únicos nessas três tabelas antes de liberar importações em produção.
- Duplicação aparente de `CREATE TABLE` para `financeiro_lancamentos`, `solicitacoes_financeiras`, `financeiro_snapshots` no histórico de migrations é um sinal de alerta para revisão de schema squash (ver acima).

---

## 3. Documentos

**Estrutura**
- **Não existe uma "Central de Documentos" unificada no código.** A busca por `CentralDocumentos`/"central de documentos" não retornou nenhum componente ou página.
- Documentos estão fragmentados por domínio:
  - Contratos: `src/components/contratos/ContratoDocumentosSection.tsx`, `src/hooks/contratos/useContratoDocumentos.ts`, `useContratoDocumentosVencendo.ts`, `src/lib/contratos/documentos.ts`.
  - RH: `src/hooks/rh/useDocumentoTipos.ts`, `src/lib/rh/documentos.ts`, `src/pages/rh/ControleDocumentos.tsx`.
  - Empresa: `src/lib/empresa/documento-numeracao-local.ts`, `src/lib/empresa/numeracao-documentos.ts`.
  - Cards: anexos ficam em tabela `card_anexos` (referenciada em 8 arquivos), separada dos documentos de contrato/RH.
  - `src/contexts/DocumentosContext.tsx` existe, mas **só cobre "documentos a vencer" de colaboradores** (`useExpiringDocuments`), não é uma central de arquivos.
- Storage: apenas **dois buckets** identificados em código (`src/lib/repositories/storage.ts`): `card-anexos` e `nfs` (notas fiscais). Não há bucket dedicado a "documentos de contrato" ou "documentos de RH" no wrapper central — sugere que esses módulos usam outro mecanismo de storage (URL externa, outro bucket direto via `supabase.storage.from(...)` fora do wrapper, ou armazenam apenas metadados/numeração sem arquivo binário). Isso é uma lacuna de padronização.

**Estado real**
- **Parcial e fragmentado**: cada módulo (contratos, RH, cards) resolve "documento" à sua maneira, sem um cadastro/central único, sem controle de revisão versionado visível (não foi encontrada tabela ou tela de "revisões de documento" com histórico de versões).
- Não há evidência de tela ou tabela de "revisões" (versionamento) para documentos de contrato/RH — apenas numeração (`numeracao-documentos.ts`).

**Vínculo com cards e cronograma**
- Vínculo existe apenas via `card_anexos` (arquivo anexado a um card específico). Documentos de contrato/RH não se conectam a cards nem a itens de cronograma.

**Lacunas / riscos**
- **Duplicidade de documentos**: com múltiplos pontos de upload (`card-anexos`, `nfs`, e presumivelmente uploads de contrato/RH fora do wrapper `storageRepo`), não há mecanismo único de deduplicação (hash de arquivo, verificação de nome+tamanho) identificado no código lido.
- **Ausência de "Central de Documentos"**: se o negócio espera um módulo único de gestão documental (permissões, revisão, expiração, busca cross-módulo), ele **não existe hoje** — precisa ser especificado e construído do zero, não apenas "unificado" a partir de algo existente.
- Permissões de documento não foram encontradas como RLS específica por bucket nesta leitura (fica pendente auditoria de policies de storage).

---

## 4. Restrições (Last Planner)

**Estrutura**
- Lib pura: `src/lib/lastplanner/restricoes.ts` (junto com `ppc.ts`, `semana.ts`).
- Tabelas: `restricoes`, `pacote_restricoes` — criadas em `20260625184155_*` e recriadas/atualizadas em `20260722114221_*` (padrão de squash, mesmo apontado no módulo Financeiro).
- Badge de card: `src/components/cards/RestricoesDoCardBadge.tsx` — usa `restricoesRepo.listAbertasDoCard(cardId)`, mostra contagem de restrições abertas e destaca vencidas (prazo < hoje), com link para `/planejamento/restricoes`. **Somente leitura** — não permite editar/resolver restrição a partir do card.

**Estado real**
- **Funcional**: o badge está implementado corretamente, distingue restrições vencidas de abertas, e o texto do componente é explícito quanto à regra de negócio: *"O pacote correspondente não pode ser comprometido enquanto não forem resolvidas."* Isso indica que a lógica de bloqueio de compromisso semanal por restrição pendente está pelo menos representada na UI.

**Vínculo com cards e cronograma**
- Vínculo direto: `restricoesRepo.listAbertasDoCard(cardId)` supõe uma coluna/relação restrição→card. Vínculo também com `pacotes_trabalho` via `pacote_restricoes` (Last Planner System clássico: pacote de trabalho semanal tem restrições que impedem seu compromisso).

**Lacunas / riscos**
- Não foi auditado neste corte se toda restrição aberta é de fato visível em algum card (cobertura completa do vínculo), nem se o "bloqueio de compromisso" mencionado no texto do badge é **imposto de fato** em alguma validação de backend/RLS ou é apenas indicativo visual (risco de bloqueio ser só cosmético).

---

## 5. Riscos

**Estrutura**
- Tabela `riscos` criada em `20260616112645_*` e novamente referenciada em `20260618151913_*` (mesmo padrão de squash do Financeiro/Restrições).
- Matriz de severidade: `src/lib/riscos/matriz.ts` (`SEVERIDADE_BG`, `SEVERIDADE_LABEL`, `severidadeDe`).
- Badge de card: `src/components/cards/RiscosDoCardBadge.tsx`.

**Estado real — ACHADO CRÍTICO**
- O próprio código contém um `TODO` explícito de dívida técnica:
  ```
  // TODO(ARC-001/E-01): coluna `card_id` ausente em riscos — migrar schema ou remover badge.
  ```
  Isso confirma que **o vínculo risco↔card está quebrado ou incompleto no schema atual**: a tabela `riscos` não possui (ou não possuía, na visão de quem escreveu o TODO) uma coluna `card_id`, mas o componente `RiscosDoCardBadge` já foi implementado assumindo esse vínculo via `riscosRepo.listAtivosDoCard(cardId)`.
- **Classificação: PARCIAL/MOCK** — o componente de UI existe e calcula corretamente severidade (probabilidade × impacto) e cor por matriz de risco, mas a fonte de dados (vínculo card→risco) está documentada como pendente de correção de schema pelos próprios desenvolvedores.

**Vínculo com cards e cronograma**
- Pretendido, mas **não confirmado como funcional** devido ao TODO acima. Requer verificação direta no schema (`\d riscos` ou migration mais recente) para saber se `card_id` já foi adicionado depois do TODO ser escrito, ou se o badge está atualmente inoperante/exibindo dados incorretos.

**Lacunas / riscos**
- Risco de a badge de riscos no card **não aparecer nunca** (silenciosamente, pois o componente retorna `null` se não há dados) mesmo quando existem riscos relevantes vinculados à obra/atividade, dando falsa sensação de "sem riscos" a quem olha o card.
- Recomenda-se, na etapa de correção, resolver este TODO como prioridade alta antes de qualquer entrega que dependa do badge de riscos.

---

## 6. RDO (Relatório Diário de Obra)

**Estrutura**
- Lib: `src/lib/rdo/` — `export-pdf.ts`, `metrics.ts`, `numeracao.ts`, `resumo-mensal-csv.ts`, `resumo-mensal.ts` (com testes).
- Tabelas: `rdo`, `rdo_efetivo`, `rdo_atividades`, `rdo_ocorrencias`, `rdo_fotos` — todas criadas em `20260714010538_*`, modelo relacional razoavelmente completo (efetivo de mão de obra, atividades do dia, ocorrências, fotos).
- Badge de card: `src/components/cards/UltimoRdoBadge.tsx`, alimentado por `useUltimoRdoParaCard(cardId)` (`src/hooks/obras/useRdo.ts`), mostra data da última execução, nº de pessoas e quantidade.

**Estado real**
- **Funcional**: modelo de dados rico (5 tabelas relacionadas), exportação em PDF e resumo mensal em CSV implementados, numeração de RDO própria (`numeracao.ts`). O badge é explícito ao afirmar que só aparece "se o card está amarrado a um `cronograma_item_id` e existe ao menos uma execução" — comportamento condicional correto e documentado.

**Vínculo com cards e cronograma**
- Vínculo via `cronograma_item_id`, igual ao padrão do Orçamento. Consistente entre os dois módulos.

**Lacunas / riscos**
- Módulo aparenta ser um dos mais maduros do sistema (dados estruturados + export + numeração formal), mas não foi auditado neste corte o volume de fotos/anexos (`rdo_fotos`) quanto a bucket de storage usado — não aparece nos dois buckets identificados (`card-anexos`, `nfs`), sugerindo bucket próprio não mapeado no wrapper central `storageRepo`, o que é uma inconsistência de padronização similar à do módulo Documentos.

---

## 7. Pacotes de Trabalho (Last Planner)

**Estrutura**
- Tabelas: `pacotes_trabalho`, `compromissos_semanais` — criadas em `20260625184155_*`, recriadas em `20260722114221_*` (mesmo padrão de squash já mencionado).
- Lib: `src/lib/lastplanner/ppc.ts` (Percent Plan Complete), `semana.ts`, `restricoes.ts`.

**Estado real**
- **Funcional em nível de lib pura**: cálculo de PPC (indicador clássico do Last Planner System) implementado e testado. Não foi auditado neste corte se a tela/hook de gestão de pacotes semanais está completa (não foi localizado hook dedicado tipo `usePacotesTrabalho` na varredura rápida — ficou registrado como pendência).

**Vínculo com cards e cronograma**
- Pacotes de trabalho são a unidade central do Last Planner e se conectam a `pacote_restricoes` (restrições) e presumivelmente a itens de cronograma para gerar o compromisso semanal. Vínculo com cards do Kanban não confirmado neste corte.

**Lacunas / riscos**
- Repetição de `CREATE TABLE IF NOT EXISTS public.pacotes_trabalho` em duas migrations distintas — mesmo padrão de possível squash observado em outros módulos; deve ser confirmado se não há divergência de colunas entre as duas versões (risco de migration mais nova não incluir todas as colunas da mais antiga, ou vice-versa).

---

## 8. Notificações

**Estrutura**
- Tabela `notificacoes`: `20260702113635_*`.
- Lib pura de política: `src/lib/cards/notificacoesPolicy.ts` — função `destinatariosNotificacao` decide, para eventos de card (`comentario`, `mencao`, `responsavel`), **quem** deve ser notificado, com deduplicação explícita via `Set` de chaves `tipo:userId`.
- O comentário no topo do arquivo é uma admissão explícita de risco arquitetural: *"A criação efetiva é feita por trigger no banco (...), mas esta lib espelha a mesma regra para uso no cliente."* Ou seja, **existem duas implementações paralelas da mesma regra de negócio** — uma em trigger SQL (fonte de verdade real, dispara as notificações) e uma em TypeScript (usada para preview/UI/testes). Isso é um vetor claro de **divergência de comportamento**: se a trigger SQL for alterada sem atualizar `notificacoesPolicy.ts` (ou vice-versa), o preview mostrado ao usuário no cliente pode não corresponder ao que efetivamente é notificado no banco.
- Preferências: `src/hooks/useNotifPreferencias.ts` (não detalhado neste corte, mas existe hook dedicado, sugerindo suporte a opt-out por tipo de evento).
- Edge functions relacionadas a alertas/lembretes: `supabase/functions/alertas-operacao/`, `supabase/functions/card-prazo-lembrete/` — ambas fora do escopo de `notificacoesPolicy.ts`, indicando uma **terceira fonte** de geração de notificações (agendada/cron), independente da trigger de eventos de card.

**Estado real**
- **Funcional, porém com risco estrutural de duplicação/divergência de regra** entre: (1) trigger SQL de eventos de card, (2) lib TS espelho, (3) edge functions de alerta/lembrete agendado. Não há uma fonte única de verdade.

**Vínculo com cards e cronograma**
- Direto: notificações de comentário/menção/responsável são geradas a partir de eventos de card. `card-prazo-lembrete` sugere vínculo com prazos de cronograma também.

**Lacunas / riscos**
- **Risco de notificações excessivas ou duplicadas**: com 3 fontes distintas de geração de notificação (trigger de evento, edge function agendada de prazo, edge function de "alertas de operação"), sem um catálogo único de regras, o risco de um mesmo evento gerar múltiplas notificações redundantes ao mesmo usuário (ex.: lembrete de prazo + notificação de comentário sobre o mesmo card no mesmo dia) é real e não foi descartado neste diagnóstico.
- Recomenda-se, na próxima etapa, mapear as 3 fontes numa tabela única de "tipo de evento → política de disparo → canal" para eliminar sobreposição.

---

## 9. Permissões

**Estrutura**
- `src/lib/authz/paginas.ts`: fonte única de páginas via `NAV_REGISTRY` (`listarModulos`, `rotasDaMatriz`), ações `V/E/X/I/Ex` (Visualizar/Editar/Excluir/Importar/Exportar), matriz fina por página (`MatrizPermissoes`), papéis especiais (`aprovarCompras`, `aprovarFinanceiro`, `setores`).
- Normalização de setor: `normalizarSetores`, `normalizarSetorLegado` — trata slugs, rótulos e valores legados (ex.: "Depto. Pessoal" → "dp"), com allowlist espelhada em edge function `sync-player-auth` (mencionado em comentário/teste, indicando duplicação de regra entre client e edge function — mesmo padrão de risco do módulo Notificações).
- `src/contexts/auth/usePermissions.ts`: fachada `usePermissions()` com `hasAccess` (nível legado), `can(rota, acao)` (matriz fina), `isGM` (bypass total). Suporta "visualizar como usuário" (preview de GM) substituindo o player efetivo em toda a árvore de decisão — mecanismo de auditoria/suporte bem desenhado.
- Banco: enum `app_role` (`gm, engenharia, dp, financeiro, compras, seguranca, comum`), tabela de papéis, função `has_role(_user_id, _role)` com `REVOKE ... FROM PUBLIC, anon` (função protegida corretamente contra chamada anônima).

**Estado real**
- **Funcional e relativamente maduro**: há dois níveis de permissão (legado por página/nível e matriz fina por ação), migração incremental sem quebra de compatibilidade (comentários no código deixam isso explícito), e função de segurança de banco com revogação correta de `PUBLIC`/`anon`.

**Vínculo com cards e cronograma**
- Indireto: permissões controlam acesso a páginas/módulos (via rota), não a cards individuais. Não há RLS por card auditada neste corte.

**Lacunas / riscos**
- **Duplicação de regra de normalização de setor** entre `src/lib/authz/paginas.ts` (client) e a edge function `sync-player-auth` (mencionada como espelhada) — mesmo risco estrutural do módulo Notificações: se uma allowlist for atualizada e a outra não, usuários podem ficar com setor "fantasma" (aceito no client, rejeitado/ignorado no servidor, ou vice-versa).
- Não foi auditada neste corte a cobertura de RLS por tabela sensível (ex.: `financeiro_lancamentos`, `insumos`, `card_anexos`) além da função `has_role` — recomenda-se auditoria dedicada de políticas RLS tabela por tabela na próxima etapa.

---

## 10. Auditoria / Histórico

**Estrutura**
- `audit_logs`: criada em `20260616112645_*` e novamente em `20260618151913_*` (mesmo padrão de squash já observado nos demais módulos), além de extensão em `20260717000000_audit_logins_oportunidade_historico.sql` (login/oportunidade).
- `card_atividades`: criada em `20260707150224_*` e novamente em `20260722114221_*`.
- `security_events`: criada em `20260714160834_*` e novamente em `20260722110359_*`.

**Estado real**
- **Existe cobertura de auditoria em 3 camadas**: `audit_logs` (ações de negócio), `card_atividades` (timeline do card), `security_events` (eventos de segurança/login). Estrutura conceitualmente correta (separação por tipo de evento).
- O padrão recorrente de `CREATE TABLE` duplicado para `audit_logs`, `card_atividades` e `security_events` (assim como em `financeiro_lancamentos`, `riscos`, `solicitacoes_financeiras`, `financeiro_snapshots`, `pacotes_trabalho`, `restricoes`, `pacote_restricoes`) ao longo de **9 módulos distintos** é sistemático o suficiente para não ser coincidência isolada — é um padrão de todo o histórico de migrations, compatível com squashes de baseline em datas de reorganização de schema (14-22/07). **Recomenda-se, como item formal da Etapa 0 (auditoria de schema/banco), rodar `supabase db diff` ou equivalente contra o schema real de produção para confirmar que a versão vigente de cada tabela é a esperada e que nenhuma coluna foi perdida entre as recriações.**

**Vínculo com cards e cronograma**
- `card_atividades` é o vínculo direto de auditoria por card (timeline). Não foi confirmado neste corte se cronograma tem timeline própria ou reaproveita `audit_logs`.

**Lacunas / riscos**
- Risco de schema divergente entre migrations duplicadas (ver acima) é o achado transversal mais relevante desta auditoria e afeta múltiplos módulos simultaneamente (Financeiro, Restrições, Riscos, Pacotes de Trabalho, Auditoria). **Deve ser tratado como item prioritário antes de qualquer alteração de schema nesses módulos.**

---

## Resumo de Achados Críticos (transversais)

| # | Achado | Módulos afetados | Severidade |
|---|--------|-------------------|------------|
| 1 | TODO explícito de coluna `card_id` ausente em `riscos` — badge de riscos pode estar inoperante | Riscos | **Alta** |
| 2 | Padrão sistemático de `CREATE TABLE` duplicado entre migrations em ~9 tabelas de 6+ módulos | Financeiro, Restrições, Riscos, Pacotes de Trabalho, Auditoria | **Alta** (requer diff de schema) |
| 3 | Regra de negócio duplicada (trigger SQL vs. lib TS) sem fonte única de verdade | Notificações | Média |
| 4 | Allowlist de setor duplicada entre client e edge function | Permissões | Média |
| 5 | Upsert real do snapshot financeiro TOTVS não localizado na função de validação — pipeline de gravação não confirmado/rastreado | Financeiro | Média-Alta |
| 6 | Ausência de "Central de Documentos" unificada; documentos fragmentados por módulo sem deduplicação nem versionamento visível | Documentos | Média |
| 7 | Três fontes distintas de geração de notificação sem catálogo único de política | Notificações | Média |

