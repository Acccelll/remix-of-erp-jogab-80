# Inventário Funcional — Planifik (remix-of-erp-jogab)

**Tipo de documento:** Auditoria de compreensão do produto (sem juízo de qualidade, sem recomendações)
**Data da análise:** 08/07/2026
**Base analisada:** `remix-of-erp-jogab-main.zip` — 768 arquivos (317 `.tsx`, 240 `.ts`, 183 `.sql`, 1 `api.php` de ~212 KB)

---

## 1. Resumo Executivo

O sistema é um **ERP web para empresas de construção e montagem industrial**, batizado internamente de **Planifik** (marca visível no cliente HTTP e no banner de status; o `index.html` ainda usa o título "JOGAB", e chaves de storage usam o prefixo legado "obraflow"). É uma SPA React 18 + TypeScript + Vite + shadcn/Tailwind, com **duas camadas de persistência coexistindo**:

1. **Backend PHP legado** (`api.php`, hospedado em `jogab.com.br/api.php`, MySQL implícito) — serve os cadastros "núcleo" (obras, colaboradores, patrimônios, veículos, contratos, clientes, oportunidades, usuários/permissões, solicitações financeiras, despesas, medições, notas fiscais, recebimentos, snapshots financeiros).
2. **Supabase (Postgres + Auth + Storage + Edge Functions)** — serve os módulos mais novos (quadros Kanban/cards, cronograma/EVM, planejamento Lean, qualidade/inspeções, suprimentos, RDO, ponto, FOPAG/holerites, faturamento NFS-e, financeiro TOTVS, multiempresa, auditoria, feature flags, notificações, motor offline).

A autenticação é **dupla e encadeada**: o login é validado primeiro no PHP (token Bearer em `localStorage`), e em paralelo uma sessão Supabase Auth é garantida via edge functions de provisionamento/sincronização de credenciais (`provision-auth-user`, `sync-player-auth`), com self-heal de usuários órfãos e diálogo global de reautenticação em 401.

O produto cobre o ciclo completo de uma construtora/montadora: **CRM → Contrato → Obra → Planejamento (cronograma CPM/EVM + Last Planner) → Execução (RDO, inspeções de qualidade, alocação de equipe) → Suprimentos (requisição → cotação → OC → recebimento → estoque) → Medição/Faturamento (BMS, NFS-e) → Financeiro (lançamentos, fluxo, confronto TOTVS) → Custos de pessoal (ponto, FOPAG, provisões)**, com governança de migração de sistemas legados (Trello, Prevision, TOTVS) por obra, controlada por feature flags e painéis de cutover.

O sistema é claramente um produto **em transição arquitetural** (PHP → Supabase), com mecanismos explícitos de convivência: sincronização de obras entre os dois backends (`sync-obra.ts`), tipos Supabase deliberadamente "afrouxados" (`client-augment.d.ts` com comentário "schema in flux"), rotas de compatibilidade/redirecionamento abundantes e um plano de consolidação de menu ("Fase 4: 52 → ~30 itens") já executado.

---

## 2. Mapa Geral do Produto

### 2.1 Stack e infraestrutura

| Camada              | Tecnologia                                                                                                                                                   | Evidência                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Frontend            | React 18.3, TypeScript 5.8, Vite 5, SWC                                                                                                                      | `package.json`, `vite.config.ts`                            |
| UI                  | shadcn/ui (Radix), Tailwind 3.4, lucide-react, sonner, recharts, dnd-kit, TipTap (editor rico), embla                                                        | `package.json`, `src/components/ui`                         |
| Estado servidor     | TanStack Query 5 (staleTime 1 min, gcTime 5 min, sem refetch on focus)                                                                                       | `src/App.tsx`                                               |
| Estado global       | Contexts (`AppContext`, `EmpresaContext`, `ThemeContext`)                                                                                                    | `src/contexts`                                              |
| Backend 1 (legado)  | PHP monolítico `api.php` (~212 KB), REST por "resource", token Bearer próprio                                                                                | `api.php`, `src/lib/api.ts`                                 |
| Backend 2           | Supabase: Postgres (172 migrations), Auth, Storage, 7 Edge Functions (Deno)                                                                                  | `supabase/`                                                 |
| Offline             | IndexedDB via `idb` (stores `sync_queue`, `media_queue`, `drafts`), fila com backoff exponencial                                                             | `src/lib/offline`                                           |
| PWA (parcial)       | `InstallPrompt` captura `beforeinstallprompt`; não há manifest/service worker no repositório                                                                 | `src/components/InstallPrompt.tsx`, `index.html`, `public/` |
| Exportações         | SheetJS (xlsx), jsPDF + autotable, html-to-image, qrcode                                                                                                     | `package.json`                                              |
| Parsing de arquivos | papaparse (CSV), pdfjs-dist (PDF de ponto/holerite), parsers XLSX próprios (BMS, checklist, holerite), XML NFS-e                                             | `src/lib/*`                                                 |
| Testes              | Vitest + Testing Library + fake-indexeddb — 60 arquivos `.test.*`, incl. testes de integração ("cadeias críticas", "cadeias de valor") e fixtures XLSX reais | `vitest.config.ts`, `src/lib/__tests__`                     |
| Observabilidade     | `logger.ts`, `sentry.ts`, tabela `system_events`, banner global de saúde do backend PHP (3 falhas em 5 min ⇒ "não saudável")                                 | `src/lib/api.ts`, `src/lib/sentry.ts`                       |

### 2.2 Divisão de persistência por domínio

