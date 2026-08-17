# ETAPA 2 — Auditoria Funcional dos Módulos — Planifik

**Perspectiva:** Product Owner Sênior / Consultor de ERP / Processos de Negócio
**Base:** Inventário da Etapa 1 + verificações funcionais dirigidas no código-fonte
**Escopo desta etapa:** exclusivamente qualidade funcional. Não se avalia código, arquitetura, performance, banco ou UX profunda.

---

# PARTE I — ANÁLISE POR MÓDULO

---

## M1. Gestão de Equipe (Board de Alocação) — `/`

**1. Objetivo.** Responder "quem está em qual obra hoje, e o que vence amanhã". É o painel operacional diário do gestor de obras/RH de campo: aloca colaboradores e veículos por obra, trata estados especiais (férias, afastamento, folga, manutenção) e antecipa vencimentos de documentos. Usuário típico: coordenador de obras, apontador, RH operacional.

**2. Escopo.** Alocação drag-free (via diálogo de mobilização com data), colunas por obra + colunas de estado, mobilização agendada para o futuro, cancelamento, exportação de movimentações em Excel, filtros e visões salváveis, alerta de documentos vencendo integrado, perfil do colaborador/veículo acessível do card.

**3. Fluxo do usuário.** Natural e curto: localizar pessoa (busca) → menu de contexto → mobilizar com data → confirmação. A decisão de colocar esta tela como _home_ do sistema é funcionalmente correta para o perfil de usuário majoritário. Ponto confuso: a coexistência de "Mobilização" (no board), "Mobilização Provisória" (tela própria) e mobilização de veículos exige que o usuário saiba a diferença conceitual entre alocação permanente, provisória e responsabilidade — a nomenclatura não explica sozinha. Etapa que parece faltar: visão de **capacidade/lotação** (quantos a obra precisa vs. quantos tem), que transformaria o board de reativo em preditivo.

**4. Consistência.** Segue o padrão da casa (filtros de coluna, diálogos, toasts), mas é um dos módulos mais antigos: estado vem do `AppContext`/PHP em vez de TanStack Query, e o vocabulário visual (colunas especiais com `__folga__` etc.) é exclusivo dele. Coerente na superfície, distinto por baixo.

**5. Funcionalidades.**

- ✔ Alocação por obra com histórico de movimentações
- ✔ Estados especiais (férias/afastamento/folga/manutenção/sujo)
- ✔ Mobilização agendada (data futura) e cancelamento
- ✔ Exportação Excel de movimentações
- ✔ Alertas de documentos a vencer
- 🟡 Visões/filtros: existem, mas não são persistidos por usuário como nos Quadros (views salvas)
- 🔴 Planejamento de demanda de mão de obra (necessidade × alocado por obra/função)
- 🔴 Linha do tempo de alocação (visão calendário/Gantt de pessoas)

**6. Lacunas (referência de mercado).** ERPs de construção maduros oferecem histograma de mão de obra por função, conflito de alocação (pessoa em duas obras), e custo/hora projetado da equipe alocada. Nada disso existe; o board é fotografia, não filme.

**7. Complexidade.** Adequada. Uma tela, poucos cliques. O excesso está no menu de contexto que acumulou muitas ações (mobilizar, agendar, cancelar, perfil, excluir) — aceitável.

**8. Automações possíveis (identificação apenas).** Desmobilização automática ao encerrar obra; retorno automático de férias na data-fim; sugestão de realocação quando obra é concluída.

**9. Integração.** Boa com RH (documentos, perfil) e razoável com DP (a alocação alimenta rateio de custo). Não conversa com Planejamento Lean (pacotes de trabalho não enxergam a equipe alocada) — isolamento funcional relevante entre "quem está lá" e "o que será feito".

**10. Maturidade: ★★★★☆.** Resolve muito bem o problema diário que se propõe; perde a quinta estrela por ser puramente reativo e não dialogar com planejamento/capacidade.

---

## M2. Quadros / Cards (Kanban genérico) — `/quadros`

**1. Objetivo.** Substituir o Trello: gestão de tarefas e itens de trabalho em quadros por setor, por obra ou livres, com um diferencial estrutural — **pool único de cards** visível em múltiplos quadros. Usuário: todos os setores.

**2. Escopo.** Quadros com templates, listas ordenadas, drag & drop, card rico (descrição rica, checklists, anexos, labels, membros internos/externos, campos customizados, localização, comentários com menção, timeline de atividades, capas), visões Kanban/Tabela/Calendário, visões salvas, "Meus cards", lembretes de prazo diários, importação de CSV do Trello, integração com Suprimentos (cards de recurso).

**3. Fluxo do usuário.** Muito bom. Criar quadro → template → arrastar cards é o fluxo esperado por qualquer usuário de Trello; a curva de aprendizado é próxima de zero, o que é estratégico para a adoção pós-migração. O conceito de pool único é poderoso mas **invisível**: o usuário não tem pista de que mover um card aqui não o move nos outros quadros — funciona, mas o modelo mental precisa ser ensinado. O card acumulou tantas seções que o produto criou "seções visíveis" configuráveis: solução funcional correta para um problema real de densidade.

**4. Consistência.** É o módulo que **define** o padrão moderno do produto (Query + repositories + diálogos ricos). Os demais módulos novos o seguem.

**5. Funcionalidades.**

- ✔ Kanban multi-board, dnd completo, templates, arquivamento
- ✔ Card completo (nível Trello Business em campos: checklists, labels, membros, anexos, custom fields)
- ✔ Comentários com menções + política de notificação
- ✔ Visões Tabela e Calendário, visões salvas
- ✔ Importação Trello, lembretes de prazo automatizados
- 🟡 Membros externos: existem como entidade, mas não há portal/acesso externo — só registro
- 🟡 Automações de quadro (regras "quando mover para X, faça Y") — inexistentes; só o lembrete de prazo é automatizado
- 🔴 Filtro/busca global de cards entre quadros (busca é por quadro; "Meus cards" é o único corte transversal)

