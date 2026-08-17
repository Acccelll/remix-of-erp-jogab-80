# ETAPA 10 — Auditoria de Performance, Eficiência e Escalabilidade Operacional — Planifik

**Perspectiva:** Performance Engineer / Frontend Performance Specialist
**Metodologia:** padrão Etapa 5.5 com campos estendidos (Tipo, Estratégia, **Valor Esperado**). Novo prefixo: **PERF-**.
**Base empírica:** além da análise estática, foi executado **build de produção real** em cópia de trabalho do sandbox (Vite 5, 49,7 s). Nota de método: a dependência `xlsx` está pinada em CDN externo (`cdn.sheetjs.com`) inacessível no ambiente de auditoria; para viabilizar a medição, a cópia usou a versão equivalente do registro npm — nenhuma alteração foi feita nos artefatos do projeto. Números de tamanho de chunk citados são pós-minificação (gzip entre parênteses).
**Regra:** somente diagnóstico. Fora de escopo: segurança, testes, observabilidade, CI/CD, infra.

---

## ETAPA A — Arquitetura de Performance

**Existe estratégia, e ela é seletiva:** (1) code-splitting integral por rota — 86 `lazy()` gerando **262 chunks**; (2) cache de servidor com política global sã (staleTime 60 s, sem refetch on focus) e **26 afinações** pontuais; (3) **17 `await import()`** dinâmicos empurrando parsers pesados (NFS-e, CPM, BMS) para o momento do uso; (4) leitura agregada resolvida **no banco** (rollup + 6 materialized views + RPCs de resumo como `board_items_resumo`) em vez de agregar no cliente; (5) telemetria própria de degradação (`rpc-baseline.ts` — EWMA de p95 por query com alerta 2×). Não é otimização pontual: é um projeto que pensou em desempenho **nas camadas de dados e rotas** — e não pensou **nas camadas de render e payload de lista**, onde estão os achados desta etapa.

## ETAPA B — Renderização

- **Granularidade:** os 10 monólitos (ARC-005) são também unidades de render — um estado muda, 800–2.100 linhas de árvore reconciliam. Sinergia direta: quebrar monólito = quebrar render.
- **React.memo: 2 usos em todo o produto**, contra 604 `useMemo`/131 `useCallback` — memoíza-se o _valor_, nunca o _componente_. Nas superfícies de alta frequência (6 kanbans com dezenas/centenas de cards, dnd com DragOverlay), cada movimento re-renderiza colunas inteiras (**PERF-003**).
- **Estados mal distribuídos:** o caso sistêmico é o AppContext — valor único com 63 membros para 86 consumidores: qualquer `set` de um domínio legado re-renderiza consumidores de todos os outros. _(Evidência de performance anexada a ARC-002; sem novo ID.)_
- Dependências incorretas de hooks: nenhuma epidemia detectada (react-hooks rules ativas no ESLint).

## ETAPA C — Hooks

Recomputação: `useMemo` denso e bem aplicado nas telas analíticas (curvas, agregações locais) — correto. O processamento repetitivo real não está nos hooks, está no **dado bruto**: sem paginação, os memos recalculam sobre arrays integrais (§G). `useMobilizacoes` (755 L) concentra derivação pesada no provider — reforço de ARC-002.

## ETAPA D — Contexts e Providers

Árvore mínima (✔). Propagação excessiva: exclusivamente o AppContext (acima). Theme/Empresa: triviais. Nenhum novo achado — o problema de propagação já tem dono (ARC-002) e esta etapa anexa a lente de render a ele.

## ETAPA E — Consultas

