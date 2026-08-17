# Onda 1 — Sumário de Uma Página

**Período:** 2026-07 · **Marco alvo:** M2 · **Status:** Encerramento em curso (pendências residuais: E2E, marco, aprovação formal)

## Objetivo

Consolidar fundações de qualidade (tipagem, lint, testes), publicar canonicidade de dados e unificar a fachada de autorização, sem alterar comportamento funcional.

## Achados concluídos (12/12)

| Área | IDs |
|---|---|
| Arquitetura | `ARC-001` (débito documentado), `ARC-006`, `ARC-007`, `ARC-009`, `ARC-011` |
| Banco de dados | `DB-003`, `DB-005` |
| Qualidade / Testes | `QC-001`, `QC-002`, `QC-004`, `TST-003` |
| Design System | `DS-013` |

## Entregas-chave

- **Fachada de autorização única** — `src/lib/authz/` (`useAuthz()` + `authorize()` puro).
- **Baseline de banco reconstruível** — `scripts/db/rebuild-baseline.sh` + `docs/db/MIGRATIONS_INDEX.md`.
- **Matriz de Canonicidade** — `docs/db/CANONICIDADE.md` (D-3).
- **CI bloqueante** — `lint` + `typecheck` em `.github/workflows/ci.yml` (OPS-001.b).
- **Régua de formatação** — `.prettierrc.json`, scripts `format`/`format:check` (QC-006/QC-007).
- **Reorganização de gavetas** — 7 lotes em `lib/` e `components/` (ARC-007).

## Métricas objetivas

- **Testes unitários:** 426 verdes / 61 arquivos (baseline 421 superada).
- **Lint:** 0 erros.
- **Typecheck estrito:** verde em `lib/` e `repositories/`.
- **Páginas órfãs removidas:** 4 · **UI mortos removidos:** 3 componentes.

## Decisões registradas

D-1, D-2, D-3, D-6 → [07_DECISOES.md](../../00_EXECUTIVO/07_DECISOES.md).

## Débitos herdados

- **ARC-001** — regeneração de `src/integrations/supabase/types.ts` (≈100 interfaces locais em `pages/**` só serão substituídas após a regeneração).
- **DB-005 / enforcement RLS** — previsto para Onda 6.

## Pendências para fechamento

- E2E das jornadas críticas; regressão específica da onda ([07](07_Plano_Regressao.md)).
- Merge com CI verde, tag **M2**, release e aprovação formal.
- Verificação das condições `NO-GO` da Onda 2 ([Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md)).

## Referências

[Critérios de Aceite](05_Criterios_Aceite.md) · [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Changesets](../../06_CHANGESETS/)

---

_Pacote Oficial de Governança da Modernização — Planifik._
