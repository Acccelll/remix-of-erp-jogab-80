# ETAPA 12 — Auditoria de Testabilidade, Qualidade e Estratégia de Testes — Planifik

**Perspectiva:** Principal QA Architect / Test Automation Architect / Auditor Técnico
**Metodologia:** padrão Etapa 5.5 com campos estendidos (Tipo, Estratégia, Valor Esperado, Métrica de Sucesso, **Criticidade do Negócio C0–C3**). Novo prefixo: **TST-**. Esta etapa também entrega a **Matriz de Validação Pós-Implementação** (ETAPA O), que servirá à fase futura de validação de todo o catálogo.
**Base empírica:** suíte **executada de verdade** no sandbox — `vitest run`: **60 arquivos, 421 testes, 100% verdes, 62,5 s**. 5.214 linhas de teste. Contagens e distribuição citadas ao longo do texto.
**Regra:** somente diagnóstico. Fora de escopo: CI/CD, infra, deploy, observabilidade.

---

## ETAPA A — Arquitetura de Testes

**Existe estratégia — deliberada, escrita e com um teto igualmente deliberado.** O projeto testa **a camada de regras de negócio pura** e os **contratos entre módulos**, e conscientemente não testa UI/hooks/páginas. Evidências: os testes de integração trazem docblocks de intenção explícita ("validam contratos entre RPCs + shape dos payloads sem tocar no banco. Se alguém alterar a assinatura de qualquer RPC de cadeia sem atualizar os consumers, estes testes quebram antes do runtime" — `cadeias-criticas.test.ts`, marcado com identificador de hito `H1.4`); há um `README.md` na pasta de integração documentando o propósito; os testes são co-locados em `__tests__` por subdomínio. **Não cresceu organicamente** — cresceu por decisão de cobrir o que dá diferencial (cálculo) e pular o que é caro e volátil (render). É a estratégia certa para um produto cuja complexidade mora na lib — e é também a origem do maior risco desta etapa (o resto do sistema não tem rede).

## ETAPA B — Cobertura (por domínio)

**Ferramental de cobertura: ausente** (sem `coverage` no vitest.config nem script) — não há número oficial; a leitura abaixo é por presença de arquivos de teste, não por % de linhas (**TST-004**).

| Camada / Domínio            | Cobertura                                                                                           | Evidência                                                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lib pura (regras)**       | **Alta** — 21 de 30 subdomínios com `__tests__`                                                     | pmbok/EVM, cpm/cronograma, lastplanner, financeiro-totvs (parse/confronto/evolução), suprimentos, recursos, cards, board, inspecoes, offline, ponto, rdo, riscos, resultado, orcamento, faturamento, frotas, contratos, quadros, lean-dashboard |
| **Contratos entre módulos** | **Presente e rara** — 3 suítes de integração (`cadeias-criticas`, `cadeias-valor`, `checklist_rdo`) | valida shape de RPC e cadeias de valor sem banco                                                                                                                                                                                                |
| **Componentes**             | **Simbólica — 2 arquivos**                                                                          | `HistoricoSemDataInicial.test.tsx` (regressão pontual) + `QueryState.permission.test.ts`                                                                                                                                                        |
| **Hooks**                   | **Zero**                                                                                            | nenhum teste em `hooks/`, `contexts/`                                                                                                                                                                                                           |
| **Páginas**                 | **Zero**                                                                                            | nenhum teste em `pages/`                                                                                                                                                                                                                        |
| **Repositories**            | **Zero direto**                                                                                     | exercitados indiretamente via lib; nenhum teste próprio                                                                                                                                                                                         |
| **Fluxos E2E**              | **Zero**                                                                                            | sem Playwright/Cypress; sem jornadas                                                                                                                                                                                                            |
| **Segurança**               | **Zero**                                                                                            | nenhum teste de auth/RLS/acesso (crítico dado o cap. 11)                                                                                                                                                                                        |
| **Performance**             | **Zero automatizado**                                                                               | há telemetria (rpc-baseline) mas não teste                                                                                                                                                                                                      |

