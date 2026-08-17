# ETAPA 9 — Auditoria de Qualidade de Código, Padrões e Dívida Técnica — Planifik

**Perspectiva:** Principal Software Engineer / Code Reviewer / Auditor Técnico
**Metodologia:** padrão Etapa 5.5 com campos estendidos (Tipo de Implementação + **Estratégia de Execução**). Novo prefixo: **QC-**.
**Base:** `src` (~97,3 mil linhas fora de `ui/` e tipos gerados), configurações de build/lint/TS, medições diretas citadas ao longo do texto.
**Regra:** somente auditoria; nada alterado. Fora de escopo: performance, segurança, testes, observabilidade, CI/CD, infra. Arquitetura/UX/banco já auditados — esta etapa referencia seus IDs e só abre achado novo para o que é estritamente qualidade de código.

---

## ETAPA A — Consistência

Existe **um padrão por geração, não um padrão único** — a conclusão transversal das Etapas 4–7 vale para o estilo do código: a geração moderna é internamente muito consistente (Query+repos+diálogos+toasts sonner, comentários de intenção, módulos coesos), a legada é consistente consigo mesma (AppContext, fetch imperativo, console.error). A previsibilidade é alta _dentro_ de cada geração e o custo cognitivo está na troca entre elas (fato já capturado em ARC-004; sem novo ID). Coerência "entre equipes": o código sugere autoria única/pequena com dois assistentes de IA de estilos distintos — visível no vocabulário (Lovable: migrations UUID + comentários longos; Copilot/humano: módulos lib enxutos com JSDoc pontual).

## ETAPA B — Nomenclatura

| Elemento            | Padrão                                                                                                                                                         | Avaliação            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Componentes/Páginas | PascalCase, nomes de domínio claros (`FinObraDetalhe`, `QuadroBoard`)                                                                                          | ✔                    |
| Hooks               | `use*` disciplinado, zero exceções encontradas                                                                                                                 | ✔                    |
| Pastas              | kebab/minúsculo consistente                                                                                                                                    | ✔                    |
| **Arquivos da lib** | **misto**: kebab-case (29: `bms-excel`, `nfse-parser`) × camelCase (6: `parserHoleriteXls`, `dpHoleriteRepo`, `dpAlocacao`, `statusEspeciais`, `tiposVeiculo`) | 🟡 QC-004            |
| Funções/variáveis   | camelCase pt/en misto porém legível; intenção clara (`recalcularPrevisaoNF`, `filtrarObras`)                                                                   | ✔                    |
| Constantes          | UPPER_SNAKE onde global (`NAV_REGISTRY`, `STORAGE_KEY`)                                                                                                        | ✔                    |
| Tipos               | `export interface` 226 × `export type` 197 sem critério declarado; **zero enums** (union types em todo o projeto — escolha coerente e uniforme)                | 🟡 leve (QC-004) / ✔ |
| Ambiguidade real    | "Contratos" (3 sentidos — já UX/PRO), `money`×`currency` (DS-006)                                                                                              | já catalogados       |

## ETAPA C — Legibilidade

O código lê-se bem em 90% da base: funções curtas, nomes de intenção, comentários que explicam _porquê_ (padrão notável: docblocks nas funções de recálculo e nos parsers). As exceções são exatamente os 10 monólitos já catalogados (ARC-005 — arquivos de 700–2.104 linhas onde a leitura vira expedição) e a densidade condicional média das páginas (66 ocorrências de `if` a 3+ níveis de indentação em `pages/` — concentradas nos mesmos monólitos). Responsabilidades escondidas: `api.ts`-gateway (E4) e os 19 módulos impuros da lib (BIZ-002). Nenhum novo caso além dos catalogados.

## ETAPA D — Duplicação

