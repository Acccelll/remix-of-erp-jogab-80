# Onda 0 — Checklist de Conclusão

## Resumo Executivo

Gate de saída da onda. **Todos** os itens devem estar marcados antes de iniciar a onda seguinte.

## Objetivo

Impedir que uma onda seja dada por encerrada sem verificação objetiva.

## Escopo

Achados, critérios de saída, regressão, governança e marco.

## Conteúdo

> **Waiver [W-001](../../00_EXECUTIVO/06_WAIVERS.md) aplicado:** `OPS-002` e `OPS-006` foram cindidos em `.a` (código, escopo M1) e `.b` (execução operacional, migrado para Onda 7/M8). M1 fecha apenas com os `.a`.

### 1. Achados concluídos (9 IDs após W-001)

- [x] `SEC-003` — Segredos versionáveis (senha MySQL no código) e CORS com fallback aberto — `06_CHANGESETS/SEC-003.md`
- [x] `EST-002` — Escopo multiempresa fluindo até os dados (parcial: hook + 1 tela + inventário) — `06_CHANGESETS/EST-002.md`
- [x] `DEP-xlsx-pin` — Pinagem `xlsx` no registro SheetJS + gate no CI — `06_CHANGESETS/DEP-xlsx-pin.md`
- [x] `OPS-001.a` — Esqueleto de CI (install+build+test) bloqueando commit vermelho — `06_CHANGESETS/OPS-001.a.md`
- [x] `OPS-002.a` — Sentry instalado e `initSentry()` no bootstrap (NO-OP sem DSN) — `06_CHANGESETS/OPS-002.md`
- [x] `OPS-006.a` — Scripts `mysql-backup.sh`/`mysql-restore.sh` + runbook — `06_CHANGESETS/OPS-006.md`
- [x] `TST-001.a` — Playwright + specs esqueleto M1/M5/M7/M8 com `storageState` — `06_CHANGESETS/TST-001.a.md`
- [x] `TST-004` — Baseline de cobertura — `06_CHANGESETS/TST-004.md`
- [x] `UX-004` — Badge de escopo de empresa em todo Layout — `06_CHANGESETS/UX-004.md`

### 2. Critérios de saída da onda

- [x] Segredo do MySQL rotacionado (assumido comprometido) e fora do código
- [x] `.env` no `.gitignore` (aplicar no repo espelho — D-01)
- [x] CORS sem fallback `*` quando há credenciais
- [x] `xlsx` instalável a partir do registro padrão (pré-condição do CI)
- [x] CI (install+build+test) bloqueando commit vermelho
- [x] `@sentry/react` no bundle e `initSentry()` chamado no bootstrap (ativação via DSN é `OPS-002.b`, Onda 7)
- [x] Scripts de backup/restore MySQL e runbook publicados (execução no host é `OPS-006.b`, Onda 7)
- [x] Cobertura medida com baseline registrado
- [x] Esqueleto E2E de caracterização (TST-001.a) verde no CI quando secrets presentes; execução real depende de `E2E_USER`/`E2E_PASSWORD` (ver D-18)
- [x] Seleção de empresa altera comprovadamente os dados exibidos (nas telas migradas via EST-002) **+** sinalização visível por tela via UX-004

### 3. Regressão

- [x] Suíte unit completa verde (baseline 421).
- [ ] E2E das jornadas críticas verde — **pendente da provisão dos secrets `E2E_USER`/`E2E_PASSWORD`** (fora da sandbox).
- [x] Regressão específica da onda executada ([07](07_Plano_Regressao.md)).
- [x] Nenhuma jornada crítica vermelha (verificação limitada pelo item acima).

### 4. Governança

- [x] Todo trabalho referencia um ID do Catálogo.
- [x] Registro de desvios atualizado e revisado (D-01..D-22).
- [x] Descobertas de Execução (D-xx) avaliadas.
- [x] Documentação incremental atualizada.
- [x] Sumário de uma página da onda produzido — ver `README.md` desta onda + waiver W-001.

### 5. Marco

- [ ] Merge na linha principal com CI verde — **pendente do repo espelho / provisão de secrets E2E**.
- [ ] Tag **M1** aplicada — pendente do item acima.
- [ ] Release publicada com os IDs concluídos.
- [ ] **Aprovação formal da onda registrada.**

### 6. Desbloqueio da próxima onda

- [ ] Condições de `NO-GO` da próxima onda verificadas (ver [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md)).

## Conclusão

Marcados todos os itens, a Onda 0 está encerrada e a Onda 1 pode iniciar.

## Referências

- [Critérios de Aceite](05_Criterios_Aceite.md) · [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md) · [Checklist Final](../../04_VALIDACAO/Checklist_Final.md)

---

**Navegação:** — · [Índice de Ondas](../) · [Onda 1 →](../ONDA_01/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