**Equilíbrio entre camadas:** deliberadamente desequilibrado — pirâmide invertida-e-truncada: base larga de unit na lib, topo inexistente (E2E), meio quase vazio (componentes/hooks/integração de UI). Para um ERP que será comercializado, os **fluxos críticos de dinheiro e acesso não têm teste de ponta a ponta** (**TST-001**).

## ETAPA C — Testabilidade (a arquitetura ajuda ou atrapalha?)

Bimodal, exatamente como todas as etapas anteriores previram:

- **Lib pura: altamente testável** — funções sem React, sem I/O, entrada→saída; é por isso que tem 421 testes verdes com mocks mínimos (só 3 arquivos usam `vi.mock`).
- **Resto: hostil a teste pela própria arquitetura** — os 19 módulos impuros (BIZ-002) misturam cálculo e Supabase (difícil de testar sem mockar banco); os 31 diálogos autofetchantes (DS-016) buscam dados sozinhos (não dá para renderizar isolado sem stub de rede); o god-context (ARC-002) exige montar 63 membros para testar qualquer consumidor; os monólitos (ARC-005) não têm costuras. **A baixa testabilidade do frontend não é falta de testes — é consequência direta dos achados de arquitetura já catalogados.** Testar melhor exige refatorar primeiro (dependência forte de ARC-002/003/005, BIZ-002, DS-016).

## ETAPA D — Qualidade dos Testes Existentes

- **Legíveis:** sim — nomes descritivos, docblocks com hitos, estrutura describe/it clara.
- **Independentes/determinísticos:** sim — `beforeEach` limpando mocks; sem ordem implícita; 62,5 s estáveis; nenhum uso de tempo real/rede (fixtures locais, incl. `checklist_214.xlsx` real).
- **Duplicação:** baixa. **Frágeis/falsos positivos/negativos:** o risco real é o **`@ts-nocheck` em 2 arquivos de teste** (incl. `cadeias-criticas`) — um teste com checagem de tipo desligada pode passar sobre um contrato que o compilador reprovaria; combinado com QC-001 (strict off), a "proteção de contrato" que o teste promete é parcialmente furada (**TST-003**).
- **Cobertura de caminho:** os testes de EVM/CPM cobrem casos reais e de borda (fixtures), mas **nunca o caso `null`** — porque sem strictNullChecks (QC-001) o próprio código não distingue; testes herdam a cegueira.

## ETAPA E — Dados de Teste

Fixtures reais e versionadas (planilhas de checklist/BMS/holerite) — padrão positivo forte: testa-se contra o artefato que o cliente realmente envia. Sem factories/builders formais (dados montados inline por teste) — aceitável na escala atual, mas sem reutilização entre suítes (duplicação leve de setup). Mocks: mínimos e cirúrgicos (o mock de `supabase.rpc` nas cadeias é o padrão certo). Sem padronização de factory será um gargalo quando testes de UI/integração exigirem montar entidades complexas repetidamente (**anexado a TST-002 como pré-requisito**).

## ETAPA F — Testes de Regressão

**Existe proteção real e localizada:** a suíte de cadeias foi escrita _como_ rede de regressão de contrato ("quebram antes do runtime"), e há um teste de regressão pontual nomeado por bug (`HistoricoSemDataInicial`). Mas **não há plano de regressão para o que mais vai mudar**: o catálogo prevê cirurgias grandes (ARC-002/004/005, SEC-001/002) em áreas com **zero teste** (auth, estado, páginas). Refatorar o god-context ou fechar o RLS sem teste de regressão nessas áreas é operar no escuro — o mesmo alerta do QC-001, agora do lado de testes (**TST-001/TST-002**).

## ETAPA G — Testes de Integração

Presentes no sentido "contrato entre módulos puros + RPC shape" (3 suítes) — e ausentes no sentido "integração real com banco/Supabase/PHP". As integrações que mais quebram na prática (repository↔Postgres, api.ts↔PHP, edge functions) não têm teste. Lacuna crítica: **a fronteira dupla de backend — a fonte de metade dos achados de todas as etapas — não é testada em nenhum ponto** (**TST-002**).

## ETAPA H — Testes End-to-End

