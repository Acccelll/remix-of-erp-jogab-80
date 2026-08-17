# ETAPA 6 — Auditoria da Camada de Regras de Negócio — Planifik

**Perspectiva:** Auditor Técnico / Arquiteto de Software
**Metodologia:** padrão da Etapa 5.5 (IDs permanentes, fichas completas, Catálogo Mestre e Matriz de Implementação atualizados). Novo prefixo desta etapa: **BIZ-** (camada de regras de negócio), conforme previsto na §9 da Etapa 5.5.
**Regra:** somente auditoria. Nenhum arquivo alterado, nenhum código. Fora do escopo (etapas próprias): estado/contexts/cache, banco/migrations, performance, segurança, testes.

---

## 1. Onde a Regra de Negócio Realmente Está

A regra do Planifik vive em **cinco casas**, com pesos muito diferentes:

| Casa                                     | Conteúdo                                                                                                                                                                                                                  | Evidência                                                                                                               | Peso                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **`src/lib` — módulos de domínio puros** | cálculo e política: EVM (`pmbok/evm.ts`, 263 L), CPM (`cpm.ts`, 259 L), Last Planner (`lastplanner/*`), confronto TOTVS (`financeiro-totvs/confronto.ts`), lead times, alçadas, curva de resultado, linha de balanço, PPC | sem React, sem persistência, com testes co-locados (incl. integração "cadeias de valor")                                | **Núcleo** — é onde a regra "de verdade" mora              |
| **`src/lib` — módulos impuros**          | 19 arquivos de domínio que acessam Supabase diretamente (`pmbok/ac-folha.ts`, `bms-boletim.ts`, `financeiro-totvs/queries.ts`, `cronograma/recalcular-cpm.ts`, `inspecoes/offline.ts`, `cards-trello-import.ts` 682 L…)   | `grep supabase` em lib fora de `repositories/`                                                                          | Grande — e **indistinguível** dos puros pelo nome/pasta    |
| **Postgres (RPCs)**                      | regras transacionais críticas: redistribuição de BMS pós-faturamento, reversão, previsão de NF, aprovação→lançamento, criação atômica de card                                                                             | `fn_recalcular_*`, `fn_lancamento_solicitacao_aprovada`, `criar_card_board_atomico`; cliente fino em `lib/recalculo.ts` | Pequeno e **bem escolhido** (o que precisa de atomicidade) |
| **Componentes/páginas**                  | regra embutida em UI: curva S recalculada inline em `components/obra/AnaliseTab.tsx` (useMemo próprio) apesar de `lib/pmbok` existir; validações imperativas em 35 páginas; cálculos locais nos 10 monólitos (ARC-005)    | greps citados nas fichas                                                                                                | Médio — é o vazamento                                      |
| **`contexts/app`**                       | regra dos domínios do Backend PHP legado (`useMobilizacoes.ts` 755 L) + mapeamento de fronteira (`mappers.ts`, 312 L, 12 exports)                                                                                         | ARC-002                                                                                                                 | Médio — herança da geração legada                          |

**Estratégia clara ou crescimento orgânico?** Ambos, por gerações: a geração moderna tem estratégia explícita (lib pura → repository → RPC quando atômico), comprovada por README normativo e testes; a distribuição real, porém, cresceu organicamente **por cima** dela — módulos impuros dentro das pastas puras, regra re-derivada em componentes, validação sem casa.

**Separação UI/Domínio/Persistência/Integrações/Transformações/Validações/Mapeamentos:** Domínio✔ (lib pura) · Persistência🟡 (repositories certos, porém minoritários — ARC-003 — e 19 infiltrações na lib) · Integrações✔ (api.ts como gateway PHP; edge functions p/ externos) · Transformações🟡 (mappers PHP centralizados ✔; parsers por importador ✔; datas e dinheiro dispersos 🔴) · Validações🔴 (sem estratégia — ver §6) · UI🟡 (vaza cálculo em pontos nomeáveis).

---

## 2. Responsabilidades por Camada

