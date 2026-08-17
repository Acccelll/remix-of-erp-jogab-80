# 06 — Waivers ao Contrato de Execução

> Registro **normativo** de desvios formalmente autorizados ao [Contrato de Execução](04_CONTRATO_EXECUCAO.md). Cada waiver altera escopo/ID e substitui, para o item afetado, a restrição original do Contrato.

## W-001 — Cisão de OPS-006 e OPS-002 em `.a` (código) e `.b` (operação)

- **Data:** 2026-07-11
- **Autor da decisão:** Dono do produto (usuário)
- **Contrato afetado:** §1.5 (IDs e critérios de aceite não podem ser alterados pela execução) e §5 (governança de desvios)
- **Ondas afetadas:** Onda 0 (M1) e Onda 7 (M8)

### Motivação

Tanto **OPS-006** (backup/restore MySQL) quanto **OPS-002** (Sentry ativo capturando eventos) têm um lado de **código/documentação**, executável na sandbox Lovable, e um lado de **execução operacional** que depende de acesso ao host MySQL, criação de projeto Sentry e configuração de secret `VITE_SENTRY_DSN` — ambos fora do alcance da sandbox. Manter os IDs monolíticos bloquearia o fechamento de M1 por dependência puramente operacional, contrariando o objetivo da Onda 0 ("parar a exposição e ligar as luzes").

### Decisão

Cindir cada Achado em duas metades rastreáveis:

| ID original | `.a` — permanece na Onda 0 (M1)                                                                             | `.b` — migra para a Onda 7 (M8)                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **OPS-006** | Scripts `ops/mysql-backup.sh` e `ops/mysql-restore.sh` + runbook documentado (`06_CHANGESETS/OPS-006.md`)   | Instalação do timer no host, primeira execução de restore de teste registrada em `restore-log.md`, cópia off-host operante                    |
| **OPS-002** | `@sentry/react` instalado, `initSentry()` no bootstrap, NO-OP validado sem DSN (`06_CHANGESETS/OPS-002.md`) | Criação do projeto Sentry, provisionamento do secret `VITE_SENTRY_DSN` (+ opcional `VITE_APP_RELEASE`), evento de teste chegando ao dashboard |

**M1 fecha exclusivamente com os `.a`.** Os `.b` entram no escopo formal da Onda 7 e são condição de M8.

### Efeitos no Contrato

- §1.5 é **flexibilizado apenas para OPS-006 e OPS-002**, e apenas na forma acima. Nenhum outro ID pode ser cindido sem novo waiver.
- Os critérios de aceite originais permanecem íntegros — são apenas **redistribuídos** entre `.a` e `.b`, sem supressão.
- Nenhum efeito sobre fusões obrigatórias (§1.1), ARC-002/ARC-004 (§1.4), SEC-002 por lotes (§1.3) ou decisões pendentes D-1..D-6 (§1 item 7).

### Atualizações documentais aplicadas neste waiver

- `05_ONDAS/ONDA_00/02_Achados.md` — IDs renomeados para `OPS-006.a` e `OPS-002.a`, com nota de referência a este waiver.
- `05_ONDAS/ONDA_00/10_Checklist_Conclusao.md` — critérios ajustados aos `.a`.
- `05_ONDAS/ONDA_00/README.md` e `09_Entregaveis.md` — Quick Wins/entregas com sufixo `.a`.
- `05_ONDAS/ONDA_07/README.md` — nota de incorporação de `OPS-006.b` e `OPS-002.b`.
- `06_CHANGESETS/OPS-002.md` e `06_CHANGESETS/OPS-006.md` — cabeçalho passa a indicar `.a` concluído e `.b` referenciando este waiver.
- `.lovable/plan.md` — sequência atualizada.

### Rastreabilidade

- Rastreamento cruzado: `OPS-006.a`/`OPS-006.b` e `OPS-002.a`/`OPS-002.b` sempre referenciam este waiver (`W-001`) no cabeçalho dos respectivos changesets.
- Reversão: revogar este waiver reunifica os IDs e reabre M1 até que `.b` esteja concluído.