**6. Lacunas.** Frente a Trello/Planner/monday: automações por regra, repetição de cards recorrentes, dependências entre cards (existe cascata de prazos via marcos, mas não dependência card→card), e dashboards de fluxo (lead time, cumulative flow).

**7. Complexidade.** O card individual está no limite superior de densidade — mitigado pelas seções configuráveis. Fora isso, enxuto.

**8. Automações possíveis.** Regras de movimentação; criação automática de cards a partir de eventos de outros módulos (NC aberta → card; restrição criada → card).

**9. Integração.** É o módulo mais integrado do sistema: Suprimentos (recursos), Planejamento (badges de restrições/riscos/RDO), notificações. Acoplamento funcional saudável — os outros módulos "publicam" no quadro.

**10. Maturidade: ★★★★★.** Paridade real com a ferramenta que substitui, mais integrações verticais que o Trello nunca teria. É o coração colaborativo do produto.

---

## M3. Obra 360º (Cronograma, Medição, Faturamento, Análise) — `/obras/:id`

**1. Objetivo.** Ser a ficha única da obra: prazo (cronograma CPM), receita (medições BMS → NF → recebimento), custo (TOTVS/folha) e desempenho (EVM). Usuário: engenheiro/gerente da obra, diretoria.

**2. Escopo.** 13 abas em 5 grupos. Cronograma com 5 visões (principal, Gantt editável, caminho crítico, semanal, linha de balanço via comparar/cenários), baselines e revisões comparáveis, calendários com exceções, cenários what-if; aditivos; medições BMS previsto×realizado com fechamento e redistribuição; faturamento e recebimentos com recálculo transacional; EVM completo com Earned Schedule e fonte de AC sinalizada; curva de resultado; custo comprometido; confronto operacional com TOTVS; riscos, ocorrências e histórico.

**3. Fluxo do usuário.** O fluxo macro (Resumo → Planejamento → Medição & Faturamento → Análise → Riscos) espelha o ciclo mensal real de uma obra — organização exemplar. O custo dessa completude é densidade: 13 abas + 5 sub-visões + drawers. O rail agrupado com "última aba visitada por grupo" mitiga bem. Pontos confusos: (a) a diferença entre "Desempenho", "Previsão" e "Análise" não é autoevidente — três abas analíticas cujo critério de separação o usuário precisa descobrir; (b) o EVM com AC estimado por medições quando falta TOTVS é sinalizado, mas exige literacia em gestão de valor agregado que nem todo usuário terá. Etapa que falta no fluxo: **do BMS aprovado à NF** não há geração — a NF é registrada/importada, não emitida; o elo medição→faturamento é manual fora do sistema.

**4. Consistência.** Padrão moderno pleno; é o módulo mais sofisticado e serve de vitrine.

**5. Funcionalidades.**

- ✔ Cronograma CPM com baseline, revisões, cenários, calendários — nível Prevision/MS Project (subset)
- ✔ EVM completo (BAC/PV/EV/AC/SPI/CPI/EAC×3/TCPI/ES) com fallback transparente de AC
- ✔ Medições BMS (importação, previstas, fechamento, redistribuição) — aderente ao processo real da empresa
- ✔ Recálculo transacional faturamento⇄BMS (RPCs dedicadas, reversível)
- ✔ Confronto operacional × TOTVS; custo comprometido por OC
- ✔ Exportação Excel/PDF da obra; membros com papéis
- 🟡 Importador BMS: funcional porém frágil a variações de layout (o próprio plano interno documenta as quebras) — parcial por confiabilidade
- 🟡 Gantt: edição existe, mas sem nivelamento de recursos nem folgas exibidas por barra em todas as visões
- 🔴 Emissão de NF/NFS-e (o sistema só registra/importa)
- 🔴 Medição do cliente com aprovação formal (workflow de aceite do fiscal do contrato)

**6. Lacunas.** Em ERPs de engenharia: workflow de aprovação de medição (contratada→fiscalização), retenções contratuais e caução, reajuste por índice (INCC etc.) aplicado a BMS, e curva física×financeira exportável para o cliente.

**7. Complexidade.** Alta, mas proporcional ao domínio. O ponto de atrito real são as três abas analíticas sobrepostas e as cinco sub-visões de cronograma — há redundância de "portas de entrada" para as mesmas perguntas.

**8. Automações possíveis.** Geração de BMS a partir do avanço do cronograma; criação de recebimento previsto ao registrar NF; alerta automático de desvio SPI/CPI abaixo de limiar.

**9. Integração.** Hub integrador do produto: consome Suprimentos (comprometido), DP (AC folha), Financeiro (TOTVS), Lean (riscos), RDO. Dependência crítica: a obra precisa existir/sincronizar do PHP — o reparo automático trata, mas o módulo é refém da dupla persistência.

**10. Maturidade: ★★★★★.** Funcionalmente é o produto dentro do produto; compete de igual com ferramentas dedicadas de planejamento no recorte que se propõe.

---

## M4. Planejamento Lean (Last Planner) — `/planejamento`

**1. Objetivo.** Operacionalizar o Last Planner System: pacotes de trabalho, remoção de restrições, lookahead de 6 semanas, compromissos semanais e PPC com análise de causas. Usuário: planejador/engenheiro de produção.

**2. Escopo.** Ciclo completo do LPS + matriz de riscos com heatmap, lições aprendidas, RDO consolidado e dois dashboards (operacional e executivo Lean), além de importação de checklist XLSX para gerar pacotes.

**3. Fluxo do usuário.** O ciclo semanal (planejar pacotes → identificar restrições → janela lookahead → comprometer → medir PPC → registrar causas) está inteiro e na ordem certa — raro em ERPs genéricos. Quebra de contexto: riscos e lições existem **duplicados em nível de portfólio (aqui) e em nível de obra (aba da Obra 360º)**; o usuário precisa entender qual instância é a "fonte". A importação de checklist como porta de entrada de pacotes é pragmática e aderente ao processo real (fixture com 214 linhas comprova uso).

