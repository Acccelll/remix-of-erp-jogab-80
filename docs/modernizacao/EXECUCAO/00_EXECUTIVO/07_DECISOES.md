# 07 — Registro de Decisões Pendentes (D-1 a D-10)

> Log das decisões formais que o Contrato de Execução §2 exige do dono do produto. Cada decisão é imutável após registrada; alterações requerem nova entrada com data e motivo.

## D-1 — Autenticação (SEC-001) · Bloqueia Onda 2

- **Decisão:** Migrar **já** para Lovable Cloud Auth (Supabase Auth). Não corrigir a auth PHP legada (hash + assinatura).
- **Data:** 2026-07-11
- **Responsável:** Produto/Arquitetura (via GM)
- **Impacto imediato:**
  - Onda 2 (SEC-001/SEC-002) fica destravada quanto à direção da autenticação.
  - Escopo de SEC-001 passa a ser **migração**, não _hardening_ do PHP.
  - D-02 / SEC-003 (senha `helpers.ts:26` — seed GM `Cappucceno`) segue coberta pela migração; será extinta pela reemissão de credenciais via Cloud Auth.
  - Provisionamento existente (`provision-auth-user`, `sync-player-auth`) é o vetor de convivência durante a migração — mantido até o _cutover_ final da Onda 2.
- **Não decidido nesta entrada:** D-2 (regime de acesso por tabela / RLS) permanece aberta.

## D-2 — Regime-alvo de acesso por tabela · Bloqueia Onda 2

- **Decisão:** **RLS estrita por empresa + role.** Toda tabela `public` exige política escopada a `auth.uid()` via `public.current_empresas()` (array de `empresa_id`) e a papel via `public.has_role()`. GM (`has_role('gm')` / `current_is_gm()`) faz bypass explícito em cada policy — sem policies genéricas `USING (true)`.
- **Data:** 2026-07-11
- **Responsável:** Produto/Arquitetura (via GM)
- **Impacto imediato:**
  - Onda 2 destravada quanto ao modelo de RLS; SEC-004+ passa a ser aplicação sistemática do padrão em todas as tabelas listadas em `<supabase-tables>`.
  - Reforça a necessidade de `empresa_id` propagado nas tabelas operacionais que ainda não possuem (insumo para DB-xxx da Onda 1).
  - Edge functions continuam usando `service_role` (bypass nativo de RLS) — auditar cada uma para não vazar cross-empresa.
- **Padrão de policy (referência):** `USING (public.current_is_gm() OR empresa_id = ANY(public.current_empresas()))`, combinado com `public.has_role(auth.uid(), '<papel>')` quando houver segregação por função (financeiro, DP, compras).

## D-3 — Canonicidade de entidades espelhadas · Bloqueia Ondas 3 e 6

- **Decisão:** **`colaboradores` e `obras` são canônicos no app.** `players` e `centros_custo_totvs` são espelhos **read-only** alimentados por sync unidirecional (TOTVS → app). Nenhum CRUD do produto escreve nos espelhos.
- **Data:** 2026-07-11
- **Responsável:** Produto/Arquitetura (via GM)
- **Impacto imediato:**
  - DB-005 (Onda 1) ganha direção: FKs e joins de negócio apontam para `colaboradores.id` / `obras.id`; `players`/`centros_custo_totvs` só entram em relatórios de conciliação.
  - Onda 3 (integração TOTVS) tratará `centros_custo_totvs` como staging; a materialização em `obras` é ETL controlado.
  - Onda 6 (financeiro) mantém `financeiro_lancamentos.centro_custo` → `obras` via `centros_custo_totvs` como lookup, não como fonte.
  - Backlog: revogar `INSERT/UPDATE/DELETE` nos espelhos para todos os roles diferentes de `service_role`.

## D-4 — NFe própria vs. emissor externo · Onda 7

- Status: **aberta**, decisão na própria Onda 7.

## D-5 — Riscos/Lições: portfólio × obra · Onda 7

- Status: **aberta**, decisão na própria Onda 7.

## D-6 — Destino das peças mortas (ui/form, ui/drawer, ui/chart) · Onda 4

- **Decisão:** **Remover agora.** Arquivos shadcn não referenciados (candidatos: `src/components/ui/form.tsx`, `drawer.tsx`, `chart.tsx` — confirmar via `rg` antes de excluir) são apagados na Onda 4 / DS-013. Se reaparecerem como necessidade, reinstalar via CLI shadcn.
- **Data:** 2026-07-11
- **Responsável:** Produto/Arquitetura (via GM)
- **Impacto imediato:**
  - DS-013 vira tarefa mecânica: `rg` para confirmar zero imports → `rm` → build/typecheck.
  - Reduz superfície de manutenção e bundle.