- **Duplicação/carregamento redundante:** baixo no lado Query (chaves por tela, staleTime evita re-fetch em navegação); o redundante estrutural é o `loadAll` legado — TODOS os domínios PHP baixados no login, usados ou não _(evidência anexada a ARC-004)_.
- **Sobrecarga por consulta:** **24 `select("*")`** contra selects com colunas nomeadas, e apenas **31 `.limit(`** em todo o app — a maioria das listas pede _tudo de todas as colunas_ (**PERF-002**, par de dados do DS-010).
- **Atualização excessiva/polling:** 6 `refetchInterval` (sino de notificações e afins) — parcimonioso ✔; Realtime só onde deve (board) ✔.
- **Invalidação:** conservadora (invalidate→refetch, 171 pontos) — previsível; custo de re-fetch largo aceito conscientemente; a fragilidade é de _chaves_ (ARC-008), não de volume.

## ETAPA F — Cache

Eficiente e subutilizado ao mesmo tempo: a política é boa, mas metade do app (legado) não participa dela, e `setQueryData` (1 uso) indica zero reaproveitamento otimista — trade-off deliberado (correto para dinheiro, caro para UX de kanban). Excesso de cache: nenhum. Nenhum novo ID — quadro já coberto por ARC-004/008.

## ETAPA G — Listagens

- **Virtualização: inexistente** (nenhuma lib, nenhuma janela manual) — kanbans e tabelas montam DOM integral.
- **Paginação: 2 telas** (DS-010, aqui recebendo o par de dados PERF-002: além de renderizar tudo, _baixa-se_ tudo).
- **Carregamento incremental:** só implícito nas materialized/rollups. **Renderização de tabela:** crua em 24/28 (DS-009).
- **Cenário de crescimento medido pelo desenho:** com 12–24 meses de lançamentos/NFs/cards, as três telas financeiras maiores e a tabela de cards degradam primeiro — DOM + payload + memo sobre array integral, simultaneamente.

## ETAPA H — Carregamento (medições reais do build)

| Chunk                              | Tamanho (gzip)               | Leitura                                                                                                                                                             |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **entry `index`**                  | **789 kB (232 kB)**          | pesado para um entry com 262 chunks — carrega React+router+radix+supabase+query+ícones+CSS base para _todas_ as rotas                                               |
| **`CardGenericoDialog`**           | **791 kB (259 kB)**          | o maior chunk do app é **um diálogo** — TipTap/ProseMirror inteiro (confirmado no artefato) viaja para abrir _qualquer card_, a interação mais frequente do produto |
| **`FinObraDetalhe`**               | **674 kB (209 kB)**          | a rota Obra 360º embarca as 13 abas juntas                                                                                                                          |
| `pdf`                              | 472 kB (140 kB)              | isolado em chunk próprio ✔ (carrega sob demanda)                                                                                                                    |
| `xlsx`                             | 429 kB (143 kB)              | idem ✔                                                                                                                                                              |
| recharts (`CategoricalChart`)      | 312 kB (94 kB)               | compartilhado entre dashboards ✔                                                                                                                                    |
| `html2canvas` + `index.es` (jspdf) | 201+153 kB                   | exportações — sob demanda ✔                                                                                                                                         |
| CSS                                | 113 kB único                 | ✔                                                                                                                                                                   |
| **Total JS**                       | **5,9 MB min** em 262 chunks | build 49,7 s ✔                                                                                                                                                      |

O próprio build emite o aviso de chunks >500 kB — três violações, todas nas superfícies mais quentes (**PERF-001**). Fora isso, a divisão é exemplar: parsers, exportadores e gráficos em chunks próprios; 17 dynamic imports cirúrgicos.

Assets: `public/` com 28 kB ✔; ícones tree-shaken (lucide) ✔; **fontes via Google Fonts remoto** no `index.html` (dependência de terceiro no caminho de render — **PERF-004**).

## ETAPA I — Build

49,7 s frio, Vite+SWC, sem etapas supérfluas — saudável. Desperdício: nenhum relevante. Acoplamento de build: o entry gordo é consequência de imports estáticos no shell (Layout/App), não de config. Sem `manualChunks` configurado (entra nos critérios de PERF-001).

