# Folha de Pagamento × Custo do Colaborador — redundâncias e proposta de fusão

> **Status: executada.** A fusão descrita aqui foi implementada. `Fopag.tsx` não existe mais,
> `/dp/fopag` redireciona para `/dp/custos?tab=colaborador`, e a decomposição do custo passou a
> fechar com o total (§3.1). O documento fica como registro do diagnóstico e das decisões — os
> trechos no presente descrevem o estado **anterior** à fusão. O que mudou de fato está no §10.

Análise comparativa de **DP › Folha de Pagamento** (`/dp/fopag`, `src/pages/dp/Fopag.tsx`) e da aba
**Custo do Colaborador** de **DP › Custos de Pessoal** (`/dp/custos?tab=colaborador`,
`src/pages/dp/Custos.tsx`), para decidir se as duas devem virar uma página só.

**Veredito curto:** sim, devem ser fundidas. As duas telas leem a mesma linha do mesmo banco pelo
mesmo hook, aplicam os mesmos filtros e recalculam os mesmos seis agregados — em duplicata e, em um
caso, **com resultados diferentes** (§3.1). O que cada uma tem de próprio é complementar, não
concorrente: o Fopag tem o drill-down e a visão de pagamento; o Custos tem o Fator K e os cortes por
obra/cargo. Nenhuma das duas é a versão "completa" da outra.

---

## 1. Onde estamos

```
/dp/fopag                    →  Fopag.tsx          menu: "Folha de Pagamento"   breadcrumb: "Fopag"
   └─ useDpHolerites() ──┐                          h1: "Dashboard de Departamento Pessoal"
                         │
/dp/custos?tab=colaborador →  Custos.tsx           menu: "Custos de Pessoal" › aba "Custo do Colaborador"
   └─ useDpHolerites() ──┘                          h1: "Custo do Colaborador"
                         │
                         └──→ dp_holerite (MySQL via api.php) · rows = tipo ≠ adiantamento
```

Ambas montam `DpFilterBar` com `defaultFilters(competencias)` e filtram por `applyFilters`
(`Fopag.tsx:346`, `Custos.tsx:203`). Ambas renderizam `ImportHoleriteDialog` no canto superior
direito. Ambas são linha própria da matriz fina (`navigation.ts:206` e `:222`), então hoje custam
duas permissões para o mesmo dado.

---

## 2. Redundâncias — o que as duas fazem igual

### 2.1 Cálculos duplicados

Seis agregações sobre `filtered` são escritas duas vezes, uma em cada arquivo:

| Agregado           | Fopag               | Custos               | Mesmo resultado?                      |
| ------------------ | ------------------- | -------------------- | ------------------------------------- |
| Custo total        | `Fopag.tsx:104`     | `Custos.tsx:82`      | ✅ idêntico (`Σ custo_total`)         |
| Salário base       | `Fopag.tsx:85`      | `Custos.tsx:81`      | ✅ idêntico                           |
| FGTS               | `Fopag.tsx:88`      | `Custos.tsx:84`      | ✅ idêntico                           |
| Provisões (13+fér) | `Fopag.tsx:89-99`   | `Custos.tsx:85-95`   | ✅ idêntico (mesmas 6 parcelas)       |
| Encargos patronais | `Fopag.tsx:87`      | `Custos.tsx:83`      | ❌ **divergente — RAT** (§3.1)        |
| Outros proventos   | `Fopag.tsx:100-103` | `Custos.tsx:103-106` | ❌ **divergente — HE e clamp** (§3.2) |

### 2.2 Visualizações que contam a mesma história

| Pergunta do usuário            | Fopag                                                    | Custos                                        |
| ------------------------------ | -------------------------------------------------------- | --------------------------------------------- |
| Do que é feito o custo?        | 5 KPIs clicáveis + barra empilhada por obra (`:488-530`) | Pizza "Composição do custo" (`:269-292`)      |
| Quanto custa cada obra?        | Barra "Custo Total por obra" (`:464-486`)                | Tabela "Custo por obra" (`:294-363`)          |
| Quanto custa cada colaborador? | Tabela operacional, 10 colunas (`:532-680`)              | Linha expansível dentro do cargo (`:437-471`) |
| Qual o total da empresa?       | Card grande "Custo Total da Empresa" (`:372-390`)        | KPI "Custo total" (`:246-250`)                |