| Domínio                                                                                                                                                                                                                                                                                          | Persistência principal | Observação                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Obras (cadastro), Colaboradores, Patrimônios, Veículos, Contratos, Clientes, Oportunidades/CRM (parcial), Usuários/Permissões, Solicitações Financeiras, Despesas, Formas de Pagamento, Funções, Tipos de Documento, DP legado (histórico salarial, provisões, horas extras, fopag_eventos, 13º) | **PHP `api.php`**      | recursos identificados nos `case` do PHP: `obras, colaboradores, patrimonios, veiculos, contratos, clientes, oportunidades, funil_estagios, interacoes, usuarios, funcoes, despesas, financeiro_lancamentos, financeiro_snapshots, medicoes, notas_fiscais, recebimentos, bms_previstas, centros_custo_totvs, responsabilidades, mobilizar, atividades, provisoes, login, refresh` |
| Quadros/Cards, Cronograma, Planejamento Lean, Qualidade, Suprimentos, RDO, Ponto, Holerites/FOPAG novo, Faturamento NFS-e, Financeiro TOTVS (snapshots/rateios/confronto), Multiempresa, Auditoria, Feature Flags, Notificações, Riscos, Lições, Ocorrências, Membros de obra                    | **Supabase**           | ~130 tabelas criadas nas migrations                                                                                                                                                                                                                                                                                                                                                |
| Obras (espelho analítico)                                                                                                                                                                                                                                                                        | **Ambos**              | `sync-obra.ts` sincroniza a obra do PHP para a tabela `obras` do Supabase, que ancora cronograma/financeiro/EVM                                                                                                                                                                                                                                                                    |

---

## 3. Catálogo dos Módulos

### 3.1 Obras / Gestão de Equipe (rota raiz `/`)

- **Finalidade:** quadro de alocação de mão de obra e frota por obra (a "home" do sistema).
- **Telas:** `Board.tsx` (799 L) — colunas por obra + colunas especiais (Folga, Afastamento, Férias, Em Manutenção, Sujo, "responsável por" para veículos), cards de colaborador e veículo, menu de contexto, mobilização com data (via `MobilizacaoDialog`), documentos vencendo (`ExpiringDocsDialog`), exportação de movimentações para Excel, filtros e visões (`BoardFiltersMenu`, `BoardViewMenu`), equipamentos extras.
- **Entidades:** Colaborador, Veículo, Obra, MobilizacaoPendente, movimentações (histórico no PHP: `movimentacoes`, `movimentacoes_veiculos`).
- **Ações:** mobilizar/cancelar mobilização, mover entre obras, agendar mobilização futura, excluir colaborador (GM), exportar XLSX, ver perfil (diálogo com histórico, férias, documentos).
- **Integrações:** PHP (`mobilizar`, `colaboradores`, `veiculos`), alertas de vencimento de documentos.

### 3.2 Quadros (Kanban genérico multi-board) — `/quadros`, `/quadros/:boardId`, `/quadros/meus`

- **Finalidade:** sistema Trello-like com **pool único de cards** exibidos em múltiplos quadros via `card_board_posicao`; quadros por setor, por obra ou custom (com templates).
- **Telas:** índice de quadros (criar/arquivar/desarquivar, abas por tipo), board view com dnd-kit (drag entre listas, DragOverlay, hotkeys), "Meus cards", visões alternativas Kanban/Tabela/Calendário (`QuadroKanban`, `QuadroTabelaView`, `QuadroCalendarView`), visões salvas (`card_views_salvas`).
- **Card:** diálogo rico (`CardGenericoDialog`) com descrição TipTap/Markdown, comentários com menções (`cards-mencoes`, política de notificações), checklists, anexos, labels, membros internos/externos, campos customizados (`board_campos`, `card_custom_fields`), localização (`card_local`), setores, seções visíveis configuráveis, atividades/timeline, capas, grupos de negociação, recursos vinculados (suprimentos), badges de riscos/restrições/último RDO, cascata de prazos e marcos (`cascata-marcos`, `useCascataPorItem`), lembretes de prazo (edge function diária `card-prazo-lembrete` + sino `AlertasPrazoBell`).
- **Entidades:** ~20 tabelas `boards`, `board_*`, `cards`, `card_*`.
- **Integrações:** importação de CSV do Trello (`ImportarTrelloDialog`, `parseTrelloCsv`), RPC atômica `criar_card_board_atomico`, RPCs `board_items_resumo`, `board_atividades_recentes`.

### 3.3 Planejamento Lean / PMBOK — `/planejamento` (hub com abas)

- **Finalidade:** gestão de prazo e desempenho no padrão Last Planner System + EVM.
- **Abas/telas:** Dashboard (portfólio), Dashboard Lean (executivo consolidado, `lean-dashboard/aggregations`), Pacotes de Trabalho (811 L; WBS/last planner), Restrições (596 L; vínculo pacote×restrição em `pacote_restricoes`), Lookahead 6 semanas (548 L), PPC & Causas (589 L; `causas_nao_conclusao`, Pareto, `compromissos_semanais`), Matriz de Riscos (753 L; heatmap probabilidade×impacto, `riscos`, `lib/riscos/matriz`), Lições Aprendidas (618 L), RDO Consolidado (visão multi-obra de diários), Importar Checklist (aba de importação XLSX de checklist → pacotes; `parseChecklist`, fixture `checklist_214.xlsx`).
- **Entidades:** `pacotes_trabalho`, `restricoes`, `pacote_restricoes`, `compromissos_semanais`, `causas_nao_conclusao`, `riscos`, `licoes_aprendidas`, `rdo*`.
- **Bibliotecas puras:** `lastplanner/ppc.ts`, `lastplanner/restricoes.ts`, `lastplanner/semana.ts`, `pmbok/evm.ts` (BAC/PV/EV/AC/SPI/CPI/EAC 3 cenários/ETC/VAC/TCPI + Earned Schedule), `pmbok/ac-totvs.ts` (AC real do TOTVS) e `pmbok/ac-folha.ts` (AC de folha), `pmbok/riscos.ts`.

### 3.4 Obra 360º — `/obras` e `/obras/:id`

