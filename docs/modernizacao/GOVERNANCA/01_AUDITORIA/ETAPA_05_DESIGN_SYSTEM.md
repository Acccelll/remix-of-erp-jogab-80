# ETAPA 5 — Auditoria dos Componentes Compartilhados e Design System — Planifik

**Perspectiva:** Design System Architect / Staff Frontend Engineer
**Base:** inventário completo de `src/components` (218 arquivos; `ui/` com 58) + contagens reais de uso por importação
**Regra:** somente auditoria. Nenhum arquivo alterado, nenhum código, nenhuma biblioteca proposta. Saídas formatadas para consumo posterior pelo Lovable.

---

## 1. Estrutura Encontrada

A biblioteca tem **quatro estratos de fato**, dois deles não declarados:

| Estrato                  | Onde vive                                                                                                                                            | Conteúdo                                                                                                                                                                                           | Status                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Base (primitivos)**    | `components/ui/` (58 arquivos)                                                                                                                       | shadcn/Radix completo + **9 extensões da casa**: `money-input`, `percent-input`, `cnpj-input`, `chips-number-input`, `multi-select`, `combobox`, `data-table`, `sort-header`, `busy-overlay`       | Declarado e saudável                                                                                                              |
| **Compostos de produto** | raiz de `components/` (35 soltos)                                                                                                                    | `QueryState`, `DeleteConfirmDialog`, `HubTabs`, `MaskedDateInput`, `ColumnFilter`/`StatusFilter`/`ObrasFilter`, `Breadcrumbs`, `CommandPalette`, `Layout`, `NotificationBell`, `SyncStatusBanner`… | Existe, **sem nome nem fronteira** — mistura layout, primitivos de produto e componentes de domínio (`Employee*Dialog` com 779 L) |
| **Domínio**              | 15 subpastas (`obra-detalhe`, `cards`, `board`, `suprimentos`, `inspecoes`, `financeiro`, `dp`, `crm`, `frotas`, `import`, `migracao`, `dashboard`…) | 31 diálogos de domínio, tabs, importadores                                                                                                                                                         | Declarado e coerente                                                                                                              |
| **Layout**               | `Layout.tsx` + satélites (Breadcrumbs, CommandPalette, InstallPrompt, banners)                                                                       | moldura única de app                                                                                                                                                                               | Saudável, porém no meio da gaveta da raiz                                                                                         |

Não há distinção formal Base/Composto/Business — a hierarquia existe por costume, não por convenção.

## 2. Consistência

- **Padrão único onde a base cobre:** botões, inputs, selects, checkboxes, switches, tabs, badges, tooltips, dropdowns, popovers, calendars/datepickers, accordions, avatars — 100% shadcn, sem forks por módulo. Nenhum módulo criou seus próprios primitivos.
- **Componentes semelhantes com implementações diferentes (duplicidade real):**
  - **Kanban:** ao menos 6 implementações independentes de quadro com colunas (Board de equipe, QuadroBoard de cards, QuadroCompras, QuadroProducao, CRMFunil, quadros de Contratos/Patrimônios) — cada uma com seu DnD/coluna/card. A mais rica (Quadros) não foi extraída para servir às demais.
  - **KPI/StatCard:** só `financeiro/dividas/KpiCard.tsx` virou componente; os 6+ dashboards restantes (Fopag, Provisões, Custos, HorasExtras, Inspeções, RdoConsolidado, Lean) redesenham o cartão de indicador localmente.
  - **Mapas de status:** `STATUS_LABEL/STATUS_VARIANT` re-declarados em **15 arquivos** — a mesma ideia (status→rótulo+cor) reescrita por tela.
  - **Formatação de moeda:** `lib/money` + `lib/currency` existem (e se sobrepõem entre si), mas **32 páginas** formatam BRL inline — três fontes para o mesmo símbolo.
  - **Toast:** dois sistemas (sonner ~84 arquivos × `use-toast` 9) — dupla infraestrutura de feedback (já apontado na Etapa 3; aqui registrado como débito de biblioteca).
  - **Importadores:** 8 diálogos de importação espalhados por 4 pastas (`import/`, `cards/`, `dp/`, `financeiro/`, `migracao/`), todos repetindo a mesma casca (upload → parse → prévia com erros → confirmar) sem um shell comum.
