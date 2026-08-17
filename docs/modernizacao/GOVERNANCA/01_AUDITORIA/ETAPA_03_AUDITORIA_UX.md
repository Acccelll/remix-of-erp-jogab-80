# ETAPA 3 — Auditoria de UX, Interface e Experiência do Usuário — Planifik

**Perspectiva:** UX para sistemas corporativos / Design de Produto / Design System / SaaS B2B
**Base:** Etapas 1 e 2 + leitura dirigida de layouts, componentes compartilhados, tokens de design e padrões de uso reais (contagens de adoção por arquivo)
**Escopo:** exclusivamente experiência. Sem propostas, sem código, sem backlog.

> **Nota de retificação (Etapa 2, seção Padrões):** a afirmação de que formulários novos usam "react-hook-form + zod" estava incorreta. A verificação desta etapa mostra `useForm` em apenas 1 arquivo e `zodResolver` em nenhum — o padrão real do produto é **formulário controlado por estado local**, com validação imperativa e máscaras pontuais (`MaskedDateInput`). Os schemas zod existem em `lib/schemas`, mas servem a parsers/importadores, não aos formulários. A análise abaixo parte do padrão correto.

---

# PARTE I — O SISTEMA DE DESIGN NA PRÁTICA (fundação compartilhada)

Antes da análise por módulo, o que é comum a todos — porque a UX do Planifik é, em grande parte, a UX dos seus componentes compartilhados.

## 1.1 Identidade visual e tokens

- Existe um **design system semântico real**: tokens HSL (`--background/--foreground/--primary/--accent/--destructive/--warning/--success` + família `--sidebar-*`), com bloco `.dark` completo e `ThemeToggle`. Azul-marinho institucional + âmbar de acento: sóbrio, legível, adequado a B2B.
- A densidade é deliberadamente alta (548 usos de `text-xs` nas páginas): estética de "ferramenta de trabalho", correta para usuários de 8h/dia, no limite para telas de leitura executiva (dashboards).
- Tipografia com `font-display` para títulos; hierarquia `h1/h2` presente (60+ títulos de página com padrão `text-2xl font-bold`).

## 1.2 Moldura de navegação (Layout)

- Sidebar escura com **grupos colapsáveis**, modo **mini** (só ícones, com `title` no hover e rótulos `lg:sr-only` — detalhe de acessibilidade acima da média), off-canvas com overlay no mobile.
- Header fixo com hambúrguer (mobile), seletor de empresa, sino de notificações, tema e ⌘K.
- **Breadcrumbs globais** montados no Layout a partir de `ROUTE_LABELS` — o usuário sempre tem um "você está aqui", sem cada tela precisar cuidar disso.
- `HubTabs` com `?tab=` na URL e `replace`: abas com deep-link, botão voltar não polui o histórico. É a melhor decisão de navegação do produto.

## 1.3 Estados e feedback

- `QueryState` é um componente exemplar: skeleton com `role="status"`, erro com **retry**, tratamento especial de **erro de permissão** ("Sem acesso a estes dados") e slot de vazio. O problema não é o componente — é a **adoção**: ~5 páginas o usam; 31 páginas ainda exibem spinner `Loader2` artesanal. O produto tem o remédio para o "spinner mudo" e o toma parcialmente.
- Estados vazios: `EmptyState` existe (8 usos) — cobertura desigual; listas sem resultado às vezes viram tabela vazia sem mensagem.
- **Dois sistemas de toast coexistem**: sonner (84 arquivos) e o toast do shadcn (`use-toast`, 9 arquivos). Para o usuário, notificações com aparência/posição diferentes conforme a tela — inconsistência visível.
- Confirmações: `DeleteConfirmDialog`/`AlertDialog` em 28 arquivos, **mas `window.confirm()` nativo sobrevive em 5 telas** (Empresas, Feature Flags, Grupos de Negociação, Agenda de Inspeções, GM/reset demo). O diálogo nativo do navegador quebra a identidade e não tem hierarquia de perigo.
- Offline: `SyncStatusBanner` + banner de saúde do backend — feedback de sistema raro em ERPs desse porte, muito bom.