**4. Consistência.** Padrão moderno; hub com abas idêntico aos demais.

**5. Funcionalidades.**

- ✔ Pacotes, restrições (com vínculo N:N), lookahead, compromissos, PPC, Pareto de causas
- ✔ Matriz de riscos probabilidade×impacto
- ✔ Lições aprendidas com ciclo próprio
- ✔ Dashboards Lean (obra e consolidado)
- 🟡 Lookahead: janela e visual presentes; não localizei mecanismo de "promoção" automática pacote→compromisso da semana (o vínculo é manual)
- 🔴 Análise de aderência entre cronograma CPM e pacotes Lean (os dois planos convivem sem reconciliação formal)

**6. Lacunas.** Takt planning / linha de balanço integrada ao LPS (a linha de balanço vive no cronograma, não nos pacotes); indicador de remoção de restrições no prazo (idade média de restrição existe implicitamente, não como KPI destacado).

**7. Complexidade.** Nove abas no hub é muito — mas cada uma corresponde a uma cerimônia real; a complexidade é do método, não do produto.

**8. Automações possíveis.** Geração de compromissos a partir do lookahead; NC de qualidade abrindo restrição; causa de não-conclusão alimentando lições automaticamente.

**9. Integração.** Boa com Quadros (badges) e Obra (riscos); fraca com Board de Equipe (compromissos não enxergam equipe disponível) e com Cronograma (planos paralelos).

**10. Maturidade: ★★★★☆.** Ciclo LPS completo e utilizável; falta costurar Lean⇄CPM⇄equipe para a excelência.

---

## M5. Qualidade / Inspeções — `/inspecoes`

**1. Objetivo.** Digitalizar FVS/FVM/checklists de NR com execução em campo (offline), rastreio por QR e tratamento de não conformidades. Usuário: técnico de qualidade/segurança, encarregado.

**2. Escopo.** Modelos com perguntas, agendamento recorrente, QR codes por alvo (frente/equipamento) com rota de acesso direto, captura offline-first com fotos comprimidas e assinatura, severidade, dashboard de KPIs, NC com tratativa 5W2H.

**3. Fluxo do usuário.** Excelente para campo: escanear QR → abrir checklist certo → responder → fotografar → assinar → sincroniza sozinho. É o fluxo de apps dedicados de qualidade (ex.: categoria SafetyCulture), não de ERP — um diferencial competitivo real. Etapa que falta: **reinspeção vinculada à NC** (verificação de eficácia da tratativa como passo formal do fluxo).

**4. Consistência.** Padrão moderno; único módulo (junto com RDO) plenamente offline — coerente com o contexto de uso.

**5. Funcionalidades.**

- ✔ Modelos/perguntas, execução offline, fotos, assinatura, severidade
- ✔ Agenda recorrente; QR por alvo; dashboard
- ✔ NC com 5W2H
- 🟡 NC: tratativa registrada, mas sem workflow de estados com responsável/prazo cobrado por notificação (a cobrança é passiva)
- 🔴 Planos de inspeção por fase da obra (vincular modelos ao cronograma)
- 🔴 Relatório de inspeção em PDF para o cliente/auditoria

**6. Lacunas.** Certificação/assinatura dupla (executante + responsável), score histórico por fornecedor/equipe, e integração NC→restrição/card automática.

**7. Complexidade.** Baixa e correta — o hub de 5 abas cobre tudo sem redundância.

**8. Automações possíveis.** NC crítica → notificação ao gestor + card; agenda vencida → alerta; reinspeção automática N dias após tratativa.

**9. Integração.** Isolamento parcial: a qualidade não retroalimenta Planejamento (restrições) nem Quadros automaticamente — os badges existem, o gatilho não.

**10. Maturidade: ★★★★☆.** Campo resolvido com sofisticação; o pós-NC ainda é raso para competir com suítes de qualidade.

---

## M6. RDO (Diário de Obra) — aba da obra + `/planejamento/rdo`

**1. Objetivo.** Registro diário legal/gerencial: atividades, efetivo, fotos, ocorrências. Usuário: engenheiro/estagiário de campo.

**2. Escopo.** RDO por obra e data com atividades, efetivo, fotos e ocorrências; rascunhos offline; consolidado multi-obra; métricas; badge de "último RDO" nos cards.

**3. Fluxo.** Direto e offline-first — correto para o contexto. Falta no fluxo: **assinatura/aprovação do RDO** (fiscal e contratada) e **bloqueio de edição retroativa**, elementos que dão valor documental/jurídico ao diário.

**4. Consistência.** Padrão moderno, mesmo motor offline das inspeções.

**5. Funcionalidades.** ✔ registro completo diário; ✔ fotos offline; ✔ consolidado e métricas; 🟡 efetivo é digitado, não derivado do Board de alocação (redundância de dado); 🔴 exportação PDF do RDO assinado; 🔴 clima/condições padronizadas (se existirem, não como campo estruturado destacado).

**6. Lacunas.** Numeração sequencial imutável, trilha de aprovação, anexo de RDO ao processo de medição.

**7. Complexidade.** Baixa, adequada.

**8. Automações possíveis.** Pré-preencher efetivo pelo Board; gerar ocorrência→risco; lembrete diário de RDO não preenchido.

**9. Integração.** Meio-termo: alimenta badges e consolidado, mas ignora o Board (efetivo) — a duplicação de digitação é a maior fricção funcional.

**10. Maturidade: ★★★☆☆.** Núcleo sólido; sem assinatura/PDF/sequência, ainda não substitui o diário formal exigido em contratos públicos ou com fiscalização rígida.

---

## M7. Suprimentos — `/suprimentos/*`

**1. Objetivo.** Ciclo de compras da obra: do orçamento de insumos à entrada em estoque, com governança de alçadas. Usuário: comprador, almoxarife, engenheiro requisitante.