- **Sobreposição de responsabilidade:** `ui/cnpj-input` contém a **validação** de CNPJ consumida por `lib/schemas` (inversão já registrada na Etapa 4 — aqui é também um caso de lógica no primitivo).

## 3. Reutilização (contagens reais)

| Componente                                  | Arquivos que usam                                                      | Leitura                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `HubTabs`                                   | 9                                                                      | padrão vencedor de página-hub                                                                            |
| `MaskedDateInput`                           | 8                                                                      | adotado                                                                                                  |
| `sort-header`                               | 8                                                                      | adotado                                                                                                  |
| `chips-number-input`                        | 6                                                                      | adotado                                                                                                  |
| `DeleteConfirmDialog`                       | 6                                                                      | adotado, mas 5 telas ainda usam `window.confirm`                                                         |
| `QueryState`                                | 5                                                                      | **subadotado** (31 páginas com spinner manual)                                                           |
| `ColumnFilter`/`StatusFilter`/`ObrasFilter` | 5/3/2                                                                  | subadotados frente às dezenas de listas                                                                  |
| `data-table`                                | 4                                                                      | a maioria das tabelas monta `<Table>` crua                                                               |
| `percent-input`                             | 4; `money-input` **2**; `cnpj-input` 2; `combobox` 2; `multi-select` 2 | extensões boas com adoção mínima — dinheiro é o caso gritante: input dedicado existe e quase ninguém usa |
| `pagination`                                | 2                                                                      | primitivo pronto, padrão inexistente                                                                     |
| `busy-overlay`                              | 1                                                                      | single-use                                                                                               |
| **`ui/form.tsx`** (wrapper RHF do shadcn)   | **0**                                                                  | **morto** — coerente com a ausência de RHF no produto                                                    |
| **`ui/drawer.tsx`**                         | **0**                                                                  | **morto** (Sheet venceu)                                                                                 |
| **`ui/chart.tsx`**                          | **0**                                                                  | **morto** — 24 arquivos usam recharts direto, cada um configurando cores/tooltip à mão                   |
| `EmptyState`                                | usado só pelas tabs de obra                                            | **compartilhado preso no domínio**: mora em `components/obra/`, invisível para o resto do app            |
| `SignaturePad`                              | 1 (captura)                                                            | específico ok, mas guardado em `inspecoes/` — correto                                                    |
| `OnboardingHint`                            | 3                                                                      | ok                                                                                                       |

Síntese: **os primitivos certos existem; a adoção é minoritária.** O padrão de reuso do projeto é "extraiu-se quando doeu, adotou-se onde se lembrou".

## 4. Responsabilidades

- **Responsabilidade clara:** a regra geral dos primitivos e dos compostos pequenos (QueryState, HubTabs, filtros) é exemplar — um propósito, API mínima.
- **Componentes gigantes multi-função:** `CardGenericoDialog` (2.104 L) mistura UI + estado + regra (menções, checklists, anexos, permissões, recursos) + comunicação (Supabase direto) + validação — é o caso extremo; `EmployeeDPDialog` (779 L), `RevisoesTab` (1.174 L), `PrevisaoTab` (966 L), `RdoTab` (868 L), `AllocationBoard` (819 L) repetem o padrão "diálogo/aba = mini-app".
- **Mistura UI×persistência:** os 31 diálogos de domínio majoritariamente buscam e gravam sozinhos (Supabase/`api` dentro do componente). É consistente com a arquitetura atual (Etapa 4, D3), mas significa que a biblioteca de domínio **não é apresentacional** — cada diálogo é UI+dados acoplados, o que impede reuso em contexto diferente (ex.: o mesmo formulário em página e em modal).