## 1.4 Padrões de interação dominantes

- **Dialog-cêntrico:** 95 arquivos com `<Dialog>` vs 12 `<Sheet>` e 1 `<Drawer>`. Criar/editar em modal mantém contexto, mas nos casos densos (card, perfil de colaborador, detalhe de OC) o modal vira "página dentro de vidro" com scroll interno.
- **Formulários controlados** simples: campos em grid, validação imperativa com toast de erro; sem indicação sistemática de obrigatoriedade nem validação inline por campo. Sequências fazem sentido; agrupamento visual existe nos formulários grandes.
- **Listagens:** tabelas shadcn com `ColumnFilter`/`StatusFilter`/`useTableSort` + busca local; ações por linha em ícones/dropdown. **Paginação praticamente inexistente** (2 páginas) — as listas renderizam tudo. Em 28 páginas com `<Table>`, só 15 têm `overflow-x`/`ScrollArea` explícitos.
- Teclado: ⌘K global (navegação por telas com keywords), hotkeys no QuadroBoard, atalhos em diálogos. Não há, porém, pesquisa global **de dados**.

---

# PARTE II — ANÁLISE POR MÓDULO

Formato: para cada módulo, os nove eixos pedidos, condensados no que o diferencia da fundação comum descrita acima.

## M1. Gestão de Equipe (Board)

- **Clareza:** ★ alta — colunas por obra com cards de pessoas/veículos são autoexplicativos; contadores por coluna dão a fotografia em 2s. Excesso pontual: colunas especiais misturadas às obras no mesmo trilho alonga o scroll horizontal.
- **Fluxo:** curto (busca → menu de contexto → mobilizar com data). Ações **escondidas em menu de contexto** — eficientes para veterano, invisíveis para novato (não há affordance de "clique direito/⋮" ensinada).
- **Navegação:** é a home; sem profundidade.
- **Formulários:** diálogo de mobilização mínimo e correto.
- **Listagens:** não tabular; a "lista" é o próprio quadro. Exportação clara no topo.
- **Feedback:** toasts sonner; sem skeleton — o board carrega do AppContext (spinner global).
- **Consistência:** visual conforme; mecânica única no produto (colunas de estado `__folga__` etc. não existem em nenhum outro lugar).
- **Produtividade:** excelente para a tarefa diária; repetitivo quando há mobilização em massa (não há seleção múltipla de colaboradores).
- **Ponto cego de UX:** em telas estreitas o quadro vive de scroll horizontal dentro de `ScrollArea` (`min-w-max`) — utilizável, mas o gesto de arrastar colunas × arrastar a página compete no touch.

## M2. Quadros / Cards

- **Clareza:** alta no board; o **card aberto** é a tela mais densa do produto — mitigada com maestria pelas "seções visíveis" configuráveis (o usuário desliga o que não usa). Hierarquia interna do card boa (título/descrição → metadados em coluna lateral).
- **Fluxo:** padrão Trello, custo de aprendizado ~zero. Menções, checklists e anexos onde se espera. Mudança de contexto mínima: quase tudo acontece no diálogo do card.
- **Navegação:** índice → board → card; visões (Kanban/Tabela/Calendário) alternam sem perder filtro; **visões salvas** são o melhor recurso de produtividade recorrente do produto.
- **Formulários:** criação rápida de card com um campo (bom); edição progressiva dentro do card (bom).
- **Listagens:** a visão Tabela dá ao gestor o que o Kanban não dá; colunas úteis.
- **Dashboards:** não tem um próprio (resumo por RPC alimenta números do índice) — sente-se falta de fluxo/aging visual, mas não é lacuna de UX, é de escopo (Etapa 2).
- **Feedback:** dnd com DragOverlay e estados otimistas; toasts consistentes (sonner).
- **Consistência:** é a **referência** dos padrões modernos.
- **Produtividade:** hotkeys, criação inline, multi-board do mesmo card. Excelente.

## M3. Obra 360º

