# ETAPA 13 — Auditoria de Observabilidade, Operação, DevOps e Sustentação — Planifik

**Perspectiva:** SRE / DevOps Architect / Observability Architect / Auditor Técnico
**Metodologia:** padrão Etapa 5.5 com todos os campos estendidos. Novo prefixo: **OPS-**. Última etapa de diagnóstico antes da consolidação executiva.
**Base:** inspeção de configuração de build/deploy, logger/Sentry, health checks, feature flags, ambientes, migrations e documentação. Verificado por leitura direta.
**Regra:** somente diagnóstico. Nenhum arquivo alterado.

> **Contexto operacional determinante:** o Planifik é operado pela plataforma **Lovable** (deploy automático a cada commit, git gerenciado) sobre **Supabase** (Postgres/Auth/Storage/Edge/backup gerenciados) + um **host PHP/MySQL próprio** (jogab.com.br) de operação manual. A maturidade operacional é, portanto, **herdada de plataformas** em duas frentes e **artesanal** na terceira. Muitos "controles ausentes" no repositório existem _na plataforma_ — este relatório distingue rigorosamente "ausente" de "delegado à plataforma", para não inflar achados.

---

## ETAPA A — Observabilidade

**Estratégia existe, é recente e está em estado embrionário deliberado.** Há três instrumentos reais, todos marcados com hitos (`H2.2`): (1) **Sentry** para error tracking — inicialização condicional a `VITE_SENTRY_DSN`, no-op sem DSN, com sampling 5% em prod, filtro de iframe de preview; (2) **`logger`** fino que roteia warn/error e silencia debug em prod; (3) **telemetria de performance própria** (`rpc-baseline.ts` — EWMA de p95 por query, alerta ao Sentry quando 2× a baseline, cooldown 15 min). Problemas são identificados hoje por: banner de saúde do gateway PHP (evento `planifik:status`), `system_events` (idade de snapshot via edge `alertas-operacao`), e `audit_logs` (negócio). **Diagnóstico:** os alicerces certos estão plantados, mas a adoção é mínima — Sentry roteado por só 8 arquivos (QC-003), e a dependência `@sentry/react` **nem sequer está instalada** (`@ts-expect-error - optional dep not installed`), ou seja, o error tracking está **desligado na prática** até que alguém instale e configure o DSN (**OPS-002**).

## ETAPA B — Logs

- **Structured logging: não** — `logger` é wrapper de `console.*` com strings livres; sem JSON, sem campos, sem correlação.
- **Severidade:** parcial (debug/info/warn/error existem, mas 90 `console.error` diretos ignoram o logger — QC-003).
- **Correlação entre eventos:** inexistente — nenhum request-id/trace-id; um erro no cliente não se liga ao evento no PHP nem ao log do Postgres.
- **Excesso/ausência:** nem um nem outro — é _disperso_ (quatro destinos, QC-003) e _efêmero_ (console não persiste).
- **Investigação:** os logs atuais não permitem investigar um incidente após o fato (nada é retido de forma consultável exceto `audit_logs` de negócio) (**OPS-003**).

## ETAPA C — Monitoramento

- **Métricas coletadas:** só a de performance própria (p95 por query, em localStorage do cliente — não agregada no servidor). Nenhuma métrica de negócio/operação centralizada (taxa de erro, latência p95 real do backend, uso por módulo).
- **Dashboards operacionais:** o painel **GM Saúde** é um dashboard operacional real (idade de snapshot, `system_events`, fila offline) — positivo, porém restrito a três sinais.
- **Monitoramento dos fluxos principais:** não — importação TOTVS, sync de obra, filas offline têm sinais pontuais, mas não há monitor contínuo de sucesso/falha por fluxo (**OPS-004**).

## ETAPA D — Rastreamento (tracing)

Inexistente. Sem trace distribuído, sem request-id propagado entre cliente→PHP→Supabase→edge, sem contexto de execução correlacionável. Numa arquitetura de **dois backends + edge functions**, a ausência de correlação é o maior buraco de diagnóstico: um erro que atravessa a fronteira dupla é irrastreável ponta a ponta (**OPS-003** cobre o eixo de correlação).

## ETAPA E — Alertas