## 5. Composição × Props

- Os compostos da casa favorecem composição onde importa: `HubTabs` recebe `element` por aba; `QueryState` usa render-prop de dados + slots de loading/empty; `data-table` é orientado a definição de colunas. Bom.
- O resto do produto tende a **props-config e monólito**: diálogos com dezenas de estados internos em vez de subcomponentes; quadros que não expõem coluna/card como peças. Não há genéricos excessivos — o desvio do projeto é sempre para o específico.

## 6. Padronização Estrutural (checklist pedido)

| Categoria                                                                                                            | Situação estrutural                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Botões / Inputs / Selects / Checkbox / Radio / Switch / Tabs / Badges / Tooltips / Dropdowns / DatePicker / Combobox | ✔ um único primitivo cada, sem forks                                                                                                                |
| Autocomplete                                                                                                         | ✔ via `combobox`/`command` (uso raro)                                                                                                               |
| Cards                                                                                                                | ✔ primitivo único; composições livres por tela                                                                                                      |
| Dialogs                                                                                                              | ✔ primitivo único; **sem escala de tamanhos padronizada** (cada uso define largura)                                                                 |
| Drawers                                                                                                              | 🟡 dois primitivos (`sheet` vivo, `drawer` morto)                                                                                                   |
| Tabelas                                                                                                              | 🟡 primitivo único + `data-table` pronto, porém 24/28 telas montam tabela crua; sem padrão de densidade/sticky/overflow                             |
| Filtros                                                                                                              | 🟡 trio reutilizável existe; adoção parcial; sem contêiner padrão de "barra de filtros"                                                             |
| Paginação                                                                                                            | 🔴 primitivo vivo, padrão ausente (2 usos)                                                                                                          |
| Alertas / Toast                                                                                                      | 🔴 duplo sistema de toast; `alert` ok                                                                                                               |
| Loading / Skeleton                                                                                                   | 🟡 padrão declarado (QueryState) subadotado                                                                                                         |
| Estados vazios                                                                                                       | 🔴 componente preso em `obra/`; resto heterogêneo                                                                                                   |
| Mensagens                                                                                                            | 🟡 texto livre por tela; sem catálogo de mensagens padrão (erro/sucesso)                                                                            |
| Ícones                                                                                                               | ✔ lucide exclusivo                                                                                                                                  |
| Tipografia / Espaçamentos                                                                                            | ✔ tokens+Tailwind; escala implícita (`text-2xl font-bold` para títulos, `text-xs` denso) consistente por imitação, não por token semântico de texto |
| Layouts                                                                                                              | ✔ moldura única (`Layout`) para 100% das telas autenticadas; página não repete chrome                                                               |

## 7. Formulários

**Não existe arquitetura única de formulário** — existe um costume: diálogo + estados locais + validação imperativa + toast. O wrapper oficial (`ui/form.tsx`) está morto; os schemas zod existem só para parsers. Máscaras/inputs especiais são o único vocabulário comum (`MaskedDateInput`, `money-input`…, com adoção parcial). Mensagens de validação: sem padrão (ora toast, ora texto sob campo, ora silêncio até o submit). Estruturalmente: grids de 2 colunas por costume, agrupamento por títulos quando o formulário cresce. Conclusão: formulários são a **maior lacuna de sistema** da biblioteca — cada um é artesanal, e a consistência que existe é imitativa.

## 8. Tabelas

Arquitetura comum **disponível e ignorada**: `ui/table` (primitivo) + `ui/data-table` (colunas tipadas) + `sort-header` + `useTableSort` cobrem o necessário, mas 24 das 28 telas com tabela montam a sua na mão, re-decidindo header/ordenação/ações/overflow. Reutilização baixa, flexibilidade alta (cada tela faz o que quer — eis o problema), padronização por semelhança visual apenas.

## 9. Filtros