Inventário consolidado (nenhuma família nova encontrada nesta etapa; a varredura confirmou as sete já catalogadas): contratos de dados por página (ARC-001), moeda ×32 (DS-006), datas ×48 (BIZ-004), status ×15 (DS-005), StatCard/kanban/importadores (DS-007/011/012), validações ×35+parsers (BIZ-003), curva EVM ×2 (BIZ-001). Constantes duplicadas: nada relevante além dos mapas de status. Utilitários redundantes: `money`×`currency` (DS-006). **Conclusão da etapa D: a dívida de duplicação está 100% catalogada; não há cauda oculta.**

## ETAPA E — Complexidade

Sem funções-labirinto fora dos monólitos; loops são simples (map/filter/reduce dominam); o fluxo difícil de acompanhar é estrutural (diálogo-gigante com dezenas de estados — ARC-005), não algorítmico. Os algoritmos genuinamente complexos do produto (CPM, EVM/ES, redistribuição) estão **isolados em módulos puros com testes** — exatamente onde complexidade deve morar. Acoplamento implícito: invalidação por chave textual (ARC-008). Baixa coesão: os 19 impuros (BIZ-002).

## ETAPA F — Organização

Fragmentação/centralização: gavetas de raiz (ARC-007) × god-context (ARC-002) — os dois polos já catalogados. **Código morto:** 4 páginas órfãs (ARC-011), 3 primitivos sem uso (DS-013), `services/` vestigial (ARC-010), `leads` no banco (DB-003) — inventário completo; nenhum bloco novo de código comentado encontrado (busca por blocos comentados extensos: incidência desprezível). **Código legado:** demarcado e conhecido (geração AppContext). Ponto novo relevante: **o ferramental não enxerga código morto** — `noUnusedLocals/Parameters: false` e ESLint com `no-unused-vars: off` (QC-002) significam que os achados de código morto desta auditoria foram encontrados na mão e voltarão a nascer sem detecção.

## ETAPA G — Padrões, Anti-patterns e Smells

**Boas práticas recorrentes:** docblocks de intenção; early-return dominante; separação leitura/mutação nos repositories; union types em vez de enums (uniforme); componentes de página como composição de seções na geração moderna. **Anti-patterns confirmados (todos já com ID):** god-context, diálogo-monólito autofetchante, otimismo sem rollback, invalidação stringly-typed. **Smells novos e exclusivos desta etapa:** (a) **compilador globalmente macio** — `strict: false`, `strictNullChecks: false`, `noImplicitAny: false` (QC-001); (b) **788 `: any`/`as any`** explícitos fora do client-augment + **25 `@ts-ignore/@ts-expect-error`** (QC-001); (c) **15 `catch {}` totalmente silenciosos** e **90 `console.error/warn`** como destino final de erro, com o `lib/logger` (que roteia ao Sentry) adotado em apenas **8 arquivos** (QC-003); (d) régua de lint mínima (QC-002). **Arquivos que destoam:** os camelCase da lib (QC-004) e `ContratoProfileDialog` com o comentário-cicatriz "TODOS OS HOOKS vêm ANTES do return condicional" — sintoma de dor com regras de hooks já domada.

## ETAPA H — Tipagem

Estratégia em três níveis, todos frouxos: (1) configuração — modo estrito desligado no projeto inteiro (QC-001): `null/undefined` não são verificados em lugar nenhum, nem na lib financeira; (2) fronteira de dados — `any` estrutural no Supabase (ARC-001, o caso agudo); (3) uso — 788 escapes explícitos. Não há generics abusivos nem tipagem redundante além dos contratos duplicados (ARC-001). Organização: `types/index.ts` para o legado ✔; o resto inline. **Leitura essencial:** ARC-001 religa os tipos _de dados_; QC-001 religa o _compilador_ — são achados distintos e sequenciais (dados primeiro, senão o strict global afoga em falsos-erros de Supabase).

## ETAPA I — Tratamento de Erros