Dentro do próprio Fopag há redundância: o gráfico `custoPorObra` (`:231-240`) e o gráfico
`chartData` (`:204-229`) plotam a mesma medida por obra — o segundo é o primeiro fatiado em três
faixas e limitado ao top 10. São dois cards de 288px de altura para um dado só.

### 2.3 Componentes reimplementados

`KpiCard` existe três vezes: `Fopag.tsx:696` (com `onClick` + affordance "detalhar →"),
`Custos.tsx:485` (com tooltip de composição) e `src/components/common/Kpi.tsx` — cujo próprio
docstring diz que veio para _"substituir reimplementações locais (`Kpi`, `KpiCard`, `KpiMini`,
`KpiBox`, `Stat`, `StatCard`)"_. As abas vizinhas (`Provisoes.tsx`, `HorasExtras.tsx`) já usam o
componente comum; estas duas ficaram para trás, cada uma com metade dos recursos que o outro tem.

### 2.4 Estados vazios e recarga

- Três telas de vazio para o mesmo caso: `EmptyState` do Fopag (`:906-921`), o aviso "só
  adiantamentos importados" (`:360-368`) e o vazio do `QueryState` do Custos (`:216-226`).
- `Custos.tsx:211-229` usa `QueryState` só pelo estado vazio — os filhos são `{() => null}` e o
  conteúdo real é renderizado logo abaixo por um `!loading && rows.length > 0 &&` (`:231`). O
  componente está sendo usado pela metade.
- `Fopag.tsx:342` passa `onImported={reload}`, mas `useImportDpHolerites` já invalida
  `dpHoleriteKeys.all` no `onSuccess` (`useDpHolerites.ts:33-36`) — o refetch acontece duas vezes.

---

## 3. Divergências — onde os números discordam

Estas são a razão principal para fundir: hoje as duas telas, abertas lado a lado com o mesmo filtro,
mostram valores diferentes para o mesmo conceito.

### 3.1 O RAT/SAT some no Fopag — e a soma dos KPIs não fecha

`custo_total` é, por definição do parser e da coluna gerada (`parser-holerite-xls.ts:208-219`):

```
custo_total = proventos + inss_empresa + rat + inss_terceiros + fgts
            + provisao_13 + provisao_ferias
            + inss_provisao_13 + fgts_provisao_13
            + inss_provisao_ferias + fgts_provisao_ferias
```

O Fopag decompõe esse total em cinco KPIs, mas o card "INSS Patronal + Terceiros" soma apenas
`inss_empresa + inss_terceiros` (`:87`) — **sem `rat`**. Somando os cinco cards:

```
(salário + HE + outros) + (inss_empresa + inss_terceiros) + fgts + provisões
  = proventos + inss_empresa + inss_terceiros + fgts + provisões
  = custo_total − RAT
```

Ou seja: o card grande "Custo Total da Empresa" nunca bate com a soma dos cards que o explicam, e a
diferença é exatamente o RAT/SAT. O mesmo buraco está no gráfico empilhado, cuja faixa "INSS + FGTS"
também ignora `rat` (`:216`) — a pilha fica visualmente menor que a barra do gráfico ao lado.

O Custos acerta: "Encargos patronais" inclui `rat` (`:83`), e a pizza fecha 100% do `custo_total`.

### 3.2 "Outros proventos" quer dizer coisas diferentes

- **Fopag:** `Σ max(0, proventos − salario_base − horas_extras_valor)` por linha (`:100-103`) — HE
  é uma coluna separada.
- **Custos:** `max(0, Σ proventos − Σ salario_base)` (`:103-106`) — **HE está dentro** da fatia
  "Outros proventos" da pizza, que portanto não é comparável com o KPI de mesmo nome do Fopag.