## ETAPA J — Dependências

- **Pesadas e justificadas:** pdfjs-dist, xlsx, jspdf+html2canvas, recharts, TipTap — todas em chunks separados exceto TipTap (dentro do diálogo de card — o problema é _onde_, não _se_).
- **Pinagem frágil:** `xlsx` pinado em tarball de CDN externo — além do risco de disponibilidade/instalação (comprovado nesta auditoria: 403 no ambiente), foge do lockfile ecosystem (**registrado como evidência em PERF-001-critérios e na futura etapa de CI/CD**; sem ID próprio por ser 1 linha).
- **Duplicadas:** nenhuma dupla real de runtime detectada (dois toasts são de UI, já DS-002; `drawer` morto já DS-013).
- **Obsoletas/pouco usadas:** `ui/chart` morto (DS-013); nada mais relevante.

## ETAPA K — Escalabilidade Operacional

Mais módulos ✔ (rota nova = chunk novo). Mais usuários ✔ no Supabase/Realtime; ✖ no legado (loadAll+staleness — ARC-004). **Mais registros ✖ — é o eixo frágil:** sem limite na consulta, sem página na UI, sem janela no DOM, o crescimento da base bate nas três camadas de uma vez (PERF-002+DS-010+DS-009). Mais consultas/dashboards ✔ (rollups/materialized dão o molde). Mais devs: régua de perf inexistente (nenhum orçamento de bundle/CI) — prospectivo em PERF-001.

## ETAPA L — Gargalos Classificados

| Gargalo                                                                                | Classe                 | ID                                |
| -------------------------------------------------------------------------------------- | ---------------------- | --------------------------------- |
| Entry 789 kB + diálogo-de-card de 791 kB + rota-obra de 674 kB                         | Carregamento/Build     | PERF-001                          |
| Consultas sem limite/colunas (`select("*")` ×24; `.limit` ×31) sobre listas sem página | Dados/Rede             | PERF-002 (com DS-010)             |
| DOM integral + zero React.memo nos kanbans/tabelas                                     | Renderização/Interface | PERF-003 (com DS-009)             |
| Snapshot legado integral no login + re-render de 86 consumidores                       | Estado/Arquitetural    | ARC-002/004 (evidências anexadas) |
| Fontes remotas de terceiro no caminho crítico                                          | Rede/Assets            | PERF-004                          |
| Chunks por UUID/rota sem orçamento vigiado                                             | Build (processo)       | PERF-001 (critérios)              |

## ETAPA M — Padrões Positivos (evidências)

1. **262 chunks / 86 rotas lazy** — divisão por rota completa.
2. **17 dynamic imports cirúrgicos** — parsers e recálculos só quando usados.
3. **Peso isolado onde foi lembrado** — pdf/xlsx/jspdf/html2canvas/recharts em chunks próprios.
4. **Agregação no banco** — rollup, 6 materialized views, RPCs de resumo.
5. **Query calibrado** — 60 s global + 26 exceções conscientes; polling mínimo (6); Realtime só no board.
6. **Telemetria própria de degradação** — `rpc-baseline.ts` (EWMA p95, alerta 2×, cooldown) — raríssimo em produto deste porte.
7. **Assets estáticos mínimos** (28 kB) e ícones tree-shaken.

## ETAPA N — NOVOS ACHADOS (prefixo PERF-)

