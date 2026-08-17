# ETAPA 14.5 — Gate de Execução, Validação do Planejamento e Preparação para Implementação — Planifik

**Papel:** Chief Software Architect / Technical Program Manager / Release Planning Specialist
**Natureza:** **Stage Gate formal.** Não audita, não cria achados, não altera prioridades nem diagnósticos. **Valida se o planejamento sustenta a execução.**
**Escopo da validação:** Catálogo Mestre (107 achados), Matriz de Implementação, Matriz Global de Dependências, Roadmap de 8 ondas, Plano de Validação.

> ### VEREDITO ANTECIPADO
>
> **Pergunta do gate:** _"O backlog está pronto para ser executado **integralmente** pelo Lovable **sem necessidade de novas decisões arquiteturais**?"_
> **Resposta: NÃO.**
>
> **Resultado: `GO` CONDICIONAL — autorizado o início das Ondas 0 e 1; `NO-GO` para as Ondas 2 e 6 até a resolução de 5 defeitos de planejamento e 6 decisões pendentes documentadas abaixo.**
>
> Este não é um veredito de fraqueza do plano: 96 dos 107 achados estão prontos para execução. O gate cumpre sua função ao impedir que cinco inconsistências reais — três delas capazes de causar retrabalho ou bloqueio de pipeline — cheguem à execução.

---

## ETAPA A — Consistência do Backlog

| Verificação                                | Resultado                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| IDs únicos, nunca reutilizados/renumerados | ✔ **Conforme** — 107 IDs em 12 prefixos, verificados nas 14 etapas                                     |
| Duplicidades                               | ✔ **Conforme** — 13 sobreposições fundidas na Etapa 5.5 com mapa de deduplicação; nenhuma remanescente |
| Conflitos                                  | ✔ **Conforme** — 7 conflitos identificados e resolvidos por ordenação/fusão (Etapa 14 §D)              |
| **Dependências quebradas**                 | 🔴 **1 defeito** — ver **G-01**                                                                        |
| **Ciclos**                                 | 🟡 **1 quase-ciclo** — ver **G-03**                                                                    |
| **Ambiguidades**                           | 🔴 **6 decisões pendentes** — ver **§Registro de Decisões**                                            |

### Defeitos de planejamento identificados pelo gate

**G-01 — Dependência órfã: ARC-009 não pertence a nenhuma onda.**
SEC-002 (P0, Onda 2) declara dependência de **ARC-009** (fachada única de autorização) para definir seu desenho-alvo. ARC-009 aparece na Matriz de Execução como pré-requisito, mas **não foi alocado a nenhuma onda do Roadmap**. Executar a Onda 2 como está significa fechar o RLS sem o desenho de autorização que a própria ficha exige — retrabalho garantido.
**Correção de planejamento (sem alterar o achado):** ARC-009 é realocado para a **Onda 1** (Fundação), imediatamente antes da Onda 2. Justificativa: ARC-009 é desenho + fachada, não depende de ARC-001, e seu produto (API única de decisão de acesso) é insumo direto de SEC-002.

**G-02 — Inversão de dependência: OPS-001 (Onda 0) depende de QC-001/QC-002 (Onda 1).**
O CI (OPS-001) foi elevado à Onda 0 por ser barato e proteger todas as cirurgias, mas sua ficha lista `typecheck` (QC-001) e `lint` apertado (QC-002) como dependências — ambos na Onda 1. Um item não pode depender de outro em onda posterior.
**Correção de planejamento:** OPS-001 é **cindido em dois checkpoints** (sem novo ID, sem alterar critérios de aceite):

- **OPS-001.a (Onda 0):** CI executando `install + build + test` — os 421 testes já existem e passam; o gate já bloqueia commit vermelho.
- **OPS-001.b (Onda 1):** CI acrescido de `lint` e `typecheck` após QC-001/QC-002.
  Os critérios de aceite originais são satisfeitos ao final de OPS-001.b.

**G-03 — Quase-ciclo: TST-001 (E2E) ↔ SEC-001/EST-002.**
TST-001 declara dependência de SEC-001 e EST-002 (o login e o escopo mudarão), mas a regra dura da Etapa 12 exige TST-001 **antes** das cirurgias de regressão Muito Alta — entre elas SEC-001. Lido literalmente, é circular.
**Correção de planejamento:** TST-001 é **cindido em dois estágios** (sem novo ID):

- **TST-001.a — Caracterização (Onda 0/1):** E2E das jornadas **no estado atual**, incluindo o login atual. Serve de rede: se a jornada verde de hoje ficar vermelha depois, a cirurgia regrediu.
- **TST-001.b — Consolidação (Onda 2/3):** jornadas atualizadas ao novo login/escopo, tornando-se o gate permanente.
  Sem esta cisão, ou se executa a cirurgia sem rede, ou se espera indefinidamente pela rede.