- **Clareza:** o rail lateral em 5 grupos com rótulos de domínio (Planejamento / Medição & Faturamento / Análise / Riscos & Histórico) é uma solução de arquitetura de informação **superior a abas horizontais** para 13 telas — o usuário entende o mapa da obra pelo próprio menu. Confusão residual (já apontada na Etapa 2, aqui confirmada como problema de UX): "Desempenho" vs "Previsão" vs "Análise" não se distinguem pelo rótulo.
- **Fluxo:** memoriza a última aba por grupo (excelente); sub-visões do cronograma via `?cView=` preservam deep-link. Excesso de profundidade real: obra → grupo → aba → sub-visão → drawer — 4–5 níveis; justificável pelo domínio, mas é onde o produto mais exige orientação espacial do usuário.
- **Formulários:** os diálogos de item de cronograma/BMS são densos porém agrupados; edição de Gantt com régua é interação sofisticada e bem resolvida.
- **Listagens:** tabelas de medições/NFs com totais e badges de status claros; cronograma principal em árvore com indentação legível.
- **Dashboards (Análise):** curva S, EVM e confronto têm **priorização visual correta** (número grande → gráfico → tabela). O alerta de fonte do AC (TOTVS vs estimado) é honestidade de dado exemplar em UX de ERP.
- **Feedback:** skeletons parciais; importadores com relatório de erros por linha (ótimo padrão).
- **Consistência:** total com o padrão moderno.
- **Produtividade:** alta para quem domina; a curva de aprendizado é a mais íngreme do produto — não há ajuda contextual nas telas analíticas justamente onde os conceitos (SPI, EAC, ES) mais exigiriam.

## M4. Planejamento Lean

- **Clareza:** cada aba corresponde a uma cerimônia — quem conhece LPS se orienta de imediato; quem não conhece não recebe nenhuma explicação (nem tooltip de "o que é PPC"). Informação na medida.
- **Fluxo:** o hub de 9 abas está no limite; a ordem das abas segue o ciclo (bom), mas pacote→compromisso exige troca manual de aba (mudança de contexto no coração do ciclo semanal).
- **Formulários:** pacotes/restrições com formulários médios e bem agrupados; matriz de riscos com entrada via célula do heatmap — interação direta e agradável.
- **Listagens:** Pareto de causas e listas com filtros padrão; boas.
- **Dashboards:** dois (operacional e executivo). O executivo Lean consolida PPC/restrições/riscos com priorização visual correta; auxilia decisão de reunião semanal de verdade.
- **Feedback/Consistência:** padrão moderno pleno.
- **Produtividade:** boa; repetição semanal de compromissos é digitação recorrente sem atalho de "repetir da semana anterior".

## M5. Qualidade / Inspeções

- **Clareza:** hub limpo; a tela de **captura** é a melhor tela mobile do produto — pergunta a pergunta, alvo grande, foto e assinatura no fluxo, indicador de offline.
- **Fluxo:** QR → checklist certo → responder → assinar → sincroniza. Zero navegação desnecessária. É o fluxo mais bem desenhado do sistema para seu contexto de uso.
- **Formulários:** perguntas como formulário progressivo; severidade com seleção visual.
- **Listagens:** histórico e NCs com badges de severidade/status legíveis.
- **Dashboards:** KPIs de score e NC úteis e enxutos.
- **Feedback:** o estado offline com fila e retomada é comunicado (banner) — padrão-ouro interno.
- **Consistência:** moderna; único desvio: `confirm()` nativo na Agenda (remoção) destoa da própria qualidade do módulo.
- **Produtividade:** alta em campo; no escritório, criar modelos com muitas perguntas é clique-a-clique (sem duplicar pergunta/seção).

## M6. RDO

- **Clareza:** formulário diário direto; seções óbvias (atividades/efetivo/fotos/ocorrências).
- **Fluxo:** bom e offline; **redigitação do efetivo** (Etapa 2) é também o maior atrito de UX do módulo — trabalho repetitivo diário.
- **Formulários:** listas dinâmicas de linhas (adicionar atividade/efetivo) funcionam; sem totais automáticos visíveis de efetivo por categoria a fricção de conferência é do usuário.
- **Listagens:** consolidado multi-obra com filtros — leitura fácil.
- **Feedback:** rascunho local comunicado; sincronização com banner.
- **Consistência:** moderna.
- **Produtividade:** mediana — é o módulo com mais digitação repetida por dia útil.