**PERF-001 — Chunks-gigante nas três superfícies mais quentes** · REF/MOD · SEQUENCIAL · **Valor: PERF** · Carregamento · Etapa 10
**Evidências (build real):** entry `index` 789 kB (232 kB gzip); `CardGenericoDialog` 791 kB (259 kB) contendo TipTap/ProseMirror (confirmado por inspeção do artefato) — pago ao abrir qualquer card; `FinObraDetalhe` 674 kB (209 kB) embarcando as 13 abas da Obra 360º; aviso >500 kB emitido pelo próprio build; sem `manualChunks`; sem orçamento de bundle no fluxo.
**Diagnóstico:** o code-splitting excelente por rota parou exatamente onde o produto mais vive: shell inicial, diálogo de card e rota da obra. Em campo (4G), abrir o primeiro card custa ~½ MB gzip adicional só de editor.
**Objetivo arquitetural:** orçamento de chunk declarado e vigiado; editor rico e seções pesadas do card carregados sob demanda dentro do diálogo; abas da obra divididas por grupo; entry enxuto.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Média. **Dependências:** sinergia forte com ARC-005 (a quebra dos monólitos divide os chunks naturalmente — executar junto); pinagem CDN do `xlsx` corrigida na mesma janela (1 linha; evidência: 403 reproduzido nesta auditoria). **Áreas impactadas:** M2, M3, shell. **Risco de regressão:** Médio (lazy interno pode introduzir flashes — mitigar com placeholders já padronizados por DS-004). **Validação recomendada:** relatório de build comparado (antes/depois) por chunk; abertura de card e da obra medidas em rede simulada.
**Critérios de aceite:** (a) nenhum chunk de rota/diálogo >500 kB min sem justificativa registrada; (b) abrir card sem editor não baixa ProseMirror; (c) entry reduzido de forma mensurável (baseline 789 kB registrado); (d) orçamento de bundle verificado a cada build; (e) `xlsx` instalável a partir do registro padrão.

**PERF-002 — Consultas de lista sem limite e sem projeção** · STD/REF · LOTE · **Valor: PERF/SCAL** · Dados/Rede · Etapa 10
**Evidências:** 24 `select("*")`; apenas 31 `.limit(` no app inteiro; listas maiores (lançamentos, NFs, cards-tabela, ponto) consultando a tabela integral; par de UI já catalogado (DS-010 sem paginação; DS-009 tabela crua).
**Diagnóstico:** o payload cresce linearmente com a vida do banco — a degradação não é hipótese, é agenda; e `*` acopla o payload a todo o schema (colunas novas engordam telas antigas).
**Objetivo arquitetural:** toda consulta de lista com limite/página e projeção de colunas; DS-010 (UI) e PERF-002 (dados) executados como um único pacote nas 5 listas de maior volume, estendendo depois.
**Impacto:** Alto. **Prioridade:** P1. **Complexidade:** Média. **Dependências:** co-execução com DS-010; repositories (ARC-003) como lugar natural da regra. **Áreas impactadas:** M8, M3, M2, M9. **Risco de regressão:** Médio (filtros/somatórios que assumiam array integral precisam de agregação no servidor — os rollups já dão o molde). **Validação recomendada:** payload por tela medido antes/depois; totais/somatórios conferidos contra agregação servidor.
**Critérios de aceite:** (a) zero `select("*")` em consultas de lista (busca verificável); (b) 100% das listas-alvo com limite/página; (c) agregados exibidos vindos do servidor onde o array deixou de ser integral; (d) regra registrada na convenção de repositories.

**PERF-003 — Granularidade de render inexistente nas superfícies de alta frequência** · REF · LOTE · **Valor: PERF/UX** · Renderização · Etapa 10
**Evidências:** `React.memo` usado 2× no produto (contra 604 useMemo/131 useCallback); 6 kanbans re-renderizando colunas inteiras por interação de drag; tabelas cruas sem janela (zero virtualização no projeto).
**Diagnóstico:** memoização de valores sem memoização de componentes — o custo de cada interação nos quadros cresce com o número de cards na tela; com listas paginadas (PERF-002) o problema reduz, mas o drag continua reconciliando o board inteiro.
**Objetivo arquitetural:** unidades de render estáveis (card/linha/coluna) nas superfícies de interação contínua; virtualização onde a página não bastar (tabela de cards, consolidados).
**Impacto:** Médio. **Prioridade:** P2. **Complexidade:** Média. **Dependências:** melhor após ARC-005/DS-011 (extração de peças de kanban cria o lugar onde memoizar); QC-001 onda relevante (props tipadas estabilizam contratos de memo). **Áreas impactadas:** M1, M2, M7, M11. **Risco de regressão:** Baixo-Médio (memo com props instáveis vira ruído — validar com profiler). **Validação recomendada:** profiling comparado de drag/typing nos quadros com N cards (baseline atual registrado por cenário).
**Critérios de aceite:** (a) interação de drag não reconcilia colunas não-afetadas (verificado em profiler); (b) card/linha como unidades memoizadas nas superfícies-alvo; (c) virtualização aplicada onde página não couber, com paridade funcional.

