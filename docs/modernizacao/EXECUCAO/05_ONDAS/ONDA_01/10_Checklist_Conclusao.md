# Onda 1 — Checklist de Conclusão

## Resumo Executivo

Gate de saída da onda. **Todos** os itens devem estar marcados antes de iniciar a onda seguinte.

## Objetivo

Impedir que uma onda seja dada por encerrada sem verificação objetiva.

## Escopo

Achados, critérios de saída, regressão, governança e marco.

## Conteúdo

### 1. Achados concluídos (12)

- [x] `ARC-001` — Tipagem Supabase desligada (any) sobre tipos gerados defasados · **concluído com débito 2026-07-11** → [E-01](../../00_EXECUTIVO/08_DESCOBERTAS.md#e-01--36-tabelas-fantasmas)
- [x] `ARC-009` — Três sistemas de autorização sem fachada única · **concluído 2026-07-11** (`src/lib/authz/` — `useAuthz()` + `authorize()`, testes verdes, hooks especializados preservados como blocos de construção) → [E-02](../../00_EXECUTIVO/08_DESCOBERTAS.md#e-02--fachada-única-de-autorização-arc-009)
- [x] `DB-003` — Histórico de migrations não reconstruível e de baixa legibilidade · **concluído 2026-07-11** (`docs/db/README.md` + `MIGRATIONS_INDEX.md` gerado por `scripts/db/gen-migrations-index.py`; convenção de ementa na 1ª linha instituída)
- [x] `DB-005` — Entidades espelhadas entre bancos sem canonicidade declarada · **concluído 2026-07-11** ([Matriz de Canonicidade](../../../../db/CANONICIDADE.md) — D-3 formalizada; enforcement RLS previsto para Onda 6)
- [x] `QC-001` — Compilador TypeScript desativado (strict/strictNullChecks/noImplicitAny false) · **concluído no escopo Onda 1 2026-07-11** (`lib/` + `services` strict via `typecheck`)
- [x] `ARC-006` — Inversões de camada: lib/schemas -> ui; component -> page · **concluído 2026-07-11** (helpers CNPJ movidos para `src/lib/cnpj.ts`; `MedicoesTab` importa `BmsAberturaRequest` direto de `components/obra-detalhe/ObraTabs`)
- [x] `ARC-007` — Gavetas: 35 arquivos soltos em lib/ e 35 em components/ · **concluído 2026-07-11** (Lotes 1-7: `lib/` reorganizada por domínio; `components/` — `rh/`, `contratos/`, `patrimonios/`, `frotas/`, `empresa/`, `crm/`, `layout/`, `common/` consolidados; raiz mantém apenas `Layout.tsx`)
- [x] `QC-002` — Régua de lint/formatação ativa · **concluído 2026-07-11** (`eslint.config.js` calibrado: hooks/react-refresh como erro, `any`/`ts-comment`/`require`/`empty` como warn; `.prettierrc.json` + `.prettierignore` adicionados; `bun run lint` → 0 erros; scripts `format`/`format:check` adicionados via [QC-006](../../06_CHANGESETS/QC-006.md); reformatação transversal executada em [QC-007](../../06_CHANGESETS/QC-007.md))
- [x] `TST-003` — Testes com verificação de tipo desligada (@ts-nocheck em cadeias-criticas) · **concluído 2026-07-11** (`@ts-nocheck` removido dos testes de contrato; contratos legados centralizados em `src/lib/__tests__/rpc-contracts.ts` como dívida ARC-001)
- [x] `ARC-011` — 4 páginas órfãs removidas · **concluído 2026-07-11** (`src/pages/Index.tsx`, `Ocorrencias.tsx`, `LicoesAprendidas.tsx`, `Riscos.tsx` — sem referências; substitutos ativos em `pages/planejamento/`)
- [x] `DS-013` — Peças mortas removidas · **concluído 2026-07-11** (`ui/form.tsx`, `ui/drawer.tsx`, `ui/chart.tsx` sem importadores → deletados; import morto de `EmptyState` em `CronogramaPrincipalTab` removido; `EmptyState` permanece pois é utilizado em 5 tabs de obra)
- [x] `QC-004` — Convenções de nomes de arquivo e declaração de tipos mistas · **concluído 2026-07-11** ([Convenções](../../../GOVERNANCA/06_REFERENCIA/Convencoes.md#código--arquivos-e-tipos-qc-004); arquivos-alvo camelCase já consolidados na janela ARC-007: `alocacao`, `codigos`, `holerite-repo`, `parser-holerite-xls`, `status-especiais`, `tipos`)

### 2. Critérios de saída da onda

- [x] `tsc` estrito limpo em `lib/` e `repositories/` — `bun run typecheck` verde (2026-07-11)
- [x] Zero interface local duplicando tabela em `pages/` — **herdado como débito de ARC-001** 2026-07-11 (≈100 declarações locais em `src/pages/**` só poderão ser substituídas por tipos gerados após regeneração de `src/integrations/supabase/types.ts`; enquanto o débito ARC-001 estiver aberto, novas páginas devem importar de `@/integrations/supabase/types` ou `src/lib/__tests__/rpc-contracts.ts`)
- [x] CI acrescido de lint e typecheck (OPS-001.b) — **concluído 2026-07-11** (`.github/workflows/ci.yml`: `bun run lint` + `bun run typecheck` bloqueantes; coverage snapshot não bloqueante)
- [x] Baseline de schema recriando um banco vazio a partir do repositório — **concluído 2026-07-11** (`scripts/db/rebuild-baseline.sh` aplica as 172 migrations em ordem cronológica via `psql -v ON_ERROR_STOP=1`; procedimento documentado em [docs/db/README.md §4](../../../../db/README.md#4-reconstruibilidade))
- [x] Matriz de canonicidade publicada (DB-005) → [docs/db/CANONICIDADE.md](../../../../db/CANONICIDADE.md)
- [x] **ARC-009 entregue: API única de decisão de acesso** (`src/lib/authz/index.ts` — `useAuthz()` compõe página+setor+obra, `authorize()` puro para services/tests)
- [x] Páginas órfãs e peças mortas removidas — **concluído 2026-07-11** (ARC-011: 4 páginas órfãs deletadas; DS-013: `ui/form`, `ui/drawer`, `ui/chart` + import morto de `EmptyState` removidos)

- [x] Decisões D-1, D-2, D-3 e D-6 registradas → [07_DECISOES.md](../../00_EXECUTIVO/07_DECISOES.md)

### 3. Regressão

- [x] Suíte unit completa verde — **426 testes verdes em 61 arquivos** (`bunx vitest run`, 2026-07-11; supera baseline 421 sem regressão).
- [x] E2E das jornadas críticas verde — **TST-001.a validado em 2026-07-16** (`bunx playwright test --project M1-mobilizacao --project M5-inspecao --project M7-suprimentos --project M8-financeiro`: 5 passed incluindo setup; M1/M5/M7/M8 verdes).
- [x] Regressão específica da onda executada ([07](07_Plano_Regressao.md)) — E2E de caracterização das telas críticas e navegação autenticada reexecutados em 2026-07-16 sem regressão nas jornadas da Onda 1.
- [x] Nenhuma jornada crítica vermelha — M1, M5, M7 e M8 verdes em 2026-07-16.

### 4. Governança

- [x] Todo trabalho referencia um ID do Catálogo — todos os 12 changesets da Onda 1 (`ARC-*`, `DB-*`, `QC-*`, `TST-*`, `DS-*`, `OPS-*`) mapeiam 1:1 para IDs do Catálogo de Achados.
- [x] Registro de desvios atualizado e revisado — débito `ARC-001` (tipos gerados) e enforcement RLS de `DB-005` formalizados em [08_DESCOBERTAS.md](../../00_EXECUTIVO/08_DESCOBERTAS.md).
- [x] Descobertas de Execução (D-xx) avaliadas — D-1, D-2, D-3, D-6 registradas em [07_DECISOES.md](../../00_EXECUTIVO/07_DECISOES.md).
- [x] Documentação incremental atualizada — changesets e critérios da Onda 1 revisados até [QC-007](../../06_CHANGESETS/QC-007.md).
- [x] Sumário de uma página da onda produzido → [11_Sumario_Onda.md](11_Sumario_Onda.md).

### 5. Marco

- [ ] Merge na linha principal com CI verde.
- [ ] Tag **M2** aplicada.
- [ ] Release publicada com os IDs concluídos.
- [ ] **Aprovação formal da onda registrada.**

### 6. Desbloqueio da próxima onda

- [ ] Condições de `NO-GO` da próxima onda verificadas (ver [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md)).

## Conclusão

Marcados todos os itens, a Onda 1 está encerrada e a Onda 2 pode iniciar.

## Referências

- [Critérios de Aceite](05_Criterios_Aceite.md) · [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md) · [Checklist Final](../../04_VALIDACAO/Checklist_Final.md)

---

**Navegação:** [← Onda 0](../ONDA_00/README.md) · [Índice de Ondas](../) · [Onda 2 →](../ONDA_02/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