- **Finalidade:** ficha completa da obra; é a página mais densa do produto.
- **Estrutura:** rail vertical em 5 seções (`config/obra-tabs.ts`): **Resumo** | **Planejamento** (Cronograma com 5 visões internas `?cView=`: principal, Gantt, caminho crítico, semanal, comparar; Aditivos) | **Medição & Faturamento** (Medições/BMS, Faturamento/NFs, Recebimentos, Financeiro) | **Análise** (Desempenho, Previsão, Análise/EVM) | **Riscos & Histórico** (Riscos, Ocorrências, Histórico).
- **Cronograma:** `cronograma_itens/dependencias/marcos/baselines/revisoes/cenarios/calendarios` — CPM (`cpm.ts`, `recalcular-cpm`), edição de Gantt (`gantt-edicao`, `useGanttEdicao`, `ReguaEditor`), linha de balanço (`LinhaBalancoTab`, `linha-balanco.ts`), cenários what-if (`CenariosSheet`), calendários com exceções, baselines e revisões comparáveis (`CompararRevisoesTab`), importadores (`CronogramaImporter`, `CronogramaSemanalImporter`, `mpp.ts` — MPP não suportado com diálogo explicativo).
- **Medições (BMS):** importador de boletins XLSX (`BmsImporter` + `bms-excel.ts`), previstas×realizadas (`bms-previstas`, redistribuição `bms_redistribuicao`), fechamento (`bms-fechamento`), boletim (`bms-boletim`), criação manual de BMS prevista.
- **Faturamento da obra:** NFs (`notas_fiscais`, `vw_nf_saldo`), recebimentos, recálculo pós-faturamento via RPCs (`fn_recalcular_apos_faturamento`, `fn_reverter_faturamento_bms`, `fn_recalcular_previsao_nf`).
- **Análise:** EVM/curva S, curva de resultado acumulado (`resultado/curva-resultado`), previsto×realizado, custo comprometido (`recursos/committed-cost`), confronto operacional TOTVS×medições (`ConfrontoOperacionalCard`, `financeiro-totvs/confronto`), calculadora de impostos (`TaxCalculator`).
- **Transversais da obra:** membros com papéis (`obra_membros`, `useObraMembership` — gate duplo RBAC global + vínculo), exportação Excel e PDF da obra, "Limpar importados", reparo/sincronização automática PHP→Supabase quando o registro não existe (`syncObraToSupabase`), localizações da obra (`obra_localizacoes`), seed de obra demo (edge `seed-obra-demo`).

### 3.5 Qualidade / Inspeções — `/inspecoes` (hub)

- **Finalidade:** checklists de verificação (FVS/FVM/NRs) executáveis em campo, offline-first, com não conformidades.
- **Abas/telas:** Lista de modelos + histórico, Dashboard (KPIs, score, NCs), Agenda (agendamentos recorrentes, `inspecao_agendas`), QR Codes (etiquetas por frente/equipamento, `inspecao_qr_alvos`, rota pública `qr/go/:alvoId`), Não Conformidades (tratativa 5W2H, `nao_conformidades`), Captura (`InspecaoCaptura`, 518 L — offline-first com IndexedDB, fotos comprimidas em fila de mídia, assinatura via `SignaturePad`, severidade).
- **Entidades:** `inspecao_modelos`, `inspecao_perguntas`, `inspecoes`, `inspecao_respostas`, `inspecao_fotos`, `inspecao_agendas`, `inspecao_qr_alvos`, `nao_conformidades`.

### 3.6 Suprimentos — `/suprimentos/*`

- **Finalidade:** ciclo de compras e produção da obra, do orçamento ao estoque.
- **Telas:** Quadro de Compras (Kanban de cards de recurso + aba consolidada `TabelaConsolidadaCompras`), Quadro de Produção, Requisições (442 L), Cotações (546 L; propostas por fornecedor em `cotacao_propostas`, mapa comparativo), Ordens de Compra (633 L; alçadas de aprovação `alcadas_aprovacao` + `lib/suprimentos/alcadas`), Recebimento (424 L; `recebimento_materiais`, `recebimento_itens`, vínculo com NF), Estoque & Recebimento (hub; saldos `estoque_saldos`, movimentações `estoque_movimentacoes`, transferências `TransferenciaDialog`), Fornecedores (307 L; consulta CNPJ via edge `cnpj-lookup`/BrasilAPI), Insumos (386 L), Composições (474 L; `composicoes`, `composicao_itens`), Orçamento (543 L; `orcamento_itens`, saldo orçado `saldo-orcado`), Curva ABC (265 L), Grupos de Negociação (CRUD fora do menu, acessível por link direto), Alçadas (fora do menu, via ⌘K).
- **Conceito central:** "recursos" são cards do pool (integração Quadros ⇄ Suprimentos via `card_recursos`, `card_grupos_negociacao`, lead times `lead_time_templates`/`recursos/lead-times`, alertas de prazo `recursos/alertas-prazo`, status `recursos/status-card`).

### 3.7 Financeiro — `/financeiro/*`

- **Finalidade:** visão financeira corporativa e por obra, com importação TOTVS como fonte de custo real.
- **Telas:** Dashboard (429 L; portfólio, EVM agregado, resultado acumulado), Lançamentos (601 L; `financeiro_lancamentos` + rateios `financeiro_rateios`/matriz `financeiro_matriz_rateios`, importação TOTVS embutida), Aprovação Financeira (workflow de `solicitacoes_financeiras` com comentários e status em_analise/aprovado/reprovado/cancelado; RPC `fn_lancamento_solicitacao_aprovada` gera lançamento), Despesas (controle de despesas), Faturamento (303 L; importação de NFS-e por XML `ImportNfseXmlDialog`/`nfse-parser` e XLSX `ImportFaturamentoXlsxDialog`/`faturamento/parse-xlsx`, vínculo automático com obra `vincular-obra`), Fluxo & Dívidas (hub: Fluxo de Caixa + Evolução de Dívidas com rollup `financeiro_evolucao_rollup`), Cadastros (hub: Centros de Custo TOTVS, Naturezas/plano de contas `plano_contas` + `fn_seed_plano_contas`, Clientes financeiros, Formas de Pagamento), Importar TOTVS (rota legada mantida).
- **Pipeline TOTVS:** `financeiro-totvs/` (parse, agregações, centros, confronto, evolução, queries) + snapshots versionados (`financeiro_snapshots`, RPC `fn_importar_financeiro_snapshot`, alerta de idade do snapshot `SnapshotAgeAlert`, validação server-side via edge `totvs-import-validar` com `import_validation_runs` e `totvs_import_runs`, relatório `ImportValidationReport`).

### 3.8 Departamento Pessoal — `/dp/*`