Quatro destinos convivem sem política: toast (padrão da geração moderna, mas com dois sistemas — DS-002), `console.error/warn` (90, incluindo 43 só em `contexts/app` — erro invisível ao usuário), `logger`→Sentry (8 arquivos — a ferramenta certa, quase sem uso), e silêncio (15 `catch {}`). Mutações legadas falham sem UI (EST-001 cobre o rollback; QC-003 cobre a **política geral**: o que loga, o que avisa, o que propaga). Duplicação de tratamento: try/catch+toast reescrito à mão em cada handler — será absorvido pela arquitetura de formulários (DS-001) nas telas, e pela política (QC-003) no resto.

## ETAPA J — Configurações

| Item          | Estado                                                                                                                  | Avaliação                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| TypeScript    | `strict:false`, `strictNullChecks:false`, `noImplicitAny:false`, `noUnusedLocals/Parameters:false`, `skipLibCheck:true` | 🔴 QC-001/QC-002                   |
| ESLint        | flat config atual (tseslint + react-hooks + react-refresh) porém `@typescript-eslint/no-unused-vars: "off"`             | 🟡 QC-002                          |
| Prettier      | **ausente** (formatação por costume/editor — consistente na prática, sem garantia)                                      | 🟡 QC-002                          |
| Aliases/paths | `@/*` único, zero imports profundos                                                                                     | ✔                                  |
| Scripts       | dev/build/build:dev/lint/preview/test/test:watch — mínimos e suficientes; sem `typecheck` dedicado                      | 🟡 (entra nos critérios de QC-001) |
| Vite/Vitest   | atuais, sem redundância ou config obsoleta detectada                                                                    | ✔                                  |

## ETAPA K — Dívida Declarada (TODO/FIXME/HACK)

**Apenas 9 marcadores em ~97 mil linhas — e de alta qualidade:** todos taxonomizados (`TODO(perm)` ×3 — gates provisórios por `obras_div` aguardando modelo de setores; `TODO(auth)` ×3 — pontos que aguardam a decisão Supabase Auth+RLS, alimentando diretamente ARC-009/DB-002; 1 nota de hooks; 0 FIXME; 0 HACK). Nenhum código experimental abandonado além do já catalogado (motor offline autodeclarado PoC — E1). **Leitura:** a dívida _não declarada_ (medida pelas etapas) é ordens de magnitude maior que a declarada — o time anota pouco porém honesto; os 6 TODOs temáticos devem ser anexados como evidência às fichas ARC-009 e DB-002 (registro feito, sem novo ID).

## ETAPA L — Manutenibilidade

Um novo dev evolui com facilidade: módulos lib puros, telas médias da geração moderna, componentes compartilhados. Maior curva: Obra 360º (domínio+profundidade), Quadros (pool multi-board), fronteira PHP (paradigma próprio). Maior risco de mexer sem quebrar silenciosamente: **qualquer coisa com `null` implícito** (sem strictNullChecks, o erro clássico `undefined is not a function` só aparece em produção), os monólitos, e os 19 impuros. O ferramental hoje **não protege** o novato: sem strict, sem unused-vars, sem typecheck script — a segurança vem da leitura e dos testes da lib.

## ETAPA M — Escalabilidade do Código

Suporta novas features/módulos: sim (receita moderna). Novos devs: parcial — pelo motivo acima. Refatorações futuras: **este é o ponto crítico** — as grandes cirurgias já planejadas (ARC-002/004/005) serão feitas _sem rede do compilador_ se QC-001 não vier antes na medida do possível; refatorar 86 consumidores de contexto com `strictNullChecks:false` é operar no escuro. Longo ciclo de vida: sim, condicionado a religar a régua (QC-001/002) e executar o catálogo.

## ETAPA N — Padrões Positivos (evidências)

1. **Zero `console.log`** em toda a base de produção — raro.
2. **9 TODOs, todos taxonomizados e verdadeiros** — disciplina de anotação exemplar.
3. **Complexidade algorítmica confinada a módulos puros testados** (CPM/EVM/redistribuição).
4. **Union types uniformes** (0 enums) — uma decisão, aplicada sempre.
5. **Docblocks de porquê** nos pontos críticos (recalculo, parsers, EmpresaContext).
6. **Hooks 100% `use*`**, alias único, zero import profundo.
7. **ESLint flat config atual** com react-hooks rules ativas (a base da régua existe; falta apertá-la).