**G-04 — Bloqueio operacional não escalonado: pinagem CDN do `xlsx`.**
A dependência `xlsx` está pinada em tarball de CDN externo (`cdn.sheetjs.com`); a auditoria **reproduziu falha 403 na instalação**. Esse item foi registrado apenas como _critério interno de PERF-001_ (Onda 6). **Consequência de execução:** o CI da Onda 0 (OPS-001.a) executa `npm install` — se o CDN estiver indisponível ou bloqueado no runner, **o pipeline nasce vermelho e o gate de qualidade é inútil desde o primeiro dia**.
**Correção de planejamento:** a correção da pinagem é **antecipada para a Onda 0**, como pré-condição de OPS-001.a. Permanece formalmente dentro dos critérios de PERF-001 (rastreabilidade preservada), apenas antecipada na ordem de execução.

**G-05 — Completude declarativa dos campos obrigatórios (Etapa B abaixo).**
Os campos estendidos (Tipo, Estratégia, Valor, Criticidade, Métrica) tornaram-se obrigatórios a partir das Etapas 8/11/12. Cerca de **65 achados anteriores** (PRO, DS, UX, ARC, BIZ, EST e parte de DB/QC) possuem esses campos **por derivação** (regra de herança da Etapa 14 §B), não por escrita explícita ficha a ficha. Não é lacuna de conteúdo — os Critérios de Aceite verificáveis existem em 107/107 — mas é lacuna de **forma declarativa**.

---

## ETAPA B — Consistência da Matriz de Implementação

| Campo obrigatório                                          | Cobertura explícita | Cobertura por herança                       | Total     |
| ---------------------------------------------------------- | ------------------- | ------------------------------------------- | --------- |
| ID, Categoria, Etapa de origem, Evidências, Diagnóstico    | 107                 | —                                           | **107 ✔** |
| Prioridade Técnica (P0–P3)                                 | 107                 | —                                           | **107 ✔** |
| Complexidade                                               | 107                 | —                                           | **107 ✔** |
| Dependências                                               | 107                 | —                                           | **107 ✔** |
| **Critérios de Aceite** (= Métrica de Sucesso verificável) | 107                 | —                                           | **107 ✔** |
| Objetivo Arquitetural                                      | ~85                 | ~22 (implícito no diagnóstico)              | 107 🟡    |
| Áreas Impactadas                                           | ~60                 | ~47                                         | 107 🟡    |
| Risco de Regressão                                         | ~60                 | ~47 (via Matriz de Regressão da Etapa 12)   | 107 🟡    |
| Validação Recomendada                                      | ~60                 | ~47 (via Plano de Validação §O da Etapa 14) | 107 🟡    |
| Tipo de Implementação                                      | ~42                 | ~65 (regra de herança)                      | 107 🟡    |
| Estratégia de Execução                                     | ~42                 | ~65                                         | 107 🟡    |
| Valor Esperado                                             | ~35                 | ~72                                         | 107 🟡    |
| Criticidade de Negócio (C0–C3)                             | ~15                 | ~92                                         | 107 🟡    |

**Itens incompletos:** nenhum em **conteúdo executável** (todos têm evidência, diagnóstico, prioridade, dependência e critério de aceite verificável). **65 achados** têm campos de classificação por derivação e não por escrita. **Efeito prático:** nenhum bloqueio — a derivação é determinística e rastreável. **Recomendação de gate:** os campos derivados devem ser **materializados ficha a ficha durante a Onda 0**, como tarefa de documentação (custo baixo, sem decisão técnica). Não bloqueia o `GO` das Ondas 0–1.

---

## ETAPA C — Validação das Dependências

| Pergunta                                                        | Resposta                                                                                                                                                                                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existe implementação executável antes da fundação arquitetural? | **Sim, e é correto** — Onda 0 (contenção, config, CI, backup) e 17 quick wins não tocam arquitetura. Verificado: nenhum deles depende de ARC-001.                                                                                       |
| Existe implementação bloqueada?                                 | **Sim, 1:** SEC-002 bloqueada por ARC-009 sem onda (G-01). Corrigido.                                                                                                                                                                   |
| Existe ordem incorreta?                                         | **Sim, 2:** OPS-001 (G-02) e a pinagem `xlsx` (G-04). Corrigidas por cisão/antecipação.                                                                                                                                                 |
| Existe dependência circular?                                    | **Um quase-ciclo:** TST-001 ↔ SEC-001/EST-002 (G-03). Corrigido por cisão em caracterização/consolidação. Nenhum ciclo verdadeiro no grafo restante.                                                                                    |
| Existe risco de retrabalho?                                     | **Sim, mitigado:** três fusões obrigatórias já declaradas (ARC-005+PERF-001+DS-011/016; DS-010+PERF-002; DS-001+BIZ-003). Executá-las separadamente é a maior fonte de retrabalho do programa — restrição formalizada no Pacote (§M.4). |