O trio `ColumnFilter`/`StatusFilter`/`ObrasFilter` tem comportamento consistente entre si (popover + seleção) e boa API; a repetição está nas telas que reimplementam filtro com selects avulsos. Não há um contêiner padrão de barra de filtros nem persistência de filtros por usuário (exceto visões salvas dos Quadros). Arquitetura reutilizável: parcial — peças sim, sistema não.

## 10. Layout

Ponto mais forte da biblioteca: moldura única (sidebar+header+breadcrumb+banners) com separação total layout×conteúdo; páginas entregam apenas o miolo. `HubTabs` padroniza o segundo nível. Consistência entre páginas garantida por construção.

## 11. Design System — existe?

**Existe um sistema de fundação e um catálogo de peças; não existe governança.**

- ✔ Tokens semânticos (cores, radius, sidebar, success/warning) com dark mode.
- ✔ Biblioteca base única (shadcn) + extensões nomeadas com clareza (kebab-case em `ui/`, PascalCase acima — convenção de nomenclatura consistente por camada).
- ✔ Escalas implícitas (espaçamento Tailwind, títulos por costume).
- 🔴 Sem documentação (nenhum catálogo/registro do que existe — a Etapa 3/5 provou que componentes "somem": EmptyState preso, chart morto, money-input com 2 usos).
- 🔴 Sem regras de adoção (o padrão declarado convive com o artesanal em toasts, tabelas, loading, confirmação, paginação).
- 🔴 Sem tokens de tipografia semântica e sem escala de tamanhos de dialog.
  Veredito: **componentes com sistema parcial** — mais que "componentes isolados", menos que Design System.

## 12. Escalabilidade da biblioteca

- **Novos módulos:** sim — a fundação absorve; o risco é cada módulo novo repetir o ciclo "reimplementa StatCard/kanban/tabela" (crescimento desordenado já observável).
- **Novos desenvolvedores:** parcial — sem catálogo, o dev descobre os compostos por arqueologia; a chance de duplicar algo existente é alta (evidência: 15 mapas de status, 32 formatações de moeda).
- **Novos componentes:** sim, com o risco inverso — a gaveta da raiz aceita qualquer coisa.
- **Sem desordem?** Não no ritmo atual: a taxa de reimplementação supera a taxa de extração.

## 13. Dívidas Técnicas da Biblioteca

| ID  | Ocorrência                                                                                                                       | Classe      | Justificativa                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Ausência de arquitetura de formulários (wrapper morto, validação imperativa heterogênea, mensagens sem padrão)                   | **Crítico** | Formulário é a interação nº 1 de um ERP; cada novo form re-decide tudo; é a dívida que mais gera inconsistência futura por unidade de tempo |
| C2  | Componentes-monólito com UI+dados (CardGenericoDialog 2.104 L e os 5 diálogos/abas >750 L)                                       | **Alto**    | Bloqueiam reuso e paralelismo de equipe nos pontos mais quentes (mesma raiz do D5 da Etapa 4, vista pela ótica de componentização)          |
| C3  | Subadoção sistêmica dos compostos (QueryState 5, data-table 4, money-input 2, pagination 2, filtros ~5)                          | **Alto**    | O custo dos componentes já foi pago; o produto colhe só a fração; cada tela fora do padrão é manutenção duplicada                           |
| C4  | Duplicação seriada: 6 kanbans, 15 mapas de status, 32 formatações BRL, N StatCards, 8 cascas de importador                       | **Alto**    | Multiplicador de custo de mudança (alterar aparência de status = 15 arquivos)                                                               |
| C5  | Duplo sistema de toast                                                                                                           | **Médio**   | Duas infraestruturas para o mesmo feedback; fácil de errar, visível ao usuário                                                              |
| C6  | Peças mortas ou presas: `form.tsx`, `drawer.tsx`, `chart.tsx` (0 usos), `EmptyState` em `components/obra/`, `busy-overlay` 1 uso | **Médio**   | Catálogo mente sobre si mesmo; peças mortas confundem quem chega                                                                            |
| C7  | Recharts cru em 24 arquivos sem camada comum de gráfico                                                                          | **Médio**   | Cores/tooltip/formatadores re-decididos por gráfico; identidade visual dos dashboards sustentada por disciplina manual                      |
| C8  | Sem escala padronizada de Dialog e sem contêiner de barra de filtros                                                             | **Baixo**   | Inconsistências pontuais de estrutura                                                                                                       |
| C9  | Lógica de validação dentro de primitivo de UI (`cnpj-input`)                                                                     | **Baixo**   | Uma ocorrência; precedente ruim (já mapeado como D8/Etapa 4)                                                                                |