**Inexistentes.** Nenhuma jornada crítica validada: login→mobilização, requisição→cotação→OC→recebimento, medição→faturamento→recebimento, importação TOTVS→conciliação, captura de inspeção offline→sync. Para um produto que se pretende comercializável, a ausência de E2E nos fluxos que geram dinheiro e custo é a lacuna de maior criticidade de negócio (**TST-001, C0**).

## ETAPA I — Qualidade da Arquitetura para Testes

| Atributo                     | Lib pura                                           | Frontend/legado                                 |
| ---------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Coesão                       | ★★★★★                                              | ★★☆☆☆ (monólitos)                               |
| Acoplamento                  | ★★★★★ (baixo)                                      | ★★☆☆☆ (god-context, autofetch)                  |
| Isolamento                   | ★★★★★                                              | ★★☆☆☆                                           |
| Substituição de dependências | ★★★★☆                                              | ★★☆☆☆ (Supabase importado direto, não injetado) |
| Injeção de dependências      | ★★☆☆☆ (import direto, mas funções puras dispensam) | ★☆☆☆☆                                           |
| Facilidade de mock/stub      | ★★★★★                                              | ★★☆☆☆                                           |

O padrão de **importar `supabase` diretamente** (em vez de injetar) é o que obriga o `vi.mock` de módulo; funciona, mas acopla teste à forma do import — aceitável hoje, limitante para testes de integração amplos.

## ETAPA J — Risco de Regressão por Área

| Área                                     | Risco          | Porquê                                            |
| ---------------------------------------- | -------------- | ------------------------------------------------- |
| Autenticação/Autorização (SEC-001/002)   | **Muito Alto** | zero teste + P0 + mudança estrutural iminente     |
| Estado/god-context (ARC-002/004)         | **Muito Alto** | zero teste + 86 consumidores + cirurgia planejada |
| Monólitos/diálogos (ARC-005, DS-016)     | **Alto**       | zero teste + maior superfície de mudança          |
| Fronteira PHP↔Supabase (DB-001/005)      | **Alto**       | zero teste + fonte de inconsistência              |
| Fluxos de dinheiro (M7/M8 ponta a ponta) | **Alto**       | lógica testada em partes, jornada não             |
| Lib pura (EVM/CPM/LPS)                   | **Baixo**      | bem coberta — mudanças aqui são seguras           |

**Leitura para o Lovable:** as áreas de maior risco de regressão são exatamente as de maior prioridade no catálogo (P0/P1) e de menor cobertura — a interseção perigosa. **Nenhuma cirurgia P0/P1 deveria começar sem teste de caracterização mínimo da área.**

## ETAPA K — Padrões Positivos (evidências)

1. **421 testes verdes, determinísticos, 62,5 s** — suíte saudável e rápida.
2. **Estratégia escrita** — docblocks com hitos, README de integração, propósito explícito de "quebrar antes do runtime".
3. **Fixtures reais versionadas** — testa contra o artefato do cliente (checklist_214, BMS, holerite).
4. **Testes de contrato de RPC** — raro e valioso: pega quebra de assinatura entre front e banco.
5. **Foco correto** — a complexidade real (EVM/CPM/confronto) é o que está coberto.
6. **Mocks mínimos** — 3 arquivos com `vi.mock`; o resto é puro, prova de boa arquitetura da lib.
7. **Testes de borda de permissão** — `QueryState.permission.test.ts` cobre o estado de acesso negado.

## ETAPA L — NOVOS ACHADOS (prefixo TST-)

**TST-001 — Ausência de testes E2E dos fluxos críticos de negócio** · NEW · SEQUENCIAL · **Valor: TEST/QUAL** · **Criticidade: C0** · E2E · Etapa 12
**Métrica de sucesso:** jornadas críticas cobertas por E2E executável; quebra de fluxo detectada antes do deploy.
**Evidências:** sem Playwright/Cypress; zero testes em `pages/`; nenhuma jornada (login→mobilização; requisição→OC→recebimento; medição→faturamento; TOTVS→conciliação; inspeção offline→sync) validada ponta a ponta.
**Diagnóstico:** os fluxos que geram custo e receita — e que atravessam vários módulos e a fronteira dupla — não têm nenhuma validação automatizada de ponta a ponta; regressões neles só aparecem em produção.
**Objetivo arquitetural:** cobertura E2E das jornadas críticas, executável de forma repetível.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Alta. **Dependências:** estabiliza depois de SEC-001/002 (login mudará) e EST-002 (escopo); pode começar pelos fluxos que não dependem de auth reformada. **Áreas impactadas:** M1, M5, M7, M8. **Risco de regressão:** Baixo (aditivo). **Validação recomendada:** as próprias jornadas viram a suíte de validação das demais fichas.
**Critérios de aceite:** (a) ferramenta E2E configurada; (b) ≥5 jornadas críticas cobertas (mobilização, compras, faturamento, conciliação, inspeção offline); (c) suíte executável de forma determinística; (d) jornadas usadas como gate das cirurgias P0/P1.