Grafo revalidado após correções: **acíclico**, com raiz dupla (contenção operacional / raiz técnica ARC-001) e raiz de segurança (SEC-001).

---

## ETAPA D — Validação das Ondas

| Onda               | Escopo coerente? | Dependências satisfeitas?     | Critérios de conclusão objetivos? | Independente da seguinte? | Ajuste do gate                     |
| ------------------ | ---------------- | ----------------------------- | --------------------------------- | ------------------------- | ---------------------------------- |
| 0 Contenção        | ✔                | ✔ após G-02/G-04              | ✔                                 | ✔                         | + `xlsx`; OPS-001.a; TST-001.a     |
| 1 Fundação         | ✔                | ✔                             | ✔                                 | ✔                         | **+ ARC-009**; OPS-001.b           |
| 2 Segurança        | ✔                | 🔴→✔ (exigia ARC-009)         | ✔                                 | ✔                         | inicia só após ARC-009 e TST-001.a |
| 3 Dados/Camadas    | ✔                | ✔                             | ✔                                 | ✔                         | —                                  |
| 4 Padronização     | ✔                | ✔ (internas: DS-002→004→009)  | ✔                                 | ✔                         | —                                  |
| 5 Validação/Regras | ✔                | ✔                             | ✔                                 | ✔                         | —                                  |
| 6 Refatorações     | ✔                | ✔ (exige TST-001.b + TST-002) | ✔                                 | ✔                         | **NO-GO até Ondas 1–3 aprovadas**  |
| 7 Produto/Operação | ✔                | ✔                             | ✔                                 | — (terminal)              | —                                  |

Nenhuma onda depende de onda posterior após as correções. **Independência preservada.**

---

## ETAPA E — Matriz de Execução em Paralelo

| ID                                          | Área               | Onda | Paralelo?                              | Dependências obrigatórias | Risco de conflito                                                  |
| ------------------------------------------- | ------------------ | ---- | -------------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| SEC-003                                     | Segurança          | 0    | Sim                                    | —                         | Nulo                                                               |
| `xlsx` (crit. PERF-001)                     | Build              | 0    | Sim                                    | —                         | Nulo                                                               |
| OPS-001.a                                   | CI                 | 0    | Sim                                    | `xlsx`                    | Nulo                                                               |
| OPS-002                                     | Observabilidade    | 0    | Sim                                    | —                         | Baixo (toca logger; coordenar com QC-003)                          |
| OPS-006                                     | Recuperação        | 0    | Sim                                    | —                         | Nulo                                                               |
| TST-004                                     | Testes             | 0    | Sim                                    | —                         | Nulo                                                               |
| TST-001.a                                   | E2E caracterização | 0    | Sim                                    | —                         | Nulo                                                               |
| EST-002 → UX-004                            | Estado/UX          | 0    | Sequencial entre si; paralelo ao resto | —                         | Baixo                                                              |
| DS-002 → DS-004                             | DS                 | 0/4  | Sequencial entre si                    | —                         | **Médio com OPS-002/QC-003** (mesmo destino de erro)               |
| DS-003, DS-005, DS-006, BIZ-004             | DS/Regras          | 0/4  | **Sim, entre si**                      | —                         | Baixo (arquivos distintos)                                         |
| PRO-001, PRO-009, PRO-018, PRO-019, PRO-029 | Produto            | 0/7  | Sim                                    | —                         | Nulo                                                               |
| ARC-006, ARC-007+QC-004, ARC-011, DS-013    | Higiene            | 1    | Sim                                    | —                         | Baixo (ARC-007 e QC-004 são o mesmo arquivo-alvo: executar juntos) |
| DB-005, DB-003                              | Banco              | 1    | Sim                                    | —                         | Nulo                                                               |
| ARC-001                                     | Tipos              | 1    | **Não** (raiz)                         | —                         | Alto (toca tudo)                                                   |
| QC-001 (ondas)                              | Strict             | 1    | Parcial                                | ARC-001                   | Alto                                                               |
| ARC-009                                     | Autorização        | 1    | Sim                                    | —                         | Baixo                                                              |
| SEC-001 (+SEC-005)                          | Auth               | 2    | **Não**                                | TST-001.a, SEC-003        | **Muito Alto**                                                     |
| SEC-002 (lotes)                             | RLS                | 2    | Parcial (por tabela)                   | SEC-001, ARC-009          | **Muito Alto**                                                     |
| ARC-003 + BIZ-002 + TST-002                 | Dados              | 3    | Sim entre si                           | ARC-001                   | Médio                                                              |
| DB-001, DB-004                              | Banco              | 3    | Sim                                    | DB-005                    | Baixo                                                              |
| DS-010+PERF-002                             | Listas             | 4    | Sim (por lista)                        | ARC-003                   | Baixo                                                              |
| DS-001+BIZ-003                              | Validação          | 5    | Padrão não; adoção sim                 | ARC-001                   | Médio                                                              |
| PRO-013→PRO-011→PRO-014                     | Financeiro         | 5    | Sequencial                             | ARC-001                   | Médio                                                              |
| ARC-005+PERF-001+DS-011+DS-016              | Monólitos          | 6    | Parcial (por arquivo)                  | ARC-001/003, TST          | **Alto**                                                           |
| ARC-002+ARC-004                             | Estado             | 6    | **Não**                                | ARC-001, TST-001.b/002    | **Muito Alto**                                                     |
| PRO-004                                     | DP                 | 6    | Não                                    | ARC-004, DB-005           | Alto                                                               |
| PERF-003                                    | Render             | 6    | Sim                                    | ARC-005/DS-011            | Baixo                                                              |
| Demais PRO/UX/OPS/P3                        | Vários             | 7    | Sim                                    | ver ficha                 | Baixo                                                              |