**PERF-004 — Fontes de terceiro no caminho crítico de render** · STD · ISOLADA · **Valor: PERF** · Assets · Etapa 10
**Evidências:** `index.html` carregando DM Sans + Space Grotesk de fonts.googleapis.com (link no head; render dependente de DNS/TLS de terceiro; sem fallback declarado além do display=swap).
**Diagnóstico:** primeiro render depende de origem externa; em campo/offline-first (produto que se orgulha do offline), a tipografia é o único recurso crítico que não é local.
**Objetivo arquitetural:** fontes servidas pela própria origem com fallback do sistema.
**Impacto:** Baixo. **Prioridade:** P3. **Complexidade:** Baixa. **Dependências:** nenhuma. **Áreas impactadas:** shell. **Risco de regressão:** Baixo. **Validação recomendada:** render sem rede externa de fontes; diff visual.
**Critérios de aceite:** (a) nenhuma requisição a domínio de fontes de terceiro; (b) tipografia idêntica ou fallback aprovado; (c) funcionamento offline sem FOUT severo.

_(Sem novo ID, por sobreposição consciente: loadAll/snapshot legado e re-render de 86 consumidores → evidências de performance anexadas a ARC-002/ARC-004; ausência de otimismo no Query → característica registrada, não-débito; pinagem CDN do xlsx → critério de PERF-001 + herança à etapa de CI/CD.)_

## ETAPA O — Matriz de Maturidade

| Área                | Eficiência | Escalabilidade | Consumo            | Organização | Maturidade |
| ------------------- | ---------- | -------------- | ------------------ | ----------- | ---------- |
| Renderização        | ★★★☆☆      | ★★☆☆☆          | ★★★☆☆              | ★★★☆☆       | ★★★☆☆      |
| Estado (Query)      | ★★★★☆      | ★★★★☆          | ★★★★☆              | ★★★★☆       | ★★★★☆      |
| Estado (legado)     | ★★☆☆☆      | ★☆☆☆☆          | ★★☆☆☆              | ★★☆☆☆       | ★★☆☆☆      |
| Cache               | ★★★★☆      | ★★★★☆          | ★★★★☆              | ★★★☆☆       | ★★★★☆      |
| Hooks               | ★★★★☆      | ★★★★☆          | ★★★★☆              | ★★★★★       | ★★★★☆      |
| Providers           | ★★★★☆      | ★★★☆☆          | ★★★☆☆              | ★★★★★       | ★★★★☆      |
| Queries (consultas) | ★★★☆☆      | ★★☆☆☆          | ★★☆☆☆              | ★★★☆☆       | ★★☆☆☆      |
| Build               | ★★★★★      | ★★★★☆          | ★★★★☆              | ★★★★☆       | ★★★★☆      |
| Assets              | ★★★★☆      | ★★★★★          | ★★★★★              | ★★★★☆       | ★★★★☆      |
| Bundles             | ★★★☆☆      | ★★★☆☆          | ★★☆☆☆ (3 gigantes) | ★★★★☆       | ★★★☆☆      |
| Dependências        | ★★★★☆      | ★★★★☆          | ★★★☆☆              | ★★★★☆       | ★★★★☆      |
| Listagens           | ★★☆☆☆      | ★☆☆☆☆          | ★★☆☆☆              | ★★★☆☆       | ★★☆☆☆      |
| Dashboards          | ★★★★☆      | ★★★★☆          | ★★★★☆              | ★★★☆☆       | ★★★★☆      |
| Carregamento        | ★★★★☆      | ★★★★☆          | ★★★☆☆              | ★★★★☆       | ★★★★☆      |