- **Finalidade:** custo de mão de obra: ponto, folha, provisões e indicadores.
- **Telas:** Folha de Pagamento/Fopag (334 L; dashboard alimentado por `dp_holerite`, importação de holerite XLS `parserHoleriteXls`/`ImportHoleriteDialog`, detalhe por holerite), Ponto (importar relatórios CSV `parseRelatorioCsv` → `ponto_importacoes`/`ponto_registros`; análise com tratativas `ponto_tratativas`; Horas Extras virou aba), Custos de Pessoal (hub: Custo do Colaborador com fator K/encargos, Custo de Mão de Obra Direta por obra — usa RPC `get_folha_rateada` e alocação `dpAlocacao` —, Provisões férias/13º/FGTS/rescisão, Homem-Hora, Histórico Salarial).
- **Entidades:** `dp_holerite`, `ponto_*`, `custo_colaborador_competencia`, `fopag_entries`, `provisoes`, `decimo_terceiro`, `horas_extras`, `historico_salarial` (as cinco últimas também existem no PHP — DP é um domínio em migração).

### 3.9 Recursos Humanos — `/rh/*`

- **Finalidade:** cadastro de pessoas e conformidade documental.
- **Telas:** Colaboradores (CRUD completo, perfil com histórico de mobilizações, férias, documentos; diálogos `EmployeeFormDialog`, `EmployeeProfileDialog`, `EmployeeDPDialog`), Funções (cargos), Controle de Documentos (tipos com dias de vencimento `documento_tipos`, alertas de vencimento consumidos também no Board).
- **Persistência:** PHP (colaboradores, funções, tipos de documento, vencimentos).

### 3.10 CRM — `/crm/*`

- **Finalidade:** funil comercial de oportunidades até virar contrato/obra.
- **Telas:** Dashboard (funil, conversão, pipeline), Funil de Vendas (hub: quadro Kanban por estágio `funil_estagios` + lista), Perfil da Oportunidade (comentários em drawer, interações, temperatura `crm-temperatura` com `TemperatureSelector/Display`), Clientes (cadastro com contatos `ContactsManager`, perfil, consulta CNPJ/CEP).
- **Persistência:** PHP (`clientes, oportunidades, funil_estagios, interacoes, oportunidade_comentarios`); migrations Supabase de `leads`→`oportunidades` indicam migração em andamento neste domínio também.

### 3.11 Contratos — `/contratos` (hub)

- **Finalidade:** contratos administrativos/facilities (tipos: Máquina, Internet, Faxina, Alimentação, Alojamento, Luz, Água, Contêiner, Outro) com ciclo rascunho→ativo→suspenso→encerrado→inadimplente, aditivos e histórico de movimentações.
- **Abas:** Quadro (Kanban por status), Lista, **Fornecimento** (contratos de fornecimento com medições próprias — `contrato_medicoes`, `lib/contratos/medicao`).

### 3.12 Ativos & Frotas — `/patrimonios`, `/veiculos`, `/mobilizacao-provisoria`

- **Patrimônios:** hub Quadro (alocação por obra) + Lista; perfil com histórico e responsabilidades por período (`responsabilidades_patrimonios`), flags de estado.
- **Veículos:** lista com tipos (Utilitário, Passeio, Retroescavadeira, Escavadeira, Munck, Ônibus, Camionete), perfil/histórico, custos de frota (`FrotaCustosTabs`: abastecimentos `frota_abastecimentos`, manutenções `frota_manutencoes`, apropriação `frota_apropriacao`, custo por equipamento `frotas/custo-equipamento`), mobilização de veículos (`mobilizacoes_veiculos`).
- **Mobilização Provisória:** (567 L) alocações temporárias com período (`mobilizacoes_periodos`).

### 3.13 GM / Gerenciamento (admin) — `/gm/*`

- **Finalidade:** administração de usuários e governança da migração.
- **Telas:** GM (CRUD de usuários/players com matriz de acessos por página × nível, reset de senha, e-mail), Saúde (idade do snapshot TOTVS, `system_events`, fila offline), Auditoria (visualizador de `audit_logs` com filtros), Feature Flags (CRUD de flags globais/por obra, resolvidas via RPC `is_flag_enabled` com fallback obra→global), Cutover (índice + painel por obra de reconciliação legado×Planifik para Trello/cronograma/financeiro/ponto, guiado pelas flags `legacy.*_import`).

### 3.14 Admin — `/admin/*`

- **Empresas:** (521 L) cadastro multiempresa (`empresas`, vínculos `user_empresas`, cor por empresa) — alimenta o `EmpresaSelector` do header (GM vê "Todas").
- **Importar Obras:** importação de obras via CSV (`parseObrasCsv`).

---

## 4. Catálogo das Entidades

### 4.1 Núcleo (PHP + espelho parcial no Supabase)

| Entidade                                                                                                                            | Onde vive                                                                                          | Campos/observações-chave                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Obra                                                                                                                                | PHP (`obras`) + Supabase (`obras`, sincronizada)                                                   | status com badge, `flowcastId` (chave de ligação com o sistema flowcast/Código TOTVS), integrações |
| Colaborador                                                                                                                         | PHP                                                                                                | histórico, férias, documentos/vencimentos, alocação                                                |
| Veículo                                                                                                                             | PHP + custos no Supabase                                                                           | tipo, flags, responsabilidades                                                                     |
| Patrimônio                                                                                                                          | PHP                                                                                                | flags, responsabilidades por período                                                               |
| Contrato (facilities)                                                                                                               | PHP                                                                                                | tipo, status, aditivos (`aditivos_contrato` também no Supabase)                                    |
| Cliente                                                                                                                             | PHP                                                                                                | contatos, dados financeiros expandidos (migration 2026-06-30)                                      |
| Oportunidade / FunilEstagio / Interação                                                                                             | PHP (+ migrations Supabase `leads`→`oportunidades`)                                                | temperatura, comentários, serviços múltiplos, datas potenciais                                     |
| Player (usuário)                                                                                                                    | PHP (`usuarios`) + Supabase (`players`, `profiles`, `user_roles`, `user_empresas`, `user_setores`) | `acessos: Record<PageKey, NivelAcesso>`, `isGM`, token                                             |
| SolicitacaoFinanceira / Despesa / FormaPagamento                                                                                    | PHP                                                                                                | workflow de aprovação com comentários e prioridade                                                 |
| Funcao / DocumentoTipo                                                                                                              | PHP                                                                                                | dias de antecedência de vencimento                                                                 |
| DP legado: HistoricoSalarial, Provisao, DecimoTerceiro, HoraExtra, FopagEntry, CustoColaboradorCompetencia, ResponsabilidadePeriodo | PHP e Supabase (duplicado)                                                                         | categorias/status tipados em `src/types`                                                           |