**Regra de paralelização:** paralelizar livremente dentro da Onda 0, 1 (exceto ARC-001/QC-001), 3, 4 e 7. **Nunca** paralelizar SEC-001, SEC-002 e ARC-002/004 entre si nem com outra cirurgia.

---

## ETAPA F — Estimativa Relativa por Onda

| Onda               | Esforço          | Justificativa                                                                                                  |
| ------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| 0 Contenção        | **Pequena**      | 7 itens, todos ISOLADA/config/aditivos; nenhum toca domínio                                                    |
| 1 Fundação         | **Grande**       | ARC-001 (toda a superfície Supabase) + QC-001 por ondas; higiene e DB documental são pequenos, a raiz é grande |
| 2 Segurança        | **Muito Grande** | duas reformas de fundamento (auth + 226 políticas), em lotes, com validação por lote                           |
| 3 Dados/Camadas    | **Grande**       | 35 páginas + 19 módulos + repositories + testes de integração                                                  |
| 4 Padronização     | **Média**        | muitos itens, cada um pequeno; varreduras mecânicas                                                            |
| 5 Validação/Regras | **Grande**       | padrão de validação transversal + cadeia financeira                                                            |
| 6 Refatorações     | **Muito Grande** | 10 monólitos + god-context (86 consumidores) + migração DP                                                     |
| 7 Produto/Operação | **Grande**       | ~35 achados de produto/UX/ops, majoritariamente independentes                                                  |

---

## ETAPA G — Critérios de Entrada e Saída por Onda

| Onda  | Entrada obrigatória                                       | Saída obrigatória                                                                                                                                                                                                                                                                                                                           |
| ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | Nenhuma                                                   | Segredo rotacionado; `.env` ignorado; CORS sem fallback `*`; `xlsx` instalável do registro; CI (install+build+test) bloqueando vermelho; Sentry capturando erro de teste; backup do MySQL **restaurado com sucesso ao menos uma vez**; cobertura com baseline registrado; E2E de caracterização verde; empresa filtra dados comprovadamente |
| **1** | Onda 0 aprovada                                           | `tsc` estrito limpo em `lib/` e `repositories/`; zero interface local duplicando tabela; CI com lint+typecheck; baseline de schema recriando banco vazio; matriz de canonicidade publicada; **ARC-009 entregue (API única de decisão de acesso)**; páginas órfãs e peças mortas removidas                                                   |
| **2** | Onda 1 aprovada **+ ARC-009 + TST-001.a verde**           | Token forjado rejeitado; senhas com hash; rate limit ativo; leitura anônima às tabelas de negócio retorna vazio; QR público e edges vivos; trilha de segurança registrando                                                                                                                                                                  |
| **3** | Onda 1 aprovada                                           | Zero `supabase.from()` fora de repositories; zero acesso a banco em módulo puro; órfãos de fronteira zerados; testes de integração de dados verdes                                                                                                                                                                                          |
| **4** | Onda 1 aprovada                                           | Um sistema de toast; zero `window.confirm`; um módulo de moeda/data/status; listas-alvo paginadas com totais do servidor; `select("*")` zerado em listas                                                                                                                                                                                    |
| **5** | Ondas 1 e 3 aprovadas                                     | Contrato de validação único (tela = importador) nas 5 entidades; curva/EVM com fonte única; conciliação TOTVS fechando período; recebimento gerando obrigação                                                                                                                                                                               |
| **6** | Ondas 1, 2 e 3 aprovadas **+ TST-001.b e TST-002 verdes** | Nenhum arquivo >500 kB sem justificativa; nenhum monólito UI+dados+regra; paradigma único de estado; DP com fonte única; EST-001 encerrado por absorção                                                                                                                                                                                     |
| **7** | Onda 6 aprovada (para itens dependentes)                  | Achados de produto/UX/OPS concluídos; runbooks publicados; onboarding validado só com a documentação                                                                                                                                                                                                                                        |

**Regra dura:** nenhuma onda inicia sem aprovação formal da anterior quando houver dependência declarada.

---

