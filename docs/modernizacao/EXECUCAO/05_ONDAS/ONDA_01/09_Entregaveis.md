# Onda 1 — Entregáveis

## Resumo Executivo

O que fica pronto e verificável ao fim da onda.

## Objetivo

Tornar tangível o resultado da onda.

## Escopo

Entregas técnicas, documentais e de marco.

## Conteúdo

### Entregas

- Tipos de banco cobrindo 100% das tabelas/RPCs
- Compilador estrito nas camadas de domínio e dados
- Fachada única de autorização
- Baseline de schema versionado
- Matriz de canonicidade
- Repositório sem código morto

### Achados concluídos

| ID        | Título                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| `ARC-001` | Tipagem Supabase desligada (any) sobre tipos gerados defasados                 |
| `ARC-009` | Três sistemas de autorização sem fachada única                                 |
| `DB-003`  | Histórico de migrations não reconstruível e de baixa legibilidade              |
| `DB-005`  | Entidades espelhadas entre bancos sem canonicidade declarada                   |
| `QC-001`  | Compilador TypeScript desativado (strict/strictNullChecks/noImplicitAny false) |
| `ARC-006` | Inversões de camada: lib/schemas -> ui; component -> page                      |
| `ARC-007` | Gavetas: 35 arquivos soltos em lib/ e 35 em components/                        |
| `QC-002`  | Régua de lint/formatação desligada (no-unused-vars off; sem Prettier)          |
| `TST-003` | Testes com verificação de tipo desligada (@ts-nocheck em cadeias-criticas)     |
| `ARC-011` | 4 páginas órfãs (Index, Ocorrencias, LicoesAprendidas, Riscos)                 |
| `DS-013`  | Peças mortas/presas: ui/form, ui/drawer, ui/chart; EmptyState em obra/         |
| `QC-004`  | Convenções de nomes de arquivo e declaração de tipos mistas                    |

### Artefatos de governança

- Sumário de uma página da onda (IDs concluídos, desvios, decisões, pendências).
- Registro de desvios atualizado.
- Documentação incremental das convenções produzidas.
- Tag **M2** e release com os IDs nas notas.

## Conclusão

Marco **M2 — Fundação técnica consolidada** alcançado.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Roadmap](../../../GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md)

---

**Navegação:** [← Onda 0](../ONDA_00/README.md) · [Índice de Ondas](../) · [Onda 2 →](../ONDA_02/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