## D-7 — Reversão parcial de D-6 (ui/form.tsx recriado) · Onda 5

- **Decisão:** **Recriar `src/components/ui/form.tsx`** como base da arquitetura de formulários (DS-001). D-6 (remoção na Onda 4) permanece válida como higienização daquele momento — na Onda 4 o arquivo estava morto, sem base de schemas centralizados; a decisão pró-remoção previa explicitamente "se reaparecerem como necessidade, reinstalar via CLI shadcn". Com BIZ-003 concluído (schemas zod centralizados), a necessidade reapareceu e a peça foi reintroduzida agora como convenção obrigatória (RHF + zod + shadcn Form).
- **Data:** 2026-07-12
- **Responsável:** Produto/Arquitetura (via GM)
- **Impacto imediato:**
  - `src/components/ui/form.tsx` volta ao repositório com JSDoc apontando para o changeset DS-001.
  - Convenção documentada em `06_CHANGESETS/DS-001.md` (schema em `lib/schemas/*` quando entidade de domínio; schema local mínimo caso contrário).
  - Migração dos formulários legados para o padrão vira backlog incremental — cada PR referencia DS-001.

## D-8 — Sub-onda financeira (PRO-011 / PRO-013 / PRO-014) · Difere fechamento da Onda 5

- **Decisão:** **Deferir** os três Achados financeiros restantes da Onda 5 (`PRO-011`, `PRO-013`, `PRO-014`) para uma **sub-onda dedicada (Onda 5.F)**, executada após a Onda 6 (Refatorações Estruturais). A Onda 5 é encerrada em **3/6** com Tag **M6-parcial**; os critérios de saída "recebimento vira título", "conciliação TOTVS × lançamentos fechando período" e "DRE gerencial por período disponível" ficam abertos até a sub-onda.
- **Data:** 2026-07-12
- **Responsável:** Produto/Arquitetura (via GM)
- **Motivo:**
  - `financeiro_lancamentos` é **espelho read-only do TOTVS** por D-3 — não pode receber `INSERT` de origem local. PRO-011 exige uma tabela nova (`obrigacoes_recebimento` ou equivalente) cuja forma depende do modelo de conciliação de PRO-013.
  - PRO-013 requer definição do **contrato do snapshot TOTVS** (colunas de matching, tolerância de valor/prazo, janela) — dado de integração ainda não disponível para o app.
  - PRO-014 (DRE/DFC gerencial) depende do resultado de PRO-013 para ter fonte única de verdade por período.
- **Pré-condições de destravamento (obrigatórias para abrir 5.F):**
  1. Especificação do schema `obrigacoes_recebimento` (colunas, FKs, RLS por empresa+role financeiro/compras).
  2. Regra formal de three-way match: OC × Recebimento × NF — tolerâncias, quem aprova exceção.
  3. Formato do snapshot TOTVS de referência para PRO-013 (colunas de chave, cadência, granularidade).
  4. Estrutura da DRE gerencial (grupos, contas, regime — competência/caixa).
- **Impacto imediato:**
  - Onda 5 fecha como **M6-parcial** (BIZ-001, BIZ-003, DS-001 concluídos).
  - Onda 6 (Grandes Refatorações Estruturais) passa a ser o próximo alvo do roadmap.
  - Sub-onda 5.F é aberta como pacote atômico (PRO-013 → PRO-011 → PRO-014, na ordem de dependência já registrada).

## D-9 — Onda 6 permanece NO-GO · TST-002 ATENDIDA, TST-001.b pendente

- **Decisão:** **Manter Onda 6 (Grandes Refatorações Estruturais) em `NO-GO`.** As pré-condições cumulativas do Stage Gate (Ondas 1–3 aprovadas **+ TST-001.b e TST-002 verdes + D-3 registrada**) tiveram avanço material: **TST-002 está ATENDIDA** e o único bloqueio remanescente é **TST-001.b**.
  1. **TST-001.b** (consolidação E2E pós-migração de auth) — segue bloqueado pela Onda 2 (`NO-GO` por D-1/D-2, cutover Cloud Auth em pipeline dedicado).
  2. **TST-002** — **ATENDIDA em 2026-07-12** com a bateria completa (lotes A–M): 13 lotes · 47 superfícies · **244 casos**, cobrindo todos os repositórios reais em `src/lib/repositories/**` e as queries de `financeiro-totvs`. Suíte total **672/672 ✔**, `tsgo --noEmit` verde.