## ETAPA O — NOVOS ACHADOS (prefixo QC-)

**QC-001 — Compilador TypeScript globalmente desativado no essencial** · STD · GLOBAL/SEQUENCIAL · Qualidade de Código · Etapa 9
**Evidências:** `tsconfig.app.json`: `strict:false`, `strictNullChecks:false`, `noImplicitAny:false`; 788 `: any`/`as any` fora do client-augment; 25 `@ts-ignore/@ts-expect-error`; nenhum script `typecheck`.
**Diagnóstico:** o projeto inteiro — inclusive a lib financeira e os módulos de cálculo — opera sem verificação de nulidade e sem inferência obrigatória; ARC-001 (tipos Supabase) é o caso agudo de uma condição crônica de configuração. Erros de `null/undefined` só se manifestam em runtime.
**Objetivo arquitetural:** compilador como rede de segurança real em toda a base, ligado por ondas (dados → lib → páginas) para não afogar em falsos-erros.
**Impacto:** Alto (Crítico para as refatorações planejadas — operar ARC-002/005 sem strict é cirurgia sem monitor). **Prioridade:** P1. **Complexidade:** Alta (onda de erros em base de 97 mil linhas). **Dependências:** ARC-001 primeiro (senão o strict global reporta milhares de erros de Supabase); depois por área. **Áreas impactadas:** toda a base. **Risco de regressão:** Baixo (o compilador só revela; correções pontuais podem alterar comportamento — mitigar com testes existentes). **Validação recomendada:** `tsc --noEmit` limpo por onda; suíte de testes verde após cada onda.
**Critérios de aceite:** (a) script `typecheck` no package.json e no fluxo de trabalho; (b) `strictNullChecks` e `noImplicitAny` ativos ao menos em `lib/` e `repositories/` (onda 1) com zero erros; (c) plano de ondas documentado para o restante; (d) contagem de `as any` reduzida e monitorada (baseline 788 registrado); (e) novos arquivos nascem sob strict.

**QC-002 — Régua de lint/formatação desligada para código morto e estilo** · STD · LOTE · Qualidade de Código · Etapa 9
**Evidências:** ESLint `@typescript-eslint/no-unused-vars: "off"`; tsconfig `noUnusedLocals/Parameters: false`; ausência de Prettier/config de formatação.
**Diagnóstico:** o ferramental não detecta variáveis/imports mortos nem garante formatação — os códigos órfãos achados nesta auditoria foram achados manualmente e voltarão a surgir sem alarme.
**Objetivo arquitetural:** régua automática mínima que impeça reincidência do que o catálogo manda limpar.
**Impacto:** Médio. **Prioridade:** P2. **Complexidade:** Baixa (ligar) + Média (limpar o que aparecer). **Dependências:** melhor após QC-001 onda 1 (evita duplo mutirão). **Áreas impactadas:** toda a base (mecânico). **Risco de regressão:** Baixo. **Validação recomendada:** `lint` limpo no repositório inteiro; build inalterado.
**Critérios de aceite:** (a) unused-vars/locals/params ativos com zero ocorrências; (b) formatador único configurado e aplicado; (c) `lint` integrado ao fluxo de trabalho.

