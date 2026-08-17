# ETAPA 8 — Auditoria da Arquitetura de Dados, Modelagem e Persistência — Planifik

**Perspectiva:** Database Architect / Data Model Reviewer / Auditor Técnico
**Metodologia:** padrão Etapa 5.5, com os campos estendidos exigidos nesta etapa (Tipo de Implementação, Áreas Impactadas, Risco de Regressão, Validação Recomendada). Novo prefixo: **DB-**.
**Base quantitativa:** 172 migrations Supabase (17.355 linhas de SQL agregadas) + 11 migrations MySQL manuais em `/migrations` + camada de persistência do frontend. Contagens: 260 `REFERENCES` · 245 `ON DELETE` explícitos · 198 `ENABLE ROW LEVEL SECURITY` · 611 `CREATE POLICY` (226 `USING (true)`) · 293 `CREATE INDEX` · 110 `CREATE TRIGGER` · 175 funções · 17 views + 6 materialized · 432 `CHECK` · 20 `CREATE TYPE` · 54 `UNIQUE` · 3 `DROP TABLE` · 4 `RENAME`.
**Regra:** somente auditoria; nada alterado. Fora de escopo: performance, segurança (análise de exploração), testes, infraestrutura — o achado DB-002 registra o fato de acesso e **delega** a avaliação de risco à etapa de Segurança.

---

## ETAPA A — Mapa da Camada de Persistência

**Dois bancos, dois trilhos de evolução, uma ponte:**

| Dimensão               | Supabase (Postgres)                                                                                                                    | Backend PHP legado (MySQL `jogabcom_gestao_obras`)                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistência           | ~130 tabelas, 17 views, 6 materialized views, 175 funções, 110 triggers                                                                | tabelas dos cadastros-núcleo (obras, colaboradores, veículos, patrimônios, contratos, CRM, usuários, DP legado)                                                                                                                    |
| Acesso pela aplicação  | supabase-js: repositories (13) + `from()` direto (ARC-003) + RPCs para operações atômicas                                              | `lib/api.ts` (gateway REST por resource) → mappers → AppContext                                                                                                                                                                    |
| Evolução               | `supabase/migrations/` — 172 arquivos com timestamp+UUID (geradas pelo fluxo Lovable), aplicação versionada pela plataforma            | `/migrations/` — 11 arquivos SQL nomeados semanticamente (`2026_07_04_rename_leads_para_oportunidades.sql`), cabeçalho instruindo **aplicação manual no host**, escritos idempotentes ("IF NOT EXISTS / verificar antes de ALTER") |
| Versionamento de dados | snapshots TOTVS versionados (`financeiro_snapshots` + runs com hash); baselines/revisões de cronograma versionadas em tabelas próprias | —                                                                                                                                                                                                                                  |
| Ponte                  | `sync-obra.ts` (PHP→Supabase para `obras`); referências a entidades PHP guardadas como **`text` sem FK**                               | —                                                                                                                                                                                                                                  |
| Persistência local     | IndexedDB (filas offline) + localStorage (Etapa 7)                                                                                     | —                                                                                                                                                                                                                                  |
| Seeds                  | `fn_seed_plano_contas`; edge `seed-obra-demo`                                                                                          | inserts inline nas migrations (funil_estagios)                                                                                                                                                                                     |

## ETAPA B — Modelagem

**Representa o domínio?** Sim, e com fidelidade incomum: a modelagem espelha os processos reais do setor — baselines/revisões/cenários de cronograma como entidades de primeira classe, BMS previstas×realizadas com redistribuição, pool de cards com posição por board (`card_board_posicao` — N:N com ordem, a decisão de modelagem mais elegante do schema), matriz de rateio com staging (`_fin_matriz_*`), snapshots imutáveis com runs.

