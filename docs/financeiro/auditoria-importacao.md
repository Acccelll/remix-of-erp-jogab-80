# Auditoria — Importação Matriz + Relatório TOTVS

> Data: 2026-07-15 · Escopo: `fn_importar_matriz`, `fn_importar_relatorio_totvs`, `FinImportar.tsx`, `parse.ts`.

## Resumo executivo

A importação está **razoavelmente protegida contra duplicidade linha-a-linha** (upserts com chave natural), mas apresenta **fragilidades operacionais** relevantes: não há trava de arquivo duplicado, nem transação envolvendo Matriz+Relatório, nem trava anti-concorrência, e a retenção de snapshots é implícita (mantém apenas 12). Nenhum acúmulo silencioso foi identificado no caminho feliz.

---

## 1. Duplicidade

### 1.1 Rateios da Matriz — **OK**
`fn_importar_matriz` deduplica por `(ref_lancamento, cod_natureza, cod_ccusto)` via `SELECT DISTINCT ON` e faz `INSERT ... ON CONFLICT DO UPDATE`. Reimportar o mesmo arquivo **não duplica linhas** e só atualiza rateios cujos campos mudaram (cláusula `IS DISTINCT FROM`). O `DELETE` prévio remove rateios que sumiram da fonte, garantindo idempotência.

### 1.2 Relatório TOTVS — **PARCIAL**
- `financeiro_relatorio_status_atual` usa `ON CONFLICT (ref_lancamento)` → não há duplicidade no estado acumulado.
- `financeiro_relatorio_status_historico` **não tem chave única**; cada importação re-insere as linhas do arquivo. Não é bug (é histórico), mas re-importar o **mesmo arquivo** gera pares idênticos com timestamps diferentes.
- **Snapshots (`financeiro_snapshots`)**: nada impede criar dois snapshots do mesmo arquivo. Não há coluna `hash_arquivo` nem check em `nome_arquivo_titulos + periodo_ref`.

**Severidade: MÉDIA.** Duplicar snapshot infla o rollup histórico (a série mensal pode ganhar dois pontos no mesmo dia — mitigado no front por `oficialPorData` em `queries.ts`, mas o storage cresce sem necessidade).

**Correção recomendada:**
1. Adicionar coluna `hash_arquivo` em `financeiro_snapshots` e índice único `(hash_arquivo)`.
2. Calcular SHA-256 do binário em `FinImportar.tsx` antes de chamar a função e passar como parâmetro.
3. Se o hash já existir, retornar `snapshot_id` existente com aviso ao usuário ("Este arquivo já foi importado em DD/MM").

---

## 2. Acúmulo em atualização de status

### 2.1 Fluxo correto
Quando um título muda de status entre dois arquivos:
- `financeiro_relatorio_status_atual` é atualizado (upsert por `ref_lancamento`).
- `financeiro_relatorio_status_historico` recebe uma nova linha (histórico).
- `financeiro_lancamentos` recebe uma nova linha vinculada ao `snapshot_id` novo (para o rollup histórico).
- `fn_reconstruir_snapshot_matriz_central` regrava o rollup do snapshot ativo.

**Não há acúmulo** no cálculo dos KPIs porque a `vw_financeiro_obra` filtra pelo snapshot mais recente e o rollup é chaveado por `snapshot_id`.

### 2.2 Risco identificado — **BAIXO**
`financeiro_lancamentos` cresce sem limite explícito, mas a retenção de 12 snapshots (fim de `fn_importar_relatorio_totvs`) dispara `DELETE` em cascata via `ON DELETE CASCADE` (assumindo FK — validar). Verificar se existe FK real de `financeiro_lancamentos.snapshot_id → financeiro_snapshots.id ON DELETE CASCADE`; caso não, órfãos acumulam.

---

## 3. Outras fragilidades

