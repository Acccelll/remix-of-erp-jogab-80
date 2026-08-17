# Onda 6 — Critérios de Aceite

## Resumo Executivo

Uma onda só é aceita quando **todos** os critérios de saída abaixo são satisfeitos e **cada** Achado cumpre os critérios de sua ficha original.

## Objetivo

Tornar a conclusão da onda verificável, não opinativa.

## Escopo

Critérios de saída da onda e critérios globais aplicáveis a cada Achado.

## Conteúdo

### Critérios de saída da Onda 6

- [ ] Nenhum chunk de rota/diálogo acima de 500 kB sem justificativa registrada
- [ ] Nenhum monólito misturando UI, dados e regra no mesmo arquivo
- [ ] Paradigma único de estado servidor; origem do backend invisível aos componentes
- [ ] DP com fonte única de dados
- [ ] EST-001 encerrado por absorção
- [ ] Interação de drag não reconcilia colunas não afetadas

### Critérios globais (todo Achado desta onda)

- [ ] Referencia um **ID** do Catálogo Mestre.
- [ ] Satisfaz **integralmente** os Critérios de Aceite da ficha original ([Etapa 1,2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md), [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md), [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md), [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md), [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)).
- [ ] **CI verde** (install + build + test + lint + typecheck).
- [ ] Suíte existente sem regressão (baseline: 421 testes verdes).
- [ ] Nenhuma alteração de comportamento não prevista na ficha.
- [ ] Documentação incremental atualizada.

### Achados e suas fichas

| ID         | Título                                                                      | Ficha completa em                                                              |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ARC-002`  | God-context AppContext (730L, 63 membros, 86 consumidores)                  | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| `ARC-004`  | Duas máquinas de estado servidor (imperativa PHP x TanStack Query)          | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| `ARC-005`  | Monólitos página/diálogo (10 arquivos de 700 a 2.104 linhas)                | [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md) |
| `PERF-001` | Chunks-gigante: entry 789kB, CardGenericoDialog 791kB, FinObraDetalhe 674kB | [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md)           |
| `PRO-004`  | DP: dualidade legado/novo (provisões, HE, histórico, fopag em 2 bancos)     | [Etapa 1,2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md) |
| `PERF-003` | Granularidade de render inexistente (React.memo usado 2x)                   | [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md)           |
| `DS-011`   | 6 implementações independentes de Kanban                                    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)          |
| `DS-016`   | 31 diálogos de domínio autofetchantes (UI acoplada a dados)                 | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)          |

## Conclusão

Sem os critérios de saída, a onda não é aprovada e a seguinte não inicia.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 5](../ONDA_05/README.md) · [Índice de Ondas](../) · [Onda 7 →](../ONDA_07/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
