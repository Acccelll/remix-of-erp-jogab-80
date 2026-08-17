# 05 — Stage Gate: veredito GO / NO-GO

> Reprodução do veredito formal da **Etapa 14.5**. Consulte a íntegra em [GOVERNANCA/01_AUDITORIA/ETAPA_14_5_GATE_EXECUCAO.md](../../GOVERNANCA/01_AUDITORIA/ETAPA_14_5_GATE_EXECUCAO.md).

## Resumo Executivo

À pergunta _"o backlog está pronto para ser executado **integralmente** sem novas decisões arquiteturais?"_, a resposta é **NÃO**. O veredito é **`GO` CONDICIONAL**: autorizadas as Ondas 0 e 1; bloqueadas as Ondas 2 e 6 até condições explícitas.

## Objetivo

Fixar os limites da autorização de execução.

## Escopo

Veredito, defeitos corrigidos, condições de desbloqueio.

## Conteúdo

### Veredito formal

| Onda                     | Status               | Condição                                                                           |
| ------------------------ | -------------------- | ---------------------------------------------------------------------------------- |
| **0 · Contenção**        | ✅ `GO`              | Imediato                                                                           |
| **1 · Fundação**         | ✅ `GO`              | Após aprovação da Onda 0                                                           |
| **2 · Segurança**        | ⛔ `NO-GO`           | Requer: ARC-009 entregue **+** TST-001.a verde **+** decisões **D-1** e **D-2**    |
| **3 · Dados**            | ✅ `GO` condicionado | Após aprovação da Onda 1                                                           |
| **4 · Padronização**     | ✅ `GO` condicionado | Após aprovação da Onda 1                                                           |
| **5 · Regras**           | ✅ `GO` condicionado | Após aprovação das Ondas 1 e 3                                                     |
| **6 · Refatorações**     | ⛔ `NO-GO`           | Requer: Ondas 1–3 aprovadas **+** TST-001.b e TST-002 verdes **+** decisão **D-3** |
| **7 · Produto/Operação** | ✅ `GO` condicionado | Após aprovação da Onda 6 (itens dependentes)                                       |

### Defeitos de planejamento corrigidos pelo Gate

| ID       | Defeito                                                             | Correção aplicada                                                        |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **G-01** | ARC-009 era dependência de SEC-002 mas não pertencia a nenhuma onda | Realocado para a **Onda 1**                                              |
| **G-02** | OPS-001 (Onda 0) dependia de QC-001/QC-002 (Onda 1)                 | Cindido em **OPS-001.a** (Onda 0) e **OPS-001.b** (Onda 1)               |
| **G-03** | Quase-ciclo TST-001 ↔ SEC-001                                       | Cindido em **TST-001.a** (caracterização) e **TST-001.b** (consolidação) |
| **G-04** | Pinagem CDN do `xlsx` faria o CI nascer vermelho                    | **Antecipada para a Onda 0** como pré-condição de OPS-001.a              |
| **G-05** | ~65 fichas com campos de classificação por derivação                | Materialização documental na **Onda 0**                                  |

> **Correção adicional aplicada na montagem deste pacote (mesmo princípio do Gate):** `OPS-006` foi cindido em **OPS-006.a** (backup verificado, Onda 0, sem dependências) e **OPS-006.b** (rollback coordenado front↔schema, Onda 3, após DB-003/DB-004), pois a ficha original declarava dependência de itens de onda posterior. `ARC-010` e `EST-001` foram realocados para a **Onda 3**, junto de `ARC-003`, de quem dependem. Nenhum Achado, prioridade ou critério foi alterado.

**Resultado da validação de dependências após correções: grafo acíclico, zero dependências apontando para ondas posteriores.**

### As 6 decisões pendentes

| #   | Decisão                                                                    | Achado           | Bloqueia    | Quem decide         | Prazo                  |
| --- | -------------------------------------------------------------------------- | ---------------- | ----------- | ------------------- | ---------------------- |
| D-1 | Corrigir a auth PHP (hash+assinatura) ou migrar já para Supabase Auth?     | SEC-001          | Onda 2      | Produto/Arquitetura | Antes do fim da Onda 1 |
| D-2 | Regime-alvo de acesso por tabela (quais permanecem públicas: QR, edges)    | SEC-002          | Onda 2      | Produto/Segurança   | Antes do fim da Onda 1 |
| D-3 | Canonicidade de cada entidade espelhada (MySQL ou Postgres manda?)         | DB-005 → PRO-004 | Ondas 3 e 6 | Produto             | Antes do fim da Onda 1 |
| D-4 | Emitir NF ou integrar emissor externo?                                     | PRO-017          | Onda 7      | Negócio             | Durante a Onda 7       |
| D-5 | Riscos/Lições: portfólio x obra — qual é a fonte?                          | UX-007           | Onda 7      | Produto             | Durante a Onda 7       |
| D-6 | Destino das peças mortas (ui/form, ui/drawer, ui/chart): adotar ou remover | DS-013           | Onda 4      | Arquitetura         | Durante a Onda 1       |

**D-1, D-2, D-3 e D-6 devem ser resolvidas antes do fim da Onda 1.**

### Checklist formal D-9 — pré-condição para GO da Onda 6

> Verificação executada em **2026-07-12** como continuação de D-9. Objetivo: confirmar se a condição cumulativa "Ondas 1–3 aprovadas" já permite destravar a Onda 6.

| Onda | Status formal no checklist | Evidência | Veredito para D-9 |
| ---- | -------------------------- | --------- | ----------------- |
| **1 · Fundação Técnica** | ⚠️ Entregas técnicas e regressão E2E críticas marcadas, mas marco formal permanece aberto | `05_ONDAS/ONDA_01/10_Checklist_Conclusao.md`: TST-001.a M1/M5/M7/M8 verde em 2026-07-16; merge/tag/release/aprovação formal ainda não marcados | **Não aprovada formalmente** |
| **2 · Segurança** | ⛔ Checklist de conclusão não iniciado | `05_ONDAS/ONDA_02/10_Checklist_Conclusao.md`: SEC-001/002/004/005/007 e critérios de segurança ainda abertos | **Não aprovada** |
| **3 · Dados e Camadas** | ⚠️ Achados técnicos marcados, mas E2E, governança e marco permanecem abertos | `05_ONDAS/ONDA_03/10_Checklist_Conclusao.md`: E2E, governança parcial, merge/tag/release/aprovação formal não marcados | **Não aprovada formalmente** |

**Conclusão D-9:** a Onda 6 permanece em **`NO-GO`**. A condição "Ondas 1–3 aprovadas" **não está atendida**; portanto, mesmo com TST-002 concluída, ainda faltam:

1. fechamento formal das pendências de aprovação das Ondas 1 e 3;
2. execução e aprovação da Onda 2, incluindo TST-001.b pós-cutover de autenticação;
3. marcação explícita dos marcos/release/aprovação formal nos checklists correspondentes.

## Conclusão

96 dos 107 Achados estão executáveis. Os defeitos encontrados eram de **sequenciamento, não de diagnóstico** — e o Gate os apanhou antes que custassem retrabalho. A execução pode começar hoje pela Onda 0.

## Referências

- [Etapa 14.5 — Gate completo](../../GOVERNANCA/01_AUDITORIA/ETAPA_14_5_GATE_EXECUCAO.md) · [Contrato](04_CONTRATO_EXECUCAO.md) · [Roadmap](../../GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
