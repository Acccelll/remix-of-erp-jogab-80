# ChangeSet PERF-002 — Projeção e limites em consultas de lista

**Onda:** 4 — Padronização
**Status:** Concluído
**Depende de:** DS-010

## Problema

Consultas de lista usando `select("*")` sem `.limit()` — payload inflado e risco
de degradação com crescimento dos dados (Etapa 10 — Auditoria de Performance).

## Solução

Projeção explícita de colunas e limite defensivo nas listas-alvo alimentadas por
consultas diretas ao backend.

### Módulo novo

- `src/lib/financeiro-totvs/colunas.ts` — constante `VW_FINANCEIRO_OBRA_COLS`
  com a projeção canônica da view `vw_financeiro_obra` (fonte única para os três
  consumidores).

### Consultas migradas

| Arquivo | Tabela / View | Projeção | Limite |
| --- | --- | --- | --- |
| `src/components/obra/RiscosTab.tsx` | `riscos` | colunas do type `Risco` + `created_at` | 1000 |
| `src/components/obra/OcorrenciasTab.tsx` (ocorrências) | `ocorrencias` | colunas do type `Ocorrencia` | 1000 |
| `src/components/obra/OcorrenciasTab.tsx` (lições) | `licoes_aprendidas` | colunas do type `Licao` | 1000 |
| `src/components/obra/MarcosTab.tsx` | `cronograma_marcos` | colunas do type `Marco` | 500 |
| `src/components/obra/HistoricoTab.tsx` (auditoria) | `audit_logs` | colunas efetivamente consumidas na tabela | 200 (mantido) |
| `src/components/obra/HistoricoTab.tsx` (redistribuição) | `bms_redistribuicao` | colunas efetivamente consumidas na tabela | 500 (mantido) |
| `src/components/obra/FinanceiroTab.tsx` | `vw_financeiro_obra` | `VW_FINANCEIRO_OBRA_COLS` | — (escopo por `obra_id`) |
| `src/components/obra/ResumoFinanceiroTotvs.tsx` | `vw_financeiro_obra` | `VW_FINANCEIRO_OBRA_COLS` | — (escopo por `obra_id`) |
| `src/components/obra/ConfrontoOperacionalCard.tsx` | `vw_financeiro_obra` | `VW_FINANCEIRO_OBRA_COLS` | — (escopo por `obra_id`) |
| `src/lib/notificacoes/index.ts` | `notificacoes` | colunas do type `Notificacao` | 100 (mantido) |

## Fora de escopo (por definição de "lista")

Consultas de registro único ou detalhe (`.single()`, `.maybeSingle()`, `.eq("id", ...)`)
e queries de formulário não entram em PERF-002. Casos como `cardsExtraRepo.getFull`,
`cardRecursosRepo.getByCard`, `AdicionarRecursoDialog`, `CardRecursoDialog` seguem
com `select("*")` — apropriado para leitura de 1 linha por PK.

## Agregados de servidor

A auditoria (Etapa 10) recomenda migrar KPIs de `FinanceiroTab` / `ResumoFinanceiroTotvs`
para agregação server-side (RPC/materialized view). A infraestrutura de rollup já
existe (`board_items_resumo`, materialized views); a criação de uma RPC específica
para `vw_financeiro_obra` fica registrada como continuação natural, mas depende
de RPCs novas (Onda 6 — decisão de banco) e foi mantida fora do escopo desta
Onda para respeitar o gate ARC-003.

## Validação

- `bunx tsgo --noEmit`: verde.
- `bunx vitest run`: 437/437 verdes.

## Risco / Rollback

Baixo. Projeção estrita respeita os `type` locais; qualquer coluna futura exige
inclusão explícita — comportamento desejado. Rollback = restaurar `select("*")`
nos arquivos migrados.