O clamp também difere (por linha × global), o que muda o resultado quando alguma competência tem
`proventos` abaixo do salário base (afastamento, admissão no meio do mês).

### 3.3 Cargo e nome saem de fontes diferentes

|               | Fopag                            | Custos                            |
| ------------- | -------------------------------- | --------------------------------- |
| Nome exibido  | `nome_lido` do arquivo (`:255`)  | cadastro, com fallback (`:75-78`) |
| Cargo exibido | `cargo_lido` do arquivo (`:257`) | cadastro, com fallback (`:71-74`) |

O filtro de cargo da barra é o mesmo nos dois casos e usa **`funcaoCadastro`**
(`useDpHolerites.ts:139`). Resultado: no Fopag você filtra por "Pedreiro" (cadastro) e a coluna
Cargo da tabela mostra outra grafia ("PEDREIRO OFICIAL", do holerite) — a tela contradiz o próprio
filtro. O Custos é internamente coerente.

### 3.4 Headcount conta coisas diferentes

Dentro do próprio Custos: "Custo por obra" incrementa 1 por **linha de holerite** (`:120`), enquanto
"Custo por cargo" conta **CPFs distintos** (`:159`). Com "Todas competências" selecionado, a mesma
pessoa vira N pessoas na tabela de obra e continua 1 na de cargo. O Fopag não tem headcount — tem
"Holerites" (`:413`), que conta linhas e está rotulado honestamente.

### 3.5 Identidade da página

Três nomes para a mesma tela: menu "Folha de Pagamento" (`navigation.ts:206`), breadcrumb "Fopag"
(`navigation.ts:749`), `h1` "Dashboard de Departamento Pessoal" (`Fopag.tsx:332`). E o subtítulo
promete _"médias de líquido, salários e adiantamentos mês a mês"_ — não existe nenhuma série
temporal na página.

---

## 4. O melhor de cada uma

### Só o Fopag tem (e vale manter)

| Recurso                    | Onde                   | Por que importa                                                                                                                                                           |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Drill-down de KPI**      | `:130-202`, `:725-904` | Clicar num KPI abre a lista de quem compõe aquele número, com busca, filtro por coluna e total do recorte. É a diferença entre "R$ 1,2 mi de encargos" e "por que subiu". |
| **Holerite completo**      | `:686`                 | Clique na linha → `HoleriteDetailDialog` com todas as verbas de provento e desconto.                                                                                      |
| **Tabela operacional**     | `:532-680`             | 10 colunas ordenáveis por colaborador — a visão que o DP usa para conferir a folha linha a linha.                                                                         |
| **Exportar CSV**           | `:289-324`             | Fecha o ciclo com quem trabalha em planilha.                                                                                                                              |
| **Adiantamentos (dia 20)** | `:70-73`, `:118-127`   | O Custos ignora `adiantamentos` por completo. É o único lugar do sistema que os enxerga.                                                                                  |
| **Visão do Colaborador**   | `:418-460`             | Líquido, adiantamento e descontos num bloco recolhível, explicitamente marcado como informativo.                                                                          |
| **KPIs de contexto**       | `:413-414`             | "Holerites" e "Obras envolvidas" — dizem se o recorte filtrado faz sentido.                                                                                               |

### Só o Custos tem (e vale manter)

| Recurso                      | Onde                   | Por que importa                                                                                             |
| ---------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Fator K**                  | `:97`, `:234-245`      | O indicador de gestão da página, ponderado por salário (média aritmética distorceria). Não existe no Fopag. |
| **Fator K por obra e cargo** | `:130`, `:161`         | Onde o markup real diverge do orçado.                                                                       |
| **Encargos corretos**        | `:83`                  | Inclui RAT — a versão que fecha com `custo_total`.                                                          |
| **Corte por cargo**          | `:135-175`, `:365-478` | Agregado pelo cadastro (não pelo texto do arquivo), expansível até o colaborador.                           |
| **Pizza de composição**      | `:269-292`             | Responde "quanto do custo é encargo" em um olhar — o percentual, que os KPIs absolutos não dão.             |
| **Tooltips de composição**   | `:33-40`, `:485-508`   | Explicam o que entra em cada KPI dentro da própria tela.                                                    |
| **Custo por obra tabulado**  | `:294-363`             | Números exatos e ordenáveis, contra a leitura aproximada da barra do Fopag.                                 |