**2. Escopo.** Insumos, composições, orçamento por obra com saldo orçado, Curva ABC, requisições com estados (aberta→cotando→atendida/cancelada), cotações com propostas por fornecedor e mapa comparativo, OC com aprovação **multi-alçada** (RPC `fn_oc_aprovar` registra aprovações parciais: "faltam outras alçadas"), recebimento vinculado a itens de OC com NF, estoque com saldos/movimentações/transferências, quadros Kanban de compras e produção com cards de recurso, lead times e alertas.

**3. Fluxo do usuário.** O encadeamento requisição→cotação→OC→recebimento→estoque existe de ponta a ponta e com estados coerentes — isso é o núcleo de qualquer ERP e está presente. Fricções: (a) o módulo tem **duas linguagens simultâneas** — o fluxo transacional (telas de lista) e o fluxo por cards (Quadro de Compras); o usuário precisa entender quando usar cada um, e a redundância conceitual é real; (b) cadastros estruturantes (insumos, composições, orçamento, curva ABC, grupos, alçadas) estão **fora do menu**, acessíveis só por link/⌘K — para um comprador novo, partes do módulo são indescobríveis; (c) da cotação vencedora à OC, a criação da OC nasce em rascunho manual — o elo proposta-vencedora→OC não é evidente na própria tela de cotações.

**4. Consistência.** Padrão moderno, porém é o módulo com mais telas "irmãs mas diferentes" (quadro vs. lista) — internamente menos homogêneo que Financeiro ou Qualidade.

**5. Funcionalidades.**

- ✔ Requisições com ciclo de estados e permissão por obra
- ✔ Cotações com propostas comparáveis
- ✔ OC com aprovação por múltiplas alçadas (governança real, não checkbox)
- ✔ Recebimento por item de OC com NF; estoque com transferência
- ✔ Orçamento/insumos/composições/ABC; custo comprometido refletido na obra
- 🟡 Geração de OC a partir da cotação vencedora (possível, mas o fluxo não conduz)
- 🟡 Descoberta do módulo (metade das telas fora da navegação)
- 🔴 Pedido ao fornecedor (envio da OC por e-mail/PDF ao fornecedor)
- 🔴 Contratos de fornecimento/preço acordado alimentando cotação (o módulo Contratos-Fornecimento existe, mas não abastece Suprimentos)
- 🔴 Inventário/contagem cíclica de estoque

**6. Lacunas.** Três lacunas clássicas de procurement: comunicação com fornecedor (portal/e-mail de cotação e OC), _three-way match_ (OC×recebimento×NF financeira — o recebimento tem NF, mas não concilia com o financeiro), e requisição a partir do orçamento com consumo de saldo bloqueante.

**7. Complexidade.** É o módulo com mais telas (15) e com sobreposição quadro/lista. Há redundância funcional deliberada (visões diferentes do mesmo dado), mas ela cobra imposto cognitivo.

**8. Automações possíveis.** OC automática da proposta vencedora; e-mail ao fornecedor; baixa de estoque por apropriação em RDO; alerta de saldo orçado estourado na requisição.

**9. Integração.** Forte com Obra (comprometido) e Quadros (recursos); fraca com Financeiro (NF de recebimento não vira título) e com Contratos-Fornecimento.

**10. Maturidade: ★★★★☆.** Espinha dorsal completa e com governança acima da média (alçadas múltiplas); perde estrela pela ponta fornecedor inexistente e pela descoberta difícil.

---

## M8. Financeiro — `/financeiro/*`

**1. Objetivo.** Visão financeira por obra e corporativa, tendo o TOTVS como fonte de verdade de custo (importada) e o Planifik como camada analítica + workflow de aprovações. Usuário: financeiro/controladoria, diretoria.

**2. Escopo.** Lançamentos com rateios (inclusive matriz de rateio), aprovação de solicitações com comentários e geração automática de lançamento na aprovação, controle de despesas, faturamento (importação NFS-e XML e XLSX com vínculo automático a obra), fluxo de caixa com **previsto derivado de BMS abertas + recebimentos congelados por NF**, evolução de dívidas com rollup, cadastros (centros TOTVS, plano de contas com seed, clientes, formas de pagamento), snapshots TOTVS versionados com validação server-side, hash e alerta de idade.

**3. Fluxo do usuário.** O desenho assume honestamente que a contabilidade mora no TOTVS: o Planifik não tenta ser contas a pagar/receber completo, e sim confronto + projeção + workflow. Dentro dessa proposta, o fluxo é bom: importar snapshot → validar → analisar por obra → aprovar solicitações. Ponto confuso: "Lançamentos", "Despesas", "Solicitações/Aprovação" e "Snapshot TOTVS" são quatro origens de números financeiros; a página de lançamentos exibe badge de origem, mas o usuário médio levará tempo para montar o modelo mental de qual número manda. Etapa que falta: **conciliação** (bancária ou ao menos snapshot×lançamentos manuais) — hoje a coexistência é informativa, não reconciliada formalmente.

**4. Consistência.** Padrão moderno pleno; hubs idênticos aos demais.

**5. Funcionalidades.**

- ✔ Workflow de aprovação com trilha (solicitação→comentários→aprovação→lançamento via RPC)
- ✔ Importação TOTVS com validação, hash e telemetria de execução
- ✔ Fluxo de caixa projetado a partir do operacional (BMS) — integração receita real
- ✔ Importação NFS-e (XML/XLSX) com vínculo a obra
- ✔ Rateios e matriz de rateio; plano de contas; evolução de dívidas
- 🟡 Contas a pagar/receber: existem lançamentos e recebimentos, mas sem gestão de títulos (vencimento, baixa, juros) — parcial por design (TOTVS)
- 🔴 Conciliação bancária
- 🔴 Emissão de boletos/remessa bancária
- 🔴 DRE gerencial formal por período (os dados existem; o demonstrativo estruturado, não)

**6. Lacunas.** Para competir como ERP standalone: títulos, conciliação, DRE/DFC gerenciais e orçamento empresarial (budget × realizado corporativo, não só por obra). Como camada sobre TOTVS, a lacuna crítica é só a conciliação snapshot×manual.

**7. Complexidade.** Sete itens de menu + dois hubs — adequado. A multiplicidade de origens de dado é a única complexidade excessiva, e é conceitual, não de telas.

