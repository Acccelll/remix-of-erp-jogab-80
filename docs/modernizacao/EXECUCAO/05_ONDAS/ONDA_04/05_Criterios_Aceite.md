# Onda 4 — Critérios de Aceite

## Resumo Executivo

Uma onda só é aceita quando **todos** os critérios de saída abaixo são satisfeitos e **cada** Achado cumpre os critérios de sua ficha original.

## Objetivo

Tornar a conclusão da onda verificável, não opinativa.

## Escopo

Critérios de saída da onda e critérios globais aplicáveis a cada Achado.

## Conteúdo

### Critérios de saída da Onda 4

- [ ] Um único sistema de toast em 100% dos arquivos
- [ ] Zero `window.confirm` no aplicativo
- [ ] Módulo único de moeda, de data e de status
- [ ] Listas-alvo paginadas com agregados vindos do servidor
- [ ] Zero `select("*")` em consultas de lista
- [ ] Estados de carregamento e vazio padronizados
- [ ] Política de erro aplicada; zero `catch {}` sem justificativa
- [ ] Toda rota alcançável por menu, hub ou tela-pai

### Critérios globais (todo Achado desta onda)

- [ ] Referencia um **ID** do Catálogo Mestre.
- [ ] Satisfaz **integralmente** os Critérios de Aceite da ficha original ([Etapa 1,2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md), [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md), [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md), [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md), [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md), [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md), [Etapa 9](../../../GOVERNANCA/01_AUDITORIA/ETAPA_09_QUALIDADE_CODIGO.md)).
- [ ] **CI verde** (install + build + test + lint + typecheck).
- [ ] Suíte existente sem regressão (baseline: 421 testes verdes).
- [ ] Nenhuma alteração de comportamento não prevista na ficha.
- [ ] Documentação incremental atualizada.

### Achados e suas fichas

| ID         | Título                                                                  | Ficha completa em                                                                |
| ---------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `DS-002`   | Dois sistemas de toast (sonner x84 / use-toast x9)                      | [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)           |
| `DS-006`   | Moeda sem fonte única (BRL inline em 32 páginas; money x currency)      | [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| `DS-010`   | Paginação inexistente como padrão (primitivo pronto, 2 usos)            | [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)           |
| `PERF-002` | Consultas de lista sem limite e sem projeção (24 select(*), 31 limit)   | [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md)             |
| `QC-003`   | Tratamento de erros sem política única (4 destinos; 15 catch vazios)    | [Etapa 9](../../../GOVERNANCA/01_AUDITORIA/ETAPA_09_QUALIDADE_CODIGO.md)         |
| `UX-001`   | Telas sem porta (Suprimentos estruturante) e configurações fragmentadas | [Etapa 1,2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md) |
| `BIZ-004`  | Datas sem módulo central (48 arquivos formatam inline)                  | [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md)           |
| `DS-003`   | window.confirm nativo em 5 telas                                        | [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)           |
| `DS-004`   | Subadoção de QueryState/EmptyState (spinner manual em 31 páginas)       | [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)           |
| `DS-005`   | Mapas status->rótulo/cor duplicados em 15 arquivos                      | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| `DS-007`   | KPI/StatCard reimplementado por dashboard                               | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| `DS-008`   | Recharts cru em 24 arquivos; ui/chart.tsx com 0 usos                    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| `DS-009`   | 24 de 28 telas com tabela crua fora de ui/data-table                    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| `DS-014`   | Biblioteca sem catálogo/documentação                                    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| `DS-012`   | 8 diálogos de importação repetindo a mesma casca                        | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| `DS-015`   | Sem escala de tamanhos de Dialog; sem barra de filtros padrão           | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |

## Conclusão

Sem os critérios de saída, a onda não é aprovada e a seguinte não inicia.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 3](../ONDA_03/README.md) · [Índice de Ondas](../) · [Onda 5 →](../ONDA_05/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