**QC-003 — Tratamento de erros sem política única** · STD · LOTE · Qualidade de Código · Etapa 9
**Evidências:** 4 destinos coexistem — toast (dominante na geração moderna), `console.error/warn` (90, sendo 43 em `contexts/app` — invisível ao usuário), `lib/logger`→Sentry (8 arquivos), silêncio (15 `catch {}`); try/catch+toast reescrito à mão por handler.
**Diagnóstico:** não existe resposta institucional para "o que fazemos com um erro" — cada autor decide entre avisar, logar, telemetrar ou engolir; o roteador de telemetria existente é o menos usado dos quatro destinos.
**Objetivo arquitetural:** política declarada por tipo de erro (usuário é avisado sempre que uma ação falha; telemetria centralizada; silêncio proibido salvo exceção justificada), aplicada por varredura.
**Impacto:** Alto (erros invisíveis + suporte às cegas). **Prioridade:** P1. **Complexidade:** Média. **Dependências:** DS-002 (um toast) antes da varredura; interseção declarada com EST-001 (mutações legadas — a política cobre o aviso, EST-001 cobre o rollback). **Áreas impactadas:** transversal; concentração em `contexts/app`. **Risco de regressão:** Baixo (aditivo). **Validação recomendada:** busca automatizada zerando `catch {}`; amostragem de falhas simuladas exibindo aviso; eventos chegando ao roteador.
**Critérios de aceite:** (a) política escrita e publicada; (b) zero `catch {}` sem justificativa em comentário; (c) `console.error` substituído pelo roteador nos fluxos de mutação; (d) toda falha de ação do usuário produz feedback visível.

**QC-004 — Convenções de nomes de arquivo e de declaração de tipos mistas** · STD · ISOLADA · Qualidade de Código · Etapa 9
**Evidências:** lib com kebab-case (29) × camelCase (6: `parserHoleriteXls`, `dpHoleriteRepo`, `dpAlocacao`, `dpCodigos`, `statusEspeciais`, `tiposVeiculo`); `export interface` (226) × `export type` (197) sem critério.
**Diagnóstico:** duas micro-decisões tomadas de dois jeitos; atrito de previsibilidade, sem erro funcional.
**Objetivo arquitetural:** convenção única prospectiva (renomeação retroativa apenas oportunista, junto de ARC-007 que já move esses arquivos).
**Impacto:** Baixo. **Prioridade:** P3. **Complexidade:** Baixa. **Dependências:** executar junto de ARC-007 (mesmos arquivos). **Áreas impactadas:** DevEx. **Risco de regressão:** Baixo (renome = ajuste de imports). **Validação recomendada:** build+testes verdes pós-renome.
**Critérios de aceite:** (a) convenção escrita (arquivo, interface×type); (b) os 6 camelCase renomeados na janela de ARC-007; (c) novos arquivos aderentes.

_(Sem novo ID, por sobreposição consciente: 788 `any` e 25 ts-ignore → evidência de QC-001; TODOs `(auth)`/`(perm)` → evidência anexada a ARC-009/DB-002; duplicações da Etapa D → confirmação das fichas existentes.)_

## ETAPA P — Matriz de Maturidade

| Área               | Legibilidade | Organização | Complexidade      | Padronização           | Manutenibilidade  |
| ------------------ | ------------ | ----------- | ----------------- | ---------------------- | ----------------- |
| Pages              | ★★★★☆        | ★★★☆☆       | ★★★☆☆ (monólitos) | ★★★★☆                  | ★★★☆☆             |
| Components         | ★★★★☆        | ★★★☆☆       | ★★★☆☆             | ★★★★☆                  | ★★★☆☆             |
| Hooks              | ★★★★★        | ★★★★☆       | ★★★★★             | ★★★★★                  | ★★★★★             |
| Lib                | ★★★★★        | ★★★★☆       | ★★★★★             | ★★★★☆ (nomes QC-004)   | ★★★★★             |
| Services           | —            | ★☆☆☆☆       | —                 | —                      | ★☆☆☆☆ (vestigial) |
| Repositories       | ★★★★★        | ★★★★☆       | ★★★★★             | ★★★★★                  | ★★★★★             |
| Contexts           | ★★★☆☆        | ★★☆☆☆       | ★★☆☆☆             | ★★★☆☆                  | ★★☆☆☆             |
| Providers (árvore) | ★★★★★        | ★★★★★       | ★★★★★             | ★★★★★                  | ★★★★★             |
| Utils              | ★★★★☆        | ★★★☆☆       | ★★★★★             | ★★★☆☆                  | ★★★★☆             |
| Types              | ★★★★☆        | ★★☆☆☆       | ★★★★☆             | ★★☆☆☆ (QC-001/ARC-001) | ★★☆☆☆             |
| Models/Schemas     | ★★★☆☆        | ★★☆☆☆       | ★★★☆☆             | ★★☆☆☆ (BIZ-003)        | ★★☆☆☆             |
| Scripts            | ★★★★☆        | ★★★★☆       | ★★★★★             | ★★★☆☆ (sem typecheck)  | ★★★★☆             |
| Configuração       | ★★★★☆        | ★★★★☆       | ★★★★★             | ★★☆☆☆ (régua solta)    | ★★★☆☆             |

