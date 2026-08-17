# Onda 5 — Checklist de Conclusão

## Resumo Executivo

Gate de saída da onda. **Todos** os itens devem estar marcados antes de iniciar a onda seguinte.

## Objetivo

Impedir que uma onda seja dada por encerrada sem verificação objetiva.

## Escopo

Achados, critérios de saída, regressão, governança e marco.

## Conteúdo

### 1. Achados concluídos (3/6 · sub-onda 5.F por D-8)

- [x] `BIZ-001` — Curva S/EVM duplicada: AnaliseTab recalcula fora de lib/pmbok — ver [changeset](../../06_CHANGESETS/BIZ-001.md)
- [x] `BIZ-003` — Camada de validação de domínio ausente (2 schemas zod no sistema) — ver [changeset](../../06_CHANGESETS/BIZ-003.md)
- [x] `DS-001` — Ausência de arquitetura de formulários (ui/form.tsx morto) — ver [changeset](../../06_CHANGESETS/DS-001.md)
- [ ] `PRO-011` — **Deferido para sub-onda 5.F** (D-8: `financeiro_lancamentos` é espelho TOTVS por D-3; requer nova tabela `obrigacoes_recebimento` cuja forma depende de PRO-013).
- [ ] `PRO-013` — **Deferido para sub-onda 5.F** (D-8: aguarda contrato do snapshot TOTVS — colunas de matching, tolerância, janela).
- [ ] `PRO-014` — **Deferido para sub-onda 5.F** (D-8: depende do resultado de PRO-013).

### 2. Critérios de saída da onda

- [x] Contrato de validação único (tela = importador) nas 5 entidades mais editadas (`cliente`, `obra`, `colaborador`, `patrimonio`, `veiculo`)
- [x] Curva/EVM com fonte única; `AnaliseTab` sem cálculo próprio (BIZ-001)
- [x] Arquitetura de formulários publicada (DS-001, RHF + zod + shadcn Form) com formulário-exemplar migrado
- [ ] Conciliação TOTVS × lançamentos fechando período — **sub-onda 5.F**
- [ ] Recebimento de material gerando obrigação financeira rastreável à OC — **sub-onda 5.F**
- [ ] DRE gerencial por período disponível — **sub-onda 5.F**

### 3. Regressão

- [x] Suíte unit completa verde (437/437, baseline 421).
- [x] `tsgo --noEmit` verde.
- [ ] E2E das jornadas críticas verde (pré-condição da Tag definitiva).
- [x] Regressão específica dos itens concluídos executada (BIZ-001, BIZ-003, DS-001).
- [x] Nenhuma jornada crítica vermelha nos itens entregues.

### 4. Governança

- [x] Todo trabalho referencia um ID do Catálogo (BIZ-001, BIZ-003, DS-001).
- [x] Registro de desvios atualizado (D-7, D-8 em `00_EXECUTIVO/07_DECISOES.md`).
- [x] Descobertas de Execução avaliadas (D-7 reverte parcialmente D-6; D-8 formaliza sub-onda 5.F).
- [x] Documentação incremental atualizada (changesets BIZ-001, BIZ-003, DS-001).
- [x] Sumário de uma página da onda produzido (`Sumario_1p.md`).

### 5. Marco

- [x] Tag **M6-parcial** aplicada (BIZ-001 + BIZ-003 + DS-001).
- [ ] Tag **M6** definitiva — aplicada apenas ao encerramento da sub-onda 5.F (PRO-011/013/014).
- [x] Release parcial publicada com os IDs concluídos.
- [x] Aprovação formal do fechamento parcial registrada (D-8).

### 6. Desbloqueio da próxima onda

- [x] Onda 6 (Grandes Refatorações Estruturais) destravada — pré-condições atendidas por BIZ-001/BIZ-003/DS-001; sub-onda 5.F corre em paralelo condicionada às pré-condições listadas em D-8.

## Conclusão

Onda 5 encerrada como **M6-parcial** (3/6 Achados). Os três Achados financeiros (PRO-011/013/014) migram para a **sub-onda 5.F** por decisão D-8, aguardando pré-condições de produto/integração. A Onda 6 pode iniciar.

## Referências

- [Critérios de Aceite](05_Criterios_Aceite.md) · [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md) · [Checklist Final](../../04_VALIDACAO/Checklist_Final.md)

---

**Navegação:** [← Onda 4](../ONDA_04/README.md) · [Índice de Ondas](../) · [Onda 6 →](../ONDA_06/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
