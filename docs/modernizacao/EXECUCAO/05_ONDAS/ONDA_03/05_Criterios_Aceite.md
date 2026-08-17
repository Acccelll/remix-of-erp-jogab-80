# Onda 3 — Critérios de Aceite

## Resumo Executivo

Uma onda só é aceita quando **todos** os critérios de saída abaixo são satisfeitos e **cada** Achado cumpre os critérios de sua ficha original.

## Objetivo

Tornar a conclusão da onda verificável, não opinativa.

## Escopo

Critérios de saída da onda e critérios globais aplicáveis a cada Achado.

## Conteúdo

### Critérios de saída da Onda 3

- [ ] Zero `supabase.from()` em `pages/` e `components/` para tabelas cobertas
- [x] Zero acesso a banco em módulo declarado puro — ver [BIZ-002.d](../../06_CHANGESETS/BIZ-002.d.md)
- [x] Órfãos de fronteira zerados e formato validado por CHECK — ver [DB-001.a](../../06_CHANGESETS/DB-001.a.md)
- [ ] Testes de integração de dados verdes
- [x] Controle de migrations aplicadas no trilho MySQL — ver [DB-004](../../06_CHANGESETS/DB-004.md)
- [ ] Rollback coordenado front↔schema documentado (OPS-006.b)
- [x] Mutações otimistas do legado revertendo e avisando em falha — ver [EST-001](../../06_CHANGESETS/EST-001.md)

### Critérios globais (todo Achado desta onda)

- [ ] Referencia um **ID** do Catálogo Mestre.
- [ ] Satisfaz **integralmente** os Critérios de Aceite da ficha original ([Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md), [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md), [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md), [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md), [Etapa 7](../../../GOVERNANCA/01_AUDITORIA/ETAPA_07_ESTADO_FLUXO_DADOS.md), [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)).
- [ ] **CI verde** (install + build + test + lint + typecheck).
- [ ] Suíte existente sem regressão (baseline: 421 testes verdes).
- [ ] Nenhuma alteração de comportamento não prevista na ficha.
- [x] Documentação incremental atualizada para os achados já executados (`ARC-003`, `BIZ-002`, `DB-001.a`, `EST-001`, `ARC-008`, `DB-004`, `ARC-010`).

### Achados e suas fichas

| ID        | Título                                                                   | Ficha completa em                                                              |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `ARC-003` | Bypass da camada de repositories (35 páginas com from() direto)          | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| `BIZ-002` | Lib bimodal pura x impura sem convenção (19 arquivos com I/O)            | [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md)         |
| `DB-001`  | Fronteira PHP x Supabase sem integridade referencial (ids em text)       | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)      |
| `EST-001` | Otimismo sem rollback nos domínios PHP (falha silenciosa)                | [Etapa 7](../../../GOVERNANCA/01_AUDITORIA/ETAPA_07_ESTADO_FLUXO_DADOS.md)     |
| `TST-002` | Fronteira de backend e camada de dados sem testes de integração          | [Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md)         |
| `ARC-008` | Query keys ad-hoc sem registro/fábrica (171 invalidações em 46 arquivos) | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| `DB-004`  | Trilho MySQL de aplicação manual sem registro de estado                  | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)      |
| `ARC-010` | services/ vestigial; dpHoleriteRepo fora de repositories/                | [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md) |

## Conclusão

Sem os critérios de saída, a onda não é aprovada e a seguinte não inicia.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 2](../ONDA_02/README.md) · [Índice de Ondas](../) · [Onda 4 →](../ONDA_04/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