## ETAPA Q — Matriz de Implementação (novos itens)

| Ordem sugerida                                            | ID         | Tipo | Estratégia        | Área       | Objetivo Arquitetural                                               | Impacto                   | Prioridade | Complexidade | Dependências    | Áreas Impactadas | Isolável? | Critérios |
| --------------------------------------------------------- | ---------- | ---- | ----------------- | ---------- | ------------------------------------------------------------------- | ------------------------- | ---------- | ------------ | --------------- | ---------------- | --------- | --------- |
| imediatamente após ARC-001 (onda 1) e antes das cirurgias | **QC-001** | STD  | GLOBAL/SEQUENCIAL | Tipagem    | Compilador estrito por ondas (dados→lib→páginas)                    | Alto/Crítico p/ refactors | P1         | Alta         | ARC-001         | toda a base      | Por onda  | ficha O   |
| junto de DS-002 e antes da varredura de estados (DS-004)  | **QC-003** | STD  | LOTE              | Erros      | Política única de erro (avisar/logar/telemetrar; silêncio proibido) | Alto                      | P1         | Média        | DS-002          | transversal      | Sim       | ficha O   |
| após QC-001 onda 1                                        | **QC-002** | STD  | LOTE              | Régua      | Lint/format detectando código morto e estilo                        | Médio                     | P2         | Baixa-Média  | QC-001 (onda 1) | toda a base      | Sim       | ficha O   |
| na janela de ARC-007                                      | **QC-004** | STD  | ISOLADA           | Convenções | Nomes de arquivo/tipos únicos prospectivos                          | Baixo                     | P3         | Baixa        | ARC-007         | DevEx            | Sim       | ficha O   |

## ETAPA R — Impacto Cruzado

| Achado | Módulos afetados                                         | Arquivos a revisar                                            | Testes a executar                            | Implementações futuras impactadas                                                                   |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| QC-001 | todos                                                    | tsconfig* + onda 1: `lib/`, `repositories/` (185+13 arquivos) | suíte completa por onda; `tsc --noEmit`      | **Todas as cirurgias** (ARC-002/004/005, PRO-004) passam a operar com rede; ARC-001 é pré-requisito |
| QC-002 | todos (mecânico)                                         | eslint.config.js, tsconfig, base inteira no mutirão           | lint+build                                   | Mantém limpo o que ARC-010/011/DS-013 removem                                                       |
| QC-003 | transversal; foco `contexts/app` (43 pontos), 15 catch{} | handlers de mutação; lib/logger                               | falhas simuladas por fluxo; Sentry recebendo | EST-001 (aviso), DS-001 (erros de formulário), etapa Observabilidade                                |
| QC-004 | DevEx                                                    | 6 arquivos camelCase da lib + guia                            | build+testes                                 | ARC-007 (mesma janela)                                                                              |

## ETAPA S — Plano Diretor de Qualidade de Código

