# Onda 1 — Dependências

## Resumo Executivo

8 dos 12 Achados desta onda não têm dependência alguma e podem iniciar imediatamente e em paralelo. **Nenhum Achado desta onda depende de item em onda posterior** — verificado por validação automática do grafo.

## Objetivo

Estabelecer a ordem interna e as pré-condições externas.

## Escopo

Dependências internas (dentro da onda) e externas (de ondas anteriores).

## Conteúdo

### Sem dependência — iniciam já, em paralelo

`ARC-001`, `ARC-009`, `DB-003`, `DB-005`, `ARC-006`, `ARC-007`, `ARC-011`, `DS-013`

### Dependências internas (respeitar ordem dentro da onda)

| Achado    | Depende de |
| --------- | ---------- |
| `QC-001`  | `ARC-001`  |
| `QC-002`  | `QC-001`   |
| `TST-003` | `ARC-001`  |
| `TST-003` | `QC-001`   |
| `QC-004`  | `ARC-007`  |

### Dependências externas (já satisfeitas por ondas anteriores)

_Nenhuma._

### Regra de paralelização

Paralelização livre entre os Achados sem dependência.

## Conclusão

Grafo acíclico validado. A onda pode ser executada sem impasse de ordem.

## Referências

- [Plano de Execução](06_Plano_Execucao.md) · [Catálogo por Onda](../../02_CATALOGO/Achados_por_Onda.md)

---

**Navegação:** [← Onda 0](../ONDA_00/README.md) · [Índice de Ondas](../) · [Onda 2 →](../ONDA_02/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
