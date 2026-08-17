# Onda 6 — Entregáveis

## Resumo Executivo

O que fica pronto e verificável ao fim da onda.

## Objetivo

Tornar tangível o resultado da onda.

## Escopo

Entregas técnicas, documentais e de marco.

## Conteúdo

### Entregas

- Monólitos decompostos e chunks sob orçamento
- Paradigma único de estado servidor
- Legado aposentado nos domínios migrados
- DP com dono único
- Render granular

### Achados concluídos

| ID         | Título                                                                      |
| ---------- | --------------------------------------------------------------------------- |
| `ARC-002`  | God-context AppContext (730L, 63 membros, 86 consumidores)                  |
| `ARC-004`  | Duas máquinas de estado servidor (imperativa PHP x TanStack Query)          |
| `ARC-005`  | Monólitos página/diálogo (10 arquivos de 700 a 2.104 linhas)                |
| `PERF-001` | Chunks-gigante: entry 789kB, CardGenericoDialog 791kB, FinObraDetalhe 674kB |
| `PRO-004`  | DP: dualidade legado/novo (provisões, HE, histórico, fopag em 2 bancos)     |
| `PERF-003` | Granularidade de render inexistente (React.memo usado 2x)                   |
| `DS-011`   | 6 implementações independentes de Kanban                                    |
| `DS-016`   | 31 diálogos de domínio autofetchantes (UI acoplada a dados)                 |

### Artefatos de governança

- Sumário de uma página da onda (IDs concluídos, desvios, decisões, pendências).
- Registro de desvios atualizado.
- Documentação incremental das convenções produzidas.
- Tag **M7** e release com os IDs nas notas.

## Conclusão

Marco **M7 — Arquitetura consolidada** alcançado.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Roadmap](../../../GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md)

---

**Navegação:** [← Onda 5](../ONDA_05/README.md) · [Índice de Ondas](../) · [Onda 7 →](../ONDA_07/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