### 4.2 Supabase (agrupado — ~130 tabelas nas migrations)

| Grupo                 | Tabelas                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quadros/Cards         | `boards, board_listas, board_membros, board_campos, cards, card_board_posicao, card_anexos, card_atividades, card_checklist_itens, card_comentarios, card_labels, card_label_links, card_membros, card_membros_externos, card_local, card_setores, card_secoes_visiveis, card_views_salvas, card_custom_fields, card_custom_field_valores, card_campos_valores, card_recursos, card_grupos_negociacao` |
| Cronograma            | `cronograma_itens, cronograma_dependencias, cronograma_marcos, cronograma_baselines, cronograma_item_baseline, cronograma_revisoes, cronograma_item_revisoes, cronograma_cenarios, cronograma_cenario_itens, cronograma_calendarios, cronograma_calendario_excecoes`                                                                                                                                   |
| Planejamento Lean     | `pacotes_trabalho, restricoes, pacote_restricoes, compromissos_semanais, causas_nao_conclusao, riscos, licoes_aprendidas`                                                                                                                                                                                                                                                                              |
| RDO                   | `rdo, rdo_atividades, rdo_efetivo, rdo_fotos, rdo_ocorrencias`                                                                                                                                                                                                                                                                                                                                         |
| Qualidade             | `inspecao_modelos, inspecao_perguntas, inspecoes, inspecao_respostas, inspecao_fotos, inspecao_agendas, inspecao_qr_alvos, nao_conformidades`                                                                                                                                                                                                                                                          |
| Suprimentos           | `fornecedores, insumos, composicoes, composicao_itens, orcamento_itens, requisicoes, cotacoes, cotacao_propostas, ordens_compra, ordem_compra_itens, alcadas_aprovacao, recebimento_materiais, recebimento_itens, estoque_saldos, estoque_movimentacoes, lead_time_templates`                                                                                                                          |
| Medição/Faturamento   | `medicoes, itens_medicao, bms_previstas, bms_redistribuicao, notas_fiscais, recebimentos, faturamento_nfse, contrato_medicoes, aditivos_contrato`                                                                                                                                                                                                                                                      |
| Financeiro            | `financeiro_lancamentos, financeiro_rateios, financeiro_matriz_rateios, financeiro_snapshots, financeiro_evolucao_rollup, centros_custo_totvs, plano_contas, solicitacoes_financeiras, solicitacao_comentarios, controle_despesas, formas_pagamento` + views `vw_financeiro_obra, vw_nf_saldo, vw_obra_valores`                                                                                        |
| DP/Ponto              | `dp_holerite, ponto_importacoes, ponto_registros, ponto_tratativas, custo_colaborador_competencia, fopag_entries, provisoes, decimo_terceiro, horas_extras, historico_salarial`                                                                                                                                                                                                                        |
| Frotas                | `frota_abastecimentos, frota_manutencoes, frota_apropriacao, mobilizacoes_veiculos, mobilizacoes_periodos`                                                                                                                                                                                                                                                                                             |
| Pessoas/Org           | `colaboradores, funcoes, empresas, user_empresas, user_setores, players, profiles, user_roles, obra_membros, obra_localizacoes, documento_tipos`                                                                                                                                                                                                                                                       |
| Governança/Plataforma | `audit_logs, feature_flags, system_events, notificacoes, import_validation_runs, totvs_import_runs, atividades, ocorrencias, interacoes, leads, lead_comentarios, clientes, oportunidades, funil_estagios`                                                                                                                                                                                             |
| RPCs                  | `criar_card_board_atomico, board_items_resumo, board_atividades_recentes, fn_importar_financeiro_snapshot, fn_lancamento_solicitacao_aprovada, fn_recalcular_apos_faturamento, fn_recalcular_previsao_nf, fn_reverter_faturamento_bms, fn_seed_plano_contas, get_folha_rateada, has_role, is_flag_enabled, current_empresas, current_is_gm`                                                            |

---

## 5. Fluxos de Negócio

### 5.1 Fluxo principal (comercial → execução → resultado)

```
Cliente (CRM)
   ↓  oportunidade avança no funil (estágios, temperatura, interações)
Oportunidade ganha
   ↓
Obra (cadastro PHP → sincronizada ao Supabase)
   ↓                             ↘
Cronograma (import/baseline)      Membros da obra (papéis)
   ↓
Planejamento Lean (pacotes → restrições → lookahead → compromissos semanais → PPC/causas)
   ↓
Execução: Board de equipe (mobilizações) + RDO diário + Inspeções de qualidade (→ NCs)
   ↓
Medições BMS (previstas × realizadas) → Faturamento (NF/NFS-e) → Recebimentos
   ↓
Financeiro: lançamentos + snapshot TOTVS (custo real) → confronto operacional → EVM (curva S, CPI/SPI, EAC) → Curva de resultado
   ↓
Dashboards (Financeiro, Lean, CRM, Inspeções) e GM/Auditoria
```

### 5.2 Fluxo de suprimentos

```
Orçamento da obra (composições/insumos, saldo orçado)
   ↓
Requisição → Cotação (propostas por fornecedor, mapa comparativo)
   ↓
Ordem de Compra (aprovação por alçada) → custo comprometido na obra
   ↓
Recebimento (vínculo NF, itens) → Estoque (saldos, movimentações, transferências)
   ↓
Quadro de Compras/Produção (cards de recurso com lead time, alertas de prazo, cascata de marcos)
```

### 5.3 Fluxo de custo de pessoal

```
Importar ponto (CSV) → registros → tratativas/análise → horas extras
Importar holerite (XLS) → dp_holerite → Fopag dashboard
   ↓
Custo do colaborador (fator K) → rateio por obra (get_folha_rateada) → AC de folha no EVM
Provisões (férias/13º/FGTS/rescisão) → Financeiro
```

