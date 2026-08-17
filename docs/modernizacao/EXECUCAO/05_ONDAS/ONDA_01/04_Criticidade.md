# Onda 1 — Criticidade

## Resumo Executivo

Distribuição da criticidade de negócio: **C1**: 5 · **C2**: 4 · **C3**: 3.

## Objetivo

Indicar onde um erro de execução custa mais caro.

## Escopo

Criticidade de negócio (C0–C3) dos Achados desta onda.

## Conteúdo

### C1 — 5 achado(s)

| ID        | Título                                                                         | Prioridade | Módulo      |
| --------- | ------------------------------------------------------------------------------ | ---------- | ----------- |
| `ARC-001` | Tipagem Supabase desligada (any) sobre tipos gerados defasados                 | P0         | Transversal |
| `ARC-009` | Três sistemas de autorização sem fachada única                                 | P1         | Transversal |
| `DB-003`  | Histórico de migrations não reconstruível e de baixa legibilidade              | P1         | Plataforma  |
| `DB-005`  | Entidades espelhadas entre bancos sem canonicidade declarada                   | P1         | Transversal |
| `QC-001`  | Compilador TypeScript desativado (strict/strictNullChecks/noImplicitAny false) | P1         | Transversal |

### C2 — 4 achado(s)

| ID        | Título                                                                     | Prioridade | Módulo      |
| --------- | -------------------------------------------------------------------------- | ---------- | ----------- |
| `ARC-006` | Inversões de camada: lib/schemas -> ui; component -> page                  | P2         | Transversal |
| `ARC-007` | Gavetas: 35 arquivos soltos em lib/ e 35 em components/                    | P2         | Transversal |
| `QC-002`  | Régua de lint/formatação desligada (no-unused-vars off; sem Prettier)      | P2         | Transversal |
| `TST-003` | Testes com verificação de tipo desligada (@ts-nocheck em cadeias-criticas) | P2         | Transversal |

### C3 — 3 achado(s)

| ID        | Título                                                                 | Prioridade | Módulo      |
| --------- | ---------------------------------------------------------------------- | ---------- | ----------- |
| `ARC-011` | 4 páginas órfãs (Index, Ocorrencias, LicoesAprendidas, Riscos)         | P3         | Transversal |
| `DS-013`  | Peças mortas/presas: ui/form, ui/drawer, ui/chart; EmptyState em obra/ | P3         | Transversal |
| `QC-004`  | Convenções de nomes de arquivo e declaração de tipos mistas            | P3         | Transversal |

### Como usar

- **C0** exige caracterização E2E prévia e rollback ensaiado.
- **C1** exige validação por lote e revisão de regressão.
- **C2/C3** seguem o fluxo normal de CI e revisão.

## Conclusão

Sem Achados C0 nesta onda; risco concentrado em C1.

## Referências

- [Taxonomia](../../../GOVERNANCA/06_REFERENCIA/Taxonomia_Prioridades.md) · [Riscos](08_Riscos.md) · [Plano de Regressão](07_Plano_Regressao.md)

---

**Navegação:** [← Onda 0](../ONDA_00/README.md) · [Índice de Ondas](../) · [Onda 2 →](../ONDA_02/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