| Camada                              | Responsabilidade declarada                     | Respeita?                    | Misturas encontradas                                                                                |
| ----------------------------------- | ---------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| lib pura                            | cálculo/política de domínio                    | **Sim, exemplarmente**       | —                                                                                                   |
| lib impura                          | (não declarada)                                | —                            | domínio+persistência no mesmo arquivo; `cards-trello-import.ts` soma parse+dedupe+inserção em 682 L |
| repositories                        | acesso a dados nomeado por intenção, sem regra | **Sim, onde existem**        | sem vazamento de domínio para dentro; o problema é cobertura (ARC-003)                              |
| RPCs + `recalculo.ts`               | transação atômica de regra crítica             | **Sim**                      | wrappers finos e documentados — padrão positivo                                                     |
| services                            | —                                              | **Camada morta** (1 arquivo) | ARC-010                                                                                             |
| mappers (`contexts/app/mappers.ts`) | fronteira PHP→domínio                          | **Sim**                      | ponto único de tradução do legado — positivo                                                        |
| schemas (`lib/schemas`)             | representar o domínio validável                | **Não representa o domínio** | apenas `cliente.ts` e `obra.ts`; e `cliente.ts` importa validação de `ui/cnpj-input` (ARC-006)      |
| componentes                         | UI                                             | Parcial                      | curva S inline (BIZ-001); validações imperativas; monólitos                                         |

**Services:** não orquestram nem concentram — não existem (já catalogado, ARC-010). A orquestração real é feita por páginas/diálogos chamando lib+repos+RPCs, o que funciona, mas deixa o "fluxo de processo" (ex.: aprovar solicitação → lançar; receber material → estoque) escrito dentro de handlers de UI.

**Repositories:** abstraem corretamente; nomes por intenção; nenhum caso encontrado de regra de domínio dentro deles; inconsistência é só de **cobertura e residência** (`dpHoleriteRepo.ts` e `ponto/pontoRepo.ts` fora de `repositories/` — padrão "repo satélite" que confirma a convenção violando-a).

---

## 3. Lib — Análise Profunda

- **Papel real:** é o coração do produto — 185 arquivos, 19,3 mil linhas, onde vivem os diferenciais (EVM com Earned Schedule, CPM, confronto, LPS).
- **Organização:** 29 subdomínios nomeados + **gaveta de 35 soltos na raiz** (ARC-007) contendo inclusive famílias inteiras (`bms-*` ×6; `cards-*` ×3 apesar de `lib/cards/` existir; trio `dp*`; `cpm.ts` fora de `cronograma/`).
- **Pura × impura sem marcação:** dentro da mesma pasta convivem cálculo puro e acesso a banco (`pmbok/evm.ts` puro ao lado de `pmbok/ac-folha.ts`/`ac-totvs.ts` impuros; `cronograma/gantt-edicao` puro ao lado de `recalcular-cpm.ts` impuro). Nada no nome/estrutura diferencia — o leitor só descobre abrindo (**BIZ-002**).
- **Funções/arquivos grandes:** `cards-trello-import.ts` 682 L é o único caso de "função-processo" gigante; os demais top-20 (390 L para baixo) são parsers e módulos coesos de tamanho justificado.
- **Responsabilidades ocultas:** `api.ts` (208 L) é um gateway completo (telemetria de saúde, refresh, eventos de reauth) sob nome de util — já registrado na Etapa 4; reafirmado aqui como responsabilidade de negócio de infraestrutura sem título.
- **Dependências cruzadas:** internas à lib são saudáveis (domínio→utils/integrations); a exceção conhecida é `schemas→ui` (ARC-006). Nenhum ciclo novo encontrado.
- **Reutilizável espalhado:** parse de data re-escrito localmente (`parseDataSafe` dentro de `resultado/curva-resultado.ts`) e formatação de data inline em 48 arquivos de UI — não existe módulo de datas (**BIZ-004**); dinheiro já catalogado (DS-006).

---

## 4. Schemas

Dois arquivos zod (`cliente`, `obra`), consumidos por 5 arquivos. **Não há padronização possível de avaliar — há ausência**: o domínio (47+ entidades) não tem representação validável; os poucos schemas existentes nasceram para casos pontuais e um deles depende de UI. Duplicação: os "schemas de fato" do sistema são as interfaces TypeScript re-declaradas por página (ARC-001/D6) e os parsers de importação, cada um com sua validação embutida (**BIZ-003**).

