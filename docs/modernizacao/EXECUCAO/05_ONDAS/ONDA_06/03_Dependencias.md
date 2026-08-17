# Onda 6 — Dependências

## Resumo Executivo

0 dos 8 Achados desta onda não têm dependência alguma e podem iniciar imediatamente e em paralelo. **Nenhum Achado desta onda depende de item em onda posterior** — verificado por validação automática do grafo.

## Objetivo

Estabelecer a ordem interna e as pré-condições externas.

## Escopo

Dependências internas (dentro da onda) e externas (de ondas anteriores).

## Conteúdo

### Sem dependência — iniciam já, em paralelo

_Nenhum._

### Dependências internas (respeitar ordem dentro da onda)

| Achado     | Depende de |
| ---------- | ---------- |
| `ARC-004`  | `ARC-002`  |
| `PERF-001` | `ARC-005`  |
| `PRO-004`  | `ARC-004`  |
| `PERF-003` | `ARC-005`  |
| `PERF-003` | `DS-011`   |
| `DS-011`   | `ARC-005`  |
| `DS-016`   | `ARC-005`  |

### Dependências externas (já satisfeitas por ondas anteriores)

| Achado    | Depende de | Onda de origem |
| --------- | ---------- | -------------- |
| `ARC-002` | `ARC-001`  | Onda 1         |
| `ARC-002` | `TST-001`  | Onda 0         |
| `ARC-002` | `TST-002`  | Onda 3         |
| `ARC-005` | `ARC-001`  | Onda 1         |
| `ARC-005` | `ARC-003`  | Onda 3         |
| `PRO-004` | `DB-005`   | Onda 1         |
| `DS-016`  | `ARC-003`  | Onda 3         |

### Regra de paralelização

Paralelização restrita — ver [Plano de Execução](06_Plano_Execucao.md).
**Proibido paralelizar** as cirurgias críticas desta onda entre si ou com qualquer outra frente.

## Conclusão

Grafo acíclico validado. A onda pode ser executada sem impasse de ordem.

## Referências

- [Plano de Execução](06_Plano_Execucao.md) · [Catálogo por Onda](../../02_CATALOGO/Achados_por_Onda.md)

---

**Navegação:** [← Onda 5](../ONDA_05/README.md) · [Índice de Ondas](../) · [Onda 7 →](../ONDA_07/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