- **Entidades grandes demais:** nenhuma tabela-Deus; `cards` é larga porém coesa (os satélites `card_*` absorvem as facetas — 22 tabelas, granularidade correta para o domínio).
- **Pequenas demais:** algumas tabelas-ponte de 3 colunas são o preço justo do N:N; nada patológico.
- **Responsabilidades misturadas:** o caso real é **entre bancos**, não dentro deles — ver DB-005 (espelhos sem dono).
- **Duplicação:** `leads`/`lead_comentarios` sobrevivem no Supabase enquanto o CRM canônico evoluiu no MySQL (rename para `oportunidades` só do lado PHP) — resíduo de rota abandonada; DP duplicado já catalogado (PRO-004).
- **Relacionamentos complexos desnecessários:** não encontrados; a profundidade (obra→cronograma→item→baseline/revisão/cenário) reflete o domínio.
- **Acoplamento forte:** correto onde existe (tudo ancora em `obras` — 56 FKs para `public.obras`); incorreto na fronteira (texto sem FK — DB-001).

## ETAPA C — Nomenclatura

| Objeto       | Padrão observado                                                                                                                                                                      | Consistência                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Tabelas      | português, plural, snake_case; prefixo de domínio **às vezes** (`inspecao_*`, `cronograma_*`, `card_*`, `frota_*`, `dp_holerite`) e às vezes não (`medicoes`, `riscos`, `restricoes`) | 🟡 dois critérios convivem                                                             |
| Colunas      | snake_case pt; FKs `*_id`                                                                                                                                                             | ✔; um acidente publicado: **`temperatura_temperatura`** em `leads` (migration de 8316) |
| Índices      | `idx_<tabela>_<colunas>` (ex.: `idx_crono_itens_lob`)                                                                                                                                 | ✔                                                                                      |
| Views        | `vw_*`                                                                                                                                                                                | ✔                                                                                      |
| Funções      | **três convenções**: `_privadas` (`_fin_snapshot_*`, `_require_*`), `fn_*` (`fn_recalcular_*`), e nomes livres (`criar_card_board_atomico`, `has_role` — inglês)                      | 🟡                                                                                     |
| Triggers     | `trg_<tabela>_updated(_at)`                                                                                                                                                           | ✔ onde existe                                                                          |
| Enum × CHECK | 20 tipos nativos × 432 CHECKs em `text`                                                                                                                                               | 🟡 duas filosofias para o mesmo problema                                               |

## ETAPA D — Relacionamentos

- **Corretos e explícitos no miolo Supabase:** 260 REFERENCES com 245 comportamentos `ON DELETE` declarados (CASCADE para dependentes verdadeiros, SET NULL para vínculos opcionais — ex.: `obra_id ... ON DELETE SET NULL` em 4 tabelas de vínculo fraco); disciplina rara.
- **O buraco é a fronteira:** referências a entidades do Backend PHP legado armazenadas como `text` **sem FK** (`mobilizacoes_veiculos.veiculo_id/obra_id text`, `colaborador_id text` em 3+ tabelas de ponto/custos) — órfãos possíveis por construção, sem integridade referencial executável (**DB-001**).
- Redundantes/circulares: não encontrados. Opcionalidade: coerente com o domínio (amostra: `obra_id uuid NULL` apenas onde a entidade pode ser corporativa).

## ETAPA E — Normalização

Equilíbrio maduro: 3FN no transacional; desnormalizações **deliberadas e justificadas** — `financeiro_evolucao_rollup` e materialized views (6) para leitura agregada, snapshots imutáveis por desenho (não é duplicação, é versionamento), `card_board_posicao` materializando ordem. Nenhuma sobre-normalização acadêmica; nenhuma tabela-planilha. A única "duplicação aparente" reprovável é inter-bancos (DB-005), não intra-schema.

## ETAPA F — Migrations

