# Onda 6 — Checklist de Conclusão

## Resumo Executivo

Gate de saída da onda. **Todos** os itens devem estar marcados antes de iniciar a onda seguinte.

## Objetivo

Impedir que uma onda seja dada por encerrada sem verificação objetiva.

## Escopo

Achados, critérios de saída, regressão, governança e marco.

## Conteúdo

### 1. Achados concluídos (8)

- [ ] `ARC-002` — God-context AppContext (730L, 63 membros, 86 consumidores)
- [ ] `ARC-004` — Duas máquinas de estado servidor (imperativa PHP x TanStack Query)
- [ ] `ARC-005` — Monólitos página/diálogo (10 arquivos de 700 a 2.104 linhas)
- [ ] `PERF-001` — Chunks-gigante: entry 789kB, CardGenericoDialog 791kB, FinObraDetalhe 674kB
- [ ] `PRO-004` — DP: dualidade legado/novo (provisões, HE, histórico, fopag em 2 bancos)
- [ ] `PERF-003` — Granularidade de render inexistente (React.memo usado 2x)
- [ ] `DS-011` — 6 implementações independentes de Kanban
- [ ] `DS-016` — 31 diálogos de domínio autofetchantes (UI acoplada a dados)

### 2. Critérios de saída da onda

- [ ] Nenhum chunk de rota/diálogo acima de 500 kB sem justificativa registrada
- [ ] Nenhum monólito misturando UI, dados e regra no mesmo arquivo
- [ ] Paradigma único de estado servidor; origem do backend invisível aos componentes
- [ ] DP com fonte única de dados
- [ ] EST-001 encerrado por absorção
- [ ] Interação de drag não reconcilia colunas não afetadas

### 3. Regressão

- [ ] Suíte unit completa verde (baseline 421).
- [ ] E2E das jornadas críticas verde.
- [ ] Regressão específica da onda executada ([07](07_Plano_Regressao.md)).
- [ ] Nenhuma jornada crítica vermelha.

### 4. Governança

- [ ] Todo trabalho referencia um ID do Catálogo.
- [ ] Registro de desvios atualizado e revisado.
- [ ] Descobertas de Execução (D-xx) avaliadas.
- [ ] Documentação incremental atualizada.
- [ ] Sumário de uma página da onda produzido.

### 5. Marco

- [ ] Merge na linha principal com CI verde.
- [ ] Tag **M7** aplicada.
- [ ] Release publicada com os IDs concluídos.
- [ ] **Aprovação formal da onda registrada.**

### 6. Desbloqueio da próxima onda

- [ ] Condições de `NO-GO` da próxima onda verificadas (ver [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md)).

## Conclusão

Marcados todos os itens, a Onda 6 está encerrada e a Onda 7 pode iniciar.

## Referências

- [Critérios de Aceite](05_Criterios_Aceite.md) · [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md) · [Checklist Final](../../04_VALIDACAO/Checklist_Final.md)

---

**Navegação:** [← Onda 5](../ONDA_05/README.md) · [Índice de Ondas](../) · [Onda 7 →](../ONDA_07/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