### 5.4 Fluxo de aprovação financeira

```
Solicitação financeira (status em_analise) → comentários → aprovada
   → RPC fn_lancamento_solicitacao_aprovada gera lançamento financeiro
```

### 5.5 Fluxo de cutover (migração de legado, por obra)

```
Feature flags legacy.trello_import / legacy.cronograma_import / legacy.financeiro_import / legacy.ponto_import
   ↓ habilitam importadores por obra
Importações (Trello CSV, cronograma, TOTVS, ponto)
   ↓
Painel GM Cutover: métricas Planifik lado a lado com valores esperados do legado (Trello/Prevision)
   ↓ reconciliado → flags desligadas
```

### 5.6 Fluxo offline (RDO e Inspeções)

```
Formulário → draft em IndexedDB (rehidratação)
Salvar → sync_queue (UUID do cliente = PK remota → upsert idempotente, FIFO, backoff)
Fotos → media_queue (upload ao Storage; pai só referencia URL após concluir)
Reconexão → sync-runner processa filas → banner de status (SyncStatusBanner) e GM Saúde
```

---

## 6. Mapa de Navegação

### 6.1 Sidebar (NAV_REGISTRY — 9 grupos, ~30 itens visíveis)

| Grupo                | Itens (rota)                                                                                                                                | Permissão              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Obras                | Gestão de Equipe `/`, Quadros `/quadros`, Planejamento Lean `/planejamento`, Qualidade `/inspecoes`, Mobilização Provisória, Obras `/obras` | `obras_div`            |
| Recursos Humanos     | Colaboradores, Funções, Controle de Documentos                                                                                              | `rh`                   |
| Departamento Pessoal | Folha de Pagamento, Ponto, Custos de Pessoal                                                                                                | `dp`                   |
| Suprimentos          | Quadro de Compras, Quadro de Produção, Requisições, Cotações, Ordens de Compra, Estoque & Recebimento, Fornecedores                         | `obras_div`            |
| Ativos & Frotas      | Patrimônios, Veículos                                                                                                                       | `patrimonios`/`frotas` |
| Contratos            | Contratos (hub)                                                                                                                             | `contratos`            |
| Financeiro           | Dashboard, Lançamentos, Aprovação, Despesas, Faturamento, Fluxo & Dívidas, Cadastros                                                        | `financeiro`           |
| CRM                  | Dashboard, Funil de Vendas, Clientes                                                                                                        | `crm`                  |
| Gerenciamento        | GM                                                                                                                                          | `admin`                |

### 6.2 Itens ocultos (HIDDEN_NAV_ITEMS — acessíveis por URL direta e ⌘K)

Abas de hubs: Inspeções (lista/dashboard/agenda/QR/NCs), Planejamento (9 sub-rotas), Custos DP (5), Estoque (saldos/recebimento), Financeiro (fluxo/dívidas/centros/naturezas/clientes/formas), Contratos e Patrimônios (quadro/lista), Alçadas.

### 6.3 Rotas fora de qualquer menu (apenas link direto)

`/suprimentos/grupos-gestao` (CRUD de grupos), `/suprimentos/insumos`, `/composicoes`, `/orcamento`, `/curva-abc` (estão em KNOWN_ROUTES e no App, mas não na sidebar nem em HIDDEN_NAV — alcançáveis por navegação interna dos módulos), `/inspecoes/:modeloId` (captura), `/inspecoes/qr/go/:alvoId`, `/gm/saude|auditoria|feature-flags|cutover`, `/admin/empresas`, `/admin/obras/importar`, `/financeiro/importar` (legada), `/quadros/meus`.

### 6.4 Redirecionamentos de compatibilidade (rotas legadas)

`/quadro→/quadros`; `/colaboradores|/funcoes|/controle-documentos→/rh/*`; `/financeiro/obras→/obras` (e `/financeiro/obras/:id→/obras/:id`); `/suprimentos/grupos|/alertas→/suprimentos/compras?view=consolidado`; `/crm/dashboard→/crm`; `/crm/funil|/crm/oportunidades→/crm/vendas`.

### 6.5 Páginas órfãs (existem em `src/pages` mas não são referenciadas por rota nem por hub)

| Arquivo                                 | Situação                                                              |
| --------------------------------------- | --------------------------------------------------------------------- |
| `src/pages/Index.tsx`                   | Não importado em lugar algum (resquício do template)                  |
| `src/pages/Ocorrencias.tsx`             | Não referenciado — a funcionalidade vive na aba Ocorrências da obra   |
| `src/pages/LicoesAprendidas.tsx` (raiz) | Não referenciado — versão ativa é `planejamento/LicoesAprendidas.tsx` |
| `src/pages/Riscos.tsx` (raiz)           | Não referenciado — versão ativa é `planejamento/Riscos.tsx`           |

### 6.6 Navegação transversal

Breadcrumbs derivados de `ROUTE_LABELS`/`KNOWN_ROUTES`; Command Palette (⌘K) sobre `NAV_ITEMS` + keywords; seletor de empresa no header; sino de notificações; banners globais (status Planifik, fila offline); atalhos de teclado em diálogos e no board.

---

## 7. Dependências entre Módulos

```
Obras (cadastro PHP)
 ├── sincroniza → Obra Supabase ─┬── Cronograma ── EVM/Análise ── Dashboards
 │                               ├── Planejamento Lean (pacotes/PPC/riscos)
 │                               ├── RDO / Inspeções (offline)
 │                               ├── Medições BMS ── Faturamento/NFs ── Recebimentos
 │                               ├── Financeiro TOTVS (via centro de custo/Código TOTVS)
 │                               └── Membros da obra (permissão por vínculo)
 ├── Board de Equipe (colaboradores/veículos mobilizados por obra)
 ├── Suprimentos (orçamento, requisições, OCs, estoque por obra)
 └── DP (rateio de folha por obra → AC do EVM)

CRM (clientes/oportunidades) ──→ Contratos ──→ Obras
Quadros/Cards ⇄ Suprimentos (cards de recurso) ⇄ Planejamento (restrições/riscos/RDO badges)
RH (colaboradores, documentos) ──→ Board / DP
GM (usuários, flags, auditoria, cutover) ──→ todos
Empresas (multiempresa) ──→ filtro global de obras em todos os módulos
```