- **Organização/sequência:** cronológica e íntegra no trilho Supabase; nomes `timestamp_uuid.sql` **sem semântica** — a arqueologia exige abrir cada arquivo (172×).
- **Consistência histórica / rastreabilidade:** comprometida em dois pontos: (1) **histórico não autossuficiente** — `ALTER TABLE leads ...` sem `CREATE TABLE leads` em todo o histórico: o banco não é reconstruível do zero a partir do repositório; (2) migrations "de conserto" e resíduos indicam refatorações inacabadas (leads órfão; `temperatura_temperatura`; políticas recriadas com `DROP POLICY IF EXISTS` em série — evolução por sobrescrita, aceitável, porém dispersa a definição vigente de cada política por N arquivos) (**DB-003**).
- **Redundantes/obsoletas:** só 3 DROP TABLE/4 RENAME em 172 — quase nada morre; o schema acumula (leads é o exemplo).
- **Trilho MySQL:** bem escrito (idempotência explícita, comentários de intenção) porém de **aplicação manual sem registro do que foi aplicado** — drift repo×banco é questão de tempo (**DB-004**).

## ETAPA G — Integridade

- **No banco:** forte no miolo — 432 CHECKs (status/faixas), 54 UNIQUEs, FKs com ON DELETE, guardas de autorização **dentro do banco** (`_require_gm`, `_require_obra_access`, `_require_obra_edit`, `_require_any_setor_or_gm` — padrão positivo de primeira linha), RPCs atômicas para invariantes multi-tabela (redistribuição BMS, criação de card+posição).
- **Só na aplicação:** validações de formato/obrigatoriedade (BIZ-003) e **toda** a integridade da fronteira PHP (ids texto).
- **Regra implícita perigosa:** a canonicidade de cada entidade espelhada (quem manda: MySQL ou Postgres?) vive na cabeça do time — nenhuma tabela/coluna/doc declara o dono (**DB-005**).
- **Modelo de acesso:** dois regimes convivem — 281 usos de `has_role`/`auth.uid()`/helpers `_require_*` (regime rico) contra **226 políticas `USING (true) ... TO anon, authenticated`** (regime neutralizado, incluindo `anon`). Da ótica de arquitetura de dados: o RLS está _ligado_ (198 tabelas) mas _desativado por política_ numa fração relevante do schema — inconsistência estrutural de modelo de acesso (**DB-002**; avaliação de exploração/risco → etapa Segurança).

## ETAPA H — Camada de Persistência (aplicação)

Estratégia declarada existe (repositories nomeados por intenção; mappers na fronteira PHP; tipos gerados) e está **furada nos três pontos já catalogados**: cobertura minoritária (ARC-003), tipos desligados (ARC-001) e I/O infiltrado na lib (BIZ-002). Vazamento de persistência para outras camadas: os 35 `from()` em páginas e 19 na lib. Serialização: parsers/mappers disciplinados (Etapa 6). Nenhum achado novo — esta etapa referencia os existentes.

## ETAPA I — Evolução da Modelagem

Suporta novos módulos/entidades/relacionamentos? **Sim, comprovadamente** — o schema absorveu suprimentos→qualidade→RDO→ponto→multiempresa em meses mantendo o mesmo vocabulário (uuid PK, obra_id FK, status CHECK, trg_updated, políticas). Novas integrações? Sim — o padrão snapshot+runs+hash (TOTVS) é reutilizável. Escala do produto? A modelagem sim; os freios são operacionais e de fronteira: histórico não-reconstruível trava novos ambientes (DB-003), a ponte texto trava a confiabilidade inter-domínios (DB-001) e o espelhamento sem dono trava a própria migração (DB-005).

## ETAPA J — Riscos

| Risco          | Vetor                                                                                       | Gravidade   |
| -------------- | ------------------------------------------------------------------------------------------- | ----------- |
| Inconsistência | órfãos na fronteira texto (DB-001); espelhos divergindo (DB-005)                            | Alta        |
| Migração       | impossibilidade de recriar ambiente do zero (DB-003); drift MySQL (DB-004)                  | Alta        |
| Evolução       | arqueologia de 172 UUIDs; definição vigente de políticas espalhada                          | Média       |
| Manutenção     | três convenções de função; enum×CHECK duplo                                                 | Baixa-Média |
| Regressão      | políticas recriadas por sobrescrita sem inventário do estado final                          | Média       |
| Crescimento    | nenhum estrutural — modelagem aguenta; rollups/marerialized já respondem à leitura agregada | Baixa       |

