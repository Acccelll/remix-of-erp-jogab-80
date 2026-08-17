# Onda 5 — Criticidade

## Resumo Executivo

Distribuição da criticidade de negócio: **C1**: 4 · **C2**: 2.

## Objetivo

Indicar onde um erro de execução custa mais caro.

## Escopo

Criticidade de negócio (C0–C3) dos Achados desta onda.

## Conteúdo

### C1 — 4 achado(s)

| ID        | Título                                                            | Prioridade | Módulo      |
| --------- | ----------------------------------------------------------------- | ---------- | ----------- |
| `BIZ-003` | Camada de validação de domínio ausente (2 schemas zod no sistema) | P1         | Transversal |
| `DS-001`  | Ausência de arquitetura de formulários (ui/form.tsx morto)        | P1         | Transversal |
| `PRO-011` | Recebimento não gera obrigação financeira (sem three-way match)   | P1         | M7, M8      |
| `PRO-013` | Financeiro: sem conciliação snapshot TOTVS x lançamentos manuais  | P1         | M8          |

### C2 — 2 achado(s)

| ID        | Título                                                        | Prioridade | Módulo |
| --------- | ------------------------------------------------------------- | ---------- | ------ |
| `BIZ-001` | Curva S/EVM duplicada: AnaliseTab recalcula fora de lib/pmbok | P1         | M3     |
| `PRO-014` | Financeiro: sem DRE/DFC gerencial formal por período          | P2         | M8     |

### Como usar

- **C0** exige caracterização E2E prévia e rollback ensaiado.
- **C1** exige validação por lote e revisão de regressão.
- **C2/C3** seguem o fluxo normal de CI e revisão.

## Conclusão

Sem Achados C0 nesta onda; risco concentrado em C1.

## Referências

- [Taxonomia](../../../GOVERNANCA/06_REFERENCIA/Taxonomia_Prioridades.md) · [Riscos](08_Riscos.md) · [Plano de Regressão](07_Plano_Regressao.md)

---

**Navegação:** [← Onda 4](../ONDA_04/README.md) · [Índice de Ondas](../) · [Onda 6 →](../ONDA_06/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
