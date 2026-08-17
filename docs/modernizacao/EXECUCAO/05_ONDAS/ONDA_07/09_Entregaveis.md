# Onda 7 — Entregáveis

## Resumo Executivo

O que fica pronto e verificável ao fim da onda.

## Objetivo

Tornar tangível o resultado da onda.

## Escopo

Entregas técnicas, documentais e de marco.

## Conteúdo

### Entregas

- Produto com lacunas funcionais fechadas
- Observabilidade completa
- Documentação operacional e runbooks
- Sistema pronto para produção/comercialização

### Achados concluídos ou reclassificados

| ID         | Título                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| `PRO-001`  | CRM: motivo de perda não capturado                                           |
| `PRO-003`  | DP: sem fechamento de competência (Fopag exibe, não fecha)                   |
| `PRO-005`  | RDO sem valor documental (sem assinatura, PDF, numeração, trava)             |
| `PRO-006`  | Efetivo do RDO redigitado (não deriva da alocação do Board)                  |
| `PRO-007`  | NC sem workflow ativo (sem responsável/prazo/reinspeção/notificação)         |
| `PRO-009`  | Suprimentos: fluxo cotação vencedora -> OC não conduzido                     |
| `PRO-010`  | Suprimentos: sem comunicação com fornecedor (OC/cotação por PDF/e-mail)      |
| `PRO-018`  | Importador BMS frágil a variações de layout (plano canônico pendente)        |
| `OPS-003`  | Ausência de logging estruturado e correlação entre eventos                   |
| `OPS-004`  | Monitoramento de fluxos e health check consolidado ausentes                  |
| `OPS-005`  | Ambientes sem perfis versionados nem documentação de configuração            |
| `OPS-007`  | Documentação operacional e runbooks inexistentes                             |
| `PRO-002`  | CRM: sem tarefas/agenda de follow-up                                         |
| `PRO-008`  | NC não gera restrição (M4) nem card (M2) automaticamente                     |
| `PRO-015`  | Importação TOTVS manual e periódica (sem agendamento)                        |
| `PRO-016`  | Obra: sem workflow de aprovação de medição                                   |
| `PRO-019`  | Contratos: sem alertas de vencimento/renovação                               |
| `PRO-020`  | Contratos não geram despesa recorrente no Financeiro                         |
| `PRO-022`  | Board: sem visão de capacidade/demanda de mão de obra                        |
| `PRO-024`  | Ativos: sem manutenção preventiva programada (km/horímetro)                  |
| `PRO-025`  | Lean: lookahead -> compromissos manual; sem repetir semana anterior          |
| `PRO-029`  | Qualidade: sem relatório PDF de inspeção para cliente/auditoria              |
| `PRO-030`  | Central de notificações com cobertura mínima de eventos                      |
| `UX-002`   | Sem pesquisa global de registros (Cmd+K só navega telas)                     |
| `UX-003`   | Rótulos analíticos indistintos na Obra 360 (Desempenho x Previsão x Análise) |
| `UX-005`   | 22 de 28 botões icon-only sem nome acessível; DnD sem teclado                |
| `UX-006`   | 13 tabelas sem proteção de overflow; telas desktop-only não sinalizadas      |
| `UX-007`   | Riscos e Lições em dois níveis (portfólio x obra) com fonte ambígua          |
| `DB-006`   | Nomenclatura e tipagem de domínio em convenções múltiplas                    |
| `EST-003`  | Persistência local sem inventário; três prefixos de marca                    |
| `PERF-004` | Fontes de terceiro no caminho crítico de render                              |
| `PRO-012`  | Suprimentos: sem inventário/contagem cíclica de estoque                      |
| `PRO-017`  | Obra: elo BMS aprovado -> NF é manual (sistema não emite NF) — **reclassificado/deferido p/ Onda 8** |
| `PRO-021`  | Contratos: sem gestão documental (arquivo anexo, assinaturas)                |
| `PRO-023`  | Board: sem mobilização em massa (seleção múltipla)                           |
| `PRO-026`  | Sem reconciliação formal entre plano Lean (pacotes) e cronograma CPM         |
| `PRO-027`  | Quadros: sem automações por regra (só lembrete de prazo)                     |
| `PRO-028`  | GM: sem perfis/papéis reutilizáveis (matriz por usuário)                     |
| `PRO-031`  | Multiempresa: sem parametrização por empresa (numerações, logotipos)         |
| `SEC-006`  | Chamadas sem timeout/deadline explícito                                      |
| `UX-008`   | Sem ajuda contextual nas telas analíticas (EVM/SPI/CPI/ES)                   |
| `UX-009`   | Sem favoritos/recentes globais                                               |
| `UX-010`   | Densidade text-xs universal (548 usos) penaliza leitura executiva            |

### Artefatos de governança

- Sumário de uma página da onda (IDs concluídos, desvios, decisões, pendências).
- Registro de desvios atualizado.
- Documentação incremental das convenções produzidas.
- Tag **M8** e release com os IDs nas notas — **pendente até CI/regressão verde**.

## Conclusão

O inventário de achados da Onda 7 está tratado, mas o marco **M8 — Produto e operação prontos para produção** ainda **não** está alcançado: depende de regressão global verde, validação operacional e aprovação formal.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Roadmap](../../../GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md)

---

**Navegação:** [← Onda 6](../ONDA_06/README.md) · [Índice de Ondas](../) · —

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