**TST-002 — Fronteira de backend e camada de dados sem testes de integração** · NEW · LOTE · **Valor: TEST** · **Criticidade: C1** · Integração · Etapa 12
**Métrica de sucesso:** repositories e adaptadores PHP com teste de integração; quebra de contrato de dados detectada em CI local.
**Evidências:** zero testes em `repositories/`; api.ts/PHP e edge functions sem cobertura; integração atual só de RPC-shape puro.
**Diagnóstico:** a origem de metade dos achados (fronteira dupla, DB-001/005, ARC-003/004) é justamente a menos testada; mudanças de schema ou de mapper passam sem alarme.
**Objetivo arquitetural:** testes de integração da camada de dados (repositories, mappers, contratos PHP) com dados controlados.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Alta. **Dependências:** ARC-003 (repositories como ponto de teste), ARC-001/QC-001 (tipos para contratos); factories de dados (pré-requisito herdado da ETAPA E). **Áreas impactadas:** todos os domínios de dados. **Risco de regressão:** Baixo (aditivo). **Validação recomendada:** contratos de repository verdes; mudança de schema simulada quebrando teste.
**Critérios de aceite:** (a) repositories cobertos por teste de integração com dados controlados; (b) mappers PH→domínio testados; (c) factories/builders de entidade reutilizáveis; (d) contrato de dados quebrado falha o teste.

**TST-003 — Testes com verificação de tipo desligada (`@ts-nocheck`)** · REF · ISOLADA · **Valor: TEST/QUAL** · **Criticidade: C2** · Qualidade de Testes · Etapa 12
**Métrica de sucesso:** 0 `@ts-nocheck` em testes de contrato; contratos validados também pelo compilador.
**Evidências:** `@ts-nocheck` em 2 arquivos, incluindo `cadeias-criticas.test.ts` — justamente o teste que promete "quebrar antes do runtime" por mudança de assinatura.
**Diagnóstico:** um teste de contrato com tipos desligados valida o shape em runtime mas não no compilador — perde metade do valor que anuncia; sintoma do QC-001 dentro da própria suíte.
**Objetivo arquitetural:** testes de contrato com tipagem ativa.
**Impacto:** Médio. **Prioridade:** P2. **Complexidade:** Baixa. **Dependências:** ARC-001 (tipos Supabase) e QC-001 (strict) — sem eles, remover `@ts-nocheck` gera ruído. **Áreas impactadas:** suíte de integração. **Risco de regressão:** Baixo. **Validação recomendada:** suíte verde sem `@ts-nocheck`.
**Critérios de aceite:** (a) `@ts-nocheck` removido dos testes de contrato; (b) suíte compila sob strict; (c) mudança de assinatura de RPC falha em tempo de tipo.

**TST-004 — Ausência de medição de cobertura** · STD · ISOLADA · **Valor: TEST/OBS** · **Criticidade: C2** · Estratégia · Etapa 12
**Métrica de sucesso:** relatório de cobertura gerado; linha de base registrada; metas por camada.
**Evidências:** sem `coverage` no vitest.config; sem script; nenhum número oficial de cobertura existe.
**Diagnóstico:** sem cobertura medida, a evolução da qualidade é invisível e as metas por camada (lib alta, E2E crítica) não são verificáveis; o time não sabe onde está descoberto exceto por inspeção.
**Objetivo arquitetural:** cobertura medida e reportada com metas diferenciadas por camada.
**Impacto:** Médio. **Prioridade:** P2. **Complexidade:** Baixa. **Dependências:** nenhuma. **Áreas impactadas:** estratégia de teste. **Risco de regressão:** Nulo. **Validação recomendada:** relatório gerado; baseline documentado.
**Critérios de aceite:** (a) cobertura gerada por camada; (b) baseline atual registrado; (c) metas diferenciadas (lib alta; fluxos críticos via E2E; UI pragmática) documentadas.