| # | Achado | Severidade | Recomendação |
|---|--------|------------|--------------|
| F1 | Sem transação envolvendo Matriz + Relatório. Se o relatório falhar após a Matriz, o rateio novo fica órfão até a próxima importação de relatório. | ALTA | Encapsular ambos em uma única RPC (`fn_importar_pacote_totvs`) ou orquestrar via edge function com rollback. |
| F2 | Sem trava contra importação concorrente. Dois usuários subindo ao mesmo tempo geram dois snapshots e disparam duas reconstruções — a última vence. | ALTA | Adicionar `SELECT pg_try_advisory_xact_lock(<chave>)` no início das duas RPCs e retornar erro amigável quando ocupado. |
| F3 | Parser (`parse.ts`) não valida presença de colunas obrigatórias antes de montar o payload. Um arquivo com header diferente pode gerar `NULL` em massa e "zerar" títulos sem alarme. | ALTA | Validar cabeçalho contra whitelist + abortar com erro claro quando faltar coluna crítica (`ref_lancamento`, `status_cod`, `valor_liquido`). |
| F4 | Retenção fixa de 12 snapshots via `DELETE ... WHERE rn > 12` sem log. Snapshots antigos somem silenciosamente. | MÉDIA | Registrar em `audit_logs` cada `snapshot_id` purgado com nome do arquivo e período. |
| F5 | Sem auditoria de quem importou. `financeiro_snapshots` não guarda `importado_por` (uid). | MÉDIA | Adicionar `importado_por UUID REFERENCES auth.users` e preencher via `auth.uid()` nas RPCs (que são SECURITY DEFINER; ler antes de trocar o `search_path`). |
| F6 | `financeiro_relatorio_status_historico` sem chave única — reimportação do mesmo arquivo duplica histórico. | BAIXA | Índice único parcial em `(ref_lancamento, periodo_ref, nome_arquivo, status_cod, valor_baixado)` ou dedupe por hash de linha. |
| F7 | `fn_importar_matriz` reconstrói **todos** os snapshots (`FROM financeiro_snapshots s`), custo O(n). Com 12 snapshots × dezenas de milhares de linhas, a matriz pode travar por minutos. | MÉDIA | Reconstruir apenas o snapshot ativo (o mais recente). |
| F8 | KPI "Vencido" divergia do aging por **truncamento em 1000 linhas** do rollup no cliente (`listEvolucaoRollup` sem paginação). Corrigido nesta rodada. | RESOLVIDO | — |

---

## Status das correções (rodada 2026-07-15)

| Item | Status | Como foi resolvido |
|------|--------|--------------------|
| F3 — validação de cabeçalho | ✅ | `validarHeaderLancamentos` / `validarHeaderMatriz` em `parse.ts` chamadas antes de `parseLancamentos`/`parseMatriz`. |
| F2 — advisory lock | ✅ | `pg_try_advisory_xact_lock` no início de `fn_importar_matriz` e `fn_importar_relatorio_totvs`. |
| 1.2 — hash de arquivo | ✅ | Coluna `hash_arquivo` + índice único em `financeiro_snapshots`; hash SHA-256 calculado no cliente e passado ao RPC. Duplicidade retorna snapshot existente com aviso. |
| F7 — reconstrução restrita ao snapshot ativo | ✅ | `fn_importar_matriz` reconstrói apenas o snapshot mais recente. |
| F5 — auditoria de quem importou | ✅ | Coluna `importado_por` + parâmetro `p_importado_por` no RPC (preenchido com `currentPlayer.id`). |
| F4 — log de purga de snapshots | ✅ | `INSERT` em `audit_logs` com motivo `retencao_12_snapshots`. |
| F6 — histórico de status sem chave única | ✅ | Índice único `ux_fin_rel_status_hist_unico` + `ON CONFLICT DO NOTHING`. |
| F1 — transação Matriz+Relatório | ✅ | Nova RPC `fn_importar_pacote_totvs(p_rateios, p_periodo_ref, p_nome_titulos, p_lancamentos, p_hash_arquivo, p_importado_por)` chama as duas funções na mesma transação. Se o relatório falhar depois da matriz, o Postgres reverte ambas — não sobra rateio órfão. UI ainda expõe os fluxos separados para casos em que só a Matriz é enviada; adotar o pacote na tela de importação quando os dois arquivos forem carregados juntos. |
| F8 — truncamento 1000 linhas | ✅ (rodada anterior) | Paginação em `listEvolucaoRollup`. |