## ETAPA K — Padrões Positivos (evidências)

1. **Autorização como função de banco** — família `_require_*` chamada pelas RPCs: a regra de acesso mora junto do dado.
2. **Versionamento de fatos** — snapshots imutáveis + `totvs_import_runs`/`import_validation_runs` com hash; baselines/revisões/cenários de cronograma como entidades.
3. **`card_board_posicao`** — N:N com ordem resolvendo o pool multi-board com elegância.
4. **ON DELETE deliberado** em 245 dos 260 FKs; CHECKs abundantes (432); índices compostos de domínio (`idx_crono_itens_lob`).
5. **trg\_*_updated** consistente onde aplicado; **staging interno** para importações de matriz (`_fin_matriz_*_stage`).
6. **Migrations MySQL idempotentes e comentadas** — o trilho manual ao menos foi escrito para sobreviver a re-execução.
7. **Materialized views para leitura pesada** (6) em vez de desnormalizar o transacional.

## ETAPA L — NOVOS ACHADOS (prefixo DB-)

**DB-001 — Fronteira PHP×Supabase sem integridade referencial** · MOD/CON · Dados · Etapa 8
**Evidências:** `mobilizacoes_veiculos (veiculo_id text, obra_id text)`; `colaborador_id text` em 3+ tabelas (ponto/custos, linhas 532/558/612 do agregado); 1 `obra_id text` residual; nenhum FK possível para entidades que vivem no MySQL.
**Diagnóstico:** toda referência a entidade do Backend PHP legado é uma string sem verificação — exclusões no PHP deixam órfãos no Postgres; grafias/ids divergentes passam calados.
**Objetivo arquitetural:** fronteira com integridade verificável enquanto a dualidade existir; extinção natural ao fim da migração.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Média. **Dependências:** convive com ARC-004/PRO-004 (solução definitiva); medidas interinas independentes. **Áreas impactadas:** M1, M9, M13; tabelas de ponte; `sync-obra`. **Risco de regressão:** Médio (constraints novas podem rejeitar lixo existente — desejável, mas exige saneamento prévio). **Validação recomendada:** rotina de detecção de órfãos zerada; testes de cadeia (mobilização→custo) verdes.
**Critérios de aceite:** (a) inventário das colunas-ponte com formato validado por CHECK; (b) rotina periódica de órfãos com relatório zerado após saneamento; (c) plano declarado de conversão para FK real conforme entidades migrarem.

**DB-002 — Modelo de acesso RLS em dois regimes (226 políticas `USING(true)` incl. `anon`)** · STD/CON · Dados/Acesso · Etapa 8
**Evidências:** 226 de 611 políticas no padrão `CREATE POLICY "Allow all access ..." FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)` (ex.: `mobilizacoes_periodos`), convivendo com 281 usos de `has_role`/`auth.uid()` e helpers `_require_*`.
**Diagnóstico:** um terço do schema tem RLS ligado porém neutralizado — inclusive para papel anônimo — enquanto o restante segue regime rico; do ponto de vista de arquitetura de dados, não há **um** modelo de acesso, há dois, sem critério documentado de qual tabela pertence a qual.
**Objetivo arquitetural:** regime único e documentado de acesso por tabela.
**Impacto:** **Crítico** (registro de arquitetura; a avaliação de exploração e a eventual reclassificação pertencem à etapa de Segurança, que herdará esta ficha).
**Prioridade:** P1. **Complexidade:** Alta (rever 226 políticas sem quebrar fluxos, incl. edge functions e QR público). **Dependências:** ARC-009 (fachada de autorização) para o desenho-alvo; etapa SEC- para o inventário de exposição. **Áreas impactadas:** todos os módulos Supabase; rotas públicas (QR de inspeção) que hoje dependem de permissividade. **Risco de regressão:** Alto (aperto indevido derruba telas). **Validação recomendada:** suíte de acesso por papel (GM/comum/anônimo) por tabela; smoke E2E dos fluxos públicos.
**Critérios de aceite:** (a) inventário tabela→regime→justificativa; (b) zero política `TO anon ... USING (true)` sem justificativa registrada; (c) fluxos legítimos (QR público, edges) preservados com política mínima específica; (d) ficha revisada pela etapa de Segurança.