## 5. Validações

**Onde acontecem:** (a) imperativas em handlers de página (35 ocorrências do padrão "if vazio → toast"); (b) dentro de cada parser de importação (BMS, holerite, ponto, NFS-e, Trello, checklist — cada um com seu relatório de erros próprio, aliás bem-feitos individualmente); (c) máscaras/inputs especiais (parciais); (d) no banco (constraints/RLS — fora do escopo desta etapa). **Estratégia única: não existe.** A mesma validação conceitual (obrigatoriedade, formato, faixa) é re-decidida por tela e por parser. Este é o ângulo de domínio do mesmo problema cuja face de UI é DS-001 — as duas fichas ficam explicitamente irmanadas (**BIZ-003 ↔ DS-001**).

## 6. Transformações de Dados

| Tipo                                  | Situação                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mapeamento PHP→domínio                | ✔ centralizado em `contexts/app/mappers.ts` (312 L, 12 mapeadores) — padrão positivo                                                                                |
| Parsers de arquivo (XLSX/CSV/XML/PDF) | ✔ um módulo por formato, com fixtures e testes — positivo; 🟡 sem casca comum (DS-012)                                                                              |
| Dinheiro                              | 🔴 três caminhos (DS-006)                                                                                                                                           |
| **Datas**                             | 🔴 **sem módulo central**: 48 arquivos formatam inline (`toLocaleDateString`/`format(dd/MM)`), parse re-escrito localmente; nenhum `lib/datas` existe (**BIZ-004**) |
| Serialização offline                  | ✔ motor genérico (`lib/offline`) — positivo                                                                                                                         |
| Status→rótulo/cor                     | 🔴 15 duplicações (DS-005)                                                                                                                                          |

## 7. Regras Duplicadas (ocorrências documentadas)

1. **Curva S / agregação EVM mensal**: `lib/pmbok/evm.ts` (consumido por `DesempenhoTab`, `EvmPortfolioCard`, `PlanejamentoDashboard`) **e** re-implementação inline em `components/obra/AnaliseTab.tsx` (useMemo montando a curva com date-fns por conta própria) — mesma pergunta de negócio, duas fontes de resposta (**BIZ-001**).
2. **Validações de obrigatoriedade/formato**: re-decididas em 35 páginas + 8 parsers (BIZ-003).
3. **Formatação de data**: 48 pontos (BIZ-004). **Moeda**: 32 pontos (DS-006). **Status**: 15 pontos (DS-005).
4. **Contratos de dados**: interfaces por página (ARC-001). **Cascas de importador**: 8 (DS-012). **Mecânica kanban**: 6 (DS-011).
   _(Itens 3–4 já catalogados; listados por completude do inventário de duplicação.)_

## 8. Acoplamento e Coesão

- Componentes dependem de regra? Sim — nos monólitos e no caso BIZ-001; fora deles, o consumo é da lib (direção correta).
- Hooks executam regra? `useMobilizacoes` (755 L) sim — já coberto por ARC-002; hooks transversais não.
- Services/repositories conhecendo UI? Não — nenhuma ocorrência.
- Inversões: apenas as duas já catalogadas (ARC-006).
- Coesão: excelente na lib pura (um objetivo por arquivo, nomes por intenção); baixa nos impuros multipapel e nos monólitos de UI.

## 9. Escalabilidade da Camada

Novas funcionalidades e módulos: **sim** — a receita (lib pura+testes → repo → RPC atômica) está provada e é o motivo da densidade funcional alcançada. Novos desenvolvedores: **parcial** — a receita não está escrita em lugar nenhum além do README de repositories; a lib pura×impura indistinta e a validação sem casa ensinam pelo mau exemplo. Novas integrações: **sim** — parsers e gateway mostram o caminho. Crescimento contínuo: o risco não é a lib explodir, é **a regra continuar vazando para onde não há proteção** (componentes sem tipos, validações imperativas) enquanto a casa certa segue opcional.

