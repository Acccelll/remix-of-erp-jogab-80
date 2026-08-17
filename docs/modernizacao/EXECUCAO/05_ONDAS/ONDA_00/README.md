# Onda 0 — Contenção

## Resumo Executivo

**Objetivo:** Parar a exposição e ligar as luzes antes de tocar arquitetura.
**Achados:** 8 · **Esforço relativo:** Pequena · **Marco de conclusão:** **M1 — Exposição contida**
**Prioridades nesta onda:** P0: 1 · P1: 6 · P2: 1

## Objetivo

Parar a exposição e ligar as luzes antes de tocar arquitetura.

## Escopo

Esta onda entrega os 8 Achados listados em [02_Achados.md](02_Achados.md). Nenhum deles depende de item em onda posterior.

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

Nenhuma.

### Waiver aplicado

[W-001](../../00_EXECUTIVO/06_WAIVERS.md) cinde `OPS-002` e `OPS-006` em `.a` (código, escopo M1) e `.b` (execução operacional, movidos para Onda 7/M8).

### Quick Wins nesta onda

| ID        | Título                                                                   |
| --------- | ------------------------------------------------------------------------ |
| SEC-003   | Segredos versionáveis (senha MySQL no código) e CORS com fallback aberto |
| EST-002   | Escopo multiempresa não flui para os dados (filtro não filtra)           |
| OPS-001.a | Esqueleto de CI (install+build+test)                                     |
| OPS-002.a | Sentry instalado e inicializado (NO-OP sem DSN)                          |
| OPS-006.a | Scripts backup/restore MySQL + runbook                                   |
| TST-004   | Baseline de cobertura                                                    |

## Conclusão

A onda encerra ao satisfazer o [Checklist de Conclusão](10_Checklist_Conclusao.md) e tagear o marco **M1**.

## Referências

- [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md) · [Catálogo Mestre](../../02_CATALOGO/Catalogo_Mestre.md)

---

**Navegação:** — · [Índice de Ondas](../) · [Onda 1 →](../ONDA_01/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