**8. Automações possíveis.** Título a pagar a partir do recebimento de material; agenda de importação TOTVS (hoje manual, com alerta de idade como paliativo); provisões DP lançadas automaticamente.

**9. Integração.** Muito boa com Obra/BMS (fluxo previsto) e Aprovações; fraca com Suprimentos (NF de recebimento ≠ título) e DP (provisões não fluem sozinhas).

**10. Maturidade: ★★★★☆.** Excelente como cockpit analítico e de workflow sobre um ERP contábil externo; regular se avaliado como financeiro autônomo — a nota reflete a proposta declarada do produto.

---

## M9. Departamento Pessoal — `/dp/*`

**1. Objetivo.** Apurar o custo real de mão de obra por obra: ponto, folha importada, provisões, fator K, homem-hora. Usuário: DP/controladoria.

**2. Escopo.** Importação de ponto (CSV) com análise e tratativas, horas extras (aba), importação de holerite XLS alimentando dashboard de folha, custo do colaborador com encargos/fator K, custo de MOD por obra via rateio (`get_folha_rateada`), provisões (férias/13º/FGTS/rescisão), histórico salarial, homem-hora.

**3. Fluxo do usuário.** O fluxo real é "importar → conferir → analisar" e funciona; mas é o módulo com **maior cicatriz da migração**: as mesmas entidades (provisões, HE, histórico, fopag) existem no PHP e no Supabase, e telas novas (Fopag por holerite) convivem com telas de era anterior. O usuário que pergunta "onde está a verdade da provisão?" não tem resposta óbvia. Falta no fluxo: fechamento de competência (consolidar/travar o mês) e envio formal ao Financeiro — a Fopag exibe, não fecha.

**4. Consistência.** Misto: metade padrão novo, metade padrão legado. É o módulo menos homogêneo internamente.

**5. Funcionalidades.** ✔ importações ponto/holerite com parsers dedicados e testes; ✔ rateio de folha por obra (elo com EVM); ✔ fator K e custo MOD; 🟡 provisões (calculadas, mas sem ciclo consolidar→reverter conduzido na UI nova); 🟡 horas extras (rebaixada a aba, ciclo de aprovação simples); 🔴 fechamento de competência com trava; 🔴 integração eSocial/folha nativa (fora de escopo declarado — folha é importada).

**6. Lacunas.** Para o propósito (custo, não folha legal): fechamento mensal, trilha holerite→provisão→lançamento financeiro, e comparativo orçado×real de MOD por obra.

**7. Complexidade.** Cadastro redundante real (duplicidade PHP/Supabase) — a única duplicação de dados estrutural visível ao usuário no produto.

**8. Automações possíveis.** Provisão mensal automática pós-importação de holerite; tratativa de ponto sugerida por regra; custo MOD publicado na obra sem ação manual.

**9. Integração.** Boa para cima (EVM consome AC de folha); fraca para o lado (Financeiro não recebe provisões automaticamente; Board não conversa com ponto).

**10. Maturidade: ★★★☆☆.** Faz a apuração que promete, mas a dualidade legado/novo e a ausência de fechamento mantêm o módulo em transição.

---

## M10. Recursos Humanos — `/rh/*`

**1. Objetivo.** Cadastro mestre de pessoas, funções e conformidade documental. Usuário: RH.

**2. Escopo.** CRUD de colaboradores com perfil completo (histórico, férias, documentos), funções, tipos de documento com prazo de vencimento e alertas.

**3. Fluxo.** Simples e concluível; o alerta de vencimento aparecer no Board (onde o gestor vive) é decisão funcional acertada.

**4. Consistência.** Padrão legado (PHP/AppContext), estável.

**5. Funcionalidades.** ✔ cadastro completo com histórico; ✔ documentos com vencimento e alerta; ✔ férias registradas; 🟡 admissão como processo (é um cadastro, não um fluxo com etapas/checklist); 🔴 organograma/centro de custo de pessoa; 🔴 anexo digital do documento (controla o vencimento; não localizei guarda do arquivo em si no fluxo de RH).

**6. Lacunas.** Onboarding/offboarding com checklist, ASO/treinamentos com validade (parcialmente cobertos por "tipos de documento" genéricos — funcional, porém sem semântica).

**7. Complexidade.** Mínima, adequada.

**8. Automações possíveis.** Bloqueio de mobilização com documento vencido; renovação disparando pendência.

**9. Integração.** Boa com Board e DP.

**10. Maturidade: ★★★☆☆.** Cumpre o essencial com solidez; é raso frente a módulos de RH de mercado, mas coerente com seu papel de cadastro mestre.

---

## M11. CRM — `/crm/*`

**1. Objetivo.** Funil de oportunidades até virar obra. Usuário: comercial/diretoria.

**2. Escopo.** Dashboard (conversão, pipeline, tempo médio), funil Kanban + lista, perfil da oportunidade com comentários/interações/temperatura, clientes com contatos e consulta CNPJ/CEP, **conversão ganho→obra com prefill** (arrastar para "fechado ganho" abre a criação da obra pré-preenchida com cliente, valor e data).

**3. Fluxo do usuário.** O momento-chave (ganhar → virar obra) está automatizado no lugar certo — é o melhor "corredor" entre módulos do produto. Faltas no fluxo: **motivo de perda não é capturado** (fechado_perdido é só um estágio — sem isso o dashboard de conversão não explica _por que_ se perde); atividades/tarefas de follow-up não existem (interações são registro passado, não agenda futura).

**4. Consistência.** Persistência legada (PHP) com telas novas — híbrido, mas invisível ao usuário.

**5. Funcionalidades.** ✔ funil com estágios configuráveis; ✔ conversão em obra com prefill; ✔ temperatura, comentários, interações; ✔ dashboard com taxa e tempo médio; 🔴 motivos de perda; 🔴 tarefas/agenda comercial; 🔴 propostas/orçamentos comerciais versionados anexos à oportunidade.