Existem **dois**, ambos bons e específicos: p95 2× baseline → Sentry (com cooldown, evita spam); idade de snapshot TOTVS → `system_events`/GM Saúde. Priorização: implícita (só o crítico alerta). **Lacunas:** nenhum alerta de taxa de erro, de falha de sync, de fila offline travada, de falha de importação, de brute-force (liga a SEC-005/007). Alertas úteis mas **esparsos** — cobrem 2 dos ~8 fluxos que mereceriam (**OPS-004**).

## ETAPA F — Health Checks

- **Gateway PHP:** há um health check _comportamental_ (3 falhas em 5 min → banner "não saudável") — inteligente, orientado ao usuário.
- **Endpoint de saúde dedicado:** não há `/health` que valide dependências (Postgres, MySQL, Storage) de forma máquina-a-máquina.
- **Diagnóstico automático de dependências:** parcial (só o gateway PHP). Supabase tem health próprio (plataforma). **Lacuna:** nenhum check consolidado "o sistema inteiro está de pé?" para monitor externo (**OPS-004**).

## ETAPA G — Configurações (ótica operacional)

- **Variáveis de ambiente:** 4 `VITE_*` + `VITE_SENTRY_DSN`/`VITE_APP_RELEASE` opcionais — enxuto e correto.
- **Separação de ambientes:** **frágil** — existe só `.env` (sem `.env.production`/`.env.staging`); a distinção dev/prod vem de `import.meta.env.DEV/MODE` (plataforma) e do `build:dev`. Não há perfis de ambiente versionados nem documento de "quais variáveis cada ambiente precisa" (**OPS-005**).
- **Secrets (operacional):** já em SEC-003 (senha MySQL no código; `.env` não-ignorado) — reafirmado aqui como risco _operacional_ além de segurança.
- **Gestão de configuração:** feature flags em runtime (`feature_flags` + `is_flag_enabled`) — **maduro** e é o melhor instrumento operacional do produto (permite cutover por obra sem deploy).

## ETAPA H — Build e Deploy

- **Build:** Vite, reproduzível, 49,7 s (medido na Etapa 10). ✔
- **Automação/CD:** **delegada ao Lovable** (commit → deploy automático, documentado no README). Não há `.github/workflows`, nem Dockerfile, nem config de Netlify/Vercel/Render no repositório — o CD **existe mas é invisível ao repositório e não versionável/auditável por quem não usa a plataforma** (**OPS-001**).
- **CI (qualidade antes do merge):** **ausente** — nada roda `lint`/`test`/`typecheck`/build como gate antes do deploy. Os 421 testes verdes (Etapa 12) e o `lint` **não são executados automaticamente**; um commit que quebra testes vai a produção (**OPS-001**, o achado operacional mais consequente).
- **Rastreabilidade de release:** `VITE_APP_RELEASE` existe (bom gancho para Sentry), mas sem changelog/versionamento semântico nem tag de release.
- **Rollback:** **delegado ao Lovable/git** (revert de commit) — existe, mas não há procedimento documentado nem rollback coordenado das migrations (reverter o front não reverte o schema — ver OPS-006).

## ETAPA I — Documentação Operacional

| Necessidade                           | Existe?                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Instalação (dev)                      | ✔ README (clone/npm i/dev) — padrão Lovable                                                            |
| Configuração (variáveis por ambiente) | 🔴 não                                                                                                 |
| Deploy                                | 🟡 só "commit → Lovable"                                                                               |
| Atualização/migrations                | 🟡 cabeçalhos nas migrations MySQL ("executar no host, separadamente") — instrução existe, runbook não |
| Troubleshooting                       | 🔴 não                                                                                                 |
| Recuperação/DR                        | 🔴 não                                                                                                 |
| Operação diária                       | 🟡 implícito no GM Saúde                                                                               |
| Onboarding técnico                    | 🔴 não (o conhecimento das duas gerações e da fronteira é tácito)                                      |

Documentação operacional é **quase inexistente** — o README é o template Lovable. Para um produto a ser sustentado por anos e possivelmente comercializado, é a maior lacuna de sustentação (**OPS-007**).

## ETAPA J — Recuperação