**Visão geral:** o código do Planifik é **limpo na escrita e solto na régua** — zero console.log, 9 TODOs honestos, complexidade confinada onde deve, nomes de intenção; e ao mesmo tempo compilador sem strict, lint sem unused, erro sem política. A dívida de _escrita_ está quase toda nos 10 monólitos já catalogados; a dívida de _régua_ é o achado próprio desta etapa.
**Pontos fortes:** disciplina de anotação; algoritmos puros testados; convenções fortes onde existem (hooks, alias, union types).
**Fragilidades:** QC-001 acima de tudo — nenhuma das grandes refatorações planejadas deveria começar sem a onda 1 do strict; QC-003 — o usuário e o suporte não veem os erros que o console vê.
**Dívida acumulada:** majoritariamente **catalogada e não-oculta** (a etapa D confirmou ausência de cauda); a declarada (9 TODOs) é ínfima e verdadeira.
**Riscos futuros:** refatorar às cegas (sem strict), reincidência de código morto (sem régua), erros engolidos em produção (sem política).
**Oportunidades:** as três réguas (strict, lint, política de erro) são baratas em relação ao que protegem — juntas, blindam todo o resto do plano.
**Sequência ao Lovable (consolidada):** ARC-001 → **QC-001 onda 1 (lib+repositories)** → DB-005+DB-003 → EST-002→UX-004 → quick wins (DS-002 → **QC-003** → DS-003/005/006, BIZ-004, PRO-001/009/018) → **QC-002** → janela de dados (ARC-003+BIZ-002+DB-001+EST-001) → DB-002 em lotes → DS-001+BIZ-003 → BIZ-001 → ARC-005 → **QC-001 ondas seguintes** → ARC-002+ARC-004 → PRO-004 → sequência anterior → ARC-007+**QC-004** → lotes P2/P3 finais.

---

# RESUMO EXECUTIVO

**1. Visão geral:** código bem escrito sob régua desligada. A qualidade da escrita (nomes, comentários, complexidade confinada, disciplina de TODO) está acima da média; a qualidade _garantida_ (strict, lint, política de erro) está abaixo — hoje a base depende da virtude dos autores, não do ferramental.

**2. Maturidade técnica: ★★★★☆** na escrita, **★★☆☆☆** na régua — média honesta ★★★☆☆.

**3. Padronização: ★★★★☆** dentro de cada geração; as exceções são micro (QC-004) ou já catalogadas.

**4. Legibilidade: ★★★★☆** — desconto integral atribuível aos 10 monólitos (ARC-005).

**5. Manutenibilidade: ★★★☆☆** — alta na lib/hooks/repos, baixa no legado e em tudo que depende de `null` não verificado.

**6. Principais riscos:** executar as cirurgias do catálogo sem compilador estrito (QC-001); erros invisíveis ao usuário e ao suporte (QC-003); reincidência de código morto sem detecção (QC-002).

**7. Principais oportunidades:** três réguas baratas que protegem todo o plano; a dívida de duplicação já está 100% mapeada — não há cauda oculta a temer.

**8. Novos Achados: 4** (QC-001 P1 · QC-003 P1 · QC-002 P2 · QC-004 P3) + 3 anexos de evidência a fichas existentes (ARC-009, DB-002, ARC-001) sem novos IDs.

**9. Catálogo Mestre atualizado:** 81 → **85 achados** (PRO 31 · DS 16 · ARC 11 · UX 10 · BIZ 4 · EST 3 · DB 6 · **QC 4**). Prioridades: P0 1 · P1 **33** · P2 **30** · P3 **21**.

**10. Matriz de Implementação atualizada:** QC-001 posicionado imediatamente após ARC-001 como pré-condição das cirurgias; QC-003 acoplado a DS-002 nos quick wins; QC-002 após a onda 1; QC-004 na janela de ARC-007. Ordens anteriores preservadas.

**11. Conclusão executiva:** à pergunta — _"o código é sustentável para evolução contínua?"_ — a resposta é: **a escrita sim, a garantia ainda não.** O Planifik escreveu código melhor do que sua configuração exige — o que é mérito raro e risco silencioso. Antes de mover as peças grandes do catálogo, liga-se a luz: strict por ondas, uma política de erro e uma régua de lint. Custa pouco, e é o que transforma o resto do plano de aposta em procedimento.

---

_Auditoria conforme metodologia da Etapa 5.5 com campos estendidos. Nenhum arquivo alterado. Performance, segurança, testes, observabilidade, CI/CD e infraestrutura permanecem reservados às suas etapas._