Dependências técnicas notáveis: praticamente todos os módulos Supabase dependem de `ensureCloudSession` (que depende do login PHP); EVM depende de Cronograma + (TOTVS ou Medições como fallback, com `fonteAC` sinalizada); Confronto Operacional depende de Medições + Snapshot TOTVS; Custo comprometido depende de OCs.

---

## 8. Funcionalidades Transversais

| Funcionalidade      | Implementação                                                                                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação        | Login PHP (token) + Supabase Auth espelhada (edges `sync-player-auth`, `provision-auth-user`), reauth global em 401 (`ReauthDialog`), reset de senha (`/reset-password`), troca de senha                                                                    |
| Permissões          | RBAC por página: 10 `PageKey` × 5 `NivelAcesso` (nenhum/visualizar/editar/compras/financeiro), flag `isGM`; no Supabase: RLS + `user_roles`/`has_role`, `obra_membros` (gate duplo em telas de obra), `user_empresas` (escopo multiempresa), `user_setores` |
| Multiempresa        | `EmpresaContext` + seletor no header; GM pode ver "Todas"; filtro de obras por empresa aplicado nas listas                                                                                                                                                  |
| Pesquisa            | Command Palette ⌘K com keywords; buscas locais por tela; `ColumnFilter`, `StatusFilter`, `ObrasFilter`                                                                                                                                                      |
| Importação          | Trello CSV, cronograma XLSX (principal e semanal), MPP (bloqueado com aviso), BMS XLSX, checklist XLSX, NFS-e XML, faturamento XLSX, holerite XLS, ponto CSV, TOTVS (com validação server-side e hash), obras CSV                                           |
| Exportação          | Obra completa em XLSX e PDF, movimentações do board em XLSX, tabelas diversas                                                                                                                                                                               |
| Dashboards          | Financeiro, Lean, CRM, Inspeções, Planejamento, Fopag, GM Saúde                                                                                                                                                                                             |
| Notificações        | Tabela `notificacoes` + `NotificationBell`; jobs: `card-prazo-lembrete` (diário) e `alertas-operacao` (idade de snapshot → `system_events`); políticas de notificação de menções                                                                            |
| Uploads/Anexos      | `card_anexos`, fotos de RDO/inspeção via Storage com fila offline e compressão de imagem                                                                                                                                                                    |
| Comentários/Menções | Cards (TipTap + menções), solicitações financeiras, oportunidades, lições                                                                                                                                                                                   |
| Histórico/Timeline  | `card_atividades`, históricos de colaborador/patrimônio/veículo/contrato, `HistoricoTab` da obra, revisões de cronograma                                                                                                                                    |
| Auditoria           | `audit_logs` + visualizador GM                                                                                                                                                                                                                              |
| Feature Flags       | `feature_flags` global/por obra, RPC `is_flag_enabled`, painel GM, gate `FeatureGate`                                                                                                                                                                       |
| Offline             | Motor genérico IndexedDB (sync/media/drafts), backoff, banner de status, hooks `useOnlineStatus`/`useSyncQueueStatus`, usado por RDO e Inspeções                                                                                                            |
| Etiquetas/Tags      | `card_labels`, grupos de negociação, setores                                                                                                                                                                                                                |
| Favoritos/Visões    | `card_views_salvas` (visões salvas de quadro)                                                                                                                                                                                                               |
| Onboarding          | `OnboardingHint`                                                                                                                                                                                                                                            |
| Tema                | `ThemeContext` + `ThemeToggle` (next-themes)                                                                                                                                                                                                                |
| Utilidades BR       | Consulta CNPJ (BrasilAPI via edge), CEP, moeda BRL (`money.ts`, `currency.ts`, `brl`)                                                                                                                                                                       |
| Deep links          | Estado em URL (`useUrlState`, `?tab=`, `?cView=`), QR codes de inspeção                                                                                                                                                                                     |

---

## 9. Grau de Completude por Módulo

