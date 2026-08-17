# Onda 3 — Entregáveis

## Resumo Executivo

O que fica pronto e verificável ao fim da onda.

## Objetivo

Tornar tangível o resultado da onda.

## Escopo

Entregas técnicas, documentais e de marco.

## Conteúdo

### Entregas

- Camada de dados fechada
- Lib pura sem I/O
- Testes de integração de repositories e mappers
- Fronteira com integridade verificável
- EST-001 mitigado (rollback + aviso)

### Achados concluídos

| ID        | Título                                                                   |
| --------- | ------------------------------------------------------------------------ |
| `ARC-003` | Bypass da camada de repositories (35 páginas com from() direto)          |
| `BIZ-002` | Lib bimodal pura x impura sem convenção (19 arquivos com I/O)            |
| `DB-001`  | Fronteira PHP x Supabase sem integridade referencial (ids em text)       |
| `EST-001` | Otimismo sem rollback nos domínios PHP (falha silenciosa)                |
| `TST-002` | Fronteira de backend e camada de dados sem testes de integração          |
| `ARC-008` | Query keys ad-hoc sem registro/fábrica (171 invalidações em 46 arquivos) |
| `DB-004`  | Trilho MySQL de aplicação manual sem registro de estado                  |
| `ARC-010` | services/ vestigial; dpHoleriteRepo fora de repositories/                |

### Artefatos de governança

- Sumário de uma página da onda (IDs concluídos, desvios, decisões, pendências).
- Registro de desvios atualizado.
- Documentação incremental das convenções produzidas.
- Tag **M4** e release com os IDs nas notas.

## Conclusão

Marco **M4 — Dados e camadas consolidados** alcançado.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Roadmap](../../../GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md)

---

**Navegação:** [← Onda 2](../ONDA_02/README.md) · [Índice de Ondas](../) · [Onda 4 →](../ONDA_04/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
