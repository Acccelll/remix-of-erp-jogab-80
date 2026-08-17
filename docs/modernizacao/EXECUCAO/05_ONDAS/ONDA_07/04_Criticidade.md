# Onda 7 — Criticidade

## Resumo Executivo

Distribuição da criticidade de negócio: **C1**: 9 · **C2**: 20 · **C3**: 14.

## Objetivo

Indicar onde um erro de execução custa mais caro.

## Escopo

Criticidade de negócio (C0–C3) dos Achados desta onda.

## Conteúdo

### C1 — 9 achado(s)

| ID        | Título                                                                  | Prioridade | Módulo     |
| --------- | ----------------------------------------------------------------------- | ---------- | ---------- |
| `PRO-001` | CRM: motivo de perda não capturado                                      | P1         | M11        |
| `PRO-003` | DP: sem fechamento de competência (Fopag exibe, não fecha)              | P1         | M9         |
| `PRO-005` | RDO sem valor documental (sem assinatura, PDF, numeração, trava)        | P1         | M6         |
| `PRO-006` | Efetivo do RDO redigitado (não deriva da alocação do Board)             | P1         | M1, M6     |
| `PRO-007` | NC sem workflow ativo (sem responsável/prazo/reinspeção/notificação)    | P1         | M5         |
| `PRO-009` | Suprimentos: fluxo cotação vencedora -> OC não conduzido                | P1         | M7         |
| `PRO-010` | Suprimentos: sem comunicação com fornecedor (OC/cotação por PDF/e-mail) | P1         | M7         |
| `PRO-018` | Importador BMS frágil a variações de layout (plano canônico pendente)   | P1         | M3         |
| `OPS-007` | Documentação operacional e runbooks inexistentes                        | P2         | Plataforma |

### C2 — 20 achado(s)

| ID        | Título                                                                       | Prioridade | Módulo      |
| --------- | ---------------------------------------------------------------------------- | ---------- | ----------- |
| `OPS-003` | Ausência de logging estruturado e correlação entre eventos                   | P2         | Plataforma  |
| `OPS-004` | Monitoramento de fluxos e health check consolidado ausentes                  | P2         | Plataforma  |
| `OPS-005` | Ambientes sem perfis versionados nem documentação de configuração            | P2         | Plataforma  |
| `PRO-002` | CRM: sem tarefas/agenda de follow-up                                         | P2         | M11         |
| `PRO-008` | NC não gera restrição (M4) nem card (M2) automaticamente                     | P2         | M2, M4, M5  |
| `PRO-015` | Importação TOTVS manual e periódica (sem agendamento)                        | P2         | M8          |
| `PRO-016` | Obra: sem workflow de aprovação de medição                                   | P2         | M3          |
| `PRO-019` | Contratos: sem alertas de vencimento/renovação                               | P2         | M12         |
| `PRO-020` | Contratos não geram despesa recorrente no Financeiro                         | P2         | M8, M12     |
| `PRO-022` | Board: sem visão de capacidade/demanda de mão de obra                        | P2         | M1          |
| `PRO-024` | Ativos: sem manutenção preventiva programada (km/horímetro)                  | P2         | M13         |
| `PRO-025` | Lean: lookahead -> compromissos manual; sem repetir semana anterior          | P2         | M4          |
| `PRO-029` | Qualidade: sem relatório PDF de inspeção para cliente/auditoria              | P2         | M5          |
| `PRO-030` | Central de notificações com cobertura mínima de eventos                      | P2         | Transversal |
| `UX-002`  | Sem pesquisa global de registros (Cmd+K só navega telas)                     | P2         | Transversal |
| `UX-003`  | Rótulos analíticos indistintos na Obra 360 (Desempenho x Previsão x Análise) | P2         | M3          |
| `UX-005`  | 22 de 28 botões icon-only sem nome acessível; DnD sem teclado                | P2         | Transversal |
| `UX-006`  | 13 tabelas sem proteção de overflow; telas desktop-only não sinalizadas      | P2         | Transversal |
| `UX-007`  | Riscos e Lições em dois níveis (portfólio x obra) com fonte ambígua          | P2         | M3, M4      |
| `PRO-017` | Obra: elo BMS aprovado -> NF é manual (sistema não emite NF)                 | P3         | M3          |

### C3 — 14 achado(s)

| ID         | Título                                                               | Prioridade | Módulo      |
| ---------- | -------------------------------------------------------------------- | ---------- | ----------- |
| `DB-006`   | Nomenclatura e tipagem de domínio em convenções múltiplas            | P3         | Plataforma  |
| `EST-003`  | Persistência local sem inventário; três prefixos de marca            | P3         | Transversal |
| `PERF-004` | Fontes de terceiro no caminho crítico de render                      | P3         | Plataforma  |
| `PRO-012`  | Suprimentos: sem inventário/contagem cíclica de estoque              | P3         | M7          |
| `PRO-021`  | Contratos: sem gestão documental (arquivo anexo, assinaturas)        | P3         | M12         |
| `PRO-023`  | Board: sem mobilização em massa (seleção múltipla)                   | P3         | M1          |
| `PRO-026`  | Sem reconciliação formal entre plano Lean (pacotes) e cronograma CPM | P3         | M3, M4      |
| `PRO-027`  | Quadros: sem automações por regra (só lembrete de prazo)             | P3         | M2          |
| `PRO-028`  | GM: sem perfis/papéis reutilizáveis (matriz por usuário)             | P3         | M14         |
| `PRO-031`  | Multiempresa: sem parametrização por empresa (numerações, logotipos) | P3         | M15         |
| `SEC-006`  | Chamadas sem timeout/deadline explícito                              | P3         | Transversal |
| `UX-008`   | Sem ajuda contextual nas telas analíticas (EVM/SPI/CPI/ES)           | P3         | M3, M4      |
| `UX-009`   | Sem favoritos/recentes globais                                       | P3         | Transversal |
| `UX-010`   | Densidade text-xs universal (548 usos) penaliza leitura executiva    | P3         | Transversal |

### Como usar

- **C0** exige caracterização E2E prévia e rollback ensaiado.
- **C1** exige validação por lote e revisão de regressão.
- **C2/C3** seguem o fluxo normal de CI e revisão.

## Conclusão

Sem Achados C0 nesta onda; risco concentrado em C1.

## Referências

- [Taxonomia](../../../GOVERNANCA/06_REFERENCIA/Taxonomia_Prioridades.md) · [Riscos](08_Riscos.md) · [Plano de Regressão](07_Plano_Regressao.md)

---

**Navegação:** [← Onda 6](../ONDA_06/README.md) · [Índice de Ondas](../) · —

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