## M7. Suprimentos

- **Clareza:** telas individuais claras (requisições, cotações, OC com badges de status e alçada); o **módulo como um todo** é confuso: quadro×lista contam a mesma história em linguagens diferentes, e telas estruturantes não aparecem em menu algum — o mapa mental precisa ser transmitido oralmente.
- **Fluxo:** dentro de cada tela, bom; **entre** telas, o corredor requisição→cotação→OC exige que o usuário saiba a próxima parada (não há CTA "gerar OC da proposta vencedora" conduzindo).
- **Navegação:** pior descoberta do produto (insumos/composições/orçamento/ABC/alçadas/grupos só por link direto ou ⌘K).
- **Formulários:** OC e recebimento com formulários por item — organizados; recebimento parcial por quantidade é claro.
- **Listagens:** boas, com filtro "ativas" por padrão (decisão de UX acertada — esconde ruído).
- **Feedback:** aprovação parcial de alçada com toast explicativo ("faltam outras alçadas") — feedback de workflow exemplar.
- **Consistência:** interna menor que a dos vizinhos (duas metáforas).
- **Produtividade:** boa para o comprador experiente; hostil para o novato.

## M8. Financeiro

- **Clareza:** dashboards com número-grande → gráfico → detalhe; lançamentos com badge de origem (TOTVS/manual) — transparência de proveniência é o destaque de UX do módulo. O modelo mental de "quatro origens de número" segue sendo o desafio (nenhuma tela o explica).
- **Fluxo:** importar snapshot → validar (relatório de validação server-side com erros listados — ótimo) → analisar; aprovação de solicitações com comentários em linha, decisão em 2 cliques.
- **Formulários:** lançamento com rateio em sub-tabela — denso porém agrupado; matriz de rateio é tela de poder para poucos usuários, corretamente separada.
- **Listagens:** as maiores do sistema; **sem paginação** — com anos de lançamentos, a rolagem única será o primeiro ponto de dor perceptível.
- **Dashboards:** priorização correta; fluxo & dívidas com rollup legível.
- **Feedback:** `SnapshotAgeAlert` (idade do dado na cara do usuário) é o melhor aviso contextual do produto.
- **Consistência:** moderna plena.
- **Produtividade:** alta no workflow de aprovação; a importação TOTVS manual mensal é o ritual mais pesado (mitigado pelo relatório de validação).

## M9. DP

- **Clareza:** telas novas (Fopag por holerite, ponto com tratativas) claras; a **coexistência de eras** confunde — telas irmãs com aparências e comportamentos de gerações diferentes.
- **Fluxo:** importar→conferir→analisar funciona; tratativa de ponto em linha é rápida.
- **Formulários:** legados com formulários simples de época; novos idem — sem grande sobrecarga.
- **Listagens:** análise de ponto com filtros bons; holerite com detalhe por evento legível.
- **Dashboards:** Fopag com cartões de competência — útil.
- **Feedback:** misto (é onde os dois toasts convivem de perto).
- **Consistência:** a **menor do produto** — é o módulo onde o usuário percebe "duas gerações".
- **Produtividade:** boa nas importações; prejudicada pela dúvida "em qual tela está a verdade".

## M10. RH

- **Clareza/Fluxo/Formulários:** cadastro clássico, perfil em diálogo com abas (dados/histórico/férias/documentos) bem agrupadas; sequência natural.
- **Listagens:** colaboradores com filtros e badges de documento vencendo — leitura rápida.
- **Consistência:** padrão legado estável; visualmente integrado, comportamentalmente mais simples (menos skeletons, mais spinner).
- **Produtividade:** alta; nenhuma etapa desnecessária.

## M11. CRM

