# Onda 3 — Dependências

## Resumo Executivo

3 dos 8 Achados desta onda não têm dependência alguma e podem iniciar imediatamente e em paralelo. **Nenhum Achado desta onda depende de item em onda posterior** — verificado por validação automática do grafo.

## Objetivo

Estabelecer a ordem interna e as pré-condições externas.

## Escopo

Dependências internas (dentro da onda) e externas (de ondas anteriores).

## Conteúdo

### Sem dependência — iniciam já, em paralelo

`EST-001`, `ARC-008`, `DB-004`

### Dependências internas (respeitar ordem dentro da onda)

| Achado    | Depende de |
| --------- | ---------- |
| `BIZ-002` | `ARC-003`  |
| `TST-002` | `ARC-003`  |
| `ARC-010` | `ARC-003`  |

### Dependências externas (já satisfeitas por ondas anteriores)

| Achado    | Depende de | Onda de origem |
| --------- | ---------- | -------------- |
| `ARC-003` | `ARC-001`  | Onda 1         |
| `BIZ-002` | `ARC-001`  | Onda 1         |
| `DB-001`  | `DB-005`   | Onda 1         |
| `TST-002` | `ARC-001`  | Onda 1         |

### Regra de paralelização

Paralelização livre entre os Achados sem dependência.

## Conclusão

Grafo acíclico validado. A onda pode ser executada sem impasse de ordem.

## Referências

- [Plano de Execução](06_Plano_Execucao.md) · [Catálogo por Onda](../../02_CATALOGO/Achados_por_Onda.md)

---

**Navegação:** [← Onda 2](../ONDA_02/README.md) · [Índice de Ondas](../) · [Onda 4 →](../ONDA_04/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