## 10. Padrões Positivos (com evidência)

1. **Regra crítica no lugar certo da pilha**: transações de redistribuição/reversão em RPCs Postgres com wrappers finos documentados (`lib/recalculo.ts`) — atomicidade onde importa, cliente simples.
2. **Domínio puro testado**: `pmbok/evm.ts` + `evm.test.ts`; `cpm.ts`; `financeiro-totvs/*` com fixtures; testes de integração de cadeias de valor (`lib/__tests__/integracao/`).
3. **Fronteira do legado traduzida num único ponto** (`mappers.ts`).
4. **Parsers por formato com relatório de erros** e fixtures reais (checklist_214.xlsx etc.).
5. **Motor offline genérico** reutilizado por dois domínios sem regra duplicada.
6. **README normativo** em repositories — convenção escrita (o déficit é adesão, não desenho).

---

## 11. NOVOS ACHADOS (Catálogo Mestre — prefixo BIZ-)

**BIZ-001 — Regra de domínio duplicada UI×lib (curva S/EVM)** · Regras de Negócio · Etapa 6
**Evidências:** `components/obra/AnaliseTab.tsx` (curva construída inline em useMemo com date-fns) vs `lib/pmbok/evm.ts` consumido por `components/obra/DesempenhoTab.tsx`, `components/dashboard/EvmPortfolioCard.tsx`, `pages/PlanejamentoDashboard.tsx`.
**Diagnóstico:** a mesma pergunta ("qual a curva prevista×realizada da obra?") tem duas implementações; qualquer ajuste de política (calendário, corte mensal, fonte de AC) pode divergir entre abas vizinhas da mesma obra.
**Impacto:** Alto — divergência silenciosa em indicador executivo do módulo-vitrine (M3).
**Prioridade:** P1. **Complexidade:** Média. **Dependências:** nenhuma obrigatória; sinergia com ARC-005 (AnaliseTab está no conjunto da Obra 360º). **Isolável:** Sim.
**Critérios de aceite:** (a) uma única fonte de cálculo de curva/EVM na lib; (b) `AnaliseTab` sem agregação própria (verificável por leitura: nenhum cálculo de PV/EV/AC no componente); (c) testes da lib cobrindo o caso que a aba exibia; (d) valores idênticos entre Desempenho/Análise/Portfólio para a mesma obra e data.

**BIZ-002 — Lib bimodal pura×impura sem convenção** · Regras de Negócio · Etapa 6
**Evidências:** 19 arquivos de `src/lib` (fora de `repositories/`) acessando Supabase, misturados aos puros nas mesmas pastas: `pmbok/ac-folha.ts`, `pmbok/ac-totvs.ts`, `bms-boletim.ts`, `financeiro-totvs/{queries,centros,labels}.ts`, `cronograma/{recalcular-cpm,persistir-calendarios}.ts`, `inspecoes/offline.ts`, `cards-trello-import.ts` (682 L: parse+dedupe+inserção), `ponto/pontoRepo.ts`, `dpHoleriteRepo.ts`, `sync-obra.ts`, `notificacoes.ts`, `cnpj.ts`, `auth/ensureCloudSession.ts`, `recalculo.ts`†. († `recalculo.ts` é wrapper legítimo de RPC — a ficha pede convenção, não pureza absoluta.)
**Diagnóstico:** não há como saber, sem abrir o arquivo, se um módulo da lib é cálculo puro (testável isolado, seguro de reusar) ou executa I/O; o testável e o efeitoso compartilham pasta e aparência. A regra "persistência mora em repositories" vale para páginas mas não foi estendida à própria lib.
**Impacto:** Alto — corrói a principal virtude da camada (previsibilidade da lib pura) e espalha acesso a dados por 19 pontos fora da camada declarada.
**Prioridade:** P1. **Complexidade:** Média. **Dependências:** ARC-001 (tipos), ARC-003 (mesma família — cobertura de repositories). **Isolável:** Sim (arquivo a arquivo).
**Critérios de aceite:** (a) convenção declarada e escrita distinguindo domínio puro × acesso a dados × orquestração; (b) os 19 arquivos classificados e residentes conforme a convenção (cálculo separado de I/O nos casos mistos, ex.: trello-import com parse puro e persistência na camada de dados); (c) verificação automática impedindo acesso a banco fora da camada de dados; (d) zero `supabase` em módulos marcados como puros.