## 14. Padrões Positivos (documentação objetiva)

Fundação de tokens com dark mode; primitivo único por categoria sem forks; extensões de input monetário/percentual/CNPJ/chips existentes e nomeadas; `QueryState` com estados de erro/permissão/vazio; `HubTabs` com sincronização de URL; trio de filtros com API uniforme; `DeleteConfirmDialog` dedicado; moldura de layout única com separação total de conteúdo; nomenclatura consistente por camada; ícones de fonte única; `data-table` orientado a definição de colunas; `useTableSort`+`sort-header` como par lógica/UI.

## 15. Padrões Negativos (documentação objetiva)

Reimplementação local de indicadores, kanbans, tabelas e mapas de status; formatação de moeda inline majoritária; dois toasts; confirmação nativa residual; paginação não praticada; skeleton/estado vazio não sistematizados; wrapper de formulário e de gráfico mortos; componente genérico armazenado em pasta de domínio; diálogos de domínio autofetchantes impedindo reuso apresentacional; ausência de qualquer catálogo/documentação da biblioteca.

## 16. Matriz de Maturidade

| Categoria                               | Organização      | Reutilização | Consistência | Escalabilidade     | Maturidade |
| --------------------------------------- | ---------------- | ------------ | ------------ | ------------------ | ---------- |
| Botões                                  | ★★★★★            | ★★★★★        | ★★★★★        | ★★★★★              | ★★★★★      |
| Inputs                                  | ★★★★☆            | ★★★☆☆        | ★★★★☆        | ★★★★☆              | ★★★★☆      |
| Formulários                             | ★★☆☆☆            | ★★☆☆☆        | ★★☆☆☆        | ★★☆☆☆              | ★★☆☆☆      |
| Tabelas                                 | ★★★☆☆            | ★★☆☆☆        | ★★★☆☆        | ★★★☆☆              | ★★★☆☆      |
| Dialogs                                 | ★★★★☆            | ★★★★★        | ★★★☆☆        | ★★★☆☆              | ★★★★☆      |
| Drawers                                 | ★★☆☆☆            | ★★☆☆☆        | ★★☆☆☆        | ★★★☆☆              | ★★☆☆☆      |
| Cards                                   | ★★★★☆            | ★★★★☆        | ★★★★☆        | ★★★★☆              | ★★★★☆      |
| Layouts                                 | ★★★★★            | ★★★★★        | ★★★★★        | ★★★★★              | ★★★★★      |
| Filtros                                 | ★★★★☆            | ★★☆☆☆        | ★★★☆☆        | ★★★☆☆              | ★★★☆☆      |
| Menus (nav/dropdown)                    | ★★★★★            | ★★★★★        | ★★★★★        | ★★★★★              | ★★★★★      |
| Feedbacks (toast/loading/empty/confirm) | ★★★☆☆            | ★★★☆☆        | ★★☆☆☆        | ★★★☆☆              | ★★☆☆☆      |
| Dashboards (KPI/gráficos)               | ★★☆☆☆            | ★★☆☆☆        | ★★★☆☆        | ★★☆☆☆              | ★★☆☆☆      |
| Componentes Compartilhados (compostos)  | ★★★☆☆            | ★★★☆☆        | ★★★★☆        | ★★★☆☆              | ★★★☆☆      |
| Design System (fundação+governança)     | ★★★★☆ (fundação) | —            | ★★★☆☆        | ★★☆☆☆ (governança) | ★★★☆☆      |

