# Onda 6 — Criticidade

## Resumo Executivo

Distribuição da criticidade de negócio: **C1**: 5 · **C2**: 3.

## Objetivo

Indicar onde um erro de execução custa mais caro.

## Escopo

Criticidade de negócio (C0–C3) dos Achados desta onda.

## Conteúdo

### C1 — 5 achado(s)

| ID         | Título                                                                      | Prioridade | Módulo      |
| ---------- | --------------------------------------------------------------------------- | ---------- | ----------- |
| `ARC-002`  | God-context AppContext (730L, 63 membros, 86 consumidores)                  | P1         | Transversal |
| `ARC-004`  | Duas máquinas de estado servidor (imperativa PHP x TanStack Query)          | P1         | Transversal |
| `ARC-005`  | Monólitos página/diálogo (10 arquivos de 700 a 2.104 linhas)                | P1         | M2, M3      |
| `PERF-001` | Chunks-gigante: entry 789kB, CardGenericoDialog 791kB, FinObraDetalhe 674kB | P1         | M2, M3      |
| `PRO-004`  | DP: dualidade legado/novo (provisões, HE, histórico, fopag em 2 bancos)     | P1         | M9          |

### C2 — 3 achado(s)

| ID         | Título                                                      | Prioridade | Módulo          |
| ---------- | ----------------------------------------------------------- | ---------- | --------------- |
| `PERF-003` | Granularidade de render inexistente (React.memo usado 2x)   | P2         | M1, M2, M7, M11 |
| `DS-011`   | 6 implementações independentes de Kanban                    | P3         | M1, M2, M7, M11 |
| `DS-016`   | 31 diálogos de domínio autofetchantes (UI acoplada a dados) | P3         | Transversal     |

### Como usar

- **C0** exige caracterização E2E prévia e rollback ensaiado.
- **C1** exige validação por lote e revisão de regressão.
- **C2/C3** seguem o fluxo normal de CI e revisão.

## Conclusão

Sem Achados C0 nesta onda; risco concentrado em C1.

## Referências

- [Taxonomia](../../../GOVERNANCA/06_REFERENCIA/Taxonomia_Prioridades.md) · [Riscos](08_Riscos.md) · [Plano de Regressão](07_Plano_Regressao.md)

---

**Navegação:** [← Onda 5](../ONDA_05/README.md) · [Índice de Ondas](../) · [Onda 7 →](../ONDA_07/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