- **Falha de deploy:** rollback por git/Lovable (existe, não documentado).
- **Falha de infra:** Supabase gerenciado (backup/restore de plataforma) ✔; **MySQL do host: backup desconhecido/não evidenciado** — risco real de perda dos cadastros-núcleo se o host não tiver backup (**OPS-006**).
- **Falha de configuração:** sem perfis versionados, um erro de env só aparece em runtime.
- **Falha de integração:** filas offline dão resiliência a RDO/Inspeções; TOTVS tem validação; sync de obra tem reparo. **Descoordenação schema↔código:** migrations MySQL manuais + Supabase automáticas sem rollback conjunto — um deploy que espera coluna nova quebra se a migration manual não foi aplicada (liga a DB-003/DB-004).
- **Redundância:** herdada da plataforma (Supabase); o host PHP é ponto único.

## ETAPA K — Sustentação

**A equipe conseguiria manter por anos? Com o time atual (autoria pequena, alta compreensão tácita), sim; com rotatividade, não sem documentação.** Áreas de maior risco operacional: (1) o **host PHP/MySQL** — operação manual, backup incerto, segredo no código, sem monitor; (2) a **fronteira dupla** — depende de conhecimento tácito de "quem manda" (DB-005); (3) **migrations manuais** (DB-004). Conhecimento tácito crítico: o mapa mental da migração, a ordem de aplicação de migrations, o significado das feature flags de cutover, o fato de o Sentry estar desligado. Tudo isso vive na cabeça do mantenedor principal (**OPS-007**).

## ETAPA L — Padrões Positivos (evidências)

1. **Feature flags em runtime** (`feature_flags`/`is_flag_enabled`) — cutover por obra sem deploy: o instrumento operacional mais maduro do produto.
2. **GM Saúde** — dashboard operacional real (snapshot/eventos/fila).
3. **Telemetria de performance própria** (`rpc-baseline`, EWMA p95, cooldown) — sofisticada e rara.
4. **Sentry desenhado com cuidado** (sampling, filtro de iframe, release, no-op sem DSN) — a fundação está pronta, falta ligar.
5. **ErrorBoundary** presente no Layout — captura de erro de render.
6. **Health check comportamental** do gateway PHP (janela 3/5min).
7. **Migrations MySQL com cabeçalho instrutivo** (host, idempotência, execução passo a passo).
8. **`system_events` + edge de alerta** — telemetria operacional server-side incipiente mas real.
9. **Deploy automático** (Lovable) — CD sem esforço.

## ETAPA M — NOVOS ACHADOS (prefixo OPS-)

**OPS-001 — Ausência de CI (gate de qualidade antes do deploy)** · NEW · ISOLADA · **Valor: OBS/QUAL** · **Criticidade: C1** · CI/CD · Etapa 13
**Métrica de sucesso:** todo commit roda lint+test+typecheck+build; deploy bloqueado se algum falha.
**Evidências:** sem `.github/workflows` nem equivalente; deploy é commit→Lovable direto; 421 testes e `lint` não executados automaticamente; sem `typecheck` (QC-001).
**Diagnóstico:** a rede de testes que existe (Etapa 12) não protege produção porque não roda antes do deploy — um commit vermelho vai ao ar; e as cirurgias P0 do catálogo serão feitas sem gate automático.
**Objetivo arquitetural:** pipeline de CI executando lint/test/typecheck/build como gate obrigatório de merge/deploy.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Baixa. **Dependências:** QC-001 (typecheck), QC-002 (lint), TST-004 (cobertura opcional no gate). **Áreas impactadas:** todo o fluxo de entrega. **Risco de regressão:** Nulo (aditivo). **Validação recomendada:** commit vermelho bloqueado; verde publicado.
**Critérios de aceite:** (a) CI rodando lint+test+typecheck+build em cada push/PR; (b) deploy condicionado ao verde; (c) tempo de pipeline aceitável documentado; (d) status visível no repositório.

**OPS-002 — Error tracking desligado na prática (Sentry não instalado)** · MOD · ISOLADA · **Valor: OBS** · **Criticidade: C1** · Error Tracking · Etapa 13
**Métrica de sucesso:** erros de produção capturados e visíveis em ferramenta; taxa de erro monitorável.
**Evidências:** `sentry.ts` completo e cuidadoso, porém `@sentry/react` marcado `@ts-expect-error - optional dep not installed` e ausente do `package.json`; funções viram no-op sem DSN; `VITE_SENTRY_DSN` não consta do `.env`.
**Diagnóstico:** a estratégia de observabilidade de erros existe no código mas está inerte — hoje, erros de produção não são capturados em lugar nenhum consultável (só console efêmero do usuário).
**Objetivo arquitetural:** error tracking ativo em produção com release e ambiente.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Baixa. **Dependências:** QC-003 (política de erro roteia ao logger→Sentry); OPS-005 (env por ambiente para o DSN). **Áreas impactadas:** observabilidade global. **Risco de regressão:** Baixo. **Validação recomendada:** erro proposital aparecendo na ferramenta com release/ambiente corretos.
**Critérios de aceite:** (a) dependência instalada e inicializada em prod; (b) DSN por ambiente; (c) erro de teste capturado com contexto de release; (d) 90 `console.error` roteados ao logger (converge com QC-003).