---

## 5. Faz sentido fundir?

**Sim.** Os critérios que justificariam manter separado não se sustentam:

| Critério            | Situação                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fonte de dados      | A mesma — `useDpHolerites()`, `dp_holerite`.                                                                                                                                   |
| Filtros             | Os mesmos — `DpFilterBar` + `applyFilters`, com o mesmo default.                                                                                                               |
| Público             | O mesmo — permissão `dp` nas duas.                                                                                                                                             |
| Ação de entrada     | A mesma — `ImportHoleriteDialog`, renderizado nas duas.                                                                                                                        |
| Pergunta respondida | ~80% igual. O Fopag classifica sua própria seção de pagamento como _"apenas informativo"_ (`:428`) — ou seja, ele mesmo se declara uma tela de custo com um apêndice de folha. |

A única distinção conceitual real — **"o que a empresa paga"** (líquido, adiantamento, descontos)
versus **"o que a empresa gasta"** (custo, encargos, Fator K) — cabe em uma seção recolhível, que é
exatamente como o Fopag já resolve hoje.

O custo de manter separado é concreto: dois lugares para corrigir o RAT, dois `KpiCard`, dois
estados vazios, dois recálculos das mesmas somas, e um usuário que vê "encargos" com dois valores
dependendo de qual aba abriu.

---

## 6. Desenho da página fundida

Destino: **`/dp/custos?tab=colaborador`** — a aba já existe, já está dentro do hub e já é o lugar
natural entre "Mão de Obra Direta", "Provisões" e "Horas Extras". `/dp/fopag` vira redirect.

