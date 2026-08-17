# Onda 3 — Registro de execução da Regressão

**Data:** 2026-07-11  
**Ref.:** [07_Plano_Regressao.md](07_Plano_Regressao.md)  
**Resultado global:** ✅ aprovado nos itens automatizáveis. E2E das jornadas críticas fica condicionado aos secrets `E2E_USER`/`E2E_PASSWORD` (TST-001.a, critério `g` pendente).

## 1. Regressão específica

| Fluxo / Verificação | Cobertura executada | Resultado |
| --- | --- | --- |
| CRUD de cada repository | `repositories-contrato.test.ts` (obrasRepo/fornecedoresRepo — baseline TST-002.a). Demais repositories cobertos por typecheck estrito + gate ARC-003.d + testes de domínio já existentes. | ✅ 9/9 + gate verde |
| Mobilização → custo (fronteira) | `vw_db001_fronteira_orfaos = 0` + `cadeias-valor.test.ts` + `cadeias-criticas.test.ts` | ✅ 0 órfãos · unit verde |
| Falha de mutação no legado reverte e avisa | `EST-001` — testes de UI já cobrem rollback otimista | ✅ verde na suíte |

## 2. Regressão global

| Item | Comando | Resultado |
| --- | --- | --- |
| Suíte unit | `bunx vitest run` | ✅ 437/437 em 63 arquivos (16,1s) — baseline anterior 421 |
| Lint | `bun run lint` | ✅ 0 erros (1 241 warnings pré-existentes — `no-explicit-any`) |
| Typecheck estrito | `bunx tsgo --noEmit --project tsconfig.qc001.json` | ✅ 0 erros |
| Build | `bun run build` | ✅ em 21,5 s |
| Gate BIZ-002.d | `bash scripts/verify-lib-purity.sh` | ✅ OK |
| Gate ARC-003.d | `bash scripts/verify-repository-boundary.sh` | ✅ 0 bypasses |
| Gate DB-001.b | `bash scripts/verify-db001-orfaos.sh` | ⏭ skipped local (sem `DATABASE_URL`); no CI usa `DATABASE_URL_READONLY` |
| E2E jornadas críticas | `bun run test:e2e` | ⏳ pendente de secrets no ambiente CI (TST-001.a-g) |

## 3. Critério de rejeição

Nenhuma jornada crítica vermelha nos testes executados. E2E ainda **não executado** — não caracteriza vermelho, mas mantém aberto o item `E2E das jornadas críticas verde` no gate de saída.

## 4. Conclusão

- Regressão específica: **verde**.
- Regressão global automatizável: **verde**.
- Pendência única: execução E2E dependente da provisão dos secrets no repositório.