**OPS-003 — Ausência de logging estruturado e correlação entre eventos** · STD/REF · LOTE · **Valor: OBS** · **Criticidade: C2** · Logging · Etapa 13
**Métrica de sucesso:** eventos com campos estruturados e id de correlação atravessando cliente→backend.
**Evidências:** `logger` sobre `console.*` com strings livres; sem request-id/trace-id; sem correlação cliente↔PHP↔Supabase↔edge; logs não retidos de forma consultável.
**Diagnóstico:** investigar um incidente após o fato é inviável; na fronteira dupla, um erro ponta a ponta é irrastreável.
**Objetivo arquitetural:** logging estruturado com correlação mínima (id propagado) e retenção consultável dos eventos relevantes.
**Impacto:** Médio. **Prioridade:** P2. **Complexidade:** Média. **Dependências:** QC-003 (política de erro), OPS-002 (destino). **Áreas impactadas:** api.ts, edges, camada de dados. **Risco de regressão:** Baixo. **Validação recomendada:** rastrear um fluxo ponta a ponta por id de correlação.
**Critérios de aceite:** (a) logs com campos estruturados; (b) id de correlação propagado cliente→backend→edge; (c) eventos relevantes retidos e consultáveis; (d) severidade padronizada.

**OPS-004 — Monitoramento de fluxos e health check consolidado ausentes** · NEW · LOTE · **Valor: OBS** · **Criticidade: C2** · Monitoramento · Etapa 13
**Métrica de sucesso:** fluxos críticos com monitor de sucesso/falha; endpoint de saúde agregado para monitor externo.
**Evidências:** GM Saúde cobre 3 sinais; sem monitor contínuo de importação TOTVS, sync de obra, filas offline, taxa de erro; sem `/health` agregado validando dependências.
**Diagnóstico:** falhas de fluxo (sync travado, importação falhando, fila offline empilhando) só são notadas por acaso ou reclamação; nenhum monitor externo consegue perguntar "está tudo de pé?".
**Objetivo arquitetural:** monitor por fluxo crítico + health check agregado consumível por monitor externo.
**Impacto:** Médio. **Prioridade:** P2. **Complexidade:** Média. **Dependências:** OPS-002/003 (destino e correlação). **Áreas impactadas:** M8 (TOTVS), M3 (sync), M5/M6 (offline), GM. **Risco de regressão:** Baixo. **Validação recomendada:** falha simulada por fluxo gerando sinal; health agregado refletindo dependência caída.
**Critérios de aceite:** (a) monitor de sucesso/falha por fluxo crítico; (b) health check agregado validando Postgres/MySQL/Storage; (c) sinais no GM Saúde ou ferramenta; (d) alerta em falha persistente.

**OPS-005 — Ambientes sem perfis versionados nem documentação de configuração** · DOC/STD · ISOLADA · **Valor: OBS/MAN** · **Criticidade: C2** · Configuração · Etapa 13
**Métrica de sucesso:** cada ambiente com perfil de configuração documentado; onboarding configura sem conhecimento tácito.
**Evidências:** só `.env` (sem `.env.production/staging`); distinção de ambiente via `import.meta.env` da plataforma; nenhum documento de "quais variáveis cada ambiente exige".
**Diagnóstico:** configuração de ambiente é conhecimento tácito; um novo ambiente (ou dev) depende de alguém que saiba as variáveis.
**Objetivo arquitetural:** perfis de ambiente e documento de configuração versionados.
**Impacto:** Baixo. **Prioridade:** P2. **Complexidade:** Baixa. **Dependências:** SEC-003 (segredos fora do repo primeiro). **Áreas impactadas:** build/deploy/onboarding. **Risco de regressão:** Baixo. **Validação recomendada:** provisionar ambiente novo só com a documentação.
**Critérios de aceite:** (a) perfis/exemplos por ambiente (sem segredos); (b) documento das variáveis por ambiente; (c) `.env.example` versionado; (d) onboarding testado contra a doc.

