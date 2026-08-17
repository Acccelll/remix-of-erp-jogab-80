# Onda 4 — Entregáveis

## Resumo Executivo

O que fica pronto e verificável ao fim da onda.

## Objetivo

Tornar tangível o resultado da onda.

## Escopo

Entregas técnicas, documentais e de marco.

## Conteúdo

### Entregas

- Design System com padrões únicos
- Listas escaláveis
- Política de erro implantada
- Navegação sem telas órfãs
- Catálogo da biblioteca publicado

### Achados concluídos

| ID         | Título                                                                  |
| ---------- | ----------------------------------------------------------------------- |
| `DS-002`   | Dois sistemas de toast (sonner x84 / use-toast x9)                      |
| `DS-006`   | Moeda sem fonte única (BRL inline em 32 páginas; money x currency)      |
| `DS-010`   | Paginação inexistente como padrão (primitivo pronto, 2 usos)            |
| `PERF-002` | Consultas de lista sem limite e sem projeção (24 select(*), 31 limit)   |
| `QC-003`   | Tratamento de erros sem política única (4 destinos; 15 catch vazios)    |
| `UX-001`   | Telas sem porta (Suprimentos estruturante) e configurações fragmentadas |
| `BIZ-004`  | Datas sem módulo central (48 arquivos formatam inline)                  |
| `DS-003`   | window.confirm nativo em 5 telas                                        |
| `DS-004`   | Subadoção de QueryState/EmptyState (spinner manual em 31 páginas)       |
| `DS-005`   | Mapas status->rótulo/cor duplicados em 15 arquivos                      |
| `DS-007`   | KPI/StatCard reimplementado por dashboard                               |
| `DS-008`   | Recharts cru em 24 arquivos; ui/chart.tsx com 0 usos                    |
| `DS-009`   | 24 de 28 telas com tabela crua fora de ui/data-table                    |
| `DS-014`   | Biblioteca sem catálogo/documentação                                    |
| `DS-012`   | 8 diálogos de importação repetindo a mesma casca                        |
| `DS-015`   | Sem escala de tamanhos de Dialog; sem barra de filtros padrão           |

### Artefatos de governança

- Sumário de uma página da onda (IDs concluídos, desvios, decisões, pendências).
- Registro de desvios atualizado.
- Documentação incremental das convenções produzidas.
- Tag **M5** e release com os IDs nas notas.

## Conclusão

Marco **M5 — Design System consolidado** alcançado.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Roadmap](../../../GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md)

---

**Navegação:** [← Onda 3](../ONDA_03/README.md) · [Índice de Ondas](../) · [Onda 5 →](../ONDA_05/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