## 17. Matriz de Implementação (para o Lovable)

| ID  | Área                | Problema                                                                                                      | Impacto                                                               | Prioridade                      | Complexidade | Dependências                                | Isolável?                                 |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------- | ------------ | ------------------------------------------- | ----------------------------------------- |
| I1  | Formulários         | Sem arquitetura única (validação, mensagens, estrutura, wrapper morto)                                        | Inconsistência crescente em toda tela nova; retrabalho por formulário | Crítica                         | Alta         | Nenhuma (define padrão) → migração gradual  | Sim (padrão primeiro, adoção incremental) |
| I2  | Feedback            | Dois sistemas de toast coexistindo                                                                            | Notificações divergentes entre telas; dupla manutenção                | Alta                            | Baixa        | Nenhuma                                     | Sim                                       |
| I3  | Feedback            | `QueryState`/skeleton/empty subadotados (31 páginas com spinner manual; EmptyState preso em `obra/`)          | Estados de carregamento/vazio heterogêneos; "spinner mudo"            | Alta                            | Média        | I2 recomendável antes (mensagens)           | Sim (por página)                          |
| I4  | Confirmação         | `window.confirm` em 5 telas apesar de componente próprio                                                      | Quebra de identidade e de hierarquia de perigo                        | Alta                            | Baixa        | Nenhuma                                     | Sim                                       |
| I5  | Indicadores         | KPI/StatCard reimplementado por dashboard                                                                     | Dashboards divergem; custo de mudança multiplicado                    | Alta                            | Média        | Nenhuma                                     | Sim                                       |
| I6  | Status              | Mapas status→rótulo/cor duplicados em 15 arquivos                                                             | Alterar um status = caça em 15 lugares                                | Alta                            | Baixa        | Nenhuma                                     | Sim                                       |
| I7  | Moeda               | Formatação BRL inline em 32 páginas + `money`×`currency` sobrepostos + `money-input` com 2 usos               | Inconsistência de exibição/entrada do dado mais sensível do ERP       | Alta                            | Baixa        | Nenhuma                                     | Sim                                       |
| I8  | Tabelas             | 24/28 tabelas cruas fora de `data-table`; sem padrão de overflow/paginação                                    | Listas degradam com volume; manutenção duplicada                      | Média                           | Alta         | I3 (estados) e I10 (paginação) relacionados | Parcial (por tela)                        |
| I9  | Kanban              | 6 implementações independentes de quadro                                                                      | Custo sêxtuplo de evolução do padrão de quadro                        | Média                           | Alta         | C2/D5 (monólitos) tocam os mesmos arquivos  | Parcial                                   |
| I10 | Paginação           | Primitivo existe, padrão de produto não                                                                       | Rolagem única em listas grandes                                       | Média                           | Média        | I8                                          | Sim                                       |
| I11 | Gráficos            | 24 usos de recharts cru; wrapper `chart.tsx` morto                                                            | Identidade dos gráficos mantida à mão                                 | Média                           | Média        | I5 recomendável junto                       | Sim                                       |
| I12 | Importadores        | 8 diálogos repetindo a casca upload→prévia→confirmar                                                          | Cada novo importador nasce do zero                                    | Média                           | Média        | Nenhuma                                     | Sim                                       |
| I13 | Catálogo            | Biblioteca sem documentação/registro (peças mortas e presas invisíveis)                                       | Duplicação por desconhecimento; onboarding lento                      | Média                           | Baixa        | Nenhuma                                     | Sim                                       |
| I14 | Higiene             | Primitivos mortos (`form`, `drawer`, `chart` se não adotado), `EmptyState` realocado, `busy-overlay` avaliado | Catálogo honesto                                                      | Baixa                           | Baixa        | I1/I11/I3 decidem o destino de cada um      | Sim                                       |
| I15 | Diálogos de domínio | UI acoplada a fetch/persistência nos 31 diálogos                                                              | Reuso apresentacional impossível; testes caros                        | Baixa (estrutural, longo prazo) | Alta         | Alinhado a P2–P5 da Etapa 4                 | Não (acompanha refactor por domínio)      |