**DB-003 — Histórico de migrations não reconstruível e de baixa legibilidade** · MIG/DOC · Dados · Etapa 8
**Evidências:** 172 arquivos `timestamp_uuid.sql` sem descrição; `ALTER TABLE leads` (linhas 5859, 8316) sem `CREATE TABLE leads` em todo o histórico; coluna acidental `temperatura_temperatura` publicada; definição vigente de políticas espalhada por DROP/CREATE sucessivos.
**Diagnóstico:** o repositório não é fonte suficiente do schema — não se cria ambiente novo a partir dele, não se lê a evolução sem arqueologia, e acidentes de geração entram sem revisão.
**Objetivo arquitetural:** repositório como fonte reconstruível e legível do schema.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Média. **Dependências:** nenhuma. **Áreas impactadas:** DevEx/ambientes; nenhuma tela. **Risco de regressão:** Baixo (aditivo). **Validação recomendada:** provisionar banco vazio a partir do repositório com sucesso; diff schema-real×repositório vazio.
**Critérios de aceite:** (a) baseline consolidado do schema atual versionado; (b) banco recriável do zero só com o repositório; (c) convenção de nome descritivo para novas migrations; (d) resíduos decididos (leads/lead_comentarios: remover ou documentar; coluna acidental corrigida).

**DB-004 — Trilho MySQL de aplicação manual sem registro de estado** · MIG/DOC · Dados · Etapa 8
**Evidências:** `/migrations/*.sql` com cabeçalho "Aplicar manualmente no MySQL do host"; nenhum mecanismo/registro de quais foram aplicadas.
**Diagnóstico:** o schema legado evolui por disciplina humana; divergência repo×produção é indetectável.
**Objetivo arquitetural:** estado aplicado rastreável no trilho legado até sua extinção.
**Impacto:** Médio. **Prioridade:** P2. **Complexidade:** Baixa. **Dependências:** nenhuma. **Áreas impactadas:** Backend PHP; DP/CRM/RH. **Risco de regressão:** Baixo. **Validação recomendada:** conferência repo×schema real uma vez registrada.
**Critérios de aceite:** (a) registro versionado de migrations aplicadas (tabela de controle ou log auditável); (b) checagem documentada de pendências; (c) política escrita para o trilho até o desligamento.

**DB-005 — Entidades espelhadas entre bancos sem canonicidade declarada** · CON/DOC · Dados · Etapa 8
**Evidências:** pares MySQL×Postgres para clientes, oportunidades (Postgres ainda com `leads` órfão), funil_estagios, colaboradores, funcoes, formas_pagamento, provisoes, horas_extras, historico_salarial, medicoes, notas_fiscais, recebimentos; sincronização formal só para `obras` (`sync-obra.ts`).
**Diagnóstico:** cada par sem dono declarado é uma bifurcação de verdade em potencial; a migração (PRO-004 e sucessoras) não tem mapa oficial de "quem manda hoje".
**Objetivo arquitetural:** matriz de canonicidade entidade→dono→estratégia (espelho lido / migrando / extinto) como documento vivo da travessia.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Baixa (é decisão+documentação; as execuções já têm fichas próprias). **Dependências:** nenhuma; alimenta ARC-004/PRO-004/DB-001. **Áreas impactadas:** todos os módulos híbridos. **Risco de regressão:** Nulo (documental). **Validação recomendada:** revisão da matriz pelos donos de módulo.
**Critérios de aceite:** (a) matriz publicada cobrindo 100% dos pares; (b) referenciada pelas fichas de migração; (c) resíduos (leads) com decisão registrada.