_(Sem novo ID, por sobreposição consciente: baixa testabilidade do frontend → consequência de ARC-002/003/005, BIZ-002, DS-016, referenciada como dependência; caso `null` não testado → herda QC-001.)_

## ETAPA M — Matriz de Maturidade

| Área                    | Testabilidade | Cobertura | Isolamento | Automação | Maturidade    |
| ----------------------- | ------------- | --------- | ---------- | --------- | ------------- |
| Componentes             | ★★☆☆☆         | ★☆☆☆☆     | ★★☆☆☆      | ★★★☆☆     | ★★☆☆☆         |
| Hooks                   | ★★★☆☆         | ★☆☆☆☆     | ★★★☆☆      | ★★★☆☆     | ★★☆☆☆         |
| Services                | —             | —         | —          | —         | — (vestigial) |
| Repositories            | ★★★☆☆         | ★☆☆☆☆     | ★★★☆☆      | ★★★☆☆     | ★★☆☆☆         |
| Regras de Negócio (lib) | ★★★★★         | ★★★★☆     | ★★★★★      | ★★★★★     | ★★★★★         |
| Integrações             | ★★★☆☆         | ★★☆☆☆     | ★★★★☆      | ★★★☆☆     | ★★★☆☆         |
| Fluxos Críticos         | ★★☆☆☆         | ★☆☆☆☆     | ★★☆☆☆      | ★☆☆☆☆     | ★☆☆☆☆         |
| Testes Unitários        | ★★★★★         | ★★★★☆     | ★★★★★      | ★★★★★     | ★★★★★         |
| Testes de Integração    | ★★★☆☆         | ★★☆☆☆     | ★★★★☆      | ★★★★☆     | ★★★☆☆         |
| Testes E2E              | ☆☆☆☆☆         | ☆☆☆☆☆     | —          | ☆☆☆☆☆     | ★☆☆☆☆         |
| Estratégia Geral        | ★★★★☆         | ★★☆☆☆     | ★★★★☆      | ★★★☆☆     | ★★★☆☆         |

## ETAPA N — Matriz de Implementação (novos itens)

| Ordem                                      | ID          | Tipo | Estratégia | Valor | Crit. | Área       | Objetivo                          | Impacto | Prioridade | Complexidade | Dependências                                      | Isolável? | Critérios |
| ------------------------------------------ | ----------- | ---- | ---------- | ----- | ----- | ---------- | --------------------------------- | ------- | ---------- | ------------ | ------------------------------------------------- | --------- | --------- |
| antes das cirurgias P0/P1 (caracterização) | **TST-001** | NEW  | SEQUENCIAL | TEST  | C0    | E2E        | Jornadas críticas cobertas        | Alto    | P1         | Alta         | início parcial já; consolida após SEC-001/EST-002 | Parcial   | ficha L   |
| janela de dados (com ARC-003)              | **TST-002** | NEW  | LOTE       | TEST  | C1    | Integração | Camada de dados/fronteira testada | Alto    | P1         | Alta         | ARC-003, ARC-001/QC-001                           | Sim       | ficha L   |
| após ARC-001/QC-001                        | **TST-003** | REF  | ISOLADA    | TEST  | C2    | Qualidade  | Testes de contrato tipados        | Médio   | P2         | Baixa        | ARC-001, QC-001                                   | Sim       | ficha L   |
| imediato (instrumentação)                  | **TST-004** | STD  | ISOLADA    | TEST  | C2    | Estratégia | Cobertura medida + metas          | Médio   | P2         | Baixa        | —                                                 | Sim       | ficha L   |

**Encaixe:** TST-004 é quick win imediato (instrumenta antes de tudo); TST-001 deve **começar cedo** como rede das cirurgias P0/P1 (caracterização dos fluxos que serão mexidos), consolidando após a reforma de auth; TST-002 acompanha ARC-003; TST-003 segue ARC-001/QC-001.

