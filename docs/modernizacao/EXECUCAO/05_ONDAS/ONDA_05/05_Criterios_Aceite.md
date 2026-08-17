# Onda 5 — Critérios de Aceite

## Resumo Executivo

Uma onda só é aceita quando **todos** os critérios de saída abaixo são satisfeitos e **cada** Achado cumpre os critérios de sua ficha original.

## Objetivo

Tornar a conclusão da onda verificável, não opinativa.

## Escopo

Critérios de saída da onda e critérios globais aplicáveis a cada Achado.

## Conteúdo

### Critérios de saída da Onda 5

- [ ] Contrato de validação único (tela = importador) nas 5 entidades mais editadas
- [ ] Curva/EVM com fonte única; `AnaliseTab` sem cálculo próprio
- [ ] Conciliação TOTVS × lançamentos fechando período
- [ ] Recebimento de material gerando obrigação financeira rastreável à OC
- [ ] DRE gerencial por período disponível

### Critérios globais (todo Achado desta onda)

- [ ] Referencia um **ID** do Catálogo Mestre.
- [ ] Satisfaz **integralmente** os Critérios de Aceite da ficha original ([Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md), [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md), [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md)).
- [ ] **CI verde** (install + build + test + lint + typecheck).
- [ ] Suíte existente sem regressão (baseline: 421 testes verdes).
- [ ] Nenhuma alteração de comportamento não prevista na ficha.
- [ ] Documentação incremental atualizada.

### Achados e suas fichas

| ID        | Título                                                            | Ficha completa em                                                           |
| --------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `BIZ-001` | Curva S/EVM duplicada: AnaliseTab recalcula fora de lib/pmbok     | [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md)      |
| `BIZ-003` | Camada de validação de domínio ausente (2 schemas zod no sistema) | [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md)      |
| `DS-001`  | Ausência de arquitetura de formulários (ui/form.tsx morto)        | [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)      |
| `PRO-011` | Recebimento não gera obrigação financeira (sem three-way match)   | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md) |
| `PRO-013` | Financeiro: sem conciliação snapshot TOTVS x lançamentos manuais  | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md) |
| `PRO-014` | Financeiro: sem DRE/DFC gerencial formal por período              | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md) |

## Conclusão

Sem os critérios de saída, a onda não é aprovada e a seguinte não inicia.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 4](../ONDA_04/README.md) · [Índice de Ondas](../) · [Onda 6 →](../ONDA_06/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
