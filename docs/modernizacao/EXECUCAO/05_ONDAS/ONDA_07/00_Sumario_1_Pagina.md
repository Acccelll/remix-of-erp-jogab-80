# Onda 7 — Sumário de Uma Página

**Tema:** Fechamento funcional dos 43 achados residuais + prontidão operacional para o marco **M8**.

## Escopo tratado

- **Produto (PRO-\*):** 25 achados encerrados por slice ou NOTA-FIM; 4 com fase 1 entregue e fase 2 diferida para Onda 8 (PRO-008, PRO-010, PRO-015, PRO-026); 1 reclassificado integralmente para Onda 8 (PRO-017 — emissão de NF exige integração fiscal externa fora do perímetro).
- **UX (UX-\*):** 8 achados fechados — foco em acessibilidade (nomes acessíveis, teclado no DnD), overflow de tabelas, ajuda contextual, favoritos globais e densidade executiva.
- **Operação (OPS-\*):** logs estruturados + correlação (OPS-003), monitor por fluxo e health agregado (OPS-004), perfis de ambiente versionados (OPS-005), 7 runbooks publicados (OPS-007), incident-runbook consolidado (OPS-006, SEC-002).
- **Dados/Segurança/Perf:** DB-006 (nomenclatura), EST-003 (inventário de persistência local — 28 chaves), SEC-006 (timeout/deadline em chamadas), PERF-004 (fontes fora do caminho crítico).

## Débito reconhecido

| ID | Estado | Encaminhamento |
|---|---|---|
| PRO-008 f2, PRO-010 f2, PRO-015 f2 | Fase 1 entregue | Onda 8 — trilho Integrações Externas |
| PRO-026 slice-03 | Aceite parcial | Onda 8 opcional |
| PRO-017 | Reclassificado integral | Onda 8 — emissor fiscal + tributos por regime |

## Regressão

- **Unit:** `bunx vitest run` verde — 118 arquivos / 906 testes (`TST-002.ONDA7-REGRESSAO-GREEN`).
- **E2E:** specs íntegras em `e2e/journeys/M{1,5,7,8}-*.spec.ts`; setup compatível com credenciais ou sessão gerenciada injetada; execução ainda bloqueada por ausência de sessão/ambiente E2E válido (`TST-003.E2E-BLOQUEADO`).

## Governança

- 43/43 achados com posicionamento formal (encerrado, faseado ou reclassificado).
- Todos os slices referenciam ID do Catálogo (Contrato §Rastreabilidade).
- Onboarding publicado em `docs/onboarding.md`.
- Descobertas de execução consolidadas em `00_EXECUTIVO/08_DESCOBERTAS.md`.

## Gate M8 — condição

Pendente **exclusivamente** de:
1. Execução E2E verde em ambiente com navegador + sessão válida (destravar `TST-003`).
2. Regressão específica da onda (`07_Plano_Regressao.md`) executada em ambiente com dados de caracterização.
3. Aprovação formal registrada em `05_STAGE_GATE_GO_NO_GO.md`.

Não há débito de código para o fechamento da Onda 7 além do que já está listado como diferido.
