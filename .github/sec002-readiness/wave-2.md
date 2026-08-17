---
apply_id: wave-2-readiness-01
schema_version: v2026-07-12.4
status: OPEN
dri_gm: Cappucceno
opened_at: null
source_spec: docs/modernizacao/EXECUCAO/06_CHANGESETS/SEC-002.wave-2-formal-open-01.pc2-scope-01.artifact-01.spec-01.md
blocked_by:
  - E_WAVE2_PC3
  - E_WAVE2_PC4
  - E_WAVE2_PC5
  - E_WAVE2_PC6
  - E_WAVE2_PC7
---

# Onda 2 — Checklist de Prontidão (BLOCKED)

## Estado

- Status atual: OPEN
- Apply-map canônico: v2026-07-12.4
- Verificador de referência: scripts/sec002/verify-wave-2-preconditions.mjs
- Abertura formal: proibida até PC1–PC7 retornarem OK no verificador R97

## Pré-condições operacionais

- O2-P1: SEC-001 CLOSED (documental) indexado — evidência R101/R103; condição usada por PC1.
- O2-P2: SEC-001.k estável — RBAC server-sourced deve permanecer em produção por pelo menos 48h sem divergência entre perfil local e autoridade do backend.
- O2-P3: Sem rota paralela de auth — `ensureSupabaseSession` e `sync-player-auth` devem estar ausentes fora de histórico/auditoria antes de qualquer apply executável.
- O2-P4: Backup lógico válido — contagens, restore list e hash devem ser registrados antes do lock operacional.
- O2-P5: Paridade staging-producao — checklist de paridade derivado de R30 deve estar assinado e rastreável.
- O2-P6: Freeze ativo — `sec002_freeze_active=true` e `freeze-guard` verde devem existir antes do primeiro apply.
- O2-P7: Apply-map terminal — `validate-apply-map` deve retornar OK em `v2026-07-12.4`, sem bump pendente sem par spec/materialize.
- O2-P8: Consumers integros — `check-consumers` deve retornar OK, provando consumo do loader compartilhado.
- O2-P9: Evidence index integro — `validate-evidence-index` deve retornar OK sobre o índice canônico da cadeia SEC-002.
- O2-P10: Self-register guard verde — runner T1–T5 deve retornar OK para o guard de autoregistro.
- O2-P11: DRIs presentes — matriz DRI deve estar preenchida para os applies da Onda 2, com GM e técnico segregados.
- O2-P12: Comunicacao T-24h pronta — log inicial de comunicação deve existir, com audiência, cadência e responsável definidos.

## Write set autorizado após abertura formal

1. helpers-02
2. tests-02-suite
3. batch-B
4. batch-C
5. batch-D
6. batch-E
7. post-rls-handoff

Nenhum apply fora desta lista pode ser executado dentro da Onda 2 sem errata formal.

## Abertura formal

- Status anterior: BLOCKED
- Status atual: OPEN
- Data: 2026-07-12T17:16:41Z
- Apply-id: wave-2-formal-open-01
- DRI GM: Cappucceno
- DRI técnico: Lovable
- Evidência SEC-001 CLOSED: docs/modernizacao/EXECUCAO/06_CHANGESETS/SEC-001.formal-closure-01.md
- Pré-condições verificadas: PC1, PC2, PC3, PC4, PC5, PC6, PC7
- Selo preparatório preservado: R94 (FS1–FS8)
- Write set liberado: helpers-02, tests-02-suite, batch-B, batch-C, batch-D, batch-E, post-rls-handoff
