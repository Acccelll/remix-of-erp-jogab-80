# Onda 7 — Checklist de Conclusão

## Resumo Executivo

Gate de saída da onda. **Todos** os itens devem estar marcados antes de iniciar a onda seguinte.

## Objetivo

Impedir que uma onda seja dada por encerrada sem verificação objetiva.

## Escopo

Achados, critérios de saída, regressão, governança e marco.

## Conteúdo

### 1. Achados tratados (43)

- [x] `PRO-001` — CRM: motivo de perda não capturado → `06_CHANGESETS/PRO-001.NOTA-FIM.md`
- [x] `PRO-003` — DP: sem fechamento de competência (Fopag exibe, não fecha) — ver [encerramento](../../06_CHANGESETS/PRO-003.slice-08.md)
- [x] `PRO-005` — RDO sem valor documental (sem assinatura, PDF, numeração, trava) — ver [fechamento](../../06_CHANGESETS/PRO-005.slice-08.md)
- [x] `PRO-006` — Efetivo do RDO redigitado (não deriva da alocação do Board) → `06_CHANGESETS/PRO-006.NOTA-FIM.md`
- [x] `PRO-007` — NC sem workflow ativo (sem responsável/prazo/reinspeção/notificação) — ver [closeout](../../06_CHANGESETS/PRO-007.closeout.md)
- [x] `PRO-009` — Suprimentos: fluxo cotação vencedora -> OC não conduzido → `06_CHANGESETS/PRO-009.NOTA-FIM.md`
- [x] `PRO-010` — Suprimentos: sem comunicação com fornecedor (OC/cotação por PDF/e-mail) → `06_CHANGESETS/PRO-010.NOTA-FIM.md` (fase 1: PDF + trilha local; envio por e-mail diferido p/ Onda 8)
- [x] `PRO-018` — Importador BMS frágil a variações de layout — ver [NOTA-FIM](../../06_CHANGESETS/PRO-018.NOTA-FIM.md)
- [x] `OPS-003` — Ausência de logging estruturado e correlação entre eventos
- [x] `OPS-004` — Monitoramento de fluxos e health check consolidado ausentes
- [x] `OPS-005` — Ambientes sem perfis versionados nem documentação de configuração
- [x] `OPS-007` — Documentação operacional e runbooks inexistentes
- [x] `PRO-002` — CRM: sem tarefas/agenda de follow-up — ver [NOTA-FIM](../../06_CHANGESETS/PRO-002.NOTA-FIM.md)
- [x] `PRO-008` — NC não gera restrição (M4) nem card (M2) automaticamente → `06_CHANGESETS/PRO-008.NOTA-FIM.md` (fase 1; slices 03–06 diferidos p/ Onda 8)
- [x] `PRO-015` — Importação TOTVS manual e periódica (sem agendamento) → `06_CHANGESETS/PRO-015.NOTA-FIM.md` (fase 1: cadência + alerta; cron real diferido p/ Onda 8)
- [x] `PRO-016` — Obra: sem workflow de aprovação de medição — ver [closeout](../../06_CHANGESETS/PRO-016.closeout.md)
- [x] `PRO-019` — Contratos: sem alertas de vencimento/renovação — banner no Hub + hook `useContratosVencendo` (aditivos, reajustes, silêncio 7d)
- [x] `PRO-020` — Contratos não geram despesa recorrente no Financeiro — ver [closeout](../../06_CHANGESETS/PRO-020.closeout.md)
- [x] `PRO-022` — Board: sem visão de capacidade/demanda de mão de obra — ver [closeout](../../06_CHANGESETS/PRO-022.closeout.md)
- [x] `PRO-024` — Ativos: sem manutenção preventiva programada (km/horímetro) — ver [closeout](../../06_CHANGESETS/PRO-024.closeout.md)
- [x] `PRO-025` — Lean: lookahead -> compromissos manual; sem repetir semana anterior — ver [NOTA-FIM](../../06_CHANGESETS/PRO-025.NOTA-FIM.md)
- [x] `PRO-029` — Qualidade: sem relatório PDF de inspeção para cliente/auditoria — ver [NOTA-FIM](../../06_CHANGESETS/PRO-029.NOTA-FIM.md)
- [x] `PRO-030` — Central de notificações — matriz em [03_DECISOES/PRO-030](../../03_DECISOES/PRO-030-cobertura-notificacoes.md); `dedupeKey` em `criarNotificacao` + emissores `contrato_vencendo`/`contrato_reajuste`/`nc_pendente`/`preventiva_vencida`
- [x] `UX-002` — Sem pesquisa global de registros (Cmd+K só navega telas) → `06_CHANGESETS/UX-002.NOTA-FIM.md`
- [x] `UX-003` — Rótulos analíticos indistintos na Obra 360 (Desempenho x Previsão x Análise)
- [x] `UX-005` — 22 de 28 botões icon-only sem nome acessível; DnD sem teclado
- [x] `UX-006` — 13 tabelas sem proteção de overflow; telas desktop-only não sinalizadas
- [x] `UX-007` — Riscos e Lições em dois níveis (portfólio x obra) com fonte ambígua
- [x] `DB-006` — Nomenclatura e tipagem de domínio em convenções múltiplas
- [x] `EST-003` — Persistência local sem inventário — [inventário fechado](../../03_DECISOES/EST-003-inventario-persistencia-local.md); 28 chaves catalogadas em `STORAGE_KEYS`, órfã `gestaobra:notif:dedupe` promovida a constante; migração dos legados fica para onda futura
- [x] `PERF-004` — Fontes de terceiro no caminho crítico de render
- [x] `PRO-012` — Suprimentos: sem inventário/contagem cíclica de estoque — ver [NOTA-FIM](../../06_CHANGESETS/PRO-012.NOTA-FIM.md)
- [x] `PRO-017` — Obra: elo BMS aprovado -> NF é manual (sistema não emite NF) → **RECLASSIFICADO / DEFERIDO p/ Onda 8** · `06_CHANGESETS/PRO-017.DEFERIMENTO.md` (débito integral; exige integração fiscal externa + motor de tributos)
- [x] `PRO-021` — Contratos: sem gestão documental (arquivo anexo, assinaturas) — ver [NOTA-FIM](../../06_CHANGESETS/PRO-021.NOTA-FIM.md)
- [x] `PRO-023` — Board: sem mobilização em massa (seleção múltipla) — ver [slice-01](../../06_CHANGESETS/PRO-023.slice-01.md)
- [x] `PRO-026` — Sem reconciliação formal entre plano Lean (pacotes) e cronograma CPM — ver [NOTA-FIM](../../06_CHANGESETS/PRO-026.NOTA-FIM.md) (aceite parcial; slice-03 opcional)
- [x] `PRO-027` — Quadros: sem automações por regra — ver [NOTA-FIM](../../06_CHANGESETS/PRO-027.NOTA-FIM.md)
- [x] `PRO-028` — GM: sem perfis/papéis reutilizáveis (matriz por usuário) — núcleo puro `perfisPermissao.ts` + `usePerfisPermissao` + `PerfisPermissaoDialog` + aplicação em GM
- [x] `PRO-031` — Multiempresa: parametrização por empresa — `empresaParametrizacaoRepo` (logo, numerações, institucional) + `EmpresaParametrizacaoDialog` em `admin/Empresas` + integração RDO/Medição/NF
- [x] `SEC-006` — Chamadas sem timeout/deadline explícito
- [x] `UX-008` — Sem ajuda contextual nas telas analíticas (EVM/SPI/CPI/ES)
- [x] `UX-009` — Sem favoritos/recentes globais
- [x] `UX-010` — Densidade text-xs universal (548 usos) penaliza leitura executiva — KPIs executivos do GM Saúde promovidos a text-sm