## 18. Plano de Evolução (sem implementação)

- **Revisão prioritária:** Formulários (I1) — única área ★★☆☆☆ que toca toda tela nova; Feedbacks (I2–I4) — baratos, visíveis, destravam consistência imediata; e o pacote anti-duplicação de baixo custo (I6, I7) — pequenas fundações com efeito multiplicador.
- **Segunda onda:** Indicadores/Gráficos (I5, I11) para unificar a face executiva do produto; Tabelas+Paginação (I8, I10) antes que o volume de dados cresça; casca de Importadores (I12) — o produto vive de importar.
- **Pode aguardar:** Kanban unificado (I9) e desacoplamento dos diálogos de domínio (I15) — corretos, porém caros e entrelaçados com o plano arquitetural da Etapa 4 (P2–P5); catálogo (I13) e higiene (I14) são contínuos.
- **Maior risco para a evolução futura:** a combinação C1+C3 — enquanto não houver padrão de formulário e enquanto a adoção dos compostos for opcional, **cada tela nova aumenta a entropia**; a biblioteca já perdeu a corrida para a reimplementação em kanban/KPI/status/moeda, e formulários são o próximo território onde isso se repete em maior escala.

---

# RESUMO EXECUTIVO

**1. Visão geral.** A biblioteca tem fundação de qualidade (tokens com dark mode, shadcn único sem forks, extensões de input corretas, moldura de layout exemplar) e uma camada de compostos de produto genuinamente boa (`QueryState`, `HubTabs`, filtros, `data-table`) — porém governança nenhuma: sem catálogo, sem regra de adoção, sem fronteira entre compartilhado e domínio na raiz de `components/`.

**2. Maturidade do Design System: ★★★☆☆** — fundação ★★★★☆, governança ★★☆☆☆. É um sistema de peças, não um sistema de regras.

**3. Reutilização: ★★★☆☆ com padrão bimodal** — total nos primitivos (100% shadcn), minoritária nos compostos (QueryState 5, data-table 4, money-input 2, pagination 2) e negativa nas categorias que cada tela reinventa (kanban ×6, status ×15, BRL ×32, StatCard ×N).

**4. Consistência: ★★★☆☆** — estrutural onde a base decide, imitativa onde o costume decide, divergente nos feedbacks (dois toasts, confirm nativo) e nos formulários.

**5. Principais riscos.** Formulários sem arquitetura multiplicando inconsistência a cada feature; duplicação seriada elevando o custo de qualquer mudança transversal; peças mortas/presas corroendo a confiança no catálogo; dashboards divergindo justamente na camada que a diretoria vê.

**6. Principais pontos fortes.** Fundação de tokens e primitivos impecável; layout e navegação como sistema de verdade; compostos de produto bem desenhados (o problema é adoção, não design); nomenclatura disciplinada; nenhum caso de over-engineering genérico.

**7. Conclusão.** Às duas perguntas da etapa: _"Existe um Design System consistente e escalável?"_ — existe **meio** Design System: a metade dos componentes está pronta e é boa; a metade das regras (adoção, catálogo, governança) não existe. _"Os componentes permitem evolução sustentável?"_ — permitem, **desde que a evolução passe a usar o que já existe**: quase todo o custo de construção já foi pago; o débito da biblioteca é majoritariamente débito de adoção, o tipo mais barato de resolver e o mais caro de ignorar.

---

_Auditoria baseada em inventário e contagens de importação reais. Nenhum arquivo modificado. Performance, banco, segurança e testes permanecem fora do escopo, reservados às próximas etapas._
