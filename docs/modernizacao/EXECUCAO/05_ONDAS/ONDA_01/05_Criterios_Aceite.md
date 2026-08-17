# Onda 1 — Critérios de Aceite

## Resumo Executivo

Uma onda só é aceita quando **todos** os critérios de saída abaixo são satisfeitos e **cada** Achado cumpre os critérios de sua ficha original.

## Objetivo

Tornar a conclusão da onda verificável, não opinativa.

## Escopo

Critérios de saída da onda e critérios globais aplicáveis a cada Achado.

## Conteúdo

### Critérios de saída da Onda 1

- [x] `tsc` estrito limpo em `lib/` e `repositories/` — `tsconfig.qc001.json` + `bun run typecheck` (2026-07-11)
- [ ] Zero interface local duplicando tabela em `pages/`
- [x] CI acrescido de lint e typecheck (OPS-001.b) — `.github/workflows/ci.yml` executa `bun run lint` e `bun run typecheck` como gates bloqueantes (2026-07-11)
- [ ] Baseline de schema recriando um banco vazio a partir do repositório
- [ ] Matriz de canonicidade publicada (DB-005)
- [ ] **ARC-009 entregue: API única de decisão de acesso**
- [ ] Páginas órfãs e peças mortas removidas
- [ ] Decisões D-1, D-2, D-3 e D-6 registradas

### Critérios globais (todo Achado desta onda)

- [ ] Referencia um **ID** do Catálogo Mestre.
- [ ] Satisfaz **integralmente** os Critérios de Aceite da ficha original ([Etapa 1,3,4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md), [Etapa 1,4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md), [Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md), [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md), [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md), [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md), [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md), [Etapa 9](../../../GOVERNANCA/01_AUDITORIA/ETAPA_09_QUALIDADE_CODIGO.md)).
- [ ] **CI verde** (install + build + test + lint + typecheck).
- [x] Suíte existente sem regressão — `bunx vitest run`: 61 arquivos, 426 testes verdes (2026-07-11; baseline 421 superado).
- [ ] Nenhuma alteração de comportamento não prevista na ficha.
- [x] Documentação incremental atualizada — changesets e evidências da Onda 1 revisados até [QC-007](../../06_CHANGESETS/QC-007.md).

### Evidência QC-001 — 2026-07-11

- `package.json` passou a expor `typecheck` como gate explícito.
- `tsconfig.qc001.json` liga `strict`, `strictNullChecks` e `noImplicitAny` para `src/lib/**` e `src/services/**`, incluindo repositories em `src/lib/repositories/**`.
- Validação executada: `bun run typecheck` sem erros.
- Plano incremental preservado: `tsconfig.app.json` permanece macio até que os erros restantes em `components/`, `contexts/`, `hooks/` e `pages/` sejam tratados por ondas subsequentes; a tentativa de strict global ainda expõe erros de `noImplicitAny` e contratos de UI fora do critério mínimo da Onda 1.

### Evidência OPS-001.b — 2026-07-11

- `.github/workflows/ci.yml` usa `bun run lint` como gate bloqueante.
- `.github/workflows/ci.yml` usa `bun run typecheck` como gate bloqueante, reaproveitando o contrato QC-001.
- `bun run test:coverage` foi adicionado como snapshot não bloqueante, preservando TST-004 sem impor threshold prematuro.

### Evidência de regressão unitária — 2026-07-11

- `bunx vitest run` executado localmente: 61 arquivos de teste, 426 testes verdes.
- Resultado supera o baseline oficial da auditoria (421 testes verdes) sem regressão unitária.

### Evidência QC-007 — 2026-07-11

- `bun run format` aplicado no repositório após a criação dos scripts em QC-006.
- `bun run format:check` verde: `All matched files use Prettier code style!`.
- Mudança classificada como mecânica, sem alteração funcional intencional.

### Achados e suas fichas

| ID        | Título                                                                         | Ficha completa em                                                                |
| --------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `ARC-001` | Tipagem Supabase desligada (any) sobre tipos gerados defasados                 | [Etapa 1,4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md)   |
| `ARC-009` | Três sistemas de autorização sem fachada única                                 | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)     |
| `DB-003`  | Histórico de migrations não reconstruível e de baixa legibilidade              | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)        |
| `DB-005`  | Entidades espelhadas entre bancos sem canonicidade declarada                   | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)        |
| `QC-001`  | Compilador TypeScript desativado (strict/strictNullChecks/noImplicitAny false) | [Etapa 9](../../../GOVERNANCA/01_AUDITORIA/ETAPA_09_QUALIDADE_CODIGO.md)         |
| `ARC-006` | Inversões de camada: lib/schemas -> ui; component -> page                      | [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| `ARC-007` | Gavetas: 35 arquivos soltos em lib/ e 35 em components/                        | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)     |
| `QC-002`  | Régua de lint/formatação desligada (no-unused-vars off; sem Prettier)          | [Etapa 9](../../../GOVERNANCA/01_AUDITORIA/ETAPA_09_QUALIDADE_CODIGO.md)         |
| `TST-003` | Testes com verificação de tipo desligada (@ts-nocheck em cadeias-criticas)     | [Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md)           |
| `ARC-011` | 4 páginas órfãs (Index, Ocorrencias, LicoesAprendidas, Riscos)                 | [Etapa 1,3,4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md) |
| `DS-013`  | Peças mortas/presas: ui/form, ui/drawer, ui/chart; EmptyState em obra/         | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| `QC-004`  | Convenções de nomes de arquivo e declaração de tipos mistas                    | [Etapa 9](../../../GOVERNANCA/01_AUDITORIA/ETAPA_09_QUALIDADE_CODIGO.md)         |

## Conclusão

Sem os critérios de saída, a onda não é aprovada e a seguinte não inicia.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 0](../ONDA_00/README.md) · [Índice de Ondas](../) · [Onda 2 →](../ONDA_02/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