### 2. Critérios de saída da onda

- [x] Achados de produto, UX e operação concluídos ou formalmente reclassificados
- [x] Logs estruturados com correlação ponta a ponta — OPS-003 slices 01–03.
- [x] Monitor por fluxo crítico e health check agregado — OPS-004 slice-01 + NOTA-FIM.
- [x] Perfis de ambiente documentados — OPS-005 slices 01–03 + `docs/operacao/ambientes.md`.
- [x] Runbooks publicados — `docs/runbooks/` (7 runbooks) + OPS-007 slice-01.
- [x] Onboarding validado apenas com a documentação — `docs/onboarding.md`.

### 3. Regressão

- [x] Suíte unit completa verde — `bunx vitest run`: **118 arquivos / 906 testes aprovados**.
- [ ] E2E das jornadas críticas verde — ⏸ bloqueado por sessão/ambiente E2E (`06_CHANGESETS/TST-003.E2E-BLOQUEADO.md`); setup já aceita credenciais ou sessão gerenciada injetada.
- [ ] Regressão específica da onda executada ([07](07_Plano_Regressao.md)) — depende do desbloqueio de `TST-003`.
- [ ] Nenhuma jornada crítica vermelha — depende do desbloqueio de `TST-003`.

### 4. Governança

- [x] Todo trabalho referencia um ID do Catálogo.
- [x] Registro de desvios atualizado e revisado — `00_EXECUTIVO/06_WAIVERS.md` + deferimentos PRO-008/010/015/017/026.
- [x] Descobertas de Execução (D-xx) avaliadas — `00_EXECUTIVO/08_DESCOBERTAS.md`.
- [x] Documentação incremental atualizada — entregáveis, plano de regressão e checklist desta onda.
- [x] Sumário de uma página da onda produzido — [`00_Sumario_1_Pagina.md`](00_Sumario_1_Pagina.md).

### 5. Marco

- [ ] Merge na linha principal com CI verde.
- [ ] Tag **M8** aplicada.
- [ ] Release publicada com os IDs concluídos.
- [ ] **Aprovação formal da onda registrada.**

## Conclusão

Todos os 43 achados da Onda 7 estão concluídos ou formalmente reclassificados, e a suíte unitária global está verde. O setup E2E foi preparado para credenciais ou sessão gerenciada injetada, mas a aprovação formal da Onda 7 e o marco **M8** permanecem bloqueados até E2E/jornadas críticas em ambiente válido, validações operacionais e governança final serem concluídos.

## Referências

- [Critérios de Aceite](05_Criterios_Aceite.md) · [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md) · [Checklist Final](../../04_VALIDACAO/Checklist_Final.md)

---

**Navegação:** [← Onda 6](../ONDA_06/README.md) · [Índice de Ondas](../) · —

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