**DB-006 — Nomenclatura e tipagem de domínio em convenções múltiplas** · STD · Dados · Etapa 8
**Evidências:** enums nativos (20) × `text+CHECK` (432); funções em três estilos (`_privada`, `fn_`, livre; pt×en); prefixação de tabela por domínio inconsistente; `trg_updated` em parte das tabelas (6 menções de função de touch para 110 triggers totais).
**Diagnóstico:** três decisões pequenas tomadas de três formas — sem erro grave, com atrito de previsibilidade permanente.
**Objetivo arquitetural:** convenção única escrita para novos objetos (sem renomeação retroativa em massa).
**Impacto:** Baixo. **Prioridade:** P3. **Complexidade:** Baixa. **Dependências:** nenhuma. **Áreas impactadas:** DevEx. **Risco de regressão:** Nulo (prospectivo). **Validação recomendada:** revisão de PR de migrations contra a convenção.
**Critérios de aceite:** (a) guia de convenções de banco publicado; (b) novas migrations aderentes; (c) exceções históricas listadas como legado aceito.

## ETAPA M — Matriz de Maturidade

| Área                                          | Organização | Integridade               | Escalabilidade | Evolução | Maturidade                       |
| --------------------------------------------- | ----------- | ------------------------- | -------------- | -------- | -------------------------------- |
| Modelagem                                     | ★★★★★       | ★★★★☆                     | ★★★★★          | ★★★★☆    | ★★★★★                            |
| Relacionamentos (miolo)                       | ★★★★★       | ★★★★★                     | ★★★★☆          | ★★★★☆    | ★★★★★                            |
| Relacionamentos (fronteira PHP)               | ★★☆☆☆       | ★☆☆☆☆                     | ★★☆☆☆          | ★★☆☆☆    | ★☆☆☆☆                            |
| Migrations (Supabase)                         | ★★★☆☆       | ★★☆☆☆ (não reconstruível) | ★★★☆☆          | ★★☆☆☆    | ★★☆☆☆                            |
| Migrations (MySQL manual)                     | ★★★☆☆       | ★★☆☆☆ (sem registro)      | ★★☆☆☆          | ★★☆☆☆    | ★★☆☆☆                            |
| Persistência (app: repos/mappers)             | ★★★★☆       | ★★★☆☆                     | ★★★★☆          | ★★★☆☆    | ★★★☆☆ (ver ARC-001/003, BIZ-002) |
| Repositories (desenho)                        | ★★★★☆       | ★★★★★                     | ★★★★☆          | ★★★★☆    | ★★★★☆                            |
| Versionamento de dados (snapshots/baselines)  | ★★★★★       | ★★★★★                     | ★★★★☆          | ★★★★★    | ★★★★★                            |
| Integridade (constraints/guards)              | ★★★★☆       | ★★★★☆                     | ★★★★☆          | ★★★★☆    | ★★★★☆                            |
| Mapeamentos/serialização                      | ★★★★☆       | ★★★★☆                     | ★★★★☆          | ★★★★☆    | ★★★★☆                            |
| Estratégia de dados (fim a fim, incl. acesso) | ★★★☆☆       | ★★☆☆☆ (DB-002/005)        | ★★★☆☆          | ★★★☆☆    | ★★★☆☆                            |

## ETAPA N — Matriz de Implementação (novos itens)