## ETAPA O — Matriz de Validação Pós-Implementação

Para cada novo achado desta etapa **e** referência cruzada aos achados de maior risco do catálogo — o insumo da futura fase de validação:

| Achado a validar                 | Funcionalidades a testar         | Fluxos críticos a reexecutar     | Módulos em regressão | Nível de regressão |
| -------------------------------- | -------------------------------- | -------------------------------- | -------------------- | ------------------ |
| TST-001                          | as 5 jornadas                    | todas as jornadas críticas       | M1/M5/M7/M8          | Baixo (aditivo)    |
| TST-002                          | CRUD de cada repository; mappers | leitura/escrita por domínio      | todos os dados       | Baixo              |
| TST-003                          | contratos de RPC                 | cadeias críticas                 | integração           | Baixo              |
| TST-004                          | —                                | —                                | —                    | Nulo               |
| **SEC-001** (auth)               | login, refresh, token forjado    | login→qualquer módulo            | **todos**            | **Muito Alto**     |
| **SEC-002** (RLS)                | acesso por papel, QR público     | leitura por papel em todo módulo | **todos Supabase**   | **Muito Alto**     |
| **ARC-002/004** (estado)         | cada domínio PHP migrado         | mobilização, cadastros, DP       | M1/M9/M10/M13        | **Muito Alto**     |
| **ARC-005/PERF-001** (monólitos) | card, obra, aprovação            | abrir/editar card; obra 360º     | M2/M3                | Alto               |
| **DS-010/PERF-002** (listas)     | paginação, totais                | listas financeiras/cards         | M8/M3/M2             | Médio              |
| **BIZ-001** (EVM)                | curva única                      | Desempenho/Análise/Portfólio     | M3                   | Médio              |
| **DB-001** (fronteira)           | integridade de ponte             | mobilização→custo                | M1/M9/M13            | Médio              |

**Regra de validação derivada:** todo achado de regressão **Muito Alto** exige teste de caracterização **antes** da implementação (TST-001 cobre os fluxos; TST-002 cobre os dados) — esta é a dependência dura que conecta a Etapa 12 ao resto do catálogo.

## ETAPA P — Impacto Cruzado

| Achado  | Módulos     | Funcionalidades críticas         | Dependências     | Risco de regressão | Validações obrigatórias                 |
| ------- | ----------- | -------------------------------- | ---------------- | ------------------ | --------------------------------------- |
| TST-001 | M1/M5/M7/M8 | jornadas de dinheiro/custo/campo | SEC-001, EST-002 | Baixo              | jornadas verdes pré e pós cirurgias     |
| TST-002 | todos dados | integridade de repository/mapper | ARC-003, ARC-001 | Baixo              | contratos verdes; schema quebrado falha |
| TST-003 | integração  | contrato de RPC tipado           | ARC-001, QC-001  | Baixo              | suíte sob strict                        |
| TST-004 | estratégia  | visibilidade de cobertura        | —                | Nulo               | relatório + baseline                    |

## ETAPA Q — Plano Diretor de Qualidade

**Visão geral:** o Planifik tem **excelência de teste onde escolheu testar** (lib pura: 421 verdes, fixtures reais, contratos de RPC) e **ausência total onde mais vai mudar** (auth, estado, páginas, E2E). A estratégia é boa e o teto é deliberado — mas o teto foi colocado exatamente abaixo das áreas que o catálogo mandará operar em P0/P1.
**Maturidade dos testes:** lib ★★★★★, sistema ★★☆☆☆ — a pirâmide é uma base sólida sem topo.
**Principais lacunas:** E2E dos fluxos de dinheiro (TST-001, C0); integração da fronteira de backend (TST-002); cobertura não medida (TST-004); contratos sem tipo (TST-003).
**Principais riscos:** executar as cirurgias P0 de segurança e estado **sem rede de regressão** nas áreas afetadas — o risco composto mais grave da auditoria inteira (zero teste × maior mudança × maior criticidade).
**Oportunidades:** a lib testada é a prova de que o time sabe testar — estender a disciplina para E2E e integração é ampliação, não fundação nova; TST-001 vira a rede de segurança que torna todas as outras cirurgias auditáveis.
**Estratégia:** medir (TST-004) → caracterizar os fluxos que serão mexidos (TST-001 nas jornadas P0/P1) → só então executar as cirurgias → integração de dados (TST-002) acompanha ARC-003 → tipar contratos (TST-003) após strict.
**Sequência ao Lovable (consolidada):** **TST-004 entra nos quick wins imediatos**; **TST-001 começa antes do bloco P0** (caracterização de login e fluxos, no estado atual, para servir de rede) e consolida após SEC-001/EST-002; bloco P0-segurança → ARC-001 → QC-001 → **TST-003** → janela de dados com ARC-003 + **TST-002** → demais ordens preservadas. Nenhuma ordem anterior removida.