**OPS-006 — Backup do host MySQL e rollback de schema não evidenciados/coordenados** · DOC/NEW · SEQUENCIAL · **Valor: OBS/SEC** · **Criticidade: C1** · Recuperação · Etapa 13
**Métrica de sucesso:** backup verificável do MySQL; procedimento de rollback coordenado front↔schema.
**Evidências:** cadastros-núcleo no MySQL do host sem backup evidenciado; migrations manuais (DB-004) sem controle de aplicação; Supabase automáticas — reverter o front não reverte schema.
**Diagnóstico:** perda do host ou uma migration mal aplicada podem custar os dados-mestre sem recuperação clara; deploy e schema podem dessincronizar.
**Objetivo arquitetural:** backup verificado do legado + rollback coordenado documentado.
**Impacto:** Alto (perda de dados-mestre). **Prioridade:** P1. **Complexidade:** Média. **Dependências:** DB-003/DB-004 (baseline e controle de migrations). **Áreas impactadas:** host PHP/MySQL, deploy. **Risco de regressão:** Baixo. **Validação recomendada:** restore de backup testado; ensaio de rollback coordenado.
**Critérios de aceite:** (a) backup automático e verificado do MySQL com retenção; (b) restore testado ao menos uma vez; (c) runbook de rollback coordenado front↔migrations; (d) controle de migrations aplicadas (converge DB-004).

**OPS-007 — Documentação operacional e runbooks inexistentes** · DOC · LOTE · **Valor: MAN/OBS** · **Criticidade: C1** · Documentação · Etapa 13
**Métrica de sucesso:** novo mantenedor opera e recupera o sistema só com a documentação.
**Evidências:** README é o template Lovable; sem runbooks de deploy/migration/troubleshooting/DR; conhecimento da fronteira dupla, ordem de migrations, feature flags de cutover e estado do Sentry é tácito.
**Diagnóstico:** a sustentação por anos depende do mantenedor atual; rotatividade é risco existencial operacional; comercialização exige documentação que não existe.
**Objetivo arquitetural:** conjunto mínimo de runbooks e documentação operacional versionada.
**Impacto:** Alto (sustentação de longo prazo). **Prioridade:** P2. **Complexidade:** Média. **Dependências:** consolida saídas de OPS-001..006 e DB-005 (matriz de canonicidade). **Áreas impactadas:** operação, onboarding. **Risco de regressão:** Nulo. **Validação recomendada:** onboarding de alguém novo usando só a doc.
**Critérios de aceite:** (a) runbooks de deploy, migration, troubleshooting e recuperação; (b) documento de arquitetura operacional (fronteira dupla, flags, ambientes); (c) matriz de canonicidade referenciada (DB-005); (d) onboarding validado contra a doc.

_(Sem novo ID, por sobreposição consciente: segredos operacionais → SEC-003; trilha de segurança → SEC-007; migrations manuais → DB-003/004; console.error disperso → QC-003.)_

## ETAPA N — Matriz de Maturidade