## ETAPA H — Plano de Versionamento (agnóstico de ferramenta)

- **Branches:** uma branch de longa duração por **onda** (`onda-N`); dentro dela, uma branch curta por **achado**, nomeada pelo ID (`ARC-001`, `SEC-003`). Um achado = uma unidade de merge.
- **Checkpoints:** ao final de cada achado, merge na branch da onda com CI verde. Ao final da onda, merge na linha principal.
- **Tags:** uma tag por **marco** (M1..M8), nomeada pelo marco, apontando para o merge de encerramento da onda correspondente.
- **Releases:** uma release por marco alcançado; notas de release listam os **IDs** concluídos (rastreabilidade auditoria→entrega).
- **Rollback:** por camada — (a) código: reverter o merge da onda até a tag do marco anterior; (b) schema: cada migration da onda deve ter procedimento de reversão declarado, e o rollback de código exige rollback coordenado de schema (OPS-006); (c) configuração/flags: as feature flags existentes permitem desligar comportamento sem reverter código — **usar flags como primeiro instrumento de rollback** nas cirurgias das Ondas 2 e 6.
- **Cirurgias de alto risco (SEC-001, SEC-002, ARC-002/004):** obrigatoriamente atrás de flag ou em lotes reversíveis, com tag imediatamente antes.

---

## ETAPA I — Governança da Execução

- **Controle de mudanças:** toda unidade de trabalho referencia um **ID do Catálogo Mestre**. Trabalho sem ID não entra. Mudança que exceda o escopo do achado não amplia o escopo silenciosamente: vira **registro de desvio**.
- **Registro de desvios:** um log versionado (`DESVIOS.md` ou equivalente) com: ID afetado, desvio, motivo, decisão, impacto em dependências. Revisado ao fim de cada onda.
- **Descobertas durante a implementação:** **não viram achados novos por conta própria.** São registradas como _Descoberta de Execução_ (D-xx) com ID próprio no log; ao fim da onda, avalia-se se (a) cabem no achado existente, (b) exigem nova auditoria pontual, ou (c) entram como débito registrado para depois. Isso preserva o princípio de que o Catálogo é fechado por auditoria, não por execução.
- **Rastreabilidade:** ID no branch → ID no commit/PR → ID na nota de release → ID no checklist de encerramento da onda → ID no Plano de Validação. Cadeia completa dos dois lados.
- **Impedir perda de contexto:** cada onda encerra com um sumário de uma página (IDs concluídos, desvios, decisões tomadas, pendências transferidas). É o documento que um novo executor lê para retomar.
- **Atualização de documentação:** OPS-007 (runbooks) consolida ao final, mas **cada onda atualiza incrementalmente** a documentação que produziu (convenções, matriz de canonicidade, regime de RLS, política de erro). Documentação não é etapa final: é subproduto de cada onda.

---

## ETAPA J — Matriz de Riscos da Execução

| Onda | Principal Risco                                         | Probabilidade               | Impacto        | Mitigação                                                         |
| ---- | ------------------------------------------------------- | --------------------------- | -------------- | ----------------------------------------------------------------- |
| 0    | CI nasce vermelho por causa do `xlsx` (G-04)            | **Alta** (se não corrigido) | Médio          | corrigir pinagem **antes** de OPS-001.a                           |
| 0    | Rotação da senha derruba o backend PHP em produção      | Média                       | Alto           | janela de manutenção; validar conexão antes de invalidar a antiga |
| 1    | Strict global expõe milhares de erros e paralisa        | Alta                        | Médio          | ondas (lib→repos→páginas), testes verdes por onda                 |
| 1    | ARC-001 altera contratos e quebra telas silenciosamente | Média                       | Alto           | TST-001.a como rede; strict revela antes do runtime               |
| 2    | Apertar RLS derruba tela legítima (QR público, edges)   | **Alta**                    | Alto           | lotes por tabela + E2E por lote + política mínima específica      |
| 2    | Reforma de auth bloqueia todos os usuários              | Média                       | **Muito Alto** | migração de senha faseada; tag+flag; rollback ensaiado            |
| 3    | Constraints de fronteira rejeitam dados legados         | Alta                        | Médio          | sanear órfãos antes de aplicar constraint                         |
| 4    | Agregados quebram ao paginar (totais no cliente)        | Média                       | Médio          | mover agregados ao servidor e conferir contra o array atual       |
| 5    | Conciliação altera números que a diretoria já usa       | Média                       | Alto           | período piloto; conferência paralela antes de substituir          |
| 6    | God-context: regressão silenciosa em 86 consumidores    | **Alta**                    | **Muito Alto** | TST-001.b+TST-002 obrigatórios; fatiar por domínio; flags         |
| 6    | Quebra de monólito altera comportamento de card/obra    | Média                       | Alto           | preservar comportamento por teste; dividir por seção              |
| 7    | Escopo de produto expande sem controle                  | Média                       | Médio          | ID obrigatório; registro de desvio                                |