**BIZ-003 — Camada de validação de domínio ausente** · Regras de Negócio · Etapa 6
**Evidências:** `lib/schemas` com apenas `cliente.ts` e `obra.ts` (5 consumidores no app inteiro); 35 páginas com validação imperativa "if→toast"; 8 parsers com validação própria embutida; `schemas/cliente.ts` importando validação de `ui/cnpj-input` (ARC-006).
**Diagnóstico:** o domínio não tem contrato validável — obrigatoriedade, formatos e faixas são re-decididos por tela e por parser; é a face de domínio do problema cuja face de interface é DS-001 (formulários), e as duas só se resolvem juntas.
**Impacto:** Alto — inconsistência de regra entre entrada por tela × entrada por importação × edição, no mesmo dado.
**Prioridade:** P1. **Complexidade:** Alta (transversal, adoção gradual). **Dependências:** ARC-001 (tipos como base dos contratos); execução conjunta com DS-001. **Isolável:** o padrão sim; a adoção é contínua.
**Critérios de aceite:** (a) contrato de validação por entidade central (mesma fonte para formulário e importador) nas 5 entidades mais editadas (obra, colaborador, lançamento, OC, oportunidade); (b) validações imperativas dessas telas substituídas pelo contrato; (c) parser e formulário da mesma entidade rejeitando/aceitando os mesmos valores (teste comprova); (d) nenhuma validação de domínio importada de `components/ui`.

**BIZ-004 — Datas sem módulo central** · Regras de Negócio · Etapa 6
**Evidências:** 48 arquivos de páginas/componentes formatando data inline (`toLocaleDateString("pt-BR")`/`format(...dd/MM...)`); parse defensivo re-escrito localmente (`parseDataSafe` em `lib/resultado/curva-resultado.ts`); inexistência de qualquer `lib/datas` (busca sem resultado); enquanto isso a lib usa date-fns diretamente em cada módulo.
**Diagnóstico:** o segundo dado mais onipresente do ERP (depois de dinheiro) não tem fonte única de formatação/parse/fuso — irmão direto de DS-006.
**Impacto:** Médio — inconsistências pontuais de exibição e parse duplicado; custo de mudança espalhado.
**Prioridade:** P2. **Complexidade:** Baixa. **Dependências:** nenhuma. **Isolável:** Sim.
**Critérios de aceite:** (a) módulo único de datas (formatar exibição, formatar curto, parse seguro, hoje/competência); (b) zero formatação de data inline em páginas/componentes (verificável por busca); (c) `parseDataSafe` local removido em favor do módulo.

---

## 12. Riscos da Camada

| Risco                   | Leitura                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manutenção              | **Médio** — baixo na lib pura (testada), alto nos 19 impuros e nos pontos de regra em UI                                                                   |
| Regressão               | **Médio-Alto** — BIZ-001 é o caso típico: mexer na política de curva conserta uma aba e esquece a outra; mitigado onde há teste, e teste só há na lib pura |
| Crescimento desordenado | **Médio** — a receita boa existe; sem convenção escrita (BIZ-002/003), cada feature nova escolhe a casa por imitação do exemplo errado mais próximo        |
| Duplicação              | **Alto** — inventário da §7: 6 famílias ativas de duplicação, três delas transversais (validação, data, dinheiro)                                          |
| Inconsistência          | **Alto no dado exibido** (data/moeda/status) e **médio na regra calculada** (um caso comprovado — BIZ-001)                                                 |

## 13. Matriz de Maturidade da Camada de Negócio