| Área                   | Observabilidade | Automação        | Sustentação | Operação | Maturidade |
| ---------------------- | --------------- | ---------------- | ----------- | -------- | ---------- |
| Logging                | ★★☆☆☆           | ★★☆☆☆            | ★★☆☆☆       | ★★☆☆☆    | ★★☆☆☆      |
| Monitoramento          | ★★☆☆☆           | ★★☆☆☆            | ★★☆☆☆       | ★★★☆☆    | ★★☆☆☆      |
| Tracing                | ★☆☆☆☆           | ★☆☆☆☆            | ★☆☆☆☆       | ★☆☆☆☆    | ★☆☆☆☆      |
| Alertas                | ★★★☆☆           | ★★★☆☆            | ★★★☆☆       | ★★★☆☆    | ★★★☆☆      |
| Health Checks          | ★★★☆☆           | ★★☆☆☆            | ★★★☆☆       | ★★★☆☆    | ★★★☆☆      |
| Build                  | ★★★★☆           | ★★★★★            | ★★★★☆       | ★★★★☆    | ★★★★☆      |
| Deploy                 | ★★★☆☆           | ★★★★★ (Lovable)  | ★★★☆☆       | ★★★★☆    | ★★★★☆      |
| CI (gate)              | ★☆☆☆☆           | ★☆☆☆☆            | ★★☆☆☆       | ★☆☆☆☆    | ★☆☆☆☆      |
| Versionamento/Releases | ★★☆☆☆           | ★★★☆☆            | ★★☆☆☆       | ★★☆☆☆    | ★★☆☆☆      |
| Configuração           | ★★★☆☆           | ★★★☆☆            | ★★☆☆☆       | ★★★☆☆    | ★★★☆☆      |
| Ambientes              | ★★☆☆☆           | ★★★☆☆            | ★★☆☆☆       | ★★★☆☆    | ★★☆☆☆      |
| Documentação           | ★☆☆☆☆           | —                | ★☆☆☆☆       | ★☆☆☆☆    | ★☆☆☆☆      |
| Runbooks               | ☆☆☆☆☆           | —                | ★☆☆☆☆       | ★☆☆☆☆    | ★☆☆☆☆      |
| Recuperação            | ★★☆☆☆           | ★★★☆☆ (Supabase) | ★★☆☆☆       | ★★☆☆☆    | ★★☆☆☆      |
| Feature Flags          | ★★★★☆           | ★★★★☆            | ★★★★☆       | ★★★★★    | ★★★★☆      |
| Operação Geral         | ★★☆☆☆           | ★★★☆☆            | ★★☆☆☆       | ★★★☆☆    | ★★☆☆☆      |

## ETAPA O — Matriz de Implementação (novos itens)

| Ordem                       | ID          | Tipo    | Estratégia | Valor    | Crit. | Área           | Objetivo                           | Impacto | Prioridade | Complexidade | Dependências         | Isolável? | Critérios |
| --------------------------- | ----------- | ------- | ---------- | -------- | ----- | -------------- | ---------------------------------- | ------- | ---------- | ------------ | -------------------- | --------- | --------- |
| quick win imediato          | **OPS-001** | NEW     | ISOLADA    | OBS/QUAL | C1    | CI/CD          | Gate lint+test+typecheck+build     | Alto    | P1         | Baixa        | QC-001/002           | Sim       | ficha M   |
| quick win imediato          | **OPS-002** | MOD     | ISOLADA    | OBS      | C1    | Error Tracking | Sentry ativo em prod               | Alto    | P1         | Baixa        | QC-003, OPS-005      | Sim       | ficha M   |
| junto do bloco P0-segurança | **OPS-006** | DOC/NEW | SEQUENCIAL | OBS/SEC  | C1    | Recuperação    | Backup MySQL + rollback coordenado | Alto    | P1         | Média        | DB-003/004           | Sim       | ficha M   |
| lote observabilidade        | **OPS-003** | STD/REF | LOTE       | OBS      | C2    | Logging        | Log estruturado + correlação       | Médio   | P2         | Média        | QC-003, OPS-002      | Sim       | ficha M   |
| lote observabilidade        | **OPS-004** | NEW     | LOTE       | OBS      | C2    | Monitoramento  | Monitor de fluxo + health agregado | Médio   | P2         | Média        | OPS-002/003          | Sim       | ficha M   |
| com SEC-003                 | **OPS-005** | DOC/STD | ISOLADA    | OBS/MAN  | C2    | Configuração   | Perfis de ambiente + doc           | Baixo   | P2         | Baixa        | SEC-003              | Sim       | ficha M   |
| consolidação final          | **OPS-007** | DOC     | LOTE       | MAN/OBS  | C1    | Documentação   | Runbooks + doc operacional         | Alto    | P2         | Média        | OPS-001..006, DB-005 | Sim       | ficha M   |

## ETAPA P — Matriz de Sustentação Operacional

