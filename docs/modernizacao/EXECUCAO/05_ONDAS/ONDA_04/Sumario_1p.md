# Onda 4 — Sumário de uma página

**Tema:** Padronização (Design System, Performance, Qualidade)
**Período de execução:** Ondas incrementais anteriores até o presente.
**Status:** Concluída — pronta para gate M5 (falta apenas E2E em pipeline dedicado).

## Objetivo

Eliminar a fragmentação de UI e camada de dados: unificar toast, moeda, data, status, tabelas, gráficos, diálogos e barras de filtro; padronizar paginação e enxugar o payload das listas.

## Entregas (16 achados)

| ID          | Escopo                                                          |
| ----------- | --------------------------------------------------------------- |
| DS-002      | Toast único (`sonner`); `useToast` legado removido              |
| DS-003      | `useConfirm` substitui `window.confirm` nativo                  |
| DS-004      | `QueryState` / `EmptyState` / `PageLoading` padronizados        |
| DS-005      | Mapas status→rótulo/cor em `@/lib/status`                        |
| DS-006      | Moeda BRL única (`@/lib/money`)                                  |
| DS-007      | `StatCard` único                                                |
| DS-008      | `ui/chart` como wrapper único de Recharts                       |
| DS-009      | Listas navegáveis migradas para `DataTable` + `ColumnDef`       |
| DS-010      | `PaginationControls` padrão                                     |
| DS-012      | `ImportDialogShell` para diálogos de importação                 |
| DS-014      | Catálogo/documentação da biblioteca de UI                       |
| DS-015      | Escala oficial `size` em `DialogContent` + `FilterBar`          |
| BIZ-004     | Módulo único de datas (`@/lib/date`)                             |
| PERF-002.a  | Projeção estrita + limites nas listas-alvo                      |
| PERF-002.b  | Zero `select("*")` em consultas de lista                        |
| PERF-002.c  | Paginação server-side no `DataTable` + amostra `GMAuditoria`    |
| QC-003      | Política única de erros (boundary + `@/lib/errors`)             |
| UX-001      | Hub de Suprimentos e consolidação de configurações              |

## Critérios de saída — status

- ✅ Toast único · ✅ zero `window.confirm` · ✅ moeda/data/status unificados
- ✅ Listas paginadas · ✅ zero `select("*")` real · ✅ carregamento/vazio padronizados
- ✅ Política de erro · ✅ toda rota alcançável por menu/hub

## Regressão

- **Unit:** 437/437 verdes (baseline era 421).
- **Typecheck:** `tsgo --noEmit` verde.
- **E2E:** pendente em pipeline dedicado (D-ONDA4-E2E) — pré-condição da Tag M5.

## Decisões de execução (D-xx)

- **D-DS009-1:** tabelas dentro de dialogs/wizards ficam fora do `DataTable`.
- **D-DS012-1:** só diálogos de *importação* usam `ImportDialogShell`.
- **D-PERF002-1:** agregados server-side por RPC → **Onda 6** (gate de banco).
- **D-ONDA4-E2E:** suíte E2E completa não executa no sandbox; roda no pipeline antes de M5.

## Próximos passos

1. Executar E2E das jornadas críticas fora do sandbox.
2. Aplicar Tag **M5** e registrar aprovação formal.
3. Verificar condições de `NO-GO` da Onda 5 (Stage Gate).
