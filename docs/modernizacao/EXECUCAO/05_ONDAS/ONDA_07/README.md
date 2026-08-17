# Onda 7 — Produto, UX e Operação Plena

## Resumo Executivo

**Objetivo:** Fechar valor funcional e maturidade operacional.
**Achados:** 43 · **Esforço relativo:** Grande · **Marco de conclusão:** **M8 — Produto e operação prontos para produção**
**Prioridades nesta onda:** P1: 8 · P2: 20 · P3: 15

## Objetivo

Fechar valor funcional e maturidade operacional.

## Escopo

Esta onda entrega os 43 Achados listados em [02_Achados.md](02_Achados.md). Nenhum deles depende de item em onda posterior.

**Incorporações via waiver [W-001](../../00_EXECUTIVO/06_WAIVERS.md):**

- `OPS-002.b` — criar projeto Sentry, provisionar `VITE_SENTRY_DSN` (+ `VITE_APP_RELEASE` opcional) e validar evento de teste no dashboard.
- `OPS-006.b` — instalar timer/cron no host MySQL, executar primeiro restore de teste (registro em `04_VALIDACAO/restore-log.md`) e ativar cópia off-host.

## Conteúdo

### Documentos desta onda

| #   | Documento                                           | Uso                           |
| --- | --------------------------------------------------- | ----------------------------- |
| 01  | [Escopo](01_Escopo.md)                              | O que entra e o que não entra |
| 02  | [Achados](02_Achados.md)                            | A lista executável            |
| 03  | [Dependências](03_Dependencias.md)                  | O que precede o quê           |
| 04  | [Criticidade](04_Criticidade.md)                    | Onde errar custa caro         |
| 05  | [Critérios de Aceite](05_Criterios_Aceite.md)       | Como saber que terminou       |
| 06  | [Plano de Execução](06_Plano_Execucao.md)           | Em que ordem executar         |
| 07  | [Plano de Regressão](07_Plano_Regressao.md)         | O que reexecutar depois       |
| 08  | [Riscos](08_Riscos.md)                              | O que pode dar errado         |
| 09  | [Entregáveis](09_Entregaveis.md)                    | O que fica pronto             |
| 10  | [Checklist de Conclusão](10_Checklist_Conclusao.md) | O gate de saída               |

### Entrada obrigatória

Onda 6 aprovada (para itens dependentes). Itens independentes podem ser antecipados.

### Quick Wins nesta onda

| ID       | Título                                                                       |
| -------- | ---------------------------------------------------------------------------- |
| PRO-001  | CRM: motivo de perda não capturado                                           |
| PRO-009  | Suprimentos: fluxo cotação vencedora -> OC não conduzido                     |
| PRO-018  | Importador BMS frágil a variações de layout (plano canônico pendente)        |
| PRO-019  | Contratos: sem alertas de vencimento/renovação                               |
| PRO-029  | Qualidade: sem relatório PDF de inspeção para cliente/auditoria              |
| UX-003   | Rótulos analíticos indistintos na Obra 360 (Desempenho x Previsão x Análise) |
| PERF-004 | Fontes de terceiro no caminho crítico de render                              |
| PRO-023  | Board: sem mobilização em massa (seleção múltipla)                           |

## Conclusão

A onda encerra ao satisfazer o [Checklist de Conclusão](10_Checklist_Conclusao.md) e tagear o marco **M8**.

## Referências

- [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md) · [Catálogo Mestre](../../02_CATALOGO/Catalogo_Mestre.md)

---

**Navegação:** [← Onda 6](../ONDA_06/README.md) · [Índice de Ondas](../) · —

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