- **Clareza:** funil Kanban legível com valor por card e temperatura visual (bom uso de cor semântica).
- **Fluxo:** arrastar para "fechado ganho" → prompt de conversão em obra — o **melhor momento de UX entre módulos** do sistema (o produto conduz o usuário na transição). Perder oportunidade, em contraste, é mudo (sem captura de motivo — lacuna funcional com efeito direto de UX: o gesto de perder não tem cerimônia).
- **Formulários:** oportunidade com formulário médio bem agrupado; cliente com consulta CNPJ que pré-preenche (excelente microinteração).
- **Listagens/Dashboards:** dashboard enxuto e honesto (conversão, tempo médio); sem excesso.
- **Consistência:** moderna na superfície, legada por baixo — invisível ao usuário.
- **Produtividade:** boa; registro de interações rápido.

## M12. Contratos

- **Clareza:** Kanban por status comunica a carteira de relance; valor vigente derivado de reajustes exibido corretamente.
- **Fluxo:** simples; aditivos em diálogo com histórico anexo — bom.
- **Formulários:** enxutos.
- **Listagens:** lista espelho do quadro; filtros padrão.
- **Consistência:** padrão dos hubs quadro/lista.
- **Produtividade:** alta; o que falta (alertas) é funcional, não de interface.

## M13. Ativos & Frotas

- **Clareza:** quadro/lista de patrimônios claro; perfil de veículo com abas de custo organizado.
- **Fluxo:** responsabilizar/mobilizar em diálogos curtos; custos de frota com formulários por tipo (abastecimento/manutenção) bem separados.
- **Listagens:** boas; apropriação por obra legível.
- **Consistência:** quadro+lista padrão; custos já modernos.
- **Produtividade:** boa; lançamento de abastecimento recorrente é repetitivo (sem duplicar último).

## M14. GM / Governança

- **Clareza:** matriz página×nível de acessos é uma tabela grande porém autoexplicativa; cutover lado a lado (Planifik × legado) com deltas destacados — **a melhor tela de "confiança no dado" do produto**.
- **Fluxo:** objetivo; flags com escopo global/obra em formulário único claro.
- **Listagens:** auditoria com filtros por entidade/ação — utilizável de verdade.
- **Feedback:** saúde com semáforos; porém aqui vivem 2 dos 5 `confirm()` nativos.
- **Consistência:** moderna.
- **Produtividade:** adequada ao público de 2–3 usuários.

## M15. Admin / Multiempresa

- **Clareza:** cadastro com cor por empresa refletida no seletor global (recurso visual útil para contexto).
- **Fluxo:** simples; importação de obras com prévia.
- **Ponto de UX:** o seletor de empresa muda o escopo global **sem indicar em cada tela** o que é ou não filtrado — o usuário confia que "tudo" respeita o filtro, e isso não é uniforme (risco de decisão sobre dado de escopo errado, o pior tipo de falha silenciosa de UX).

---

# PARTE III — NAVEGAÇÃO GLOBAL

| Elemento                  | Avaliação                                                                                                                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menu lateral              | ★★★★☆ — grupos colapsáveis por domínio de negócio, modo mini, permissões escondem o que não se pode usar. Organização 52→30 itens foi acerto. Desconto: itens legítimos ficaram sem casa (Suprimentos estruturante) e o critério "o que é aba de hub × o que é item" não é perceptível ao usuário. |
| Topbar                    | ★★★★☆ — empresa, notificações, tema, ⌘K: o essencial, sem ruído.                                                                                                                                                                                                                                   |
| Breadcrumb                | ★★★★☆ — global, automático, consistente.                                                                                                                                                                                                                                                           |
| Pesquisa                  | ★★★☆☆ — ⌘K excelente para **telas** (keywords), inexistente para **dados** (não acha "NF 1234" nem "João"). Num ERP, a expectativa de busca global de registros é norma.                                                                                                                           |
| Acesso rápido             | ★★★☆☆ — visões salvas (só Quadros), última aba por grupo (só Obra); sem favoritos/recentes globais.                                                                                                                                                                                                |
| Agrupamento/Hierarquia    | ★★★★☆ — grupos espelham áreas da empresa; hubs reduzem profundidade percebida. Profundidade real máxima (obra) é alta, porém sinalizada.                                                                                                                                                           |
| Facilidade de localização | ★★★☆☆ — boa para 80% das tarefas; ruim para configurações (fragmentadas, sem tela "Configurações") e para as telas fora de menu.                                                                                                                                                                   |
| Consistência              | ★★★★☆ — mesma moldura em 100% das telas autenticadas.                                                                                                                                                                                                                                              |

