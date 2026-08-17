# Onda 4 — Criticidade

## Resumo Executivo

Distribuição da criticidade de negócio: **C1**: 3 · **C2**: 11 · **C3**: 2.

## Objetivo

Indicar onde um erro de execução custa mais caro.

## Escopo

Criticidade de negócio (C0–C3) dos Achados desta onda.

## Conteúdo

### C1 — 3 achado(s)

| ID       | Título                                                                  | Prioridade | Módulo      |
| -------- | ----------------------------------------------------------------------- | ---------- | ----------- |
| `DS-006` | Moeda sem fonte única (BRL inline em 32 páginas; money x currency)      | P1         | Transversal |
| `QC-003` | Tratamento de erros sem política única (4 destinos; 15 catch vazios)    | P1         | Transversal |
| `UX-001` | Telas sem porta (Suprimentos estruturante) e configurações fragmentadas | P1         | M7          |

### C2 — 11 achado(s)

| ID         | Título                                                                | Prioridade | Módulo         |
| ---------- | --------------------------------------------------------------------- | ---------- | -------------- |
| `DS-002`   | Dois sistemas de toast (sonner x84 / use-toast x9)                    | P1         | Transversal    |
| `DS-010`   | Paginação inexistente como padrão (primitivo pronto, 2 usos)          | P1         | M2, M3, M8     |
| `PERF-002` | Consultas de lista sem limite e sem projeção (24 select(*), 31 limit) | P1         | M2, M3, M8, M9 |
| `BIZ-004`  | Datas sem módulo central (48 arquivos formatam inline)                | P2         | Transversal    |
| `DS-003`   | window.confirm nativo em 5 telas                                      | P2         | Transversal    |
| `DS-004`   | Subadoção de QueryState/EmptyState (spinner manual em 31 páginas)     | P2         | Transversal    |
| `DS-005`   | Mapas status->rótulo/cor duplicados em 15 arquivos                    | P2         | Transversal    |
| `DS-007`   | KPI/StatCard reimplementado por dashboard                             | P2         | Transversal    |
| `DS-008`   | Recharts cru em 24 arquivos; ui/chart.tsx com 0 usos                  | P2         | Transversal    |
| `DS-009`   | 24 de 28 telas com tabela crua fora de ui/data-table                  | P2         | Transversal    |
| `DS-014`   | Biblioteca sem catálogo/documentação                                  | P2         | Transversal    |

### C3 — 2 achado(s)

| ID       | Título                                                        | Prioridade | Módulo      |
| -------- | ------------------------------------------------------------- | ---------- | ----------- |
| `DS-012` | 8 diálogos de importação repetindo a mesma casca              | P3         | Transversal |
| `DS-015` | Sem escala de tamanhos de Dialog; sem barra de filtros padrão | P3         | Transversal |

### Como usar

- **C0** exige caracterização E2E prévia e rollback ensaiado.
- **C1** exige validação por lote e revisão de regressão.
- **C2/C3** seguem o fluxo normal de CI e revisão.

## Conclusão

Sem Achados C0 nesta onda; risco concentrado em C1.

## Referências

- [Taxonomia](../../../GOVERNANCA/06_REFERENCIA/Taxonomia_Prioridades.md) · [Riscos](08_Riscos.md) · [Plano de Regressão](07_Plano_Regressao.md)

---

**Navegação:** [← Onda 3](../ONDA_03/README.md) · [Índice de Ondas](../) · [Onda 5 →](../ONDA_05/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