| Ordem sugerida                                            | ID         | Tipo    | Área   | Objetivo Arquitetural                      | Impacto | Prioridade | Complexidade | Dependências       | Áreas Impactadas | Isolável?            | Critérios de Aceite |
| --------------------------------------------------------- | ---------- | ------- | ------ | ------------------------------------------ | ------- | ---------- | ------------ | ------------------ | ---------------- | -------------------- | ------------------- |
| imediata (bloco quick wins)                               | **DB-005** | CON/DOC | Dados  | Matriz de canonicidade entidade→dono       | Alto    | P1         | Baixa        | —                  | módulos híbridos | Sim                  | ficha L             |
| imediata (habilita ambientes)                             | **DB-003** | MIG/DOC | Dados  | Schema reconstruível + migrations legíveis | Alto    | P1         | Média        | —                  | DevEx            | Sim                  | ficha L             |
| janela de dados (com ARC-003/BIZ-002)                     | **DB-001** | MOD/CON | Dados  | Fronteira com integridade verificável      | Alto    | P1         | Média        | DB-005 (mapa)      | M1/M9/M13        | Sim                  | ficha L             |
| programa próprio, iniciado já e concluído com a etapa SEC | **DB-002** | STD/CON | Acesso | Regime único de RLS documentado            | Crítico | P1         | Alta         | ARC-009; etapa SEC | todos Supabase   | Parcial (por tabela) | ficha L             |
| lote P2                                                   | **DB-004** | MIG/DOC | Dados  | Trilho MySQL rastreável                    | Médio   | P2         | Baixa        | —                  | backend legado   | Sim                  | ficha L             |
| lote P3                                                   | **DB-006** | STD     | Dados  | Convenção única prospectiva                | Baixo   | P3         | Baixa        | —                  | DevEx            | Sim                  | ficha L             |

## ETAPA O — Impacto Cruzado dos Novos Achados

| Achado | Módulos afetados                       | Migrations dependentes                          | Entidades a revisar                                                        | Testes pós-implementação                               | Etapas futuras impactadas                        |
| ------ | -------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------ |
| DB-001 | M1 Board, M9 DP, M13 Frotas            | novas migrations de CHECK/saneamento nas pontes | mobilizacoes_veiculos, mobilizacoes_periodos, ponto__, custo_colaborador__ | cadeias mobilização→custo; sync-obra; testes de órfãos | Segurança (superfície), Testes (suíte de cadeia) |
| DB-002 | todos Supabase; rotas públicas (M5 QR) | migrations de política por tabela (lotes)       | políticas das 226 tabelas permissivas                                      | suíte de acesso por papel; E2E fluxos públicos e edges | **Segurança (herda a ficha)**; Testes            |
| DB-003 | nenhum funcional; DevEx/ambientes      | baseline consolidado + convenção futura         | leads/lead_comentarios (destino)                                           | provisionamento de banco vazio; diff de schema         | CI/CD-Infra; Testes                              |
| DB-004 | M9/M10/M11 (legado)                    | — (controle de aplicação)                       | tabela/registro de controle                                                | conferência repo×schema                                | Segurança (acesso ao host), Infra                |
| DB-005 | todos híbridos                         | — (documental)                                  | pares espelhados listados na ficha                                         | revisão da matriz por dono de módulo                   | todas as fichas de migração (ARC-004, PRO-004)   |
| DB-006 | DevEx                                  | prospectivas                                    | —                                                                          | revisão de PR                                          | —                                                |

## ETAPA P — Plano Diretor da Arquitetura de Dados

**Visão geral:** o Postgres do Planifik é um schema **modelado por quem entende o negócio e disciplinado por quem entende banco** — versionamento de fatos, guardas de acesso como funções, N:N com ordem, ON DELETE deliberado. As fragilidades não estão no desenho das tabelas: estão **no processo** (histórico não reconstruível, trilho manual sem registro), **na fronteira** (texto sem FK, espelhos sem dono) e **no modelo de acesso bifurcado** (226 políticas neutralizadas ao lado de um regime rico).

**Pontos fortes:** modelagem de domínio ★★★★★; snapshots/baselines; `_require_*`; constraints abundantes; rollups/materialized para leitura.

**Fragilidades:** DB-001/002/003/005 (as quatro P1) + os furos de camada já catalogados (ARC-001/003, BIZ-002) que esta etapa confirma do lado do banco.

**Oportunidades:** o padrão snapshot+runs+hash está pronto para virar o molde de _todas_ as integrações; os guards `_require_*` são o embrião natural do desenho-alvo de ARC-009; a matriz de canonicidade (DB-005) barateia toda a travessia PHP→Supabase.