**6. Lacunas.** Frente a CRMs (mesmo simples): funil por valor ponderado por probabilidade, metas por vendedor, e histórico de propostas.

**7. Complexidade.** Baixa e correta.

**8. Automações possíveis.** Follow-up automático por inatividade; oportunidade parada X dias esfria temperatura.

**9. Integração.** Boa para frente (obra); nenhuma para trás (obra concluída não retroalimenta o cliente com histórico comercial consolidado).

**10. Maturidade: ★★★☆☆.** MVP comercial funcional com um golden path excelente; sem perda/tarefas/proposta, ainda não é um CRM completo.

---

## M12. Contratos — `/contratos`

**1. Objetivo.** Dois subdomínios sob o mesmo teto: (a) contratos administrativos/facilities (internet, alojamento, água…) com ciclo de vida e aditivos; (b) contratos de fornecimento com medições próprias. Usuário: administrativo.

**2. Escopo.** Kanban por status + lista, aditivos de prorrogação/reajuste (o valor vigente é derivado dos reajustes), histórico de movimentações, inadimplência como status; aba Fornecimento com medições de contrato.

**3. Fluxo.** Simples e concluível. Confusão real: **"Contratos" aqui não é o contrato da obra** (que vive como valor/aditivo na Obra 360º) nem o contrato de compra (Suprimentos) — três noções de contrato em três lugares, sem ponte. Falta no fluxo: alerta de vencimento/renovação (o dado de prorrogação existe; a cobrança proativa, não).

**4. Consistência.** Kanban+lista no padrão de Patrimônios — coerente.

**5. Funcionalidades.** ✔ ciclo de status com Kanban; ✔ aditivos com efeito no valor vigente; ✔ histórico; 🟡 Fornecimento (recente, medições básicas, sem elo com Suprimentos); 🔴 alertas de renovação; 🔴 gestão documental do contrato (arquivo anexo, assinaturas).

**6. Lacunas.** Índices de reajuste automáticos, workflow de renovação, repositório do documento contratual.

**7. Complexidade.** Baixa.

**8. Automações possíveis.** Alerta N dias antes do fim; despesa recorrente do contrato lançada no Financeiro.

**9. Integração.** Isolamento é a marca: não gera despesa financeira recorrente, não abastece Suprimentos. É quase um cadastro anotado.

**10. Maturidade: ★★★☆☆.** Bom controle de carteira; pouco conectado ao dinheiro que os contratos movimentam.

---

## M13. Ativos & Frotas (+ Mobilização Provisória) — `/patrimonios`, `/veiculos`

**1. Objetivo.** Controlar onde estão os ativos, quem responde por eles e quanto custam (frota). Usuário: almoxarifado central, frota.

**2. Escopo.** Patrimônios com quadro/lista, responsabilidades por período, flags de estado; veículos com tipos, perfil, mobilização; custos de frota (abastecimento, manutenção, apropriação, custo por equipamento); mobilização provisória com períodos.

**3. Fluxo.** Alocar/responsabilizar é direto. A tríade Patrimônios/Veículos/Mobilização Provisória tem fronteiras que o usuário precisa aprender (por que veículo não é patrimônio? quando usar provisória?). Falta no fluxo: manutenção **preventiva** (plano por km/horímetro) — a manutenção registrada é corretiva/histórica.

**4. Consistência.** Quadro+lista padrão; custos de frota já no padrão novo.

**5. Funcionalidades.** ✔ alocação e responsabilidade com histórico; ✔ custos de frota com apropriação por obra; ✔ termo de responsabilidade por período (estrutura); 🟡 depreciação/valor do ativo (cadastro não contempla vida útil contábil); 🔴 manutenção preventiva programada; 🔴 checklist de saída/devolução de equipamento (poderia usar Inspeções, não usa).

**6. Lacunas.** Ordem de serviço de manutenção, controle de pneus/horímetro, integração combustível (cartão).

**7. Complexidade.** Adequada; leve redundância entre "responsabilidade", "mobilização" e "mobilização provisória".

**8. Automações possíveis.** Preventiva por km; apropriação de frota automática por RDO/obra.

**9. Integração.** Boa com Board e obra (custos apropriados); Inspeções ignorada (QR de equipamento existe na Qualidade e não se conecta ao cadastro de patrimônio de forma evidente).

**10. Maturidade: ★★★☆☆.** Controle de localização/custo bom; gestão de ativo (vida útil, preventiva) inicial.

---

## M14. GM / Governança (usuários, flags, auditoria, saúde, cutover) — `/gm/*`

**1. Objetivo.** Administrar acessos e governar a migração de legados com segurança. Usuário: administrador/GM.

**2. Escopo.** CRUD de usuários com matriz página×nível, reset de senha; auditoria navegável; feature flags global/por obra; painel de saúde (idade de snapshot, eventos, fila offline); cutover com reconciliação por obra.

**3. Fluxo.** Para o público-alvo (1–3 pessoas técnicas), é objetivo e completo. O painel de cutover lado a lado (Planifik × esperado do legado) é uma prática de migração acima da média de mercado.

**4. Consistência.** Padrão moderno.

**5. Funcionalidades.** ✔ RBAC matricial; ✔ flags com escopo por obra; ✔ auditoria com filtros; ✔ saúde operacional; ✔ cutover; 🟡 permissões: a granularidade é por página+nível — não há permissão por ação/campo (ex.: "aprova OC até R$ X" vive nas alçadas de Suprimentos, não aqui — correto, mas o GM não tem visão unificada de "o que este usuário pode").

**6. Lacunas.** Perfis/papéis reutilizáveis (hoje a matriz é por usuário, sem templates de perfil), e log de acesso (login/IP) visível.

**7. Complexidade.** Correta.

**8. Automações possíveis.** Desativação de flag legacy automática pós-reconciliação; alerta de snapshot velho por e-mail (hoje só evento).

**9. Integração.** Transversal por natureza; bem conectado.

**10. Maturidade: ★★★★☆.** Governança de migração exemplar; administração de acessos funcional porém artesanal (sem perfis).

