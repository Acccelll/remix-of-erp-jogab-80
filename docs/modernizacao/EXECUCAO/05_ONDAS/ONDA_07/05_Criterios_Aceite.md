# Onda 7 — Critérios de Aceite

## Resumo Executivo

Uma onda só é aceita quando **todos** os critérios de saída abaixo são satisfeitos e **cada** Achado cumpre os critérios de sua ficha original.

## Objetivo

Tornar a conclusão da onda verificável, não opinativa.

## Escopo

Critérios de saída da onda e critérios globais aplicáveis a cada Achado.

## Conteúdo

### Critérios de saída da Onda 7

- [ ] Achados de produto, UX e operação concluídos ou formalmente reclassificados
- [ ] Logs estruturados com correlação ponta a ponta
- [ ] Monitor por fluxo crítico e health check agregado
- [ ] Perfis de ambiente documentados
- [ ] Runbooks publicados
- [ ] Onboarding validado apenas com a documentação

### Critérios globais (todo Achado desta onda)

- [ ] Referencia um **ID** do Catálogo Mestre.
- [ ] Satisfaz **integralmente** os Critérios de Aceite da ficha original ([Etapa 1,2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md), [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md), [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md), [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md), [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md), [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md), [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md), [Etapa 7](../../../GOVERNANCA/01_AUDITORIA/ETAPA_07_ESTADO_FLUXO_DADOS.md), [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)).
- [ ] **CI verde** (install + build + test + lint + typecheck).
- [ ] Suíte existente sem regressão (baseline: 421 testes verdes).
- [ ] Nenhuma alteração de comportamento não prevista na ficha.
- [ ] Documentação incremental atualizada.

### Achados e suas fichas

| ID         | Título                                                                       | Ficha completa em                                                                 |
| ---------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `PRO-001`  | CRM: motivo de perda não capturado                                           | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-003`  | DP: sem fechamento de competência (Fopag exibe, não fecha)                   | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-005`  | RDO sem valor documental (sem assinatura, PDF, numeração, trava)             | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-006`  | Efetivo do RDO redigitado (não deriva da alocação do Board)                  | [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)     |
| `PRO-007`  | NC sem workflow ativo (sem responsável/prazo/reinspeção/notificação)         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-009`  | Suprimentos: fluxo cotação vencedora -> OC não conduzido                     | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-010`  | Suprimentos: sem comunicação com fornecedor (OC/cotação por PDF/e-mail)      | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-018`  | Importador BMS frágil a variações de layout (plano canônico pendente)        | [Etapa 1,2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md)    |
| `OPS-003`  | Ausência de logging estruturado e correlação entre eventos                   | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| `OPS-004`  | Monitoramento de fluxos e health check consolidado ausentes                  | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| `OPS-005`  | Ambientes sem perfis versionados nem documentação de configuração            | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| `OPS-007`  | Documentação operacional e runbooks inexistentes                             | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| `PRO-002`  | CRM: sem tarefas/agenda de follow-up                                         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-008`  | NC não gera restrição (M4) nem card (M2) automaticamente                     | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-015`  | Importação TOTVS manual e periódica (sem agendamento)                        | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-016`  | Obra: sem workflow de aprovação de medição                                   | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-019`  | Contratos: sem alertas de vencimento/renovação                               | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-020`  | Contratos não geram despesa recorrente no Financeiro                         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-022`  | Board: sem visão de capacidade/demanda de mão de obra                        | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-024`  | Ativos: sem manutenção preventiva programada (km/horímetro)                  | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-025`  | Lean: lookahead -> compromissos manual; sem repetir semana anterior          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-029`  | Qualidade: sem relatório PDF de inspeção para cliente/auditoria              | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-030`  | Central de notificações com cobertura mínima de eventos                      | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `UX-002`   | Sem pesquisa global de registros (Cmd+K só navega telas)                     | [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)     |
| `UX-003`   | Rótulos analíticos indistintos na Obra 360 (Desempenho x Previsão x Análise) | [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)     |
| `UX-005`   | 22 de 28 botões icon-only sem nome acessível; DnD sem teclado                | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |
| `UX-006`   | 13 tabelas sem proteção de overflow; telas desktop-only não sinalizadas      | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |
| `UX-007`   | Riscos e Lições em dois níveis (portfólio x obra) com fonte ambígua          | [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)     |
| `DB-006`   | Nomenclatura e tipagem de domínio em convenções múltiplas                    | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)         |
| `EST-003`  | Persistência local sem inventário; três prefixos de marca                    | [Etapa 7](../../../GOVERNANCA/01_AUDITORIA/ETAPA_07_ESTADO_FLUXO_DADOS.md)        |
| `PERF-004` | Fontes de terceiro no caminho crítico de render                              | [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md)              |
| `PRO-012`  | Suprimentos: sem inventário/contagem cíclica de estoque                      | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-017`  | Obra: elo BMS aprovado -> NF é manual (sistema não emite NF)                 | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-021`  | Contratos: sem gestão documental (arquivo anexo, assinaturas)                | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-023`  | Board: sem mobilização em massa (seleção múltipla)                           | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |
| `PRO-026`  | Sem reconciliação formal entre plano Lean (pacotes) e cronograma CPM         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-027`  | Quadros: sem automações por regra (só lembrete de prazo)                     | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-028`  | GM: sem perfis/papéis reutilizáveis (matriz por usuário)                     | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `PRO-031`  | Multiempresa: sem parametrização por empresa (numerações, logotipos)         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| `SEC-006`  | Chamadas sem timeout/deadline explícito                                      | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)                |
| `UX-008`   | Sem ajuda contextual nas telas analíticas (EVM/SPI/CPI/ES)                   | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |
| `UX-009`   | Sem favoritos/recentes globais                                               | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |
| `UX-010`   | Densidade text-xs universal (548 usos) penaliza leitura executiva            | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |

## Conclusão

Sem os critérios de saída, a onda não é aprovada e a seguinte não inicia.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 6](../ONDA_06/README.md) · [Índice de Ondas](../) · —

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