| Processo Operacional       | Maturidade | Documentação | Automação                    | Risco Operacional | Conhecimento Tácito                      | Prioridade de Evolução    |
| -------------------------- | ---------- | ------------ | ---------------------------- | ----------------- | ---------------------------------------- | ------------------------- |
| Deploy (front)             | ★★★★☆      | Parcial      | Total (Lovable)              | Baixo             | Baixo                                    | Baixa                     |
| CI / gate de qualidade     | ★☆☆☆☆      | Nenhuma      | Nenhuma                      | **Alto**          | Médio                                    | **Alta** (OPS-001)        |
| Error tracking             | ★★☆☆☆      | Nenhuma      | Desligado                    | **Alto**          | Alto (só o mantenedor sabe que está off) | **Alta** (OPS-002)        |
| Migrations (Supabase)      | ★★★☆☆      | Parcial      | Total                        | Médio             | Médio                                    | Média (DB-003)            |
| Migrations (MySQL host)    | ★★☆☆☆      | Cabeçalhos   | Manual                       | **Alto**          | **Alto**                                 | **Alta** (DB-004/OPS-006) |
| Backup / DR                | ★★☆☆☆      | Nenhuma      | Supabase sim / MySQL incerto | **Alto**          | Alto                                     | **Alta** (OPS-006)        |
| Monitoramento de fluxos    | ★★☆☆☆      | Nenhuma      | Parcial                      | Médio             | Médio                                    | Média (OPS-004)           |
| Logging / diagnóstico      | ★★☆☆☆      | Nenhuma      | Parcial                      | Médio             | Médio                                    | Média (OPS-003)           |
| Feature flags / cutover    | ★★★★☆      | Parcial      | Total                        | Baixo             | Médio                                    | Baixa                     |
| Configuração de ambiente   | ★★★☆☆      | Nenhuma      | Parcial                      | Médio             | Alto                                     | Média (OPS-005)           |
| Health check               | ★★★☆☆      | Nenhuma      | Parcial                      | Médio             | Baixo                                    | Média (OPS-004)           |
| Operação diária (GM Saúde) | ★★★☆☆      | Parcial      | Parcial                      | Baixo             | Baixo                                    | Baixa                     |
| Onboarding técnico         | ★☆☆☆☆      | Nenhuma      | —                            | **Alto**          | **Muito Alto**                           | **Alta** (OPS-007)        |
| Recuperação de incidente   | ★☆☆☆☆      | Nenhuma      | —                            | **Alto**          | **Muito Alto**                           | **Alta** (OPS-007)        |

## ETAPA Q — Impacto Cruzado

| Achado  | Módulos/Serviços   | Ambientes    | Riscos operacionais       | Riscos de regressão | Validações obrigatórias   |
| ------- | ------------------ | ------------ | ------------------------- | ------------------- | ------------------------- |
| OPS-001 | todo o repo        | todos        | commit vermelho em prod   | Nulo                | commit vermelho bloqueado |
| OPS-002 | observabilidade    | prod/staging | erros invisíveis          | Baixo               | erro de teste capturado   |
| OPS-003 | api.ts/edges/dados | todos        | incidente irrastreável    | Baixo               | fluxo rastreado por id    |
| OPS-004 | M8/M3/M5/M6/GM     | prod         | falha de fluxo silenciosa | Baixo               | falha simulada sinalizada |
| OPS-005 | build/deploy       | todos        | config tácita             | Baixo               | ambiente novo só com doc  |
| OPS-006 | host MySQL/deploy  | prod         | perda de dados-mestre     | Baixo               | restore testado           |
| OPS-007 | operação           | todos        | dependência do mantenedor | Nulo                | onboarding só com doc     |

## ETAPA R — Plano Diretor de Operação e Sustentação

**Visão geral:** a maturidade operacional é **herdada onde a plataforma cobre** (deploy automático, backup Supabase, build) e **artesanal ou ausente onde depende do projeto** (CI, error tracking ligado, logs estruturados, monitoramento de fluxo, documentação, backup do host, DR). O produto tem instrumentos operacionais sofisticados e subutilizados — flags maduras, telemetria de p95 própria, Sentry bem desenhado porém desligado — o mesmo padrão "boa fundação, adoção parcial" de todas as etapas.
**Pontos fortes:** feature flags de cutover, GM Saúde, telemetria p95, deploy automático, ErrorBoundary, health comportamental do gateway.
**Fragilidades:** sem CI (OPS-001), Sentry off (OPS-002), sem logs estruturados/tracing (OPS-003), sem monitor de fluxo/health agregado (OPS-004), sem doc/runbooks (OPS-007), backup do host incerto (OPS-006).
**Riscos de operação:** falha silenciosa de fluxo; incidente irrastreável na fronteira dupla; commit vermelho em produção.
**Riscos de manutenção:** dependência de conhecimento tácito do mantenedor; perda de dados-mestre do host.
**Oportunidades:** três quick wins de altíssima alavancagem e baixa complexidade — ligar o CI (OPS-001), ligar o Sentry (OPS-002) e garantir backup do host (OPS-006) — elevam a operação de ★★☆☆☆ para funcional sem esforço grande; e cada um deles **protege a execução das cirurgias P0/P1** do catálogo.
**Estratégia:** ligar as luzes antes de operar — CI + error tracking + backup como pré-condições operacionais das cirurgias; depois logs/monitor; documentação por último, consolidando o aprendizado das execuções.
**Sequência ao Lovable (consolidada):** no **bloco de contenção inicial**, junto de SEC-003, entram **OPS-001 (CI), OPS-002 (Sentry) e OPS-006 (backup host)** — são baratos e viram a rede operacional das cirurgias; **OPS-005** acompanha SEC-003 (ambientes/segredos); **OPS-003/004** no lote de observabilidade após a estabilização; **OPS-007** na consolidação final, absorvendo o aprendizado de todas as execuções. Nenhuma ordem anterior removida.