```
┌ Custo do Colaborador ─────────────────────── [Exportar CSV] [Importar Holerite] ┐
│ DpFilterBar (competência · obra · cargo · busca)                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ┌ Custo Total da Empresa ──────────┐ ┌ Fator K médio ────┐                       │
│ │ R$ 1.234.567    [detalhar →]     │ │ 1,78x             │                       │
│ └──────────────────────────────────┘ └───────────────────┘                       │
│ [Salário+HE+Outros ⓘ] [Encargos patronais ⓘ] [FGTS ⓘ] [Provisões ⓘ]            │
│ [Holerites: 312]      [Obras: 7]                                                 │
│    ↑ todos clicáveis (BreakdownDialog do Fopag) + tooltip ⓘ (do Custos)          │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ▸ Visão do Colaborador (líquido · adiantamento dia 20 · descontos)   [recolhido] │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ┌ Composição do custo (pizza) ─────┐ ┌ Custo por obra (barra empilhada) ────────┐│
│ └──────────────────────────────────┘ └──────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────────┤
│ Custo por obra   — tabela: obra · headcount · salário · custo · Fator K          │
│ Custo por cargo  — tabela expansível até o colaborador · Fator K                 │
│ Por colaborador  — tabela operacional 10 colunas → clique abre o holerite        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Decisões que a fusão precisa tomar, e a recomendação para cada uma:

| Ponto              | Recomendação                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Encargos patronais | Versão do **Custos** (com `rat`). Corrige o buraco do §3.1 e faz a soma dos KPIs fechar com o total.      |
| Outros proventos   | Versão do **Fopag** (HE separado), aplicada também às fatias da pizza — HE merece fatia própria.          |
| Nome e cargo       | Versão do **Custos** (cadastro com fallback), inclusive na tabela operacional — alinha com o filtro.      |
| Headcount          | CPFs distintos em **todas** as tabelas; manter "Holerites" como contador de linhas, separado.             |
| KPI card           | `@/components/common/Kpi`, estendido com `onClick` + `info` — mata as três implementações.                |
| Gráficos por obra  | Manter **só o empilhado** (mostra total e composição); o de barra simples é subconjunto dele.             |
| Estado vazio       | `QueryState` usado por inteiro, com o texto do Fopag (que cita holerite **e** adiantamento).              |
| Agregações         | Extrair para `useCustoFolhaAgregados(filtered)` — uma fonte só, testável, consumível pelas abas vizinhas. |

---

## 7. Impactos

| Área                     | O que muda                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rotas (`App.tsx:350`)    | `/dp/fopag` → `<Navigate to="/dp/custos?tab=colaborador" replace />`. Manter o redirect: é link salvo e decorado.                                                                                                                                                                                                        |
| Navegação                | Remover o item "Folha de Pagamento" (`navigation.ts:206`) ou reapontá-lo para a aba. Mover os keywords ("fopag", "folha de pagamento", "holerite", "adiantamento") para o item "Custos de Pessoal", senão a busca do menu perde o termo.                                                                                 |
| `paginas.ts`             | Adicionar `"/dp/fopag": "/dp/custos"` em `ROTA_MAE` enquanto o redirect existir.                                                                                                                                                                                                                                         |
| **Matriz de permissões** | ⚠️ `/dp/fopag` deixa de ser linha da matriz. Quem tinha `/dp/fopag` **sem** `/dp/custos` perde acesso silenciosamente. Precisa de migração que copie o nível de `/dp/fopag` para `/dp/custos` (mantendo o maior) antes de remover a linha. **É o único item com risco de regressão de acesso — não pode ser esquecido.** |
| Breadcrumb               | Remover a entrada `fopag: "Fopag"` (`navigation.ts:749`) depois que o redirect sair.                                                                                                                                                                                                                                     |
| Testes                   | Nenhum teste referencia as duas páginas hoje. A extração de `useCustoFolhaAgregados` é a oportunidade de criar o primeiro — em especial um caso que trave `Σ KPIs === Σ custo_total` (§3.1).                                                                                                                             |

---

## 8. Execução sugerida

| Fatia | Escopo                                                                                                            | Ganho                                             | Esforço |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------- |
| 1     | `useCustoFolhaAgregados` com a fórmula correta (RAT incluso, HE separado) + teste de reconciliação                | Elimina o §3.1 e o §3.2 nas duas telas de uma vez | P       |
| 2     | Fundir a UI em `Custos.tsx`: KPIs clicáveis com tooltip, breakdown, visão do colaborador, tabela operacional, CSV | A página única                                    | M       |
| 3     | `/dp/fopag` → redirect; navegação, `ROTA_MAE`, keywords                                                           | Um caminho só na IA                               | P       |
| 4     | Migração da matriz de permissões + remoção da linha `/dp/fopag`                                                   | Fecha o gate sem regressão                        | P       |
| 5     | Trocar os `KpiCard` locais por `common/Kpi` estendido                                                             | Paga a dívida do §2.3, aproveita as abas vizinhas | P       |

Fatia 1 vale sozinha, mesmo que a fusão seja adiada: hoje a Folha de Pagamento apresenta uma
decomposição de custo que não fecha com o próprio total que ela exibe.

---

## 9. O que **não** fundir

- **Mão de Obra Direta** (`CustoColaboradorObra.tsx`): rateia custo por período de alocação em obra.
  É outra pergunta e outra matemática (proporção de dias) — continua aba própria.
- **Provisões**, **Horas Extras**, **Histórico Salarial**, **Homem/Hora**: cada uma aprofunda uma
  fatia que a página fundida só resume. A fusão deve, ao contrário, **linkar** para elas a partir do
  KPI correspondente (clicar em "Provisões" pode oferecer "ver aba Provisões").
- **Conciliação Ponto × Folha** (`PontoConciliacaoFolha.tsx`): pertence ao hub de Ponto.

---

## 10. O que foi implementado

### Camada de cálculo — `src/lib/dp/custo-folha.ts` (novo, `@module-kind pure`)

Fonte única das agregações, com a fórmula correta. `PARCELAS_CUSTO` é a decomposição em seis
parcelas que, somadas, reproduzem `custo_total`; `reconcilia()` e `residuoReconciliacao()` deixam
essa propriedade verificável. `src/lib/dp/__tests__/custo-folha.test.ts` (10 casos) trava a
reconciliação e, em particular, o caso do RAT: o teste calcula a soma **sem** RAT e exige que a
diferença seja exatamente o RAT — se alguém reintroduzir o bug, o teste nomeia o valor que sumiu.

### Página — `src/pages/dp/Custos.tsx`

Recebeu da Folha o drill-down de KPI (`BreakdownDialog`, com busca e filtro por coluna), o
`HoleriteDetailDialog` no clique da linha, a tabela operacional por colaborador, a exportação CSV,
os adiantamentos e a Visão do Colaborador recolhível. Manteve do Custos o Fator K (geral, por obra e
por cargo), o corte por cargo expansível e os tooltips de composição.

Correções aplicadas na fusão, além do RAT:

- **Faixa de reconciliação** sob os KPIs, somando as parcelas na tela e afirmando que fecham. Quando
  não fecha (importação inconsistente), diz a diferença em vez de mentir.
- **Nome e cargo do cadastro** também na tabela operacional — alinhados com o filtro de cargo, que
  sempre usou `funcaoCadastro`.
- **Headcount por obra conta CPFs distintos**, não linhas de holerite.
- **Pizza → barra empilhada horizontal** na composição; o gráfico por obra ficou só o empilhado.
- `Kpi` de `@/components/common` no lugar dos dois `KpiCard` locais.
- `QueryState` usado por inteiro, com o texto de vazio que cita holerite **e** adiantamento.

### Paleta de gráficos — `--chart-1..6` (index.css) + `CHART_COLORS.categorical`

O array de cores anterior (`["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]`)
era um arco-íris com hexes soltos. A paleta nova é validada par a par para daltonismo nos dois
temas. A ordem dos slots é o mecanismo de segurança — não reordene sem revalidar.

### Rotas, navegação e permissões

| Arquivo                                  | Mudança                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`                                | `/dp/fopag` → `<Navigate to="/dp/custos?tab=colaborador" replace />`                                                                                    |
| `navigation.ts`                          | item "Folha de Pagamento" removido; seus termos de busca ("folha de pagamento", "fopag", "holerite", "adiantamento"…) migraram para "Custos de Pessoal" |
| `authz/paginas.ts`                       | `/dp/fopag` entra em `ROTA_MAE`; novo `migrarRotasFundidas()`                                                                                           |
| `usePermissions.ts`, `gm/Permissoes.tsx` | aplicam a migração na leitura e ao carregar o perfil                                                                                                    |

**A migração de permissões roda no cliente, sem tocar no banco.** Quem tinha `/dp/fopag` na matriz
salva herda a permissão em `/dp/custos` (união das ações, nunca rebaixamento), e a linha morta é
descartada. O Quadro de Permissões também migra ao carregar, então o GM vê o mesmo que o gate
aplica e o próximo save persiste a matriz já limpa. Cinco testes em `paginas.test.ts` cobrem
herança, união, idempotência, ausência de efeito colateral e o caso ponta a ponta.

A entrada em `ROTAS_FUNDIDAS` só pode sair quando não houver mais matriz salva com `/dp/fopag`.

### Verificação

`tsc --noEmit` sobre `tsconfig.app.json`: zero erros. Suíte: 1394 passando (os 2 vermelhos são
pré-existentes, num mock do Supabase em `repositories-contrato-*`, sem relação com esta mudança).
`vite build` conclui. `src/pages/dp/__tests__/Custos.render.test.tsx` (7 casos) renderiza a página
fundida e verifica na tela o que o typecheck não alcança — inclusive que os encargos exibem
R$ 2.304,00 (com RAT) e não R$ 2.064,00 (sem).

### Ficou de fora

Não existe UI para reabrir competência fechada — `CompetenciaFechamentoBar` está no repositório mas
não é renderizada em lugar nenhum, e já não era antes da fusão. A mensagem de importação bloqueada
dizia "Reabra no Fopag"; como esse nome deixou de existir, passou a orientar a falar com o DP. Criar
a tela de reabertura é trabalho próprio, fora do escopo desta fusão.