---

## ETAPA K — Checklist GO / NO-GO

| #   | Item                                               | Status                                                     |
| --- | -------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Catálogo Mestre completo (107 achados, IDs únicos) | ☑ **Conforme**                                             |
| 2   | Dependências validadas                             | ☒ **1 quebrada (G-01)** → corrigida neste gate             |
| 3   | Ausência de ciclos                                 | ☒ **1 quase-ciclo (G-03)** → corrigido por cisão           |
| 4   | Ordem de execução consistente                      | ☒ **2 inversões (G-02, G-04)** → corrigidas                |
| 5   | Roadmap consolidado em ondas                       | ☑ **Conforme** (8 ondas, com ajustes deste gate)           |
| 6   | Critérios de aceite definidos                      | ☑ **Conforme** (107/107 verificáveis)                      |
| 7   | Campos obrigatórios materializados ficha a ficha   | ☒ **~65 por herança (G-05)** → tarefa documental na Onda 0 |
| 8   | Estratégia de validação definida                   | ☑ **Conforme** (Plano único, Etapa 14 §O)                  |
| 9   | Plano de rollback definido                         | ☑ **Conforme** (§H deste gate)                             |
| 10  | Riscos documentados                                | ☑ **Conforme** (§J)                                        |
| 11  | Matriz de regressão pronta                         | ☑ **Conforme** (Etapa 12 §O + Etapa 14 §N)                 |
| 12  | Plano pós-implementação pronto                     | ☑ **Conforme**                                             |
| 13  | **Decisões arquiteturais pendentes resolvidas**    | ☒ **6 pendentes** → ver Registro abaixo                    |

### Registro de Decisões Pendentes (bloqueiam ondas específicas, não o programa)

O gate identifica **6 pontos onde o backlog exige uma decisão que a auditoria deliberadamente não tomou** — não são achados novos: são escolhas que as próprias fichas remetem ao dono do produto. **O Lovable não pode decidi-las sozinho.**

| #   | Decisão                                                                              | Achado                | Bloqueia    | Quem decide         |
| --- | ------------------------------------------------------------------------------------ | --------------------- | ----------- | ------------------- |
| D-1 | **Corrigir a auth PHP** (hash+assinatura) **ou migrar já para Supabase Auth?**       | SEC-001               | Onda 2      | Produto/Arquitetura |
| D-2 | **Regime-alvo de acesso por tabela** (quais permanecem públicas: QR, edges)          | SEC-002               | Onda 2      | Produto/Segurança   |
| D-3 | **Canonicidade de cada entidade espelhada** (quem manda: MySQL ou Postgres)          | DB-005 → PRO-004      | Ondas 3 e 6 | Produto             |
| D-4 | **Emitir NF ou integrar emissor externo**                                            | PRO-017               | Onda 7      | Negócio             |
| D-5 | **Riscos/Lições: portfólio × obra — qual é a fonte?**                                | UX-007                | Onda 7      | Produto             |
| D-6 | **Destino das peças mortas** (`ui/form`, `ui/drawer`, `ui/chart`): adotar ou remover | DS-013 (e DS-001/008) | Onda 4      | Arquitetura         |

**D-1, D-2 e D-3 devem ser resolvidas antes do fim da Onda 1.** As demais podem ser resolvidas durante a onda que as consome.

### VEREDITO FORMAL

**`GO` — Ondas 0 e 1**, imediatamente, com as quatro correções deste gate aplicadas (ARC-009 na Onda 1; OPS-001 cindido; TST-001 cindido; `xlsx` antecipado).

**`NO-GO` — Onda 2**, até: (a) ARC-009 entregue; (b) TST-001.a verde; (c) decisões D-1 e D-2 registradas.

**`NO-GO` — Onda 6**, até: Ondas 1–3 aprovadas + TST-001.b e TST-002 verdes + decisão D-3 registrada.

**Ondas 3, 4, 5 e 7:** `GO` condicionado apenas à aprovação de suas ondas de entrada (§G).

**Justificativa:** 96 dos 107 achados estão executáveis hoje. Os cinco defeitos de planejamento são de **sequenciamento**, não de diagnóstico, e foram corrigidos sem alterar nenhum achado, prioridade ou critério. As seis decisões pendentes são **escolhas de negócio e arquitetura que a auditoria corretamente não usurpou** — autorizá-las por omissão seria delegar ao executor decisões que pertencem ao dono do produto. Um `GO` integral aqui produziria retrabalho garantido na Onda 2 (RLS sem fachada de autorização) e risco de pipeline morto na Onda 0.

---

## ETAPA L — PLANO MESTRE DE EXECUÇÃO

**Visão geral.** Execução em 8 ondas, da contenção à operação plena, guiada por um Catálogo de 107 achados com IDs permanentes. O princípio ordenador é: **conter a exposição → religar as redes de segurança (tipos, CI, testes) → reformar segurança → consolidar dados → padronizar → consolidar regras → refatorar estruturas → completar produto e operação.**