---

## M15. Admin / Multiempresa — `/admin/*`

**1. Objetivo.** Suportar operação multi-CNPJ e cargas iniciais. Usuário: GM.

**2. Escopo.** Cadastro de empresas com cor e vínculos usuário-empresa; seletor global com "Todas" para GM; filtro de obras por empresa aplicado nas listas; importação de obras via CSV.

**3. Fluxo.** Simples. Ponto de atenção funcional: a multiempresa filtra por **obras vinculadas à empresa** — módulos não ancorados em obra (ex.: contratos facilities, patrimônios) não deixam claro ao usuário se respeitam o filtro; a percepção de escopo pode divergir da realidade tela a tela.

**4. Consistência.** Padrão moderno.

**5. Funcionalidades.** ✔ empresas/vínculos/seletor; ✔ importação de obras; 🟡 abrangência do filtro multiempresa não uniforme entre módulos; 🔴 parametrizações por empresa (numerações, logotipos em relatórios).

**6. Lacunas.** Consolidado × por empresa nos dashboards com rótulo explícito.

**7–8.** Complexidade mínima; automação possível: provisionamento de usuário já vinculando empresa padrão.

**9. Integração.** Transversal; cobertura desigual é o risco.

**10. Maturidade: ★★★☆☆.** Fundação recém-colocada e funcional; abrangência ainda em consolidação.

---

# PARTE II — VISÃO GLOBAL

## Síntese comparativa

- **Mais maduros:** Obra 360º (Cronograma/EVM/Medição) e Quadros/Cards — ambos com paridade ou superioridade frente às ferramentas que substituem.
- **Menos maduros:** RDO (sem valor documental formal), RH (cadastro raso), Admin/Multiempresa (fundação recente).
- **Incompletos/em transição:** DP (dualidade legado/novo), CRM (sem perda/tarefas), Contratos-Fornecimento (aba recém-nascida), Importador BMS (fragilidade reconhecida em plano interno).
- **Maior potencial:** Suprimentos (a espinha existe; falta a ponta fornecedor e o elo financeiro — com isso vira diferencial competitivo), Qualidade (a captura offline é vendável isoladamente) e Financeiro (o confronto TOTVS é um posicionamento único: "camada de inteligência sobre o ERP contábil").
- **Redundâncias:** Riscos e Lições em dois níveis (portfólio e obra); Quadro×Lista em Suprimentos/Contratos/Patrimônios (deliberada, mas custosa); DP duplicado entre backends; efetivo digitado no RDO já existente no Board; três conceitos de "contrato" desconexos.
- **Aparentemente pouco utilizados:** páginas órfãs (Index, Ocorrências raiz, Riscos raiz, Lições raiz), telas de Suprimentos fora de qualquer menu (indício de uso por poucos usuários-chave), rota legada `/financeiro/importar`.
- **Concentram mais responsabilidade:** Obra 360º (hub de tudo) e Quadros (barramento colaborativo) — concentração coerente com o desenho.

## Funcionalidades globais (verificação)

| Funcionalidade corporativa | Situação                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Pesquisa global            | 🟡 ⌘K navega por telas (com keywords); **não** pesquisa registros/dados                                      |
| Favoritos                  | 🔴 Inexistente (o mais próximo: visões salvas de quadro)                                                     |
| Central de notificações    | ✔ Sino + tabela + jobs (prazo de cards, alertas de operação); cobertura restrita a poucos eventos            |
| Anexos                     | 🟡 Cards, fotos RDO/inspeção; ausente em contratos, colaboradores, oportunidades                             |
| Comentários                | ✔ Cards (com menção), solicitações financeiras, oportunidades, lições                                        |
| Histórico/Timeline         | ✔ Consistente: atividades de card, históricos de entidades, revisões de cronograma                           |
| Auditoria                  | ✔ `audit_logs` com visualizador GM                                                                           |
| Workflow/Aprovação         | ✔ Dois workflows reais: solicitações financeiras e OC multi-alçada; ausente em medições, RDO, NC             |
| Permissões                 | ✔ RBAC página×nível + GM + membros de obra + multiempresa (camadas coerentes, sem visão unificada)           |
| Dashboards                 | ✔ Seis dashboards (Financeiro, Lean×2, CRM, Inspeções, Fopag) + GM Saúde                                     |
| Exportação                 | ✔ Excel/PDF de obra, movimentações; desigual nos demais módulos                                              |
| Importação                 | ✔★ Ponto mais forte do produto: 10+ importadores com validação e testes                                      |
| Logs                       | ✔ system_events, runs de importação com hash                                                                 |
| Ajuda contextual           | 🟡 OnboardingHint pontual; sem central de ajuda                                                              |
| Documentação               | 🔴 Nenhuma documentação de usuário no produto                                                                |
| Assistentes (wizards)      | 🔴 Ausentes (o prefill CRM→Obra é o único "corredor guiado")                                                 |
| Atalhos                    | ✔ ⌘K, hotkeys de board e diálogos                                                                            |
| Configurações              | 🟡 Fragmentadas por módulo (alçadas, flags, empresas, estágios de funil); sem tela "Configurações" unificada |

## Experiência do produto

**Parece um ERP profissional?** Sim, com uma assimetria: os módulos de engenharia (Obra, Lean, Qualidade, Quadros) têm profundidade de software vertical especializado; os módulos administrativos (RH, Contratos, CRM) têm profundidade de sistema interno bem-feito. **Identidade e coerência:** alta nos módulos pós-migração (hubs com abas, mesmos padrões de lista/diálogo/estado vazio); a "linha do tempo" da migração é perceptível — quem usa DP e depois Quadros sente duas gerações. **Processos bem planejados?** Os fluxos espelham cerimônias reais do setor (ciclo LPS, ciclo BMS, cutover governado) — evidência de produto desenhado por quem opera o negócio. **Navegação:** a consolidação 52→30 itens com hubs foi decisão madura; o custo são as telas legítimas que ficaram indescobríveis (Suprimentos estruturante). **Continuidade entre módulos:** excelente nos corredores construídos (CRM→Obra, OC→custo comprometido, BMS→fluxo de caixa, folha→EVM) e abrupta nos não construídos (RDO↛Board, NC↛Restrição, Recebimento↛Financeiro, Contrato↛Despesa). O produto transmite maturidade **operacional** (importa, valida, audita, reconcilia) acima da maturidade **comercial** (documentar, guiar, comunicar para fora).