# PARTE IV — PADRÕES VISUAIS (inventário de consistência)

| Componente                                                                                                 | Situação                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Cards, Tabs, Badges, Tooltips, Dropdowns, Accordion, Inputs, Select, Checkbox, Switch, Calendar/DatePicker | ✔ shadcn únicos, uso consistente em todo o produto                                                                                           |
| Dialogs                                                                                                    | ✔ padrão dominante (95 arquivos); tamanhos variados mas estrutura título/corpo/rodapé estável                                                |
| Sheet/Drawer                                                                                               | 🟡 minoria (12/1); critério de "quando sheet, quando dialog" não é discernível — mesma intenção (detalhe lateral) ora abre modal, ora painel |
| Toast                                                                                                      | 🔴 **dois sistemas** (sonner 84 × use-toast 9) — aparência e posição divergem entre telas                                                    |
| Confirmações                                                                                               | 🟡 componente próprio em 28 arquivos × `window.confirm` em 5 — quebra pontual porém visível de identidade                                    |
| Tabelas                                                                                                    | 🟡 componente único, mas sem paginação (2 exceções) e com proteção de overflow em só 15/28 páginas                                           |
| Filtros                                                                                                    | ✔ `ColumnFilter`/`StatusFilter`/`ObrasFilter` reutilizados — vocabulário de filtro consistente                                               |
| Paginação                                                                                                  | 🔴 praticamente ausente como padrão de produto                                                                                               |
| Chips/labels                                                                                               | ✔ labels de card e badges de status com paleta semântica                                                                                     |
| Botões                                                                                                     | ✔ variantes shadcn; 🟡 28 botões icon-only nas páginas, só 6 com `aria-label`/`title`                                                        |
| Loading                                                                                                    | 🟡 `QueryState`/Skeleton (padrão declarado) × `Loader2` artesanal (31 páginas) — o padrão existe, a adoção é parcial                         |
| Estados vazios                                                                                             | 🟡 `EmptyState` em 8 lugares; resto heterogêneo                                                                                              |

# PARTE V — RESPONSIVIDADE (análise estática)

- **Fundação mobile correta:** sidebar off-canvas, header com hambúrguer, hubs com abas roláveis, captura de inspeção desenhada para telefone.
- **Telas que provavelmente sofrem em mobile:** Gantt e visões de cronograma (natureza desktop), matriz de acessos do GM, matriz de rateio, mapa comparativo de cotações, tabelas largas sem `overflow-x` (13 páginas com `<Table>` sem proteção explícita), Board (scroll horizontal competindo com gestos), card completo (diálogo alto com scroll interno).
- **Sintoma estrutural:** `useIsMobile` é usado em **2 arquivos** — o produto responde por CSS utilitário, quase nunca adapta o **comportamento** ao toque. Para uso de escritório é aceitável; para o discurso de campo (RDO/inspeção), só as telas de campo foram realmente pensadas mobile — coerente com a prioridade real, mas desigual.
- Formulários longos em dialogs tendem a exigir dupla rolagem (página+modal) em telas pequenas.

# PARTE VI — ACESSIBILIDADE (qualitativa)

**Evidências positivas:** `aria-*` em 61 arquivos; `role="status"` no loading padrão; rótulos `sr-only` no menu mini; `aria-label` na navegação principal e no toggle da sidebar; componentes Radix (foco, teclado e ARIA corretos por construção em dialog/menu/tabs); hierarquia de títulos por página presente; contraste da paleta principal adequado (marinho/branco, âmbar com foreground escuro).

**Fragilidades:** botões icon-only majoritariamente sem nome acessível (22 de 28 sem `aria-label`/`title`); dependência do foco default do Radix sem reforço próprio (nenhuma regra `:focus` no CSS global); densidade `text-xs` generalizada penaliza baixa visão; badges de cor como único portador de significado em alguns status; dnd (board/quadros) sem alternativa de teclado evidente; mensagens de erro imperativas via toast desaparecem (sem persistência para leitores de tela em formulários).