**Prioridades.** 4 P0 (3 de segurança + tipos), 42 P1, 38 P2, 23 P3. Os P0 de segurança abrem o programa; o P0 técnico (ARC-001) abre a fundação.

**Dependências.** Grafo acíclico com três raízes: contenção operacional (sem deps), ARC-001 (raiz técnica), SEC-001 (raiz de segurança). ARC-009 realocado à Onda 1 como insumo de SEC-002.

**Paralelização.** Livre nas Ondas 0, 1 (exceto ARC-001/QC-001), 3, 4 e 7. Proibida entre SEC-001, SEC-002 e ARC-002/004.

**Versionamento.** Branch por onda; branch por ID; tag por marco; release por marco com IDs nas notas; rollback por código+schema+flag, com flags como primeiro instrumento.

**Governança.** ID obrigatório em toda unidade de trabalho; registro de desvios; descobertas de execução (D-xx) não viram achados sem avaliação de fim de onda; sumário de uma página por onda.

**Controle de qualidade.** CI como gate desde a Onda 0 (install+build+test), completo na Onda 1 (lint+typecheck). Nenhum merge com CI vermelho.

**Validação.** Critérios de entrada/saída por onda (§G) + Plano de Validação global (Etapa 14 §O) ao final de tudo.

**Regressão.** Regra dura: achados de regressão **Muito Alta** (SEC-001, SEC-002, ARC-002/004, PRO-004) exigem caracterização E2E **antes** da execução (TST-001.a / TST-002).

**Documentação.** Subproduto de cada onda; consolidada em runbooks na Onda 7 (OPS-007).

---

## ETAPA M — PACOTE OFICIAL PARA O LOVABLE

### 1. Escopo da Execução

Implementar os **107 achados** do Catálogo Mestre — 4 P0, 42 P1, 38 P2, 23 P3 — organizados em 8 ondas, elevando o Planifik de "ERP funcionalmente forte com exposições críticas e dívidas concentradas" a "produto seguro, testado, observável e sustentável". Nenhum achado exige reescrita do sistema; a maioria consiste em **terminar de aplicar padrões que o próprio projeto já criou**.

### 2. Ordem Obrigatória de Execução

**Onda 0 Contenção** → **Onda 1 Fundação** → **Onda 2 Segurança** → **Onda 3 Dados/Camadas** → **Onda 4 Padronização** → **Onda 5 Validação/Regras** → **Onda 6 Refatorações Estruturais** → **Onda 7 Produto/Operação**.
Ondas 4 e 7 admitem início antecipado dos itens sem dependência, mediante aprovação da onda de entrada.

### 3. Dependências Críticas (mapa simplificado)

```
[Onda 0: SEC-003 · xlsx · OPS-001.a · OPS-002 · OPS-006 · TST-004 · TST-001.a · EST-002→UX-004]
                                   ↓
[Onda 1: ARC-001 → QC-001/002 · ARC-009 · DB-005 · DB-003 · higiene · OPS-001.b]
              ↓                        ↓
[Onda 2: SEC-001(+005) → SEC-002 → SEC-004 → SEC-007]   [Onda 3: ARC-003+BIZ-002+TST-002 · DB-001/004]
                                   ↓                                    ↓
                        [Onda 4: DS padronização · DS-010+PERF-002]
                                   ↓
                        [Onda 5: DS-001+BIZ-003 · BIZ-001 · PRO-013→011→014]
                                   ↓
[Onda 6: ARC-005+PERF-001+DS-011/016 → ARC-002+ARC-004 → PRO-004 · PERF-003]
                                   ↓
[Onda 7: PRO/UX restantes · OPS-003/004/005 · OPS-007]
```

### 4. Restrições (não alteráveis sem nova auditoria)

1. **Fusões obrigatórias:** ARC-005+PERF-001+DS-011+DS-016 é **uma** cirurgia; DS-010+PERF-002 é **um** pacote; DS-001+BIZ-003 é **um** programa. Separá-los gera retrabalho.
2. **Nenhuma cirurgia de regressão Muito Alta sem caracterização E2E prévia.**
3. **SEC-002 executa por lotes**, com validação por lote; nunca de uma vez.
4. **ARC-002/ARC-004 não se paralelizam** com nada.
5. **Prioridades, IDs, diagnósticos e critérios de aceite não podem ser alterados** pela execução.
6. **Descobertas de execução não viram achados** sem avaliação formal de fim de onda.
7. **As 6 decisões pendentes (D-1..D-6) pertencem ao dono do produto**, não ao executor.

### 5. Critérios Globais de Aceite (toda implementação)

