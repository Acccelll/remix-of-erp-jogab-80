# Onda 3 — Checklist de Conclusão

## Resumo Executivo

Gate de saída da onda. **Todos** os itens devem estar marcados antes de iniciar a onda seguinte.

## Objetivo

Impedir que uma onda seja dada por encerrada sem verificação objetiva.

## Escopo

Achados, critérios de saída, regressão, governança e marco.

## Conteúdo

### 1. Achados concluídos (8)

- [x] `ARC-003` — Bypass da camada de repositories — Lotes: A (obras) [changeset](../../06_CHANGESETS/ARC-003.a.md), B.1 (fornecedores/requisicoes/insumos) [changeset](../../06_CHANGESETS/ARC-003.b.1.md), B.2 (demais suprimentos) [changeset](../../06_CHANGESETS/ARC-003.b.2.md), C.1 (riscos/lições) [changeset](../../06_CHANGESETS/ARC-003.c.1.md), C.2 (pacotes/restrições/compromissos/causas) [changeset](../../06_CHANGESETS/ARC-003.c.2.md), C.3 (ocorrências/localizações/aditivos/bms/marcos/rdo\_efetivo+ocorrências/import\_runs) [changeset](../../06_CHANGESETS/ARC-003.c.3.md), C.4 (cronograma\_itens+revisões+cenários) [changeset](../../06_CHANGESETS/ARC-003.c.4.md), C.5 (cards/board\_\*) [changeset](../../06_CHANGESETS/ARC-003.c.5.md). Exceção documentada: `src/lib/cards/trello-import.ts` mantém acesso direto por ser utilitário isolado de importação.
- [x] `BIZ-002` — Lib bimodal pura x impura sem convenção — Lotes: A (convenção + inventário + script de verificação) [changeset](../../06_CHANGESETS/BIZ-002.a.md), B (extração Trello/BMS) [changeset](../../06_CHANGESETS/BIZ-002.b.md), C (extração de puros + reclassificação orchestration) [changeset](../../06_CHANGESETS/BIZ-002.c.md), D (verify-lib-purity no CI) [changeset](../../06_CHANGESETS/BIZ-002.d.md).
- [x] `DB-001` — Fronteira PHP x Supabase sem integridade referencial (ids em text) — Lotes: A (CHECK de formato + relatório de órfãos zerado) [changeset](../../06_CHANGESETS/DB-001.a.md), B (plano FK real + gate de regressão CI) [changeset](../../06_CHANGESETS/DB-001.b.md). Execução das fases `DB-001.c.<n>` fica atrelada à migração canônica das entidades (Onda 4/5).
- [x] `EST-001` — Otimismo sem rollback nos domínios PHP (falha silenciosa) — ver [changeset](../../06_CHANGESETS/EST-001.md)
- [x] `TST-002` — Fronteira de backend e camada de dados sem testes de integração — Lote A (mock de supabase + contrato de query em `obrasRepo`/`fornecedoresRepo`) [changeset](../../06_CHANGESETS/TST-002.a.md). Lotes seguintes cobrem repositories restantes de forma incremental.
- [x] `ARC-008` — Query keys ad-hoc sem registro/fábrica (171 invalidações em 46 arquivos) — ver [changeset](../../06_CHANGESETS/ARC-008.md)
- [x] `DB-004` — Trilho MySQL de aplicação manual sem registro de estado — ver [changeset](../../06_CHANGESETS/DB-004.md)
- [x] `ARC-010` — services/ vestigial; dpHoleriteRepo fora de repositories/ — ver [changeset](../../06_CHANGESETS/ARC-010.md)

### 2. Critérios de saída da onda

- [x] Zero `supabase.from()` em `pages/` e `components/` para tabelas cobertas — gate `scripts/verify-repository-boundary.sh` no CI ([ARC-003.d](../../06_CHANGESETS/ARC-003.d.md))
- [x] Zero acesso a banco/I/O em módulo declarado puro (verificado por `scripts/verify-lib-purity.sh`)
- [x] Órfãos de fronteira zerados e formato validado por CHECK — ver [DB-001.a](../../06_CHANGESETS/DB-001.a.md)
- [x] Testes de integração de dados verdes — baseline `TST-002.a` (9/9)
- [x] Controle de migrations aplicadas no trilho MySQL — runner validado com `bash -n` e bit executável
- [x] Rollback coordenado front↔schema documentado (OPS-006.b) — ver [changeset](../../06_CHANGESETS/OPS-006.b.md)
- [x] Mutações otimistas do legado revertendo e avisando em falha (EST-001)

### 3. Regressão

- [x] Suíte unit completa verde — **437/437** (63 arquivos) em 16,1s no fim da Onda 3; baseline anterior 421.
- [ ] E2E das jornadas críticas verde.
- [x] Regressão específica da onda executada ([registro](11_Registro_Regressao.md)).
- [x] Nenhuma jornada crítica vermelha nos testes executados (E2E aguarda secrets).

### 4. Governança

- [ ] Todo trabalho referencia um ID do Catálogo.
- [ ] Registro de desvios atualizado e revisado.
- [ ] Descobertas de Execução (D-xx) avaliadas.
- [x] Documentação incremental atualizada para `ARC-008`, `DB-004`, `EST-001`, `ARC-010`, `ARC-003`, `BIZ-002`, `DB-001` (A+B) e `TST-002.a`.
- [x] Sumário de uma página da onda produzido — [00_Sumario_1pag.md](00_Sumario_1pag.md).

### 5. Marco

- [ ] Merge na linha principal com CI verde.
- [ ] Tag **M4** aplicada.
- [ ] Release publicada com os IDs concluídos.
- [ ] **Aprovação formal da onda registrada.**

### 6. Desbloqueio da próxima onda

- [ ] Condições de `NO-GO` da próxima onda verificadas (ver [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md)).

## Conclusão

Marcados todos os itens, a Onda 3 está encerrada e a Onda 4 pode iniciar.

## Referências

- [Critérios de Aceite](05_Criterios_Aceite.md) · [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md) · [Checklist Final](../../04_VALIDACAO/Checklist_Final.md)

---

**Navegação:** [← Onda 2](../ONDA_02/README.md) · [Índice de Ondas](../) · [Onda 4 →](../ONDA_04/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