| Camada                                        | Organização | Coesão | Acoplamento           | Escalabilidade | Maturidade              |
| --------------------------------------------- | ----------- | ------ | --------------------- | -------------- | ----------------------- |
| Lib pura (domínio)                            | ★★★★☆       | ★★★★★  | ★★★★★                 | ★★★★★          | ★★★★★                   |
| Lib impura (domínio+I/O)                      | ★★☆☆☆       | ★★☆☆☆  | ★★★☆☆                 | ★★☆☆☆          | ★★☆☆☆                   |
| Repositories                                  | ★★★★☆       | ★★★★★  | ★★★★★                 | ★★★★☆          | ★★★★☆ (cobertura ★★☆☆☆) |
| RPCs/orquestração atômica                     | ★★★★★       | ★★★★★  | ★★★★★                 | ★★★★☆          | ★★★★★                   |
| Mappers/adaptadores (fronteira PHP)           | ★★★★★       | ★★★★★  | ★★★★★                 | ★★★★☆          | ★★★★★                   |
| Parsers/transformações de arquivo             | ★★★★☆       | ★★★★☆  | ★★★★★                 | ★★★★☆          | ★★★★☆                   |
| Schemas/validação de domínio                  | ★☆☆☆☆       | ★★☆☆☆  | ★★☆☆☆ (depende de UI) | ★☆☆☆☆          | ★☆☆☆☆                   |
| Formatadores transversais (data/moeda/status) | ★★☆☆☆       | ★★☆☆☆  | ★★★★☆                 | ★★☆☆☆          | ★★☆☆☆                   |
| Services                                      | ★☆☆☆☆       | —      | —                     | —              | ★☆☆☆☆ (vestigial)       |
| Regra em UI (monólitos + BIZ-001)             | ★★☆☆☆       | ★★☆☆☆  | ★★☆☆☆                 | ★★☆☆☆          | ★★☆☆☆                   |

## 14. Atualização da Matriz de Implementação

Novos itens inseridos na sequência consolidada da Etapa 5.5 (posições relativas):

| Ordem sugerida                        | ID          | Área       | Objetivo                                                        | Impacto | Prioridade | Complexidade | Dependências                 | Isolável?                   | Critérios de aceite |
| ------------------------------------- | ----------- | ---------- | --------------------------------------------------------------- | ------- | ---------- | ------------ | ---------------------------- | --------------------------- | ------------------- |
| junto às ordens 2–8 (quick wins)      | **BIZ-004** | Datas      | Módulo único de datas + varredura de inline                     | Médio   | P2         | Baixa        | —                            | Sim                         | ficha §11           |
| junto à ordem 9 (ARC-003)             | **BIZ-002** | Lib/Dados  | Convenção pura×impura + realocação dos 19 arquivos              | Alto    | P1         | Média        | ARC-001, ARC-003             | Sim                         | ficha §11           |
| junto à ordem 13 (DS-001)             | **BIZ-003** | Validação  | Contratos de validação de domínio (fonte única tela+importador) | Alto    | P1         | Alta         | ARC-001; conjunta com DS-001 | Padrão sim; adoção contínua | ficha §11           |
| ordem 13-bis (antes/junto de ARC-005) | **BIZ-001** | Domínio M3 | Fonte única de curva/EVM; AnaliseTab sem cálculo próprio        | Alto    | P1         | Média        | — (sinergia ARC-005)         | Sim                         | ficha §11           |

Racional de encaixe: BIZ-002 é literalmente a extensão de ARC-003 para dentro da lib — mesma janela de trabalho; BIZ-003 e DS-001 são o mesmo programa visto do domínio e da interface — especificar juntos, adotar juntos; BIZ-001 convém antes de quebrar os monólitos da Obra 360º para que a extração já aponte para a fonte única; BIZ-004 entra no pacote de quick wins transversais com DS-005/DS-006.

## 15. Plano Diretor da Camada de Negócio

**Visão:** o Planifik já possui o desenho correto — _domínio puro testado no cliente, transação atômica no banco, tradução de legado num ponto só_. O plano diretor não cria arquitetura nova; **promove a existente de costume a lei**.

**Pontos fortes a proteger:** lib pura (EVM/CPM/LPS/confronto) com testes; RPCs atômicas com wrappers finos; mappers de fronteira; parsers com fixtures.