(a) Referencia um ID do Catálogo; (b) satisfaz integralmente os Critérios de Aceite da ficha; (c) CI verde (install+build+test; +lint/typecheck a partir da Onda 1); (d) suíte existente sem regressão; (e) nenhuma alteração de comportamento não prevista na ficha; (f) documentação incremental atualizada.

### 6. Critérios de Regressão (após cada onda)

Reexecutar: suíte unit completa; E2E das jornadas críticas; e — conforme a onda — acesso por papel (Onda 2), integridade de fronteira (Onda 3), totais de listas (Onda 4), números financeiros (Onda 5), paridade funcional de card/obra/DP (Onda 6). Nenhuma jornada crítica pode ficar vermelha.

### 7. Critérios de Encerramento da Modernização

Modernização concluída quando: **(1)** os 10 critérios do Plano de Validação (Etapa 14 §O) forem satisfeitos; **(2)** os 8 marcos M1–M8 estiverem tagueados; **(3)** os 107 IDs estiverem concluídos ou formalmente reclassificados com justificativa; **(4)** token forjado rejeitado e leitura anônima vazia; **(5)** banco recriável do zero e backup restaurável; **(6)** nenhum chunk >500 kB sem justificativa; **(7)** um paradigma de estado, um sistema de toast, uma fonte de moeda/data/status/EVM; **(8)** runbooks permitindo que um novo mantenedor opere e recupere o sistema sem conhecimento tácito.

---

# RELATÓRIO EXECUTIVO

**1. Resultado do Gate:** **`GO` CONDICIONAL.** `GO` imediato para Ondas 0 e 1 (com 4 correções aplicadas). `NO-GO` para Onda 2 até ARC-009 + TST-001.a + decisões D-1/D-2. `NO-GO` para Onda 6 até Ondas 1–3 aprovadas + rede de testes + decisão D-3. **A resposta à pergunta literal do gate — "pronto para execução integral sem novas decisões arquiteturais?" — é NÃO**, por 6 decisões que pertencem ao dono do produto.

**2. Maturidade do planejamento: ★★★★☆.** Rastreabilidade total, critérios verificáveis em 107/107, roadmap coerente. Desconto por: 65 fichas com campos de classificação derivados e não escritos, 1 dependência órfã, 2 inversões de ordem, 1 quase-ciclo — todos corrigidos aqui sem tocar em diagnóstico.

**3. Consistência do backlog: Alta.** IDs únicos, zero duplicidade, zero conflito irreconciliável, zero item obsoleto.

**4. Consistência das dependências: Alta após correção.** Grafo acíclico, três raízes, ARC-009 realocado, TST-001 e OPS-001 cindidos, `xlsx` antecipado.

**5. Consistência das ondas: Alta.** Nenhuma onda depende de onda posterior; critérios de entrada/saída objetivos em todas.

**6. Riscos da execução:** CI nascendo vermelho (G-04, alta probabilidade se ignorado); RLS derrubando telas (Onda 2); regressão silenciosa nos 86 consumidores do god-context (Onda 6); rotação de senha derrubando o backend em produção.

**7. Paralelização:** livre nas Ondas 0/1/3/4/7; proibida entre as três cirurgias críticas.

**8. Versionamento:** branch por onda e por ID; tag por marco; release com IDs; rollback triplo (código/schema/flag), com flags como primeiro instrumento.

**9. Governança:** ID obrigatório; registro de desvios; descobertas de execução isoladas do Catálogo; sumário por onda; documentação como subproduto.

**10. Plano Mestre de Execução:** §L.

**11. Pacote Oficial para o Lovable:** §M — autossuficiente, com escopo, ordem, dependências, restrições, critérios de aceite, regressão e encerramento.

**12. Conclusão Executiva.** O planejamento **passa no gate** — não porque é perfeito, mas porque suas falhas são de **sequenciamento e não de conteúdo**, e o gate as apanhou antes que custassem retrabalho. Quatro correções de ordem restauram a integridade do grafo; uma tarefa documental fecha a forma das fichas; e seis decisões — corretamente não usurpadas pela auditoria — aguardam o dono do produto.

A execução pode começar **hoje** pela Onda 0: rotacionar a senha exposta, ignorar o `.env`, fechar o CORS, desprender o `xlsx` do CDN, ligar o CI, ligar o Sentry, restaurar um backup, medir a cobertura, escrever a rede E2E de caracterização e fazer o filtro de empresa finalmente filtrar. São ações de baixo risco e alto retorno que, sozinhas, tiram o Planifik da zona de exposição material e dão ao restante do programa a rede que ele exige.

**A fase de Planejamento Estratégico está encerrada. A transição para a fase de Execução está autorizada, nos termos e limites deste gate.**

---

_Stage Gate formal. Nenhum achado criado, nenhuma prioridade alterada, nenhum diagnóstico modificado, nenhuma auditoria reaberta. As quatro correções aplicadas são de sequenciamento de execução e preservam integralmente a rastreabilidade do Catálogo Mestre (107 achados, IDs permanentes)._
