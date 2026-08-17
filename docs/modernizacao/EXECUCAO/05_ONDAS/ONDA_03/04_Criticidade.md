# Onda 3 — Criticidade

## Resumo Executivo

Distribuição da criticidade de negócio: **C1**: 5 · **C2**: 2 · **C3**: 1.

## Objetivo

Indicar onde um erro de execução custa mais caro.

## Escopo

Criticidade de negócio (C0–C3) dos Achados desta onda.

## Conteúdo

### C1 — 5 achado(s)

| ID        | Título                                                             | Prioridade | Módulo           |
| --------- | ------------------------------------------------------------------ | ---------- | ---------------- |
| `ARC-003` | Bypass da camada de repositories (35 páginas com from() direto)    | P1         | Transversal      |
| `BIZ-002` | Lib bimodal pura x impura sem convenção (19 arquivos com I/O)      | P1         | Transversal      |
| `DB-001`  | Fronteira PHP x Supabase sem integridade referencial (ids em text) | P1         | M1, M9, M13      |
| `EST-001` | Otimismo sem rollback nos domínios PHP (falha silenciosa)          | P1         | M1, M9, M10, M13 |
| `TST-002` | Fronteira de backend e camada de dados sem testes de integração    | P1         | Transversal      |

### C2 — 2 achado(s)

| ID        | Título                                                                   | Prioridade | Módulo      |
| --------- | ------------------------------------------------------------------------ | ---------- | ----------- |
| `ARC-008` | Query keys ad-hoc sem registro/fábrica (171 invalidações em 46 arquivos) | P2         | Transversal |
| `DB-004`  | Trilho MySQL de aplicação manual sem registro de estado                  | P2         | Plataforma  |

### C3 — 1 achado(s)

| ID        | Título                                                    | Prioridade | Módulo      |
| --------- | --------------------------------------------------------- | ---------- | ----------- |
| `ARC-010` | services/ vestigial; dpHoleriteRepo fora de repositories/ | P3         | Transversal |

### Como usar

- **C0** exige caracterização E2E prévia e rollback ensaiado.
- **C1** exige validação por lote e revisão de regressão.
- **C2/C3** seguem o fluxo normal de CI e revisão.

## Conclusão

Sem Achados C0 nesta onda; risco concentrado em C1.

## Referências

- [Taxonomia](../../../GOVERNANCA/06_REFERENCIA/Taxonomia_Prioridades.md) · [Riscos](08_Riscos.md) · [Plano de Regressão](07_Plano_Regressao.md)

---

**Navegação:** [← Onda 2](../ONDA_02/README.md) · [Índice de Ondas](../) · [Onda 4 →](../ONDA_04/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
