# Onda 5 — Sumário de Uma Página (M6-parcial)

**Objetivo original:** Regras e fluxo financeiro consolidados (6 Achados).
**Resultado:** **3/6 concluídos** — 3 diferidos para **sub-onda 5.F** por decisão D-8.
**Tag:** **M6-parcial** (Tag M6 definitiva aguarda sub-onda 5.F).

## Entregas concluídas

| ID        | Descrição                                                                       | Changeset                                          |
| --------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `BIZ-001` | Curva S/EVM centralizada em `lib/pmbok` (AnaliseTab sem cálculo próprio)        | [BIZ-001](../../06_CHANGESETS/BIZ-001.md)          |
| `BIZ-003` | Camada de validação de domínio única (`src/lib/schemas/*`, 5 entidades)         | [BIZ-003](../../06_CHANGESETS/BIZ-003.md)          |
| `DS-001`  | Arquitetura de formulários RHF + zod + shadcn Form (`ui/form.tsx` + convenção) | [DS-001](../../06_CHANGESETS/DS-001.md)           |

## Diferidos — sub-onda 5.F (D-8)

| ID        | Motivo de deferimento                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `PRO-011` | `financeiro_lancamentos` é espelho TOTVS por D-3; três-way match exige nova tabela `obrigacoes_recebimento` dependente de PRO-013. |
| `PRO-013` | Aguarda contrato do snapshot TOTVS (colunas de matching, tolerância de valor/prazo, janela).                                       |
| `PRO-014` | Depende de PRO-013 (fonte única de verdade por período).                                                                           |

**Pré-condições para abrir 5.F** (ver D-8):
1. Schema `obrigacoes_recebimento` especificado.
2. Regra formal de three-way match (tolerâncias, exceção).
3. Formato do snapshot TOTVS para conciliação.
4. Estrutura da DRE gerencial (grupos, contas, regime).

## Decisões registradas

- **D-7** — Reversão parcial de D-6: `ui/form.tsx` recriado como base de DS-001, agora que BIZ-003 forneceu schemas centralizados. Migração legada vira backlog incremental.
- **D-8** — Sub-onda financeira 5.F formalizada; Onda 5 encerra como M6-parcial; Onda 6 destravada.

## Regressão

- `bunx tsgo --noEmit` → verde.
- `bunx vitest run` → **437/437 verdes** (baseline 421 mantida ao longo dos 3 changesets).
- E2E das jornadas críticas — pré-condição da Tag M6 definitiva (executada na sub-onda 5.F).

## Critérios de saída

| Critério                                                          | Status               |
| ----------------------------------------------------------------- | -------------------- |
| Contrato de validação único nas 5 entidades mais editadas         | Atingido (BIZ-003)   |
| Curva/EVM com fonte única                                         | Atingido (BIZ-001)   |
| Arquitetura de formulários publicada + exemplar                   | Atingido (DS-001)    |
| Conciliação TOTVS × lançamentos fechando período                  | Sub-onda 5.F         |
| Recebimento gerando obrigação financeira rastreável à OC          | Sub-onda 5.F         |
| DRE gerencial por período disponível                              | Sub-onda 5.F         |

## Próximos passos

1. **Onda 6 — Grandes Refatorações Estruturais** (ARC-005, DS-011/016, PERF-001, ARC-002 → ARC-004): iniciar após verificação das condições de NO-GO no Stage Gate.
2. **Sub-onda 5.F** (PRO-013 → PRO-011 → PRO-014): abrir quando as 4 pré-condições de D-8 forem atendidas por Produto/Integração.