# PARTE VII — PADRÕES NEGATIVOS IDENTIFICADOS

1. **Dupla notificação** (sonner × use-toast) — mesmo evento, roupas diferentes.
2. **Modal-dentro-de-modal e modais-página** (card, perfis) — profundidade em vidro; 95 arquivos com dialog indicam que o modal virou resposta única para "nova tela".
3. **`window.confirm` residual** em 5 telas — inclusive em módulos novos (Flags, Empresas).
4. **Ausência de paginação** como padrão — risco de degradação de leitura (e de performance percebida) com o crescimento da base.
5. **Telas sem porta** (Suprimentos estruturante, configurações fragmentadas) — o ⌘K virou muleta de navegação para o que o menu não mostra.
6. **Redigitação estrutural** (efetivo do RDO; compromissos semanais sem repetição) — desperdício diário.
7. **Rótulos analíticos indistintos** (Desempenho/Previsão/Análise) — três portas para perguntas parecidas.
8. **Dois níveis de riscos/lições** (portfólio × obra) com telas quase gêmeas — duplicação visual que exige aprendizado.
9. **Escopo multiempresa silencioso** — filtro global sem indicação por tela do que é filtrado.
10. **Adoção parcial dos próprios padrões** (QueryState/EmptyState) — o produto define o certo e se cobra pouco.

# PARTE VIII — CLASSIFICAÇÃO POR MÓDULO

| Módulo                   | Clareza | Navegação | Formulários | Listagens | Consistência | Produtividade | UX Geral |
| ------------------------ | ------- | --------- | ----------- | --------- | ------------ | ------------- | -------- |
| Quadros/Cards            | ★★★★★   | ★★★★★     | ★★★★☆       | ★★★★☆     | ★★★★★        | ★★★★★         | ★★★★★    |
| Qualidade/Inspeções      | ★★★★★   | ★★★★☆     | ★★★★☆       | ★★★★☆     | ★★★★☆        | ★★★★★         | ★★★★★    |
| Obra 360º                | ★★★★☆   | ★★★★☆     | ★★★★☆       | ★★★★☆     | ★★★★★        | ★★★★☆         | ★★★★☆    |
| Financeiro               | ★★★★☆   | ★★★★☆     | ★★★★☆       | ★★★☆☆     | ★★★★★        | ★★★★☆         | ★★★★☆    |
| Gestão de Equipe (Board) | ★★★★☆   | ★★★★★     | ★★★★☆       | ★★★☆☆     | ★★★★☆        | ★★★★☆         | ★★★★☆    |
| Planejamento Lean        | ★★★★☆   | ★★★☆☆     | ★★★★☆       | ★★★★☆     | ★★★★★        | ★★★★☆         | ★★★★☆    |
| GM/Governança            | ★★★★☆   | ★★★★☆     | ★★★★☆       | ★★★★☆     | ★★★★☆        | ★★★★☆         | ★★★★☆    |
| CRM                      | ★★★★☆   | ★★★★☆     | ★★★★☆       | ★★★★☆     | ★★★★☆        | ★★★★☆         | ★★★★☆    |
| Contratos                | ★★★★☆   | ★★★★☆     | ★★★★☆       | ★★★★☆     | ★★★★☆        | ★★★★☆         | ★★★★☆    |
| RH                       | ★★★★☆   | ★★★★☆     | ★★★★☆       | ★★★★☆     | ★★★☆☆        | ★★★★☆         | ★★★☆☆    |
| Ativos & Frotas          | ★★★★☆   | ★★★★☆     | ★★★☆☆       | ★★★★☆     | ★★★★☆        | ★★★☆☆         | ★★★☆☆    |
| RDO                      | ★★★★☆   | ★★★★☆     | ★★★☆☆       | ★★★★☆     | ★★★★☆        | ★★★☆☆         | ★★★☆☆    |
| Suprimentos              | ★★★☆☆   | ★★☆☆☆     | ★★★★☆       | ★★★★☆     | ★★★☆☆        | ★★★☆☆         | ★★★☆☆    |
| Admin/Multiempresa       | ★★★★☆   | ★★★★☆     | ★★★★☆       | ★★★★☆     | ★★★★☆        | ★★★☆☆         | ★★★☆☆    |
| DP                       | ★★★☆☆   | ★★★☆☆     | ★★★☆☆       | ★★★★☆     | ★★☆☆☆        | ★★★☆☆         | ★★★☆☆    |