## ETAPA P — Matriz de Implementação (novos itens)

| Ordem sugerida                        | ID           | Tipo    | Estratégia | Valor     | Área         | Objetivo Arquitetural                                              | Impacto | Prioridade | Complexidade | Dependências           | Áreas Impactadas | Isolável? | Critérios |
| ------------------------------------- | ------------ | ------- | ---------- | --------- | ------------ | ------------------------------------------------------------------ | ------- | ---------- | ------------ | ---------------------- | ---------------- | --------- | --------- |
| na janela de ARC-005 (mesma cirurgia) | **PERF-001** | REF/MOD | SEQUENCIAL | PERF      | Bundles      | Orçamento de chunk + carga sob demanda no card/obra + entry enxuto | Alto    | P1         | Média        | ARC-005 (sinergia)     | M2/M3/shell      | Parcial   | ficha N   |
| pacote único com DS-010 (listas-alvo) | **PERF-002** | STD/REF | LOTE       | PERF/SCAL | Consultas    | Limite+projeção em toda lista; agregados no servidor               | Alto    | P1         | Média        | DS-010; ARC-003        | M8/M3/M2/M9      | Sim       | ficha N   |
| após ARC-005/DS-011                   | **PERF-003** | REF     | LOTE       | PERF/UX   | Renderização | Unidades de render estáveis + virtualização seletiva               | Médio   | P2         | Média        | ARC-005/DS-011; QC-001 | M1/M2/M7/M11     | Sim       | ficha N   |
| lote P3                               | **PERF-004** | STD     | ISOLADA    | PERF      | Assets       | Fontes locais com fallback                                         | Baixo   | P3         | Baixa        | —                      | shell            | Sim       | ficha N   |

## ETAPA Q — Impacto Cruzado

| Achado   | Módulos         | Arquivos a revisitar                                                                       | Etapas anteriores impactadas                  | Testes a executar                                                       |
| -------- | --------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------- |
| PERF-001 | M2, M3, shell   | CardGenericoDialog, FinObraDetalhe/obra-tabs, App/Layout, vite.config, package.json (xlsx) | ARC-005 (mesma janela), DS-004 (placeholders) | build comparado; fluxo de card e obra em rede simulada; suíte existente |
| PERF-002 | M8, M3, M2, M9  | repositories + 24 pontos de `select("*")` + telas DS-010                                   | ARC-003 (regra na camada), DS-009/010         | conferência de totais vs servidor; testes de lista/filtros              |
| PERF-003 | M1, M2, M7, M11 | peças extraídas dos kanbans; tabelas-alvo                                                  | ARC-005/DS-011; QC-001                        | profiling roteirizado por cenário; dnd E2E                              |
| PERF-004 | shell           | index.html, assets de fonte                                                                | —                                             | render offline; diff visual                                             |

## ETAPA R — Plano Diretor de Performance