- **Data:** 2026-07-12 (atualizada — fechamento de TST-002)
- **Responsável:** Produto/Arquitetura (via GM)
- **Bateria TST-002 (histórico):**
  - **A** baseline (2 repos, +N casos) · **B** `clientesRepo`, `insumosRepo` (+14, 451/451) — [B](../06_CHANGESETS/TST-002.b.md)
  - **C** boards + card checklist/membros/setores (+16, 467/467) — [C](../06_CHANGESETS/TST-002.c.md)
  - **D** `cronogramaRepo`, revisões, `requisicoesRepo` (+16, 483/483) — [D](../06_CHANGESETS/TST-002.d.md)
  - **E** `financeiroRepo` + fatia `obraDetalhe` (+26, 509/509) — [E](../06_CHANGESETS/TST-002.e.md)
  - **F** `cards`, `cardsExtra` (+21, 530/530) — [F](../06_CHANGESETS/TST-002.f.md)
  - **G** notas fiscais + `suprimentosRepo` (+22, 552/552) — [G](../06_CHANGESETS/TST-002.g.md)
  - **H** `dpRepo` + `dpHolerite` (+19, 571/571) — [H](../06_CHANGESETS/TST-002.h.md)
  - **I** `boards` + `cronograma` completos (+26, 597/597) — [I](../06_CHANGESETS/TST-002.i.md)
  - **J** `clientesRepo` + `fornecedoresRepo` (+18, 615/615) — [J](../06_CHANGESETS/TST-002.j.md)
  - **K** `rdoRepo` + `inspecoesRepo` (+15, 630/630) — [K](../06_CHANGESETS/TST-002.k.md)
  - **L** `insumos` + `requisicoes` + `planejamento` (+24, 654/654) — [L](../06_CHANGESETS/TST-002.l.md)
  - **M** `obrasRepo` (+18, **672/672**) — [M](../06_CHANGESETS/TST-002.m.md)
- **Escopo fora de TST-002 (por design):** `patrimonios` e `veiculos` permanecem em `localStorage` e não têm repositório Supabase — nada a travar.
- **Bloqueios remanescentes para GO da Onda 6:**
  1. **TST-001.b** — destrava quando Cloud Auth cutover (Onda 2, D-1/D-2) concluir.
  2. Confirmação formal de Ondas 1–3 aprovadas (verificar checklist do Stage Gate).
  3. Preparação dos artefatos de referência (mapa de dependências do `AppContext`, inventário dos 10 monólitos de `ARC-005`).
- **Impacto imediato:**
  - Continua **proibido** abrir branch `onda-6` ou iniciar cirurgia `ARC-005 + PERF-001 + DS-011 + DS-016` enquanto TST-001.b não passar.
  - Onda 7 (Produto/Operação) permanece bloqueada por dependência de Onda 6.
  - Trabalho útil autorizado nesta janela: (a) preparação dos artefatos de referência acima, (b) manutenção incremental dos contratos TST-002 caso novos repos apareçam, (c) apoio à Onda 2 para desbloquear TST-001.b.

## D-10 — Partida da Onda 8 · Integrações externas e débitos diferidos

- **Status:** **aberta** — decisão obrigatória antes de materializar o dossiê `ONDA_08` ou iniciar qualquer implementação técnica.
- **Data de abertura:** 2026-07-14
- **Responsável:** Patrocinador de negócio + owners de Fiscal, Financeiro, Suprimentos, Operação e GM.
- **Origem:** `GOV-008.ONDA8-KICKOFF.md` e `GOV-009.ONDA8-MATRIZ-DECISAO.md`.
- **Escopo da decisão:**
  1. **PRO-008 f2:** confirmar se a automação NC → Restrição/Card deve avançar com backend, migration e RLS agora.
  2. **PRO-010 f2:** definir canal oficial de envio a fornecedor e armazenamento/trilha multiusuário.
  3. **PRO-015 f2:** definir contrato de agenda TOTVS, endpoint, janela, retry e owner operacional.
  4. **PRO-017:** escolher estratégia fiscal — emissor externo homologado, SEFAZ direto ou manutenção da emissão manual.
  5. **PRO-026 opcional:** definir owner formal de escrita entre Lean e CPM antes de qualquer atualização automática.
- **Condição de aceite da decisão:** cada linha da matriz `GOV-009` deve ter sistema-alvo ou não-integração explícita, owner, credenciais/segredos necessários, SLA, ambiente de homologação e critério de aceite mensurável.
- **Impacto imediato:** Onda 8 permanece em **KICKOFF** até `M8` aprovado, Onda 7 formalmente aprovada e esta decisão registrada. Nenhum endpoint, migration, secret ou integração externa deve ser criado antes disso.



## Referências

- [Contrato de Execução §2](04_CONTRATO_EXECUCAO.md)
- [Roadmap Executivo](../../GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Log de decisões produzido durante a execução; não altera Achados nem cria novos._