**Estratégia recomendada:** (1) documentar a verdade — canonicidade (DB-005) e baseline reconstruível (DB-003) — antes de mover qualquer coisa; (2) blindar a fronteira (DB-001) enquanto ela existir; (3) unificar o regime de acesso (DB-002) em lotes, de mãos dadas com a etapa de Segurança e com ARC-009; (4) manter a modelagem como está — ela é o ativo.

**Sequência para o Lovable (consolidada com a matriz vigente):** ARC-001 → **DB-005 + DB-003** (junto aos quick wins; destravam ambientes e dão mapa à travessia) → EST-002→UX-004 → quick wins já ordenados → janela de dados (ARC-003 + BIZ-002 + **DB-001** + EST-001) → **DB-002 iniciando em lotes** (concluído junto à etapa SEC) → programa de validação (DS-001+BIZ-003) → BIZ-001 → ARC-005 → janela ARC-002+ARC-004 → PRO-004 (agora guiada pela matriz DB-005) → sequência anterior inalterada → **DB-004** no lote P2 → **DB-006** no lote P3.

---

# RESUMO EXECUTIVO

**1. Visão geral:** dois bancos com culturas opostas — um Postgres moderno, rico em constraints, versões e guardas, evoluído por 172 migrations geradas; um MySQL legado evoluído por 11 scripts manuais bem escritos. A ponte entre eles é texto sem verificação, e o mapa de quem é dono de cada entidade espelhada não existe por escrito.

**2. Maturidade da modelagem: ★★★★★** — a melhor camada individual de todo o sistema auditado até aqui.

**3. Integridade: ★★★★☆ no miolo, ★☆☆☆☆ na fronteira** — 432 CHECKs e ON DELETE deliberado de um lado; órfãos possíveis por construção do outro.

**4. Escalabilidade: ★★★★☆** — o schema absorve módulos novos com vocabulário estável; rollups e materialized views já respondem à leitura agregada.

**5. Evolução das migrations: ★★☆☆☆** — o ponto fraco do capítulo: histórico não reconstruível, nomes opacos, resíduos e acidente publicado, trilho manual sem registro.

**6. Principais riscos:** modelo de acesso bifurcado com 226 políticas permissivas incluindo `anon` (DB-002 — herdado pela etapa de Segurança); órfãos e divergência na fronteira (DB-001/DB-005); impossibilidade de recriar ambientes (DB-003).

**7. Principais oportunidades:** molde snapshot+runs para todas as integrações; `_require_*` como base de ARC-009; matriz de canonicidade como GPS da migração.

**8. Novos Achados: 6** (DB-001…DB-006) — 4×P1 (um com Impacto Crítico), 1×P2, 1×P3.

**9. Catálogo Mestre atualizado:** 75 → **81 achados** (PRO 31 · DS 16 · ARC 11 · UX 10 · BIZ 4 · EST 3 · **DB 6**). Prioridades: P0 1 · P1 **31** · P2 **29** · P3 **20**.

**10. Matriz de Implementação atualizada:** DB-005 e DB-003 promovidos ao bloco imediato; DB-001 na janela de dados; DB-002 como programa em lotes ligado à etapa de Segurança; DB-004/006 nos lotes finais. Ordens anteriores preservadas.

**11. Conclusão executiva:** à pergunta — _"a arquitetura de dados está consistente, sustentável, escalável e preparada?"_ — a resposta é: **o desenho, sim; o processo e a fronteira, ainda não.** O Planifik tem o schema que muitos ERPs maduros gostariam de ter e o processo de evolução que nenhum deveria ter. A boa notícia é a assimetria do custo: consertar processo e fronteira (documentar donos, consolidar baseline, blindar pontes, unificar regime de acesso) é ordens de grandeza mais barato do que teria sido consertar uma modelagem ruim — e aqui a modelagem é o que há de melhor.

---

_Auditoria conforme metodologia da Etapa 5.5 com campos estendidos. Nenhum arquivo alterado. Performance, exploração de segurança (herdeira de DB-002), testes e infraestrutura permanecem reservados às suas etapas._
