# 04 — Contrato de Execução

> Documento normativo. Define o que **não pode** ser alterado durante a implementação.

## Resumo Executivo

Sete restrições invioláveis, cinco critérios globais de aceite e as regras de governança que preservam a rastreabilidade entre Auditoria e Execução. Violar qualquer restrição exige **nova auditoria**, não decisão do executor.

## Objetivo

Impedir que a execução altere o que a auditoria fixou, e que descobertas de implementação inflem o escopo silenciosamente.

## Escopo

Restrições, critérios de aceite, critérios de regressão, governança de desvios e critérios de encerramento.

## Conteúdo

### 1. Restrições invioláveis (não alteráveis sem nova auditoria)

1. **Fusões obrigatórias.** `ARC-005 + PERF-001 + DS-011 + DS-016` é **uma** cirurgia. `DS-010 + PERF-002` é **um** pacote. `DS-001 + BIZ-003` é **um** programa. Separá-los gera retrabalho garantido.
2. **Nenhuma cirurgia de regressão Muito Alta sem caracterização E2E prévia** (TST-001.a / TST-002).
3. **SEC-002 executa por lotes**, com validação por lote. Nunca de uma vez.
4. **ARC-002 e ARC-004 não se paralelizam** com nada, nem entre si e outra cirurgia.
5. **Prioridades, IDs, diagnósticos e critérios de aceite não podem ser alterados** pela execução.
6. **Descobertas de execução não viram Achados** sem avaliação formal de fim de onda.
7. **As 6 decisões pendentes (D-1 a D-6) pertencem ao dono do produto**, não ao executor.

### 2. Decisões pendentes (bloqueiam ondas específicas)

| #   | Decisão                                                                                                                                                                                                                                                   | Achado           | Bloqueia                  | Quem decide         | Prazo                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------- | ------------------- | -------------------------- |
| D-1 | ~~Corrigir a auth PHP (hash+assinatura) ou migrar já para Supabase Auth?~~ **Decidida 2026-07-11: migrar já para Lovable Cloud Auth** — [registro](07_DECISOES.md#d-1--autenticação-sec-001--bloqueia-onda-2)                                             | SEC-001          | ~~Onda 2~~ (destravada)   | Produto/Arquitetura | ~~Antes do fim da Onda 1~~ |
| D-2 | ~~Regime-alvo de acesso por tabela~~ **Decidida 2026-07-11: RLS estrita por empresa + role (has_role + current_empresas), GM bypass explícito** — [registro](07_DECISOES.md#d-2--regime-alvo-de-acesso-por-tabela--bloqueia-onda-2)                       | SEC-002          | Onda 2 (destravada)       | Produto/Segurança   | ~~Antes do fim da Onda 1~~ |
| D-3 | ~~Canonicidade de cada entidade espelhada~~ **Decidida 2026-07-11: `colaboradores` e `obras` canônicos; `players`/`centros_custo_totvs` espelhos read-only** — [registro](07_DECISOES.md#d-3--canonicidade-de-entidades-espelhadas--bloqueia-ondas-3-e-6) | DB-005 → PRO-004 | Ondas 3 e 6 (destravadas) | Produto             | ~~Antes do fim da Onda 1~~ |
| D-4 | Emitir NF ou integrar emissor externo?                                                                                                                                                                                                                    | PRO-017          | Onda 7                    | Negócio             | Durante a Onda 7           |
| D-5 | Riscos/Lições: portfólio x obra — qual é a fonte?                                                                                                                                                                                                         | UX-007           | Onda 7                    | Produto             | Durante a Onda 7           |
| D-6 | ~~Destino das peças mortas (ui/form, ui/drawer, ui/chart)~~ **Decidida 2026-07-11: remover agora (aplicado em Onda 4 / DS-013)** — [registro](07_DECISOES.md#d-6--destino-das-peças-mortas-uiform-uidrawer-uichart--onda-4)                               | DS-013           | Onda 4                    | Arquitetura         | ~~Durante a Onda 1~~       |

### 3. Critérios globais de aceite (toda implementação)

- (a) Referencia um **ID** do Catálogo Mestre.
- (b) Satisfaz **integralmente** os Critérios de Aceite da ficha original.
- (c) **CI verde** (install+build+test; acrescido de lint/typecheck a partir da Onda 1).
- (d) Suíte existente **sem regressão** (baseline: 421 testes verdes).
- (e) **Nenhuma alteração de comportamento** não prevista na ficha.
- (f) Documentação incremental atualizada.

### 4. Critérios de regressão (após cada onda)

Reexecutar: suíte unit completa; E2E das jornadas críticas; e, conforme a onda — acesso por papel (Onda 2), integridade de fronteira (Onda 3), totais de listas (Onda 4), números financeiros (Onda 5), paridade funcional de card/obra/DP (Onda 6). **Nenhuma jornada crítica pode ficar vermelha.**

### 5. Governança de desvios

Toda descoberta durante a implementação é registrada como **Descoberta de Execução (D-xx)** em um log versionado, com: ID afetado, desvio, motivo, decisão, impacto em dependências. Ao fim da onda avalia-se se (a) cabe no Achado existente, (b) exige auditoria pontual, ou (c) entra como débito registrado.

### 6. Critérios de encerramento da modernização

1. Os 10 critérios do [Plano de Validação](../04_VALIDACAO/Plano_Validacao.md) satisfeitos.
2. Os 8 marcos (M1–M8) tagueados.
3. Os 107 IDs concluídos ou formalmente reclassificados com justificativa.
4. Token forjado rejeitado e leitura anônima vazia.
5. Banco recriável do zero e backup restaurável.
6. Nenhum chunk acima de 500 kB sem justificativa.
7. Um paradigma de estado; uma fonte de moeda, data, status e EVM; um sistema de toast.
8. Runbooks permitindo que um novo mantenedor opere e recupere o sistema sem conhecimento tácito.

## Conclusão

Este contrato não é burocracia: cada restrição corresponde a um risco identificado e quantificado na auditoria. Cumpri-lo é o que separa execução de improviso.

## Referências

- [LEIA PRIMEIRO](00_LEIA_PRIMEIRO.md) · [Stage Gate](05_STAGE_GATE_GO_NO_GO.md) · [Plano de Validação](../04_VALIDACAO/Plano_Validacao.md) · [Checklist Final](../04_VALIDACAO/Checklist_Final.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
