# ETAPA 4 — Auditoria da Arquitetura Frontend — Planifik

**Perspectiva:** Arquiteto de Software Sênior (React)
**Base:** medições diretas na base (`src`: ~97,3 mil linhas fora de `components/ui` e tipos gerados)
**Regra desta etapa:** somente análise. Nenhum arquivo alterado, nenhum código gerado, nenhuma biblioteca proposta. O plano final descreve problemas/impactos/objetivos para execução futura pelo Lovable.

---

## 1. Fotografia da Estrutura

| Camada           | Arquivos           | Linhas | Observação                                                                                                                                                                                                        |
| ---------------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages`      | 98                 | 35.834 | subpastas por domínio (financeiro, crm, dp, planejamento, suprimentos, admin, contratos) + ~30 páginas soltas na raiz                                                                                             |
| `src/components` | 218                | 41.359 | subpastas por domínio (obra-detalhe, obra, cards, board, suprimentos, inspecoes, financeiro, dp, crm, frotas, import, migracao, dashboard, cliente, onboarding) + **35 arquivos soltos na raiz** + `ui/` (shadcn) |
| `src/lib`        | 185                | 19.288 | 29 subdomínios nomeados + **35 arquivos soltos na raiz** + `repositories/` + `__tests__/`                                                                                                                         |
| `src/contexts`   | 16                 | 2.805  | `AppContext` (730 L) + 12 hooks de estado em `contexts/app/` + Empresa + Theme                                                                                                                                    |
| `src/hooks`      | 17 + `financeiro/` | 1.334  | hooks transversais pequenos e focados                                                                                                                                                                             |
| `src/services`   | **1**              | 48     | camada vestigial (`colaboradorService.ts`)                                                                                                                                                                        |
| `src/types`      | 1                  | 491    | só o domínio PHP                                                                                                                                                                                                  |
| `src/config`     | 2                  | 535    | `navigation.ts` (registro único de rotas/menu) + `obra-tabs.ts`                                                                                                                                                   |
| `src/App.tsx`    | —                  | 281    | 86 `lazy()` — code-splitting integral por rota                                                                                                                                                                    |

Alias único `@/*` → `src/*`; **zero** imports relativos profundos (`../../..`) — higiene de import exemplar.

---

## 2. Estratégia de Organização Identificada

**Híbrida: esqueleto layer-based com domínio dentro das camadas.**

Evidências: a raiz separa por papel técnico (pages/components/hooks/lib/contexts), e **dentro** de cada camada repete-se a mesma taxonomia de domínio (`pages/financeiro` + `components/financeiro` + `lib/financeiro-totvs` + `hooks/financeiro`). Não há módulos de feature autocontidos (nenhum `features/financeiro` com tudo dentro); a fronteira de um domínio atravessa quatro pastas.

Consequência prática (neutra, documentada): para entender "Financeiro" o leitor abre 4 árvores; para entender "o que é página vs componente" abre 1. A escolha favorece consistência de camada e desfavorece isolamento de módulo. Há ainda uma **segunda dimensão de organização implícita e não declarada**: a fronteira de backend (domínios PHP vivem em `contexts/app` + `types/index.ts`; domínios Supabase vivem em `lib/repositories` + React Query). Essa fronteira é a divisão arquitetural mais importante do sistema e não aparece em nenhuma convenção de pasta ou nome.

---

## 3. Análise por Área

### 3.1 Pages

- Estrutura por domínio razoável, mas **incompleta**: ~30 páginas na raiz de `pages/` (Board, Contratos, Veiculos, Patrimonios, Quadros, GM*, Inspecoes*...) ao lado das subpastas — o critério "quando ganha pasta" não existe.
- 4 páginas órfãs (Etapa 1) permanecem como ruído estrutural.
- Páginas-monólito: `AprovacaoFinanceira` (1.399 L), `QuadroBoard` (1.165 L), `PacotesTrabalho` (811 L), `Board` (799 L), `FinObras` (753 L), `Riscos` (753 L) — páginas que contêm listagem + diálogos + regras no mesmo arquivo.
- **Inversão de dependência real:** `components/obra-detalhe/MedicoesTab.tsx` importa um tipo de `pages/financeiro/FinObraDetalhe` — componente dependendo de página (o contrato deveria fluir no sentido oposto).

### 3.2 Components

- Separação compartilhado × específico existe (raiz + `ui/` vs pastas de domínio), mas a **raiz virou gaveta** (35 soltos: Layout, Breadcrumbs, QueryState, filtros, diálogos de colaborador com 779 L, InstallPrompt...). Misturam-se ali infraestrutura de layout, primitivos de produto e componentes de domínio (Employee*).
- Componentes-gigante: `CardGenericoDialog` **2.104 L** (o maior arquivo de produto do sistema — um "mini-app" completo dentro de um diálogo), `RevisoesTab` 1.174 L, `PrevisaoTab` 966 L, `RdoTab` 868 L, `AllocationBoard` 819 L.
- Acoplamento ao domínio é o esperado nas pastas de domínio; não há genéricos "over-engineered" — na dúvida o time escreveu específico (custo: duplicação entre quadros gêmeos quadro/lista de Contratos/Patrimônios/Suprimentos).
- **Reutilizável no lugar errado:** validação de CNPJ (`isValidCnpj`, `onlyDigits`) vive dentro de `components/ui/cnpj-input.tsx` e é importada por `lib/schemas/cliente.ts` — **lib dependendo de UI**, a segunda inversão de camada real do projeto.

### 3.3 Hooks

- Os 17 hooks transversais são pequenos, nomeados por intenção e sem duplicação (`useUrlState`, `useTableSort`, `useObraMembership`, `useFeatureFlag`, `useOnlineStatus`...). Boa separação lógica/UI.
- A concentração indevida está fora da pasta: `contexts/app/useMobilizacoes.ts` (**755 L**) é regra de negócio inteira (mobilização, agendamento, colunas especiais) morando na camada de contexto.
- `hooks/financeiro/` inaugura hooks por domínio; padrão não replicado para os demais domínios (cada um resolve à sua maneira: repo + query inline).

### 3.4 Services

- Camada **morta**: um único arquivo. O papel foi absorvido por repositories (Supabase), `lib/api.ts` (PHP) e edge functions. Manter a pasta comunica um padrão que não existe.

### 3.5 Repositories

- Padrão **bom e documentado** (README com regra explícita: páginas não chamam `supabase.from` de tabelas cobertas; funções nomeadas por intenção; sem regra de negócio).
- Adesão **minoritária**: 13 repositories cobrem parte das ~130 tabelas; **35 arquivos de páginas** ainda chamam `supabase.from`/`rpc` direto contra 11 consumindo repositories. O padrão certo perdeu a corrida para a conveniência.
- Fora do lugar: `lib/dpHoleriteRepo.ts` é um repository solto na raiz da lib, fora de `repositories/`.
- Onde existem, abstraem de verdade (sem regra de negócio dentro); a lógica vive nos módulos puros de `lib/*` — separação correta.

### 3.6 Contexts / Providers

- Árvore enxuta e correta: `QueryClientProvider → ThemeProvider → AppProvider → EmpresaProvider` + Suspense por rota. Sem provider hell.
- O problema é **um** provider: `AppContext` é um god-context — 730 L, **63 membros expostos**, consumido por **86 arquivos**. Ele acumula: autenticação dupla, RBAC (`canAccess`), _todo_ o estado dos domínios PHP (via 12 hooks de estado), mutações otimistas e sincronismo Supabase. Qualquer alteração nele tem raio de explosão de 86 arquivos, e qualquer atualização de estado re-renderiza o mundo (mitigado apenas pelo tamanho das telas).
- **Duplicidade de gerência de estado servidor:** duas máquinas convivem — AppContext (fetch imperativo + cache manual + otimismo artesanal para PHP) e TanStack Query (para Supabase). Mesma responsabilidade, dois paradigmas, decididos pela origem do dado — a tal fronteira invisível.
- `EmpresaContext` e `ThemeContext` têm responsabilidade adequada e tamanho mínimo.

### 3.7 Lib (análise dedicada)

- **O melhor ativo arquitetural do projeto**: 29 subdomínios puros, testáveis (14 arquivos de teste co-locados, incl. integração), sem dependência de React — `pmbok/`, `cronograma/` (CPM), `lastplanner/`, `financeiro-totvs/`, `offline/` (motor genérico), `suprimentos/`, `recursos/`... É a "regra de negócio como biblioteca", e explica a densidade funcional alcançada.
- **Gaveta paralela:** 35 arquivos soltos na raiz, misturando utilitários legítimos (`money`, `uuid`, `logger`) com módulos de domínio que mereciam pasta (`bms-*.ts` são 6 arquivos irmãos soltos; `cards-*.ts` 3 soltos apesar de existir `lib/cards/`; `cpm.ts` solto apesar de existir `lib/cronograma/`; `dpHoleriteRepo`, `dpAlocacao`, `dpCodigos` soltos sem `lib/dp/`). O critério "quando cresce, ganha pasta" foi aplicado a uns e não a outros.
- Acoplamentos: uma única violação (schemas→components/ui já citada); no restante, lib importa apenas lib/integrations — direção correta.
- Utilitário que virou responsabilidade maior: `api.ts` (cliente PHP) acumulou telemetria de saúde, refresh de token, eventos globais de reauth e banner — é hoje um "gateway" completo com nome de util.

### 3.8 Routing

- `App.tsx` exemplar como composição: 281 L, 86 lazy, rotas públicas × `ProtectedRoutes`, redirects legados centralizados.
- Metadados de rota centralizados em `config/navigation.ts` (menu, permissões, KNOWN_ROUTES, labels de breadcrumb, keywords do ⌘K) — **padrão positivo raro**: uma única fonte para rota/menu/breadcrumb/busca.
- Gate de acesso por página resolvido no ponto certo (`canAccess` + registro de navegação). Fricção: o gate por página vive no AppContext enquanto o gate por obra (`useObraMembership`) e por papel Supabase (`has_role`/RLS) vivem alhures — três sistemas de autorização sem fachada comum (consequência da fronteira dupla, não erro isolado).

### 3.9 Types

- Estratégia **tripartida e desigual**: (a) `types/index.ts` centraliza só o domínio PHP (491 L, bom); (b) tipos Supabase gerados **desatualizados** (~40 tabelas ausentes) com `client-augment.d.ts` rebaixando `from()/rpc()` para `any` ("schema in flux") — o type-check foi deliberadamente desligado na metade nova do sistema; (c) interfaces locais re-declaradas por página (ex.: `OrdensCompra` define `OC/Cotacao/Requisicao` próprios) — duplicação de contrato com risco de deriva silenciosa entre telas.
- Em síntese: existe centralização onde o sistema é velho e não existe onde o sistema cresce.

### 3.10 Utils / Shared / Config

- Utils: dispersos entre `lib/utils.ts`, `lib/utils/` (2 arquivos) e soltos (`currency`+`money` coexistem para dinheiro — redundância pontual).
- Shared de fato = componentes soltos da raiz + `ui/` — funciona, sem nome nem fronteira declarada.
- Config: pequena e de alto valor (navigation/obra-tabs).

### 3.11 Importações e ciclos

- Sem ciclos evidentes entre camadas; as duas inversões (lib→ui, component→page) são os únicos vazamentos de direção encontrados.
- Query keys do React Query: strings ad-hoc por tela (`["board"]`, `["obras"]`, `["clientes"]`...), razoavelmente consistentes por convenção oral, **sem fábrica/registro** — invalidações cruzadas dependem de memória do autor.

---

## 4. Escalabilidade

**Suporta crescimento do produto?** Sim, no eixo em que vem crescendo: novos domínios Supabase entram com receita conhecida (lib pura + repository + páginas com Query + item no navigation). A prova é empírica — o produto absorveu suprimentos, qualidade, RDO e ponto sem colapso estrutural.

**Suporta novos módulos?** Sim, com atrito baixo — desde que sigam a geração nova. O custo marginal de um módulo novo é pequeno; o custo de tocar a geração antiga (AppContext/PHP) é alto e crescente.

**Suporta novas equipes?** Parcialmente. Contra: fronteira de backend invisível, regra de repositories não fiscalizada (35 furos), tipagem `any` na metade nova (o compilador não protege o novato), god-context com raio de 86 arquivos, e arquivos de 800–2.100 linhas como ponto de entrada de features centrais. A favor: lib pura testada, navegação registrada, aliases limpos.

**Suporta evolução contínua?** O risco dominante não é a estrutura de pastas — é a **combinação (tipos desligados + bypass de repositories + god-context)**: juntas, elas removem as três redes de proteção (compilador, camada de dados, isolamento de estado) exatamente na região do código que mais muda.

---

## 5. Padrões Arquiteturais

**Positivos:** regra de negócio como lib pura testada; repositories documentados com README normativo; registro único de navegação (rota+menu+breadcrumb+busca+permissão); code-splitting integral; contexto fatiado internamente (`contexts/app/use*State` — o god-context ao menos é modular por dentro); motor offline genérico reutilizado por dois domínios; mappers de fronteira para o PHP; RPCs atômicas para operações compostas; testes de integração de "cadeias de valor".

**Inconsistentes:** repository × acesso direto (11×35); duas máquinas de estado servidor; três locais de tipos; utilitários dinheiro duplicados; lib com pastas e soltos do mesmo domínio; padrão hooks-por-domínio iniciado e abandonado; `services/` vestigial.

**Repetidos (duplicação estrutural):** trio quadro/lista quase gêmeo em três módulos; interfaces locais por página para as mesmas tabelas.

**Ausentes:** fronteira declarada de feature/módulo; fábrica/registro de query keys; fachada única de autorização; regra automatizada de fronteiras (nada impede o próximo import lib→components); convenção para tamanho máximo de página/diálogo.

---

## 6. Débito Arquitetural Classificado

| #   | Ocorrência                                                                                                                                          | Classificação | Justificativa                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Tipagem Supabase desligada (`client-augment.d.ts` → `any`) sobre tipos gerados defasados em ~40 tabelas                                             | **Crítico**   | Remove o compilador exatamente da metade do sistema em expansão; erros de contrato só aparecem em runtime; convida a deriva de schemas entre telas (D6 é sintoma)    |
| D2  | God-context `AppContext` (730 L, 63 membros, 86 consumidores) somando auth+RBAC+estado de 10 domínios+sincronismo                                   | **Crítico**   | Maior raio de explosão do sistema; acopla autenticação à migração dos domínios PHP; re-render global; é o principal bloqueador da saída do backend legado            |
| D3  | Regra de repositories não cumprida (35 páginas com `supabase.from` direto vs 11 via repo)                                                           | **Alto**      | A camada anticorrupção existe mas está furada; mudanças de schema exigem caça por 35 arquivos; padrão declarado ≠ padrão praticado corrói a confiança nas convenções |
| D4  | Duas máquinas de estado servidor (AppContext imperativo × TanStack Query) segregadas por backend, fronteira não documentada                         | **Alto**      | Duplicidade de caching/otimismo/erros; on-boarding aprende dois paradigmas; qualquer entidade migrada de backend troca de paradigma junto                            |
| D5  | Componentes/páginas-monólito (CardGenericoDialog 2.104 L; AprovacaoFinanceira 1.399 L; RevisoesTab 1.174 L; QuadroBoard 1.165 L; +6 acima de 700 L) | **Alto**      | Pontos de entrada das features mais quentes com custo de mudança e revisão máximo; concentram merge conflicts para equipes                                           |
| D6  | Contratos de dados re-declarados por página (interfaces locais para mesmas tabelas)                                                                 | **Médio**     | Deriva silenciosa entre telas; consequência direta de D1/D3                                                                                                          |
| D7  | Gavetas: 35 soltos em `lib/` raiz (6 `bms-*`, 3 `cards-*`, trio `dp*`, `cpm` fora de `cronograma/`) e 35 soltos em `components/` raiz               | **Médio**     | Custo de descoberta e critério de organização ilegível; convida novas adições ao lugar errado                                                                        |
| D8  | Inversões de camada: `lib/schemas` → `components/ui` (validação CNPJ na UI) e `components/obra-detalhe` → `pages/financeiro` (tipo)                 | **Médio**     | Duas ocorrências apenas, mas são precedentes de direção; sem regra automatizada, tendem a multiplicar                                                                |
| D9  | Query keys ad-hoc sem registro                                                                                                                      | **Médio**     | Invalidações cruzadas frágeis; refactors de chave são busca textual                                                                                                  |
| D10 | `services/` vestigial; `dpHoleriteRepo` fora de `repositories/`; `currency`×`money` duplicados; hooks-por-domínio inconsistente                     | **Baixo**     | Ruído de convenção; baixo custo individual, sinalização ruim                                                                                                         |
| D11 | Páginas órfãs (4) e rotas/telas fora de registro de menu                                                                                            | **Baixo**     | Peso morto e ambiguidade de fonte de verdade da navegação                                                                                                            |
| D12 | Autorização em três sistemas sem fachada (acessos PHP, membership de obra, roles/RLS Supabase)                                                      | **Alto**      | Raciocinar "o que este usuário pode" exige conhecer três mecanismos; risco de gate esquecido em tela nova é estrutural                                               |

---

## 7. Matriz de Maturidade

| Área                        | Organização | Escalabilidade | Coesão | Acoplamento (menor=pior) | Maturidade           |
| --------------------------- | ----------- | -------------- | ------ | ------------------------ | -------------------- |
| Pages                       | ★★★☆☆       | ★★★☆☆          | ★★★☆☆  | ★★★☆☆                    | ★★★☆☆                |
| Components                  | ★★★☆☆       | ★★★☆☆          | ★★★☆☆  | ★★★★☆                    | ★★★☆☆                |
| Hooks                       | ★★★★☆       | ★★★★☆          | ★★★★★  | ★★★★★                    | ★★★★☆                |
| Contexts                    | ★★★☆☆       | ★★☆☆☆          | ★★☆☆☆  | ★★☆☆☆                    | ★★☆☆☆                |
| Providers (árvore)          | ★★★★★       | ★★★★☆          | ★★★★★  | ★★★★☆                    | ★★★★☆                |
| Services                    | ★☆☆☆☆       | —              | —      | —                        | ★☆☆☆☆ (vestigial)    |
| Repositories                | ★★★★☆       | ★★★★☆          | ★★★★★  | ★★★★★                    | ★★★★☆ (adesão ★★☆☆☆) |
| Lib                         | ★★★★☆       | ★★★★★          | ★★★★★  | ★★★★★                    | ★★★★★                |
| Routing                     | ★★★★★       | ★★★★★          | ★★★★★  | ★★★★★                    | ★★★★★                |
| Types                       | ★★☆☆☆       | ★★☆☆☆          | ★★★☆☆  | ★★★☆☆                    | ★★☆☆☆                |
| Utils                       | ★★★☆☆       | ★★★★☆          | ★★★★☆  | ★★★★★                    | ★★★☆☆                |
| Shared (componentes comuns) | ★★★☆☆       | ★★★★☆          | ★★★★☆  | ★★★★☆                    | ★★★☆☆                |
| Configuração                | ★★★★★       | ★★★★★          | ★★★★★  | ★★★★★                    | ★★★★★                |

---

## 8. Plano Técnico de Evolução (para execução futura pelo Lovable)

Formato exigido: problema → impacto → prioridade → objetivo. Sem instruções de implementação, sem código, sem bibliotecas.

**P1. Religar a tipagem da metade Supabase.**
Problema: tipos gerados defasados + afrouxamento global para `any` (D1), com contratos re-declarados por página (D6). Impacto: erros de contrato só em runtime na região mais ativa do produto; deriva entre telas. Prioridade: **Crítica**. Objetivo: uma única fonte de tipos de banco atualizada cobrindo todas as tabelas/RPCs, eliminação do afrouxamento global e das interfaces locais duplicadas, de modo que o compilador volte a proteger o desenvolvimento dos domínios novos.

**P2. Desmontar o god-context em fatias com fronteiras próprias.**
Problema: AppContext concentra autenticação, autorização e estado de 10 domínios PHP, com 86 consumidores (D2) e regra de negócio pesada dentro de hook de contexto (useMobilizacoes). Impacto: raio de mudança máximo, re-render global, acoplamento da auth à migração do legado. Prioridade: **Crítica**. Objetivo: sessão/identidade isoladas do estado de domínio; cada domínio PHP exposto por interface própria e substituível, permitindo migrar entidade a entidade de backend sem tocar consumidores.

**P3. Unificar a gestão de estado servidor sob um único paradigma.**
Problema: duas máquinas (imperativa PHP × Query Supabase) para a mesma responsabilidade (D4). Impacto: dois modelos de cache/otimismo/erro, on-boarding duplo, migrações de backend trocam paradigma junto. Prioridade: **Alta** (deve andar junto de P2). Objetivo: um único modelo mental de dados-servidor em todo o app, com a origem (PHP/Supabase) encapsulada atrás da camada de dados.

**P4. Fechar os furos da camada de repositories.**
Problema: 35 páginas ignoram a regra documentada (D3); um repo mora fora da pasta (D10). Impacto: mudanças de schema viram caça em 35 arquivos; convenção desmoralizada. Prioridade: **Alta**. Objetivo: 100% do acesso a tabelas cobertas passando pela camada declarada, cobertura de repositories estendida aos domínios que hoje não têm, e verificação automática de fronteira para que o furo não reabra.

**P5. Quebrar os monólitos de página/diálogo.**
Problema: 10 arquivos entre 700 e 2.104 linhas concentram as features centrais (D5). Impacto: custo de mudança, revisão e conflito máximos nos pontos mais quentes. Prioridade: **Alta**. Objetivo: nenhuma página/diálogo funcionando como "mini-app" monolítico; composição por seções com contratos claros, preservando comportamento.

**P6. Declarar e policiar as fronteiras de camada.**
Problema: duas inversões existentes (D8) e nenhuma regra automatizada impedindo as próximas; critério de "solto × pasta" ilegível em lib/components (D7). Impacto: erosão gradual da direção de dependências e custo de descoberta. Prioridade: **Média**. Objetivo: direção de dependência explícita (pages→components→hooks/lib; lib nunca importa UI/páginas), utilitários de domínio residindo no domínio (validação de CNPJ fora da UI), gavetas da raiz redistribuídas para seus subdomínios existentes (bms→medições, cards-* → cards/, dp* → dp/, cpm→cronograma/), e verificação automática dessas regras.

**P7. Registro central de query keys e invalidações.**
Problema: chaves ad-hoc por tela (D9). Impacto: invalidação cruzada frágil entre módulos integrados (cards⇄suprimentos⇄obra). Prioridade: **Média**. Objetivo: vocabulário único de chaves por domínio com pontos de invalidação conhecidos.

**P8. Fachada única de autorização.**
Problema: três mecanismos de acesso sem ponto de consulta comum (D12). Impacto: risco estrutural de gate esquecido; raciocínio de permissão fragmentado. Prioridade: **Média**. Objetivo: uma API única de decisão de acesso (página, obra, papel), consumida por menu, rotas e telas, independentemente de onde a regra é avaliada.

**P9. Higiene estrutural.**
Problema: `services/` vestigial, 4 páginas órfãs, duplicação `currency`×`money`, hooks-por-domínio inconsistente (D10, D11). Impacto: ruído de convenção e peso morto. Prioridade: **Baixa**. Objetivo: estrutura sem camadas mortas nem arquivos inalcançáveis, com uma única convenção visível para cada papel.

Sequência recomendada de execução: P1 → P4 → P2/P3 (em conjunto) → P5 → P6 → P7/P8 → P9. Racional: religar o compilador e fechar a camada de dados barateia e protege todas as demais frentes; o desmonte do contexto e a unificação de estado são a mesma cirurgia vista de dois ângulos; monólitos quebram melhor depois que tipos e dados estão firmes.

---

## 9. Resumo Executivo

**1. Visão geral.** SPA React em organização híbrida (camadas com domínio interno), com uma divisão arquitetural real e invisível: a fronteira PHP×Supabase. A metade nova segue uma receita sólida (lib pura testada → repositories → páginas com Query → navegação registrada); a metade legada vive num god-context imperativo. O routing e a configuração de navegação são de nível excelente; a lib de domínio é o grande patrimônio.

**2. Pontos fortes.** Regra de negócio como biblioteca pura com testes (CPM, EVM, LPS, offline, TOTVS); registro único de navegação alimentando menu, breadcrumb, busca e permissão; code-splitting integral com árvore de providers mínima; repositories bem desenhados e documentados; higiene total de imports/aliases; contexto legado ao menos fatiado internamente.

**3. Pontos fracos.** Compilador desligado na metade nova (tipos `any` + gerados defasados); god-context com 86 consumidores; regra de repositories cumprida por minoria; dois paradigmas de estado servidor; dez arquivos-monólito nas features centrais; gavetas de raiz em lib/components; tipos triplicados; três sistemas de autorização.

**4. Principais riscos.** (i) Erro de contrato em produção na região sem tipos; (ii) a migração PHP→Supabase travar no AppContext, perpetuando a dualidade; (iii) erosão de fronteiras sem policiamento automatizado; (iv) custo de mudança crescente nos monólitos que concentram as features mais evoluídas.

**5. Grau de escalabilidade: ★★★★☆** para crescer no padrão novo; **★★☆☆☆** para evoluir o legado — a média real depende de quanto do roadmap toca cada metade.

**6. Grau de organização: ★★★☆☆** — excelente onde há convenção declarada (routing, lib de domínio, repositories), gaveta onde não há (raízes de lib/components, tipos).

**7. Débito arquitetural: Médio-Alto, concentrado e endereçável** — 2 itens críticos, 4 altos, 4 médios, 2 baixos; nenhum exige reescrita, todos são consolidação de padrões que o próprio projeto já inventou.

**8. Conclusão.** A pergunta da etapa — _"a estrutura favorece a evolução?"_ — tem resposta dupla e honesta: **sim** para tudo que nasce na geração nova (a receita existe, é boa e está provada), **não** para tudo que depende de atravessar a fronteira legada, onde tipos desligados, contexto-deus e bypass de repositories removem justamente as proteções de que uma migração precisa. O plano técnico acima ordena a correção começando por religar as redes de segurança (tipos e camada de dados) antes das cirurgias maiores.

---

_Auditoria estática baseada em medições da própria base (contagens de arquivos/linhas/consumidores citadas ao longo do texto). Nenhum arquivo modificado. Performance, banco, segurança, testes e design system serão tratados nas etapas seguintes._
