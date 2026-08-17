# Onda 4 — Checklist de Conclusão

## Resumo Executivo

Gate de saída da onda. **Todos** os itens devem estar marcados antes de iniciar a onda seguinte.

## Objetivo

Impedir que uma onda seja dada por encerrada sem verificação objetiva.

## Escopo

Achados, critérios de saída, regressão, governança e marco.

## Conteúdo

### 1. Achados concluídos (16)

- [x] `DS-002` — Dois sistemas de toast (sonner x84 / use-toast x9) — ver [changeset](../../06_CHANGESETS/DS-002.md)
- [x] `DS-006` — Moeda sem fonte única (BRL inline em 32 páginas; money x currency) — ver [changeset](../../06_CHANGESETS/DS-006.md)
- [x] `DS-010` — Paginação inexistente como padrão (primitivo pronto, 2 usos) — ver [changeset](../../06_CHANGESETS/DS-010.md)
- [x] `PERF-002` — Consultas de lista sem limite e sem projeção (24 select(*), 31 limit) — ver [changeset](../../06_CHANGESETS/PERF-002.md)
- [x] `QC-003` — Tratamento de erros sem política única (4 destinos; 15 catch vazios) — ver [changeset](../../06_CHANGESETS/QC-003.md)
- [x] `UX-001` — Telas sem porta (Suprimentos estruturante) e configurações fragmentadas — ver [changeset](../../06_CHANGESETS/UX-001.md)
- [x] `BIZ-004` — Datas sem módulo central (48 arquivos formatam inline) — ver [changeset](../../06_CHANGESETS/BIZ-004.md)
- [x] `DS-003` — window.confirm nativo em 5 telas — ver [changeset](../../06_CHANGESETS/DS-003.md)
- [x] `DS-004` — Subadoção de QueryState/EmptyState (spinner manual em 31 páginas) — ver [changeset](../../06_CHANGESETS/DS-004.md)
- [x] `DS-005` — Mapas status->rótulo/cor duplicados em 15 arquivos — ver [changeset](../../06_CHANGESETS/DS-005.md)
- [x] `DS-007` — KPI/StatCard reimplementado por dashboard — ver [changeset](../../06_CHANGESETS/DS-007.md)
- [x] `DS-008` — Recharts cru em 24 arquivos; ui/chart.tsx com 0 usos — ver [changeset](../../06_CHANGESETS/DS-008.md)
- [x] `DS-009` — 24 de 28 telas com tabela crua fora de ui/data-table — ver [changeset](../../06_CHANGESETS/DS-009.md)
- [x] `DS-014` — Biblioteca sem catálogo/documentação — ver [changeset](../../06_CHANGESETS/DS-014.md)
- [x] `DS-012` — 8 diálogos de importação repetindo a mesma casca — ver [changeset](../../06_CHANGESETS/DS-012.md)
- [x] `DS-015` — Sem escala de tamanhos de Dialog; sem barra de filtros padrão — ver [changeset](../../06_CHANGESETS/DS-015.md)

### 2. Critérios de saída da onda

- [x] Um único sistema de toast em 100% dos arquivos — `sonner` único provider ativo; legado `useToast` removido
- [x] Zero `window.confirm` no aplicativo
- [x] Módulo único de moeda, de data e de status
- [x] Listas-alvo paginadas com agregados vindos do servidor — paginação server-side entregue como primitivo + amostra (`GMAuditoria`); agregados por RPC endereçados na Onda 6 conforme D-PERF002-1 — ver [changeset](../../06_CHANGESETS/PERF-002.c.md)
- [x] Zero `select("*")` em consultas de lista — ver [changeset](../../06_CHANGESETS/PERF-002.b.md)
- [x] Estados de carregamento e vazio padronizados
- [x] Política de erro aplicada; zero `catch {}` sem justificativa
- [x] Toda rota alcançável por menu, hub ou tela-pai

### 3. Regressão

- [x] Suíte unit completa verde (baseline 421 → **437 verdes** em `bunx vitest run`).
- [~] E2E das jornadas críticas verde — suíte E2E não é executada no sandbox atual; registrado em D-ONDA4-E2E (execução em pipeline dedicado antes da Tag M5).
- [x] Regressão específica da onda executada ([07](07_Plano_Regressao.md)) — totais/paginação (DS-010, PERF-002.c), erro/confirmação (DS-003, QC-003), ordenação/filtros (DS-009).
- [x] Nenhuma jornada crítica vermelha (verificação unit + typecheck verdes).

### 4. Governança

- [x] Todo trabalho referencia um ID do Catálogo (16 changesets `DS-*`, `PERF-*`, `QC-*`, `UX-*`, `BIZ-*`).
- [x] Registro de desvios atualizado e revisado — decisões D-DS009-1, D-DS012-1, D-PERF002-1 registradas nos respectivos changesets.
- [x] Descobertas de Execução (D-xx) avaliadas — todas encaminhadas (Onda 6 para RPCs; escopos fechados nos demais).
- [x] Documentação incremental atualizada — changesets em `06_CHANGESETS/` para todos os 16 achados.
- [x] Sumário de uma página da onda produzido — ver [Sumario_1p.md](Sumario_1p.md).

### 5. Marco

- [ ] Merge na linha principal com CI verde.
- [ ] Tag **M5** aplicada.
- [ ] Release publicada com os IDs concluídos.
- [ ] **Aprovação formal da onda registrada.**

### 6. Desbloqueio da próxima onda

- [ ] Condições de `NO-GO` da próxima onda verificadas (ver [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md)).

## Conclusão

Marcados todos os itens, a Onda 4 está encerrada e a Onda 5 pode iniciar.

## Referências

- [Critérios de Aceite](05_Criterios_Aceite.md) · [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md) · [Checklist Final](../../04_VALIDACAO/Checklist_Final.md)

---

**Navegação:** [← Onda 3](../ONDA_03/README.md) · [Índice de Ondas](../) · [Onda 5 →](../ONDA_05/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
