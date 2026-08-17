# Onda 7 — Escopo

## Resumo Executivo

Fechar valor funcional e maturidade operacional. Esta onda contém **43 Achados** e tem esforço relativo **Grande**.

## Objetivo

Delimitar com precisão o que entra e o que fica de fora desta onda.

## Escopo

### Dentro do escopo

| ID           | Título                                                                       | Categoria      |
| ------------ | ---------------------------------------------------------------------------- | -------------- |
| **PRO-001**  | CRM: motivo de perda não capturado                                           | Produto        |
| **PRO-003**  | DP: sem fechamento de competência (Fopag exibe, não fecha)                   | Produto        |
| **PRO-005**  | RDO sem valor documental (sem assinatura, PDF, numeração, trava)             | Produto        |
| **PRO-006**  | Efetivo do RDO redigitado (não deriva da alocação do Board)                  | Produto        |
| **PRO-007**  | NC sem workflow ativo (sem responsável/prazo/reinspeção/notificação)         | Produto        |
| **PRO-009**  | Suprimentos: fluxo cotação vencedora -> OC não conduzido                     | Produto        |
| **PRO-010**  | Suprimentos: sem comunicação com fornecedor (OC/cotação por PDF/e-mail)      | Produto        |
| **PRO-018**  | Importador BMS frágil a variações de layout (plano canônico pendente)        | Produto        |
| **OPS-003**  | Ausência de logging estruturado e correlação entre eventos                   | Operação       |
| **OPS-004**  | Monitoramento de fluxos e health check consolidado ausentes                  | Operação       |
| **OPS-005**  | Ambientes sem perfis versionados nem documentação de configuração            | Operação       |
| **OPS-007**  | Documentação operacional e runbooks inexistentes                             | Operação       |
| **PRO-002**  | CRM: sem tarefas/agenda de follow-up                                         | Produto        |
| **PRO-008**  | NC não gera restrição (M4) nem card (M2) automaticamente                     | Produto        |
| **PRO-015**  | Importação TOTVS manual e periódica (sem agendamento)                        | Produto        |
| **PRO-016**  | Obra: sem workflow de aprovação de medição                                   | Produto        |
| **PRO-019**  | Contratos: sem alertas de vencimento/renovação                               | Produto        |
| **PRO-020**  | Contratos não geram despesa recorrente no Financeiro                         | Produto        |
| **PRO-022**  | Board: sem visão de capacidade/demanda de mão de obra                        | Produto        |
| **PRO-024**  | Ativos: sem manutenção preventiva programada (km/horímetro)                  | Produto        |
| **PRO-025**  | Lean: lookahead -> compromissos manual; sem repetir semana anterior          | Produto        |
| **PRO-029**  | Qualidade: sem relatório PDF de inspeção para cliente/auditoria              | Produto        |
| **PRO-030**  | Central de notificações com cobertura mínima de eventos                      | Produto        |
| **UX-002**   | Sem pesquisa global de registros (Cmd+K só navega telas)                     | UX             |
| **UX-003**   | Rótulos analíticos indistintos na Obra 360 (Desempenho x Previsão x Análise) | UX             |
| **UX-005**   | 22 de 28 botões icon-only sem nome acessível; DnD sem teclado                | UX             |
| **UX-006**   | 13 tabelas sem proteção de overflow; telas desktop-only não sinalizadas      | UX             |
| **UX-007**   | Riscos e Lições em dois níveis (portfólio x obra) com fonte ambígua          | UX             |
| **DB-006**   | Nomenclatura e tipagem de domínio em convenções múltiplas                    | Banco de Dados |
| **EST-003**  | Persistência local sem inventário; três prefixos de marca                    | Estado         |
| **PERF-004** | Fontes de terceiro no caminho crítico de render                              | Performance    |
| **PRO-012**  | Suprimentos: sem inventário/contagem cíclica de estoque                      | Produto        |
| **PRO-017**  | Obra: elo BMS aprovado -> NF é manual (sistema não emite NF)                 | Produto        |
| **PRO-021**  | Contratos: sem gestão documental (arquivo anexo, assinaturas)                | Produto        |
| **PRO-023**  | Board: sem mobilização em massa (seleção múltipla)                           | Produto        |
| **PRO-026**  | Sem reconciliação formal entre plano Lean (pacotes) e cronograma CPM         | Produto        |
| **PRO-027**  | Quadros: sem automações por regra (só lembrete de prazo)                     | Produto        |
| **PRO-028**  | GM: sem perfis/papéis reutilizáveis (matriz por usuário)                     | Produto        |
| **PRO-031**  | Multiempresa: sem parametrização por empresa (numerações, logotipos)         | Produto        |
| **SEC-006**  | Chamadas sem timeout/deadline explícito                                      | Segurança      |
| **UX-008**   | Sem ajuda contextual nas telas analíticas (EVM/SPI/CPI/ES)                   | UX             |
| **UX-009**   | Sem favoritos/recentes globais                                               | UX             |
| **UX-010**   | Densidade text-xs universal (548 usos) penaliza leitura executiva            | UX             |

### Fora do escopo

- Qualquer Achado não listado acima.
- Qualquer melhoria descoberta durante a execução (registrar como **Descoberta de Execução D-xx**).
- Alteração de prioridade, diagnóstico ou critério de aceite de qualquer Achado.

### Pré-condição de entrada

Onda 6 aprovada (para itens dependentes). Itens independentes podem ser antecipados.

## Conteúdo

O escopo desta onda foi fixado pela Etapa 14 e validado pelo Stage Gate (Etapa 14.5). Ele é **fechado**: ampliá-lo exige registro de desvio e avaliação ao fim da onda.

## Conclusão

Escopo fechado, 43 Achados, marco **M8**.

## Referências

- [Achados](02_Achados.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 6](../ONDA_06/README.md) · [Índice de Ondas](../) · —

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