---

# RESUMO EXECUTIVO

**1. Visão geral:** qualidade concentrada e deliberada — a camada de regras de negócio é exemplarmente testada (421 testes verdes, determinísticos, com fixtures reais e contratos de RPC), e todo o resto (UI, hooks, estado, auth, E2E) não tem cobertura. A estratégia é madura na intenção e estreita no alcance.

**2. Maturidade da estratégia de testes: ★★★☆☆** — puxada para cima pela lib (★★★★★) e para baixo pela ausência de E2E/integração de UI (★☆☆☆☆).

**3. Testabilidade da arquitetura: bimodal** — lib pura ★★★★★, frontend/legado ★★☆☆☆; a baixa testabilidade do segundo é consequência direta de ARC-002/005, BIZ-002 e DS-016, não um problema novo.

**4. Proteção contra regressões: ★★☆☆☆** — real e boa nos contratos de módulo; inexistente nas áreas de maior mudança futura (auth, estado, páginas).

**5. Principais riscos:** executar os P0 de segurança e as cirurgias de estado sem teste de caracterização nas áreas afetadas — interseção de zero cobertura, máxima prioridade e criticidade de negócio C0.

**6. Principais oportunidades:** o time comprovadamente sabe testar; TST-001 (E2E das jornadas) transforma cada cirurgia futura de aposta em procedimento auditável.

**7. Novos Achados: 4** (TST-001 P1/C0 · TST-002 P1/C1 · TST-003 P2/C2 · TST-004 P2/C2) + a Matriz de Validação Pós-Implementação (ETAPA O) cobrindo também os achados de alto risco das etapas anteriores.

**8. Catálogo Mestre atualizado:** 96 → **100 achados** (PRO 31 · DS 16 · ARC 11 · UX 10 · BIZ 4 · EST 3 · DB 6 · QC 4 · PERF 4 · SEC 7 · **TST 4**). Prioridades: P0 4 · P1 **39** · P2 **34** · P3 23.

**9. Matriz de Implementação atualizada:** TST-004 nos quick wins; TST-001 antecipado como rede das cirurgias P0/P1; TST-002 com ARC-003; TST-003 após strict. Ordens anteriores preservadas.

**10. Matriz de Validação Pós-Implementação criada** (ETAPA O) — vincula cada achado de alto risco ao nível de regressão e à validação obrigatória; estabelece a regra dura "regressão Muito Alta exige caracterização antes da implementação".

**11. Conclusão executiva:** à pergunta — _"a estratégia de qualidade sustenta a evolução contínua com baixo risco de regressão?"_ — a resposta é: **sustenta a evolução da lib; não sustenta a das áreas que o catálogo mandará mudar.** O paradoxo do Planifik em testes espelha o de todas as etapas: o núcleo é maduro, a borda é descoberta — e desta vez a borda descoberta é exatamente onde moram os quatro P0. A ação de maior alavancagem de toda a auditoria talvez seja a mais simples de enunciar: **antes de operar segurança e estado, escrever a rede que dirá se a operação deu certo.** O marco 100 do catálogo é um bom lugar para fechar o diagnóstico e começar a execução.

---

_Auditoria conforme metodologia da Etapa 5.5 com campos estendidos. Suíte de testes executada de fato (421 verdes). Nenhum arquivo alterado. CI/CD, infraestrutura, deploy e observabilidade permanecem reservados às suas etapas._