---

# RESUMO EXECUTIVO

**1. Visão geral da maturidade operacional:** herdada e sofisticada em pontos (flags, telemetria p95, deploy automático), ausente ou desligada nos fundamentos operacionais (CI, error tracking ativo, logs estruturados, monitor de fluxo, documentação, backup do host). Maturidade global ★★☆☆☆ com fundações que permitem subir rápido.

**2. Observabilidade: ★★☆☆☆** — instrumentos certos (Sentry, logger, rpc-baseline, system_events) com adoção mínima; Sentry literalmente não instalado.

**3. Automação: ★★★☆☆** — deploy/build automáticos (Lovable) puxam para cima; ausência de CI puxa para baixo.

**4. Capacidade de diagnóstico: ★★☆☆☆** — sem logs estruturados, sem tracing, sem correlação na fronteira dupla; um incidente ponta a ponta é difícil de investigar.

**5. Sustentação de longo prazo: ★★☆☆☆** — viável com o time atual, arriscada com rotatividade; documentação operacional quase inexistente e conhecimento tácito alto.

**6. Principais riscos operacionais:** commit vermelho em produção (sem CI); erros invisíveis (Sentry off); perda de dados-mestre do host (backup incerto); incidente irrastreável.

**7. Principais oportunidades:** três quick wins de baixa complexidade e alta alavancagem — CI, Sentry, backup — que também blindam a execução do catálogo.

**8. Novos Achados: 7** (OPS-001/002/006 P1 · OPS-003/004/005/007 P2) + evidências operacionais anexadas a SEC-003/007, DB-003/004, QC-003.

**9. Catálogo Mestre atualizado:** 100 → **107 achados** (PRO 31 · DS 16 · ARC 11 · UX 10 · SEC 7 · **OPS 7** · DB 6 · BIZ 4 · QC 4 · PERF 4 · TST 4 · EST 3). Prioridades: P0 4 · P1 **42** · P2 **38** · P3 23.

**10. Matriz de Implementação atualizada:** OPS-001/002/006 no bloco de contenção inicial (com SEC-003); OPS-005 com segredos; OPS-003/004 no lote de observabilidade; OPS-007 na consolidação final. Ordens anteriores preservadas.

**11. Matriz de Sustentação Operacional criada** (ETAPA P) — 14 processos operacionais classificados por maturidade, documentação, automação, risco, dependência tácita e prioridade de evolução.

**12. Conclusão executiva:** à pergunta — _"a aplicação possui arquitetura operacional madura, observável e preparada para ser mantida por anos?"_ — a resposta é: **preparada para operar hoje pela mão de quem a construiu; não preparada para ser operada por outros, nem para diagnosticar-se sozinha.** É o padrão da auditoria inteira aplicado à operação: fundação boa, adoção parcial, dependência de conhecimento tácito. E, como em toda etapa, o remédio é barato em relação ao risco — ligar o CI, ligar o Sentry, garantir o backup e escrever os runbooks transforma a operação de "funciona porque o autor está por perto" em "funciona porque está documentado e vigiado". Com esta etapa, a auditoria técnica encerra-se: **107 achados** mapeados, priorizados e prontos para a fase de consolidação executiva e execução pelo Lovable.

---

_Auditoria conforme metodologia da Etapa 5.5 com campos estendidos. Nenhum arquivo alterado. Esta é a última etapa de diagnóstico técnico; a próxima fase natural é a consolidação executiva final do Catálogo Mestre (107 achados) e o planejamento de execução._