**Visão geral:** o Planifik foi projetado para desempenho **nas camadas certas mais difíceis** (rotas, dados agregados, cache, telemetria) e deixou em aberto **as camadas mais visíveis** (payload de lista, peso dos três pontos quentes, granularidade de render). É o inverso do padrão de mercado — e é boa notícia: o que falta é mais barato do que o que já foi feito.
**Principais gargalos:** o trio medido (entry/card/obra), o crescimento sem limite das listas, e o legado eager (já endereçado por ARC-004).
**Riscos:** degradação silenciosa com o crescimento da base (listas) e primeira impressão pesada em campo (chunks) — ambos com data marcada, não com incerteza.
**Pontos fortes:** 262 chunks, dynamic imports cirúrgicos, agregação no banco, rpc-baseline.
**Oportunidades:** ARC-005 e PERF-001 são a mesma cirurgia com dois ganhos; DS-010+PERF-002 idem; a telemetria existente (rpc-baseline) vira o instrumento de validação de tudo.
**Estratégia:** medir→limitar→dividir→granular: registrar baselines (feito nesta etapa), fechar consultas (PERF-002+DS-010), dividir os três gigantes junto dos monólitos (PERF-001+ARC-005), e só então lapidar render (PERF-003).
**Sequência ao Lovable (consolidada):** inalterada até a janela de dados; **PERF-002 entra no pacote DS-010** (ordem 15 da matriz vigente); **PERF-001 entra na janela de ARC-005** (ordem 27); **PERF-003 após ARC-005/DS-011**; **PERF-004** no lote P3. Nenhuma ordem existente alterada.

---

# RESUMO EXECUTIVO

**1. Visão geral:** aplicação com fundação de performance acima da média (splitting integral, agregação no banco, cache calibrado, telemetria própria) e três dívidas concentradas e **medidas**: chunks-gigante nos pontos mais usados, listas que baixam e renderizam o banco inteiro, e render sem granularidade nos quadros.

**2. Eficiência: ★★★★☆** nas camadas de dados/rotas; **★★☆☆☆** em listas/payload — média honesta ★★★☆☆.

**3. Escalabilidade: ★★★★☆** para módulos e usuários (Supabase); **★★☆☆☆** para registros — o eixo do crescimento da base é o frágil.

**4. Otimização: ★★★★☆** de projeto, ★★☆☆☆ de vigilância (nenhum orçamento/medição contínua — o build avisa e ninguém escuta).

**5. Principais gargalos:** `CardGenericoDialog` 791 kB (o maior chunk do app é um diálogo), entry 789 kB, `FinObraDetalhe` 674 kB; 24 `select("*")` com 31 `.limit` no app inteiro; React.memo ×2.

**6. Principais oportunidades:** duas cirurgias já agendadas (ARC-005, DS-010) entregam de graça metade do ganho de performance se executadas com PERF-001/002 acopladas.

**7. Novos Achados: 4** (PERF-001 P1 · PERF-002 P1 · PERF-003 P2 · PERF-004 P3) + evidências anexadas a ARC-002/004 e herança da pinagem CDN à etapa de CI/CD.

**8. Catálogo Mestre atualizado:** 85 → **89 achados** (PRO 31 · DS 16 · ARC 11 · UX 10 · BIZ 4 · EST 3 · DB 6 · QC 4 · **PERF 4**). Prioridades: P0 1 · P1 **35** · P2 **31** · P3 **22**.

**9. Matriz de Implementação atualizada:** PERF-002 acoplado a DS-010; PERF-001 acoplado a ARC-005; PERF-003 após; PERF-004 no lote final. Ordens anteriores preservadas.

**10. Conclusão executiva:** à pergunta — _"a arquitetura é eficiente e preparada para crescer sem degradação?"_ — a resposta é: **eficiente sim; preparada, quase.** O produto já paga os custos difíceis (agregação, splitting, telemetria) e deixa na mesa os baratos (limite, página, memo, um editor fora do chunk do card). Com baselines agora registrados em números — 789/791/674 kB, 24 selects integrais, memo ×2 — a evolução deixa de ser opinião e vira meta verificável.

---

_Auditoria conforme metodologia da Etapa 5.5 com campos estendidos. Medições de build realizadas em cópia de sandbox (substituição pontual e declarada da origem do pacote xlsx para viabilizar instalação); nenhum artefato do projeto foi alterado. Segurança, testes, observabilidade, CI/CD e infraestrutura permanecem reservados às suas etapas._