# PARTE IX — MATURIDADE DO DESIGN

**★★★★☆ (Muito bom, não excelente).** Justificativa: existe um design system semântico de verdade (tokens, dark mode, componentes únicos, moldura de navegação exemplar, estados padronizados com `QueryState`, deep-link em tudo, offline comunicado) — isso coloca o produto acima da média de ERPs internos e de muitos SaaS B2B. O que impede as cinco estrelas não é falta de design, é **falta de fiscalização do próprio design**: dois toasts, confirms nativos, adoção parcial de QueryState/EmptyState, paginação inexistente, icon-buttons sem nome acessível e a geração legada visível no DP. São inconsistências de disciplina, não de concepção.

---

# RESUMO EXECUTIVO

**1. Visão geral da experiência.** O Planifik entrega uma experiência de ferramenta profissional densa e rápida, com arquitetura de informação acima da média (hubs com deep-link, rail da obra, breadcrumbs automáticos, ⌘K) e momentos de excelência genuína: a captura de inspeção em campo, o quadro de cards, o rail da Obra 360º, o feedback de proveniência de dados no Financeiro e o painel de cutover. A experiência degrada nos pontos onde o produto ainda não fiscaliza seus próprios padrões e onde a navegação esconde telas legítimas.

**2. Principais pontos fortes.** Design system semântico com dark mode; moldura de navegação consistente em 100% das telas; `HubTabs`+URL (voltar sempre funciona, tudo é linkável); `QueryState` com retry e erro de permissão dedicado; transparência de dado (badge de origem, idade do snapshot, fonte do AC); offline comunicado; microinterações certas nos momentos certos (CNPJ pré-preenche, conversão CRM→Obra conduzida, toast de alçada parcial).

**3. Principais problemas.** Dois sistemas de toast; `window.confirm` residual; ausência de paginação como padrão; telas estruturantes fora de qualquer menu (Suprimentos) e configurações fragmentadas; redigitação diária (efetivo do RDO); rótulos analíticos indistintos na obra; escopo multiempresa não sinalizado por tela; 22 de 28 botões icon-only sem nome acessível; adoção parcial de QueryState/EmptyState (spinner mudo em 31 páginas); dnd sem alternativa de teclado.

**4. Áreas mais consistentes.** Quadros/Cards, Obra 360º, Financeiro, Qualidade, Planejamento Lean — a "geração moderna" compartilha vocabulário completo de interação.

**5. Áreas menos consistentes.** DP (duas gerações convivendo), Suprimentos (duas metáforas + navegação oculta), RH/Board (comportamentos de era anterior sob pele atual), e os pontos difusos de toast/confirm.

**6. Maturidade da UX: ★★★★☆.** Fluxos espelham o trabalho real; os atritos são localizados e nomeáveis.

**7. Maturidade da interface: ★★★★☆.** Sistema visual sólido e sóbrio; desconto pela dupla notificação, confirms nativos, densidade universal `text-xs` e lacunas de acessibilidade em botões icônicos.

**8. Conclusão.** Para as centenas de usuários hipotéticos, o Planifik já seria uma ferramenta diária confortável nos módulos modernos e irregular nas bordas legadas e ocultas. A distância entre a UX atual (★★★★☆) e a excelência não exige redesign: exige terminar de aplicar, em todo lugar, os padrões que o próprio produto já definiu — e dar porta, nome e cerimônia ao que hoje existe mas não se apresenta.

---

_Auditoria qualitativa baseada em leitura estática de layouts, componentes e padrões de uso (com contagens de adoção verificadas no código). Nenhum arquivo modificado; nenhuma melhoria proposta nesta etapa._