## Matriz de Maturidade

| Módulo                        | Escopo | Fluxo | Funcionalidades | Integração | Maturidade Geral |
| ----------------------------- | ------ | ----- | --------------- | ---------- | ---------------- |
| Quadros/Cards                 | ★★★★★  | ★★★★★ | ★★★★★           | ★★★★★      | ★★★★★            |
| Obra 360º (Crono/EVM/Medição) | ★★★★★  | ★★★★☆ | ★★★★★           | ★★★★★      | ★★★★★            |
| Planejamento Lean             | ★★★★★  | ★★★★☆ | ★★★★☆           | ★★★☆☆      | ★★★★☆            |
| Qualidade/Inspeções           | ★★★★☆  | ★★★★★ | ★★★★☆           | ★★★☆☆      | ★★★★☆            |
| Suprimentos                   | ★★★★★  | ★★★☆☆ | ★★★★☆           | ★★★☆☆      | ★★★★☆            |
| Financeiro                    | ★★★★☆  | ★★★★☆ | ★★★★☆           | ★★★★☆      | ★★★★☆            |
| Gestão de Equipe (Board)      | ★★★☆☆  | ★★★★★ | ★★★★☆           | ★★★☆☆      | ★★★★☆            |
| GM/Governança                 | ★★★★☆  | ★★★★☆ | ★★★★☆           | ★★★★★      | ★★★★☆            |
| RDO                           | ★★★☆☆  | ★★★★☆ | ★★★☆☆           | ★★☆☆☆      | ★★★☆☆            |
| DP                            | ★★★★☆  | ★★★☆☆ | ★★★☆☆           | ★★★☆☆      | ★★★☆☆            |
| CRM                           | ★★★☆☆  | ★★★★☆ | ★★★☆☆           | ★★★☆☆      | ★★★☆☆            |
| Contratos                     | ★★★☆☆  | ★★★★☆ | ★★★☆☆           | ★★☆☆☆      | ★★★☆☆            |
| Ativos & Frotas               | ★★★☆☆  | ★★★★☆ | ★★★☆☆           | ★★★☆☆      | ★★★☆☆            |
| RH                            | ★★★☆☆  | ★★★★☆ | ★★★☆☆           | ★★★★☆      | ★★★☆☆            |
| Admin/Multiempresa            | ★★★☆☆  | ★★★★☆ | ★★★☆☆           | ★★★☆☆      | ★★★☆☆            |

---

# RESUMO EXECUTIVO

**Principais pontos positivos.** (1) Os módulos de engenharia atingem profundidade de software vertical: cronograma CPM com baselines/cenários, EVM com Earned Schedule e origem de custo transparente, ciclo Last Planner completo e qualidade offline com QR — combinação que ERPs generalistas não entregam. (2) O produto tem os dois workflows de governança que mais importam em construção (aprovação financeira e OC multi-alçada) implementados de verdade. (3) A capacidade de importação (BMS, TOTVS com validação/hash, NFS-e, ponto, holerite, Trello, cronograma, checklist) é excepcional e é o que torna a adoção viável no mundo real. (4) Os "corredores" entre módulos onde existem são exemplares: oportunidade ganha pré-preenche obra; BMS abertas projetam o fluxo de caixa; folha rateada vira AC do EVM; OC vira custo comprometido. (5) A governança da própria migração (flags por obra, cutover reconciliado, auditoria, saúde) transmite seriedade rara.

**Principais lacunas funcionais.** (1) O produto não se comunica com o mundo externo: não emite NF, não envia OC/cotação a fornecedor, não gera RDO/inspeção em PDF assinável, não tem portal de terceiros — tudo entra, quase nada sai formalmente. (2) Elos internos não construídos geram redigitação e silêncio entre módulos: efetivo do RDO ignora o Board; NC não abre restrição/card; recebimento de material não vira obrigação financeira; contratos não geram despesas recorrentes. (3) Motivo de perda no CRM, fechamento de competência no DP e conciliação snapshot×lançamentos no Financeiro são as três ausências de processo mais sentidas. (4) Descoberta: parte estruturante de Suprimentos e todas as configurações vivem fora de navegação visível, sem tela de configurações unificada nem documentação/ajuda. (5) Pesquisa global de dados e favoritos inexistem.

**Módulos mais completos.** Quadros/Cards e Obra 360º (★★★★★), seguidos de Lean, Qualidade, Suprimentos, Financeiro, Board e GM (★★★★☆).

**Módulos que merecem maior atenção.** DP (concluir a travessia legado→novo e criar fechamento de competência), RDO (dar valor documental: assinatura, PDF, trava), CRM (perda e agenda), Contratos (conectar ao dinheiro), e a uniformização do escopo multiempresa.

**Visão geral.** O Planifik é hoje um **★★★★☆ funcional**: um sistema de gestão de obras de nível competitivo envolto por um ERP administrativo de nível "bom sistema interno". Ele já responde com solidez ao problema que declaradamente resolve — consolidar Trello, Prevision, planilhas e a camada analítica sobre o TOTVS. Para competir comercialmente com ERPs estabelecidos, o salto não está em criar módulos novos, e sim em (a) fechar os elos internos já quase prontos, (b) aprender a "falar para fora" (documentos formais e comunicação com terceiros) e (c) terminar as duas transições visíveis (DP e tipagem/backend), que hoje são as únicas partes onde o usuário percebe costura.

---

_Análise exclusivamente funcional, baseada no inventário da Etapa 1 e em leitura dirigida dos fluxos no código. Nenhum arquivo do projeto foi modificado; nenhuma solução foi proposta._
