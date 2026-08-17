# Onda 3 — Sumário de uma página

**Tema:** Dívida técnica estrutural (fronteira PHP↔Supabase, repositories, lib bimodal, testes de integração)  
**Marco alvo:** M4  
**Status:** 8/8 Achados concluídos · gates técnicos verdes · pendências: E2E e Marco.

## 1. O que mudou (Achados)

| ID | Entrega | Gate |
| --- | --- | --- |
| ARC-003 (A–D) | Migração de `supabase.from` para `src/lib/repositories/*` + gate CI de fronteira | `verify-repository-boundary.sh` |
| BIZ-002 (A–D) | Convenção `@module-kind` (pure/orchestration/io) + extrações + gate CI | `verify-lib-purity.sh` |
| DB-001 (A–B) | `CHECK` de formato + view `vw_db001_fronteira_orfaos` (0 órfãos) + gate CI + plano faseado de FK real | `verify-db001-orfaos.sh` |
| EST-001 | Mutações otimistas do legado revertendo e avisando em falha | testes de UI |
| TST-002 (A) | Mock de Supabase + contrato de query em `obrasRepo`/`fornecedoresRepo` | vitest 9/9 |
| ARC-008 | Fábrica de query keys (fim das 171 invalidações ad-hoc) | uso obrigatório |
| DB-004 | Registro de estado das migrations MySQL de aplicação | runner |
| ARC-010 | `dpHoleriteRepo` movido para `repositories/`; `services/` extinto | grep-check |

## 2. Números do gate técnico

- **Suíte unit:** 437/437 em 63 arquivos (baseline anterior 421). ✅
- **Órfãos DB-001:** `SUM(total_orfaos) = 0`. ✅
- **Bypasses de repository em pages/components:** 0 (com exceção documentada `trello-import.ts`). ✅
- **Módulos `src/lib` sem `@module-kind`:** 0. ✅
- **Linter Supabase:** só avisos pré-existentes de políticas permissivas (catálogo SEC/DB-002).

## 3. Novos gates de CI (bloqueiam PR)

1. `verify-lib-purity.sh` — BIZ-002.d
2. `verify-repository-boundary.sh` — ARC-003.d
3. `verify-db001-orfaos.sh` — DB-001.b (skipped sem DATABASE_URL)

## 4. Governança & Operação

- **OPS-006.b** — Rollback coordenado front↔schema (Lovable Cloud/Supabase) documentado: classificação aditiva/compatível/destrutiva, PITR, checks pós-restore.
- **Contrato §1:** respeitado — nenhuma cirurgia sem caracterização prévia; toda mudança referencia ID do Catálogo.

## 5. Riscos residuais

- Fases `DB-001.c.<n>` (conversão para FK real) dependem da migração canônica de `colaboradores`/`patrimonios`/`veiculos` (Onda 4/5).
- Cobertura de repositories em testes de integração é baseline (2 domínios) — expansão incremental via `TST-002.b..z`.
- Feature flag `manutencao_ativa` (dep. OPS-006.b) ainda inexistente (D-21).

## 6. Pendências para fechar a Onda

- [ ] E2E das jornadas críticas verde (depende dos secrets `E2E_USER`/`E2E_PASSWORD`).
- [ ] Regressão específica ([07_Plano_Regressao](07_Plano_Regressao.md)).
- [ ] Merge com CI verde + tag **M4** + aprovação formal.

## 7. Desbloqueio da próxima onda

Condições de `NO-GO` da Onda 4 a validar no [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md).

---

_Sumário canônico da Onda 3 — 1 página. Referencia [Checklist de Conclusão](10_Checklist_Conclusao.md)._