**Fragilidades a fechar:** validação sem casa (BIZ-003+DS-001); lib impura indistinta (BIZ-002); regra re-derivada em UI (BIZ-001, e os monólitos ARC-005); transversais dispersos (datas BIZ-004, moeda DS-006, status DS-005); receita não escrita (resolvida pelos critérios de convenção de BIZ-002/003 + catálogo DS-014).

**Áreas prioritárias:** (1º) fundações transversais baratas — datas/moeda/status; (2º) fronteira de dados completa — ARC-003+BIZ-002 na mesma janela; (3º) contratos de validação — BIZ-003+DS-001 nas 5 entidades mais editadas; (4º) fonte única de EVM — BIZ-001, precedendo a quebra dos monólitos de M3.

**Riscos futuros se nada for feito:** divergência de indicadores executivos (BIZ-001 é o precedente), regra nova nascendo em UI por imitação, e a migração PHP→Supabase transportando dados sem transportar contratos (validação/tipos), perpetuando a validação por tela.

**Sequência recomendada ao Lovable (consolidada com a Etapa 5.5):** ARC-001 → [quick wins: DS-002/003/005/006 + **BIZ-004** + PRO-001/009/018] → [janela de dados: ARC-003 + **BIZ-002**] → [programa de validação/formulários: DS-001 + **BIZ-003** (padrão, depois adoção contínua)] → **BIZ-001** → ARC-005 → (fluxo segue como na matriz da Etapa 5.5, ordens 14+ inalteradas).

---

# RESUMO EXECUTIVO

**1. Visão geral:** a regra de negócio do Planifik tem um núcleo de qualidade rara (lib pura testada + RPCs atômicas + mappers de fronteira) cercado por três vazamentos sistemáticos: persistência infiltrada na lib (19 arquivos), validação sem camada e regra re-derivada em UI (um caso comprovado em indicador executivo).

**2. Organização: ★★★★☆ no núcleo, ★★☆☆☆ nas bordas** — a média honesta é ★★★☆☆: a estratégia existe e funciona; não está escrita nem policiada.

**3. Coesão: ★★★★☆** — um objetivo por arquivo é a regra na lib pura e nos repositories; as exceções são os 19 impuros e o importador Trello de 682 L.

**4. Acoplamento: ★★★★☆** — direções corretas quase sempre; duas inversões conhecidas (ARC-006) e dependência de UI dentro de schema como piores casos.

**5. Escalabilidade: ★★★★☆ para quem seguir a receita; ★★☆☆☆ para quem aprender pelos maus exemplos** — o determinante é tornar a receita explícita.

**6. Principais riscos:** divergência silenciosa de indicadores (BIZ-001); validação inconsistente entre tela e importação do mesmo dado (BIZ-003); erosão da previsibilidade da lib (BIZ-002).

**7. Principais pontos fortes:** EVM/CPM/LPS/confronto puros e testados; transações críticas atômicas no banco com cliente fino; fronteira do legado traduzida num único ponto; parsers com fixtures reais.

**8. Novos achados: 4** (BIZ-001 a BIZ-004) — 3×P1, 1×P2.

**9. Catálogo Mestre atualizado:** 68 → **72 achados** (PRO 31 · DS 16 · ARC 11 · UX 10 · **BIZ 4**). Prioridades: P0 1 · P1 **25** · P2 **28** · P3 18. Nenhum ID reutilizado ou renumerado.

**10. Matriz de Implementação atualizada:** 4 inserções com posições e racional na §14; ordens existentes preservadas.

**11. Conclusão:** à pergunta da etapa — _"as regras estão organizadas de forma consistente, escalável e sustentável?"_ — a resposta é: **o padrão sim; a prática, em parte**. O Planifik não precisa inventar uma camada de negócio: precisa terminar de morar na que construiu — dar nome à diferença entre puro e impuro, dar casa à validação, e garantir que cada regra tenha exatamente um endereço.

---

_Auditoria conforme metodologia da Etapa 5.5. Nenhum arquivo alterado. Estado/estado servidor, banco/RPCs por dentro, performance, segurança e testes permanecem reservados às suas etapas específicas._
