# Onda 7 — Achados

## Resumo Executivo

Os **43 Achados** desta onda, com todos os campos de classificação. A ficha completa de cada um está na etapa de origem.

## Objetivo

Fornecer a lista executável da onda.

## Escopo

Todos os Achados atribuídos à Onda 7. Nenhum outro.

## Conteúdo

| ID           | Título                                                                       | Prior. | Compl.     | Crit. | Tipo | Estratégia | Dependências     | Módulo      | Origem                                                                            |
| ------------ | ---------------------------------------------------------------------------- | ------ | ---------- | ----- | ---- | ---------- | ---------------- | ----------- | --------------------------------------------------------------------------------- |
| **PRO-001**  | CRM: motivo de perda não capturado                                           | P1     | Baixa      | C1    | NEW  | ISOLADA    | —                | M11         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-003**  | DP: sem fechamento de competência (Fopag exibe, não fecha)                   | P1     | Média      | C1    | NEW  | SEQUENCIAL | —                | M9          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-005**  | RDO sem valor documental (sem assinatura, PDF, numeração, trava)             | P1     | Média      | C1    | NEW  | SEQUENCIAL | —                | M6          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-006**  | Efetivo do RDO redigitado (não deriva da alocação do Board)                  | P1     | Média      | C1    | NEW  | ISOLADA    | —                | M1, M6      | [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)     |
| **PRO-007**  | NC sem workflow ativo (sem responsável/prazo/reinspeção/notificação)         | P1     | Média      | C1    | NEW  | SEQUENCIAL | PRO-030          | M5          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-009**  | Suprimentos: fluxo cotação vencedora -> OC não conduzido                     | P1     | Baixa      | C1    | NEW  | ISOLADA    | —                | M7          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-010**  | Suprimentos: sem comunicação com fornecedor (OC/cotação por PDF/e-mail)      | P1     | Média      | C1    | NEW  | SEQUENCIAL | PRO-009          | M7          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-018**  | Importador BMS frágil a variações de layout (plano canônico pendente)        | P1     | Média      | C1    | REF  | ISOLADA    | —                | M3          | [Etapa 1,2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md)    |
| **OPS-003**  | Ausência de logging estruturado e correlação entre eventos                   | P2     | Média      | C2    | STD  | LOTE       | QC-003, OPS-002  | Plataforma  | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| **OPS-004**  | Monitoramento de fluxos e health check consolidado ausentes                  | P2     | Média      | C2    | NEW  | LOTE       | OPS-002, OPS-003 | Plataforma  | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| **OPS-005**  | Ambientes sem perfis versionados nem documentação de configuração            | P2     | Baixa      | C2    | DOC  | ISOLADA    | SEC-003          | Plataforma  | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| **OPS-007**  | Documentação operacional e runbooks inexistentes                             | P2     | Média      | C1    | DOC  | LOTE       | OPS-001, OPS-006 | Plataforma  | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| **PRO-002**  | CRM: sem tarefas/agenda de follow-up                                         | P2     | Média      | C2    | NEW  | ISOLADA    | —                | M11         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-008**  | NC não gera restrição (M4) nem card (M2) automaticamente                     | P2     | Média      | C2    | NEW  | ISOLADA    | PRO-007          | M2, M4, M5  | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-015**  | Importação TOTVS manual e periódica (sem agendamento)                        | P2     | Média      | C2    | NEW  | ISOLADA    | —                | M8          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-016**  | Obra: sem workflow de aprovação de medição                                   | P2     | Média      | C2    | NEW  | ISOLADA    | —                | M3          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-019**  | Contratos: sem alertas de vencimento/renovação                               | P2     | Baixa      | C2    | NEW  | ISOLADA    | PRO-030          | M12         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-020**  | Contratos não geram despesa recorrente no Financeiro                         | P2     | Média      | C2    | NEW  | ISOLADA    | —                | M8, M12     | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-022**  | Board: sem visão de capacidade/demanda de mão de obra                        | P2     | Alta       | C2    | NEW  | SEQUENCIAL | —                | M1          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-024**  | Ativos: sem manutenção preventiva programada (km/horímetro)                  | P2     | Média      | C2    | NEW  | ISOLADA    | —                | M13         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-025**  | Lean: lookahead -> compromissos manual; sem repetir semana anterior          | P2     | Média      | C2    | NEW  | ISOLADA    | —                | M4          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-029**  | Qualidade: sem relatório PDF de inspeção para cliente/auditoria              | P2     | Baixa      | C2    | NEW  | ISOLADA    | —                | M5          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-030**  | Central de notificações com cobertura mínima de eventos                      | P2     | Média      | C2    | NEW  | SEQUENCIAL | —                | Transversal | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **UX-002**   | Sem pesquisa global de registros (Cmd+K só navega telas)                     | P2     | Alta       | C2    | NEW  | SEQUENCIAL | ARC-001          | Transversal | [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)     |
| **UX-003**   | Rótulos analíticos indistintos na Obra 360 (Desempenho x Previsão x Análise) | P2     | Baixa      | C2    | MOD  | ISOLADA    | —                | M3          | [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)     |
| **UX-005**   | 22 de 28 botões icon-only sem nome acessível; DnD sem teclado                | P2     | Média      | C2    | STD  | LOTE       | DS-001           | Transversal | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |
| **UX-006**   | 13 tabelas sem proteção de overflow; telas desktop-only não sinalizadas      | P2     | Média      | C2    | MOD  | LOTE       | DS-009           | Transversal | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |
| **UX-007**   | Riscos e Lições em dois níveis (portfólio x obra) com fonte ambígua          | P2     | Média      | C2    | MOD  | ISOLADA    | —                | M3, M4      | [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)     |
| **DB-006**   | Nomenclatura e tipagem de domínio em convenções múltiplas                    | P3     | Baixa      | C3    | STD  | ISOLADA    | —                | Plataforma  | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)         |
| **EST-003**  | Persistência local sem inventário; três prefixos de marca                    | P3     | Baixa      | C3    | STD  | ISOLADA    | —                | Transversal | [Etapa 7](../../../GOVERNANCA/01_AUDITORIA/ETAPA_07_ESTADO_FLUXO_DADOS.md)        |
| **PERF-004** | Fontes de terceiro no caminho crítico de render                              | P3     | Baixa      | C3    | STD  | ISOLADA    | —                | Plataforma  | [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md)              |
| **PRO-012**  | Suprimentos: sem inventário/contagem cíclica de estoque                      | P3     | Média      | C3    | NEW  | ISOLADA    | —                | M7          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-017**  | Obra: elo BMS aprovado -> NF é manual (sistema não emite NF)                 | P3     | Muito Alta | C2    | NEW  | MIGRAÇÃO   | —                | M3          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-021**  | Contratos: sem gestão documental (arquivo anexo, assinaturas)                | P3     | Baixa      | C3    | NEW  | ISOLADA    | —                | M12         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-023**  | Board: sem mobilização em massa (seleção múltipla)                           | P3     | Baixa      | C3    | NEW  | ISOLADA    | —                | M1          | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |
| **PRO-026**  | Sem reconciliação formal entre plano Lean (pacotes) e cronograma CPM         | P3     | Alta       | C3    | NEW  | SEQUENCIAL | —                | M3, M4      | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-027**  | Quadros: sem automações por regra (só lembrete de prazo)                     | P3     | Alta       | C3    | NEW  | ISOLADA    | —                | M2          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-028**  | GM: sem perfis/papéis reutilizáveis (matriz por usuário)                     | P3     | Média      | C3    | NEW  | SEQUENCIAL | ARC-009          | M14         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **PRO-031**  | Multiempresa: sem parametrização por empresa (numerações, logotipos)         | P3     | Média      | C3    | NEW  | ISOLADA    | UX-004           | M15         | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)       |
| **SEC-006**  | Chamadas sem timeout/deadline explícito                                      | P3     | Baixa      | C3    | STD  | LOTE       | QC-003           | Transversal | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)                |
| **UX-008**   | Sem ajuda contextual nas telas analíticas (EVM/SPI/CPI/ES)                   | P3     | Média      | C3    | NEW  | ISOLADA    | —                | M3, M4      | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |
| **UX-009**   | Sem favoritos/recentes globais                                               | P3     | Média      | C3    | NEW  | ISOLADA    | —                | Transversal | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |
| **UX-010**   | Densidade text-xs universal (548 usos) penaliza leitura executiva            | P3     | Baixa      | C3    | STD  | ISOLADA    | —                | Transversal | [Etapa 3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)              |

### Onde encontrar a ficha completa

Cada Achado tem, em sua **etapa de origem**, a ficha com: Evidências, Diagnóstico, Impacto, Objetivo Arquitetural, Áreas Impactadas, Risco de Regressão, Validação Recomendada e **Critérios de Aceite**. A coluna _Origem_ acima leva diretamente ao documento.

## Conclusão

Executar exclusivamente estes 43 IDs, respeitando a ordem do [Plano de Execução](06_Plano_Execucao.md).

## Referências

- [Catálogo Mestre](../../02_CATALOGO/Catalogo_Mestre.md) · [Critérios de Aceite](05_Criterios_Aceite.md) · [Dependências](03_Dependencias.md)

---

**Navegação:** [← Onda 6](../ONDA_06/README.md) · [Índice de Ondas](../) · —

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
