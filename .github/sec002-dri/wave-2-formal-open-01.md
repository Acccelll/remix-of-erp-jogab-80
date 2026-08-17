---
sec002_apply_id: wave-2-formal-open-01
matrix_version: v2026-07-12.1
window:
  starts_at: 2026-07-12T00:00:00Z
  ends_at: 2026-07-13T00:00:00Z
roles:
  dri_technical:
    primary: Lovable
    backup: GestaoObraMaintainer
    available: true
  dri_platform:
    primary: GestaoObraPlatform
    backup: GestaoObraMaintainer
    available: true
  dri_tests:
    primary: GestaoObraQA
    backup: GestaoObraMaintainer
    available: true
  dri_observability:
    primary: GestaoObraObservability
    backup: GestaoObraMaintainer
    available: true
  dri_security:
    primary: GestaoObraSecurity
    backup: GestaoObraMaintainer
    available: true
  comms_owner:
    primary: GestaoObraComms
    backup: GestaoObraMaintainer
    available: true
  incident_commander:
    primary: GestaoObraIC
    backup: GestaoObraMaintainer
    available: true
  gm_approver:
    primary: Cappucceno
    backup: GestaoObraMaintainer
    available: true
handoffs:
  pre_apply: local://sec002/wave-2-formal-open-01/pre-apply
  rollback: local://sec002/wave-2-formal-open-01/rollback
  post_apply: null
evidence_refs:
  go_no_go: .github/sec002-go-no-go/wave-2-formal-open-01.md
  comms: .github/sec002-comms/wave-2-formal-open-01.md
  acceptance: .github/sec002-acceptance/wave-2-formal-open-01.md
approved_by:
  dri_technical: Lovable
  gm: Cappucceno
---

# DRI — wave-2-formal-open-01

DRI GM: Cappucceno
DRI técnico: Lovable

## Escopo

Registro DRI documental para satisfazer `E_WAVE2_PC6` da abertura formal da Onda 2.

## Restrições

- Não abre a Onda 2.
- Não satisfaz PC7.
- Não altera workflow, apply-map, `INDEX.md` ou produção.