| Módulo                           | Classificação                                        | Justificativa                                                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Board / Gestão de Equipe         | **Completo**                                         | Home consolidada, filtros, export, mobilização agendada, integrações de documentos; código maduro (799 L) sem TODOs estruturais                                                                                    |
| Quadros/Cards                    | **Completo**                                         | Funcionalidade Trello completa + além (multi-board, views salvas, campos custom, recursos); comentários de fase indicam Fase A/B concluídas; RPC atômica e testes                                                  |
| Cronograma/EVM (Obra 360º)       | **Completo**                                         | CPM, baselines, revisões, cenários, calendários, Gantt editável, linha de balanço, EVM com Earned Schedule e fallback de AC sinalizado; ampla cobertura de testes (cpm, mpp-lob, rpcs-atomicos, cadeias)           |
| Planejamento Lean                | **Completo**                                         | Todas as cerimônias do Last Planner presentes (pacotes, restrições, lookahead, compromissos, PPC/causas) + dashboards                                                                                              |
| Qualidade/Inspeções              | **Completo**                                         | Ciclo modelo→agenda→QR→captura offline→NC 5W2H com fotos e assinatura                                                                                                                                              |
| Suprimentos                      | **Completo (funcional), com bordas em consolidação** | Ciclo requisição→cotação→OC (alçadas)→recebimento→estoque implementado; porém páginas de configuração fora do menu (grupos-gestao, alçadas via ⌘K) e consolidação recente de rotas indicam acabamento em andamento |
| Financeiro                       | **Completo (dependente de importação)**              | Lançamentos, rateios, aprovação, faturamento NFS-e, fluxo/dívidas, cadastros; o custo real depende do snapshot TOTVS (alerta de idade evidencia operação por importação periódica, não integração online)          |
| RDO                              | **Completo**                                         | Diário com atividades/efetivo/fotos/ocorrências, offline-first, consolidado multi-obra, métricas                                                                                                                   |
| DP                               | **Parcial / em migração**                            | Convivem dois mundos: tabelas legadas no PHP (fopag_eventos, provisões, HE, 13º) e pipeline novo no Supabase (dp_holerite, ponto). Fopag novo é "dashboard operacional"; Horas Extras rebaixada a aba              |
| RH                               | **Completo**                                         | CRUD estável no PHP com alertas de vencimento                                                                                                                                                                      |
| CRM                              | **Completo como MVP comercial / em migração**        | Funil, dashboard, perfil, temperatura, comentários; migrations recentes (jun-jul/2026) renomeando `leads`→`oportunidades` e expandindo campos mostram evolução ativa                                               |
| Contratos                        | **Completo**; aba Fornecimento **recente**           | Kanban+lista maduros; Fornecimento (contrato_medicoes) é adição nova acessível só pelo hub                                                                                                                         |
| Patrimônios / Veículos / Frotas  | **Completo**                                         | Perfis, históricos, responsabilidades, custos de frota com apropriação                                                                                                                                             |
| Mobilização Provisória           | **Completo**                                         | Tela dedicada com períodos                                                                                                                                                                                         |
| GM (usuários)                    | **Completo**                                         | Matriz de acessos completa                                                                                                                                                                                         |
| GM Saúde/Auditoria/Flags/Cutover | **Completo para o propósito de migração**            | Numerado por hitos (H2.1, H2.2, H2.3, H3.1, H3.3) — infraestrutura de governança do cutover concluída                                                                                                              |
| Multiempresa                     | **Completo (recente)**                               | Contexto, seletor, filtro de obras, admin de empresas                                                                                                                                                              |
| Motor Offline                    | **Funcional, autodeclarado PoC**                     | Comentário "Fase 4.0 — PoC" em `db.ts`; porém já em produção para RDO e Inspeções, com testes                                                                                                                      |
| PWA                              | **Parcial**                                          | InstallPrompt existe; não há `manifest.json` nem service worker no repositório                                                                                                                                     |
| Importador BMS                   | **Em evolução planejada**                            | `.lovable/plan.md` descreve o próximo passo (parser canônico com detecção dinâmica de colunas) — plano ainda não implementado                                                                                      |
| Tipagem Supabase                 | **Em transição**                                     | `client-augment.d.ts` afrouxa `from()`/`rpc()` para `any` ("schema in flux"); `types.ts` gerado não cobre ~40 tabelas mais novas                                                                                   |
| Páginas órfãs                    | **Não utilizadas**                                   | `Index.tsx`, `Ocorrencias.tsx`, `LicoesAprendidas.tsx` (raiz), `Riscos.tsx` (raiz)                                                                                                                                 |
| Serviços                         | **Experimental/embrionário**                         | `src/services` contém apenas `colaboradorService.ts` — camada de service não generalizada (o padrão dominante é repositories + hooks)                                                                              |

---

## 10. Padrões Observados (documentação, sem julgamento)

- **Listagem:** TanStack Query + repository (ou `supabase.from` direto onde não há repo) → tabela shadcn com `ColumnFilter`/`useTableSort`/`QueryState` (loading/erro/vazio padronizados) → busca textual local → botões de ação por linha.
- **Formulário:** Dialog shadcn + react-hook-form + zod (`lib/schemas`) para os domínios novos; formulários controlados simples nos legados; `MaskedDateInput` para datas.
- **Cadastro/edição:** mesmo Dialog para criar/editar; otimista no estado local do AppContext para entidades PHP (atualiza estado, depois chama `api.update`, toast em erro).
- **Exclusão:** `DeleteConfirmDialog` de confirmação; em alguns casos exclusão restrita a GM; grupos de negociação só excluem sem vínculos.
- **Navegação:** hubs com abas (`HubTabs`) preservando deep links `?tab=`; rotas legadas viram `<Navigate replace>`; estado de visão em query string.
- **Pesquisa:** ⌘K global por rótulo+keywords; filtros por coluna/status/obra nas listas.
- **Acesso a dados:** regra escrita no README de repositories — páginas não chamam `supabase.from` para tabelas cobertas por repo; funções nomeadas por intenção (`listResumo`, `getById`...). Entidades PHP passam por `mappers.ts` (fromApi) e hooks de estado por entidade (`useXxxState`).
- **Convivência de backends:** detecção de UUID na rota da obra para decidir origem; reparo automático (sync PHP→Supabase) quando o registro remoto falta.
- **Planos de IA no repositório:** `.lovable/plan.md` armazena o plano da próxima mudança (padrão de trabalho com Lovable).

---

## 11. Escopo Geral do Sistema

- **Que tipo de sistema é este?** Um ERP vertical de construção civil/montagem industrial com forte ênfase em gestão de obras (prazo, custo, qualidade, suprimentos e pessoas), somado a camadas de colaboração (Kanban genérico) e governança de migração de legados.
- **Quem é o usuário?** Equipes internas da(s) construtora(s): engenheiros/gestores de obra (planejamento, RDO, inspeções, suprimentos), RH/DP, financeiro, comercial (CRM), administração de contratos/ativos e um perfil GM (administrador) que governa usuários, flags e o cutover. O multiempresa indica uso por mais de um CNPJ do mesmo grupo.
- **Qual problema resolve?** Centralizar em um único produto o que antes vivia em Trello (tarefas/compras), Prevision (cronograma), TOTVS (financeiro/folha — que permanece como fonte de custo real importada), planilhas de BMS/ponto/holerite e um ERP PHP próprio, dando visibilidade de desempenho (EVM, PPC, resultado) por obra e por portfólio.
- **Áreas de negócio cobertas:** Comercial/CRM, Contratos, Engenharia/Planejamento, Produção/Execução, Qualidade, Suprimentos/Estoque, Financeiro, RH, DP, Frotas/Ativos, Administração/TI.
- **Processos gerenciados:** funil de vendas; ciclo de vida de contrato; planejamento e controle de obra (CPM/EVM/Last Planner); diário de obra; inspeções e não conformidades; mobilização de equipe e frota; compras ponta a ponta; medição e faturamento; contas, fluxo e aprovações financeiras; apuração de custo de mão de obra; conformidade documental; e o próprio processo de migração de sistemas (cutover controlado por flags, com auditoria e reconciliação).

---

_Documento gerado exclusivamente por leitura do código-fonte, migrations, configurações e artefatos do repositório. Nenhum arquivo do projeto foi modificado._
