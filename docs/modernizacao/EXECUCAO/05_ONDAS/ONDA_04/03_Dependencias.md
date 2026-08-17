# Onda 4 — Dependências

## Resumo Executivo

10 dos 16 Achados desta onda não têm dependência alguma e podem iniciar imediatamente e em paralelo. **Nenhum Achado desta onda depende de item em onda posterior** — verificado por validação automática do grafo.

## Objetivo

Estabelecer a ordem interna e as pré-condições externas.

## Escopo

Dependências internas (dentro da onda) e externas (de ondas anteriores).

## Conteúdo

### Sem dependência — iniciam já, em paralelo

`DS-002`, `DS-006`, `UX-001`, `BIZ-004`, `DS-003`, `DS-005`, `DS-007`, `DS-014`, `DS-012`, `DS-015`

### Dependências internas (respeitar ordem dentro da onda)

| Achado     | Depende de |
| ---------- | ---------- |
| `PERF-002` | `DS-010`   |
| `QC-003`   | `DS-002`   |
| `DS-004`   | `DS-002`   |
| `DS-008`   | `DS-007`   |
| `DS-009`   | `DS-004`   |
| `DS-009`   | `DS-010`   |

### Dependências externas (já satisfeitas por ondas anteriores)

| Achado     | Depende de | Onda de origem |
| ---------- | ---------- | -------------- |
| `DS-010`   | `ARC-003`  | Onda 3         |
| `PERF-002` | `ARC-003`  | Onda 3         |

### Regra de paralelização

Paralelização livre entre os Achados sem dependência.

## Conclusão

Grafo acíclico validado. A onda pode ser executada sem impasse de ordem.

## Referências

- [Plano de Execução](06_Plano_Execucao.md) · [Catálogo por Onda](../../02_CATALOGO/Achados_por_Onda.md)

---

**Navegação:** [← Onda 3](../ONDA_03/README.md) · [Índice de Ondas](../) · [Onda 5 →](../ONDA_05/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
