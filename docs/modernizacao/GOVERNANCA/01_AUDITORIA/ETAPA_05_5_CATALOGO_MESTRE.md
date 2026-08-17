# ETAPA 5.5 — Consolidação e Padronização das Auditorias (Etapas 1–5) — Planifik

**Papel deste documento:** Catálogo Mestre oficial de achados + matrizes de dependência e implementação, no formato que passa a ser obrigatório para todas as etapas futuras. Fonte única de rastreabilidade para execução pelo Lovable.
**Regra:** nenhuma nova auditoria foi realizada; nenhum arquivo do projeto foi alterado. Este documento apenas revisa, corrige, deduplica e padroniza o conhecimento das Etapas 1–5.

---

## 1. Revisão Crítica dos Relatórios (Etapas 1–5)

### 1.1 Inconsistências encontradas entre relatórios

| #   | Inconsistência                                                                                                                                                                                           | Resolução adotada neste catálogo                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Etapa 2** afirmou que formulários novos usam "react-hook-form + zod"; **Etapa 3** verificou e retificou (1 uso de `useForm`, 0 de `zodResolver`; padrão real = formulário controlado por estado local) | Vale a Etapa 3. O achado DS-001 (arquitetura de formulários ausente) parte do padrão correto                                          |
| R2  | **Etapa 2** classificou Suprimentos como "Completo (funcional)" na dimensão escopo enquanto a **Etapa 3** deu ★★☆☆☆ à sua navegação — leitura possivelmente contraditória                                | Não é contradição: escopo funcional ≠ descoberta. Consolidado em dois achados distintos (PRO-009/010/011 funcional; UX-001 navegação) |
| R3  | **Etapa 1** listou `/suprimentos/insumos`, `/composicoes`, `/orcamento`, `/curva-abc` como "fora de qualquer menu"; a Etapa 3 tratou o conjunto como "telas sem porta" incluindo alçadas/grupos          | Unificado em UX-001 com a lista completa de telas afetadas                                                                            |
| R4  | **Etapas 4 e 5** registraram o mesmo fato por lentes diferentes (monólitos D5 = C2; inversão de camada D8 ⊃ C9; toast duplo em E3 e C5)                                                                  | Deduplicado no catálogo: um ID por problema, com origem múltipla registrada                                                           |
| R5  | Nota de maturidade funcional do Financeiro (E2 ★★★★☆) convive com lacunas P1 (conciliação)                                                                                                               | Mantido: a nota reflete a proposta declarada (camada sobre TOTVS); a lacuna vira achado próprio (PRO-013)                             |

### 1.2 Sobreposições consolidadas (mapa de deduplicação)

| Problema                                           | Aparece em             | ID único consolidado             |
| -------------------------------------------------- | ---------------------- | -------------------------------- |
| Duplo sistema de toast                             | E3 §1.3/§VII; E5 C5/I2 | DS-002                           |
| `window.confirm` residual                          | E3; E5 I4              | DS-003                           |
| Monólitos página/diálogo (CardGenericoDialog etc.) | E4 D5/P5; E5 C2        | ARC-005                          |
| Inversões de camada (lib→ui; component→page)       | E4 D8; E5 C9           | ARC-006                          |
| Tipos Supabase `any`/defasados                     | E1 §9; E4 D1/D6/P1     | ARC-001                          |
| Páginas órfãs                                      | E1 §6.5; E3; E4 D11    | ARC-011                          |
| Subadoção QueryState/EmptyState/estados            | E3; E5 C3/I3           | DS-004                           |
| Paginação inexistente                              | E3; E5 I10             | DS-010                           |
| Riscos/Lições em dois níveis                       | E2 M4; E3 §VII.8       | UX-007                           |
| Redigitação do efetivo no RDO                      | E2 M6; E3 §VII.6       | PRO-006                          |
| `currency`×`money` duplicados                      | E4 D10; E5 I7          | DS-006                           |
| Busca global de cards / de dados                   | E2 M2; E3 §III         | UX-002 (absorve o caso de cards) |
| Serviços vestigiais / dpHoleliteRepo fora de lugar | E4 D10; E5 I14         | ARC-010                          |

### 1.3 Lacunas das Etapas 1–5 (a auditar em etapas futuras — apenas registradas)

Performance (bundle, renderizações, volume de dados sem paginação em runtime); Banco de dados/SQL (schema real, índices, RLS, RPCs, migrations 172+11); Segurança (autenticação dupla, tokens em localStorage, RLS efetiva, api.php); Testes (cobertura real além dos 60 arquivos, E2E ausente?); Backend PHP (api.php 212 KB nunca auditado por dentro); Edge Functions (7, só inventariadas); Motor offline (robustez/conflitos além do desenho); PWA (manifest/service worker inexistentes vs InstallPrompt); Integração Planifik⇄flowcast-build-sync (mencionada em memória de projeto, fora do zip auditado).

---

## 2. Terminologia Normalizada (obrigatória daqui em diante)

| Termo canônico                       | Definição                                                                                                                                                                                                                                                             | Proibido usar                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Módulos M1–M15**                   | M1 Gestão de Equipe (Board) · M2 Quadros/Cards · M3 Obra 360º · M4 Planejamento Lean · M5 Qualidade/Inspeções · M6 RDO · M7 Suprimentos · M8 Financeiro · M9 DP · M10 RH · M11 CRM · M12 Contratos · M13 Ativos & Frotas · M14 GM/Governança · M15 Admin/Multiempresa | nomes alternativos ("Kanban", "Compras", "Folha") |
| **Backend PHP legado**               | `api.php` em jogab.com.br + entidades servidas por ele                                                                                                                                                                                                                | "API antiga", "MySQL"                             |
| **Supabase**                         | Postgres/Auth/Storage/Edge do projeto                                                                                                                                                                                                                                 | "backend novo"                                    |
| **Geração legada / Geração moderna** | padrão AppContext+PHP vs padrão lib pura+repositories+TanStack Query                                                                                                                                                                                                  | "código velho/novo"                               |
| **Compostos de produto**             | componentes compartilhados acima de `ui/` (QueryState, HubTabs, filtros...)                                                                                                                                                                                           | "helpers", "commons"                              |
| **Primitivos**                       | `components/ui/*`                                                                                                                                                                                                                                                     | "átomos"                                          |
| **Hub**                              | página com `HubTabs` e `?tab=`                                                                                                                                                                                                                                        | "página com abas"                                 |
| **Achado**                           | item do Catálogo Mestre com ID                                                                                                                                                                                                                                        | "problema", "issue" sem ID                        |
| Prefixos de ID                       | **PRO-** produto/funcional · **UX-** experiência · **ARC-** arquitetura · **DS-** design system/componentes                                                                                                                                                           | —                                                 |

---

## 3. CATÁLOGO MESTRE DE ACHADOS

### 3.1 Tabela-índice (Status inicial de todos: **Aberto**)

| ID      | Categoria                  | Etapa | Problema (síntese)                                                                                                                                                        | Prioridade | Impacto | Complexidade | Dependências                             | Status |
| ------- | -------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- | ------------ | ---------------------------------------- | ------ |
| ARC-001 | Arquitetura/Tipos          | 1,4   | Tipagem Supabase desligada (`any`) sobre tipos gerados defasados; contratos re-declarados por página                                                                      | P0         | Crítico | Média        | —                                        | Aberto |
| ARC-002 | Arquitetura/Estado         | 4     | God-context `AppContext` (730 L, 63 membros, 86 consumidores)                                                                                                             | P1         | Crítico | Muito Alta   | ARC-001                                  | Aberto |
| ARC-003 | Arquitetura/Dados          | 4     | Bypass da camada de repositories (35 páginas com `supabase.from` direto)                                                                                                  | P1         | Alto    | Média        | ARC-001                                  | Aberto |
| ARC-004 | Arquitetura/Estado         | 4     | Duas máquinas de estado servidor (imperativa PHP × TanStack Query)                                                                                                        | P1         | Alto    | Alta         | ARC-002                                  | Aberto |
| ARC-005 | Arquitetura/Componentes    | 4,5   | Monólitos página/diálogo (10 arquivos 700–2.104 L; CardGenericoDialog, AprovacaoFinanceira, RevisoesTab…)                                                                 | P1         | Alto    | Alta         | ARC-001, ARC-003                         | Aberto |
| ARC-006 | Arquitetura/Camadas        | 4,5   | Inversões de camada: `lib/schemas`→`components/ui/cnpj-input`; `components/obra-detalhe/MedicoesTab`→`pages/financeiro/FinObraDetalhe`                                    | P2         | Médio   | Baixa        | —                                        | Aberto |
| ARC-007 | Arquitetura/Organização    | 4     | Gavetas: 35 soltos em `lib/` raiz (bms-_, cards-_, dp*, cpm) e 35 em `components/` raiz                                                                                   | P2         | Médio   | Média        | ARC-006                                  | Aberto |
| ARC-008 | Arquitetura/Dados          | 4     | Query keys ad-hoc sem registro/fábrica                                                                                                                                    | P2         | Médio   | Baixa        | —                                        | Aberto |
| ARC-009 | Arquitetura/Autorização    | 4     | Três sistemas de autorização sem fachada (acessos PHP, `obra_membros`, roles/RLS)                                                                                         | P1         | Alto    | Média        | —                                        | Aberto |
| ARC-010 | Arquitetura/Higiene        | 4,5   | `services/` vestigial; `dpHoleriteRepo` fora de `repositories/`; padrão hooks-por-domínio inconsistente                                                                   | P3         | Baixo   | Baixa        | ARC-003                                  | Aberto |
| ARC-011 | Arquitetura/Higiene        | 1,3,4 | Páginas órfãs: `Index.tsx`, `Ocorrencias.tsx`, `LicoesAprendidas.tsx` (raiz), `Riscos.tsx` (raiz)                                                                         | P3         | Baixo   | Baixa        | —                                        | Aberto |
| DS-001  | Design System/Formulários  | 3,5   | Ausência de arquitetura de formulários (validação imperativa heterogênea, mensagens sem padrão, `ui/form.tsx` morto)                                                      | P1         | Crítico | Alta         | ARC-001 (tipos ajudam validação)         | Aberto |
| DS-002  | Design System/Feedback     | 3,5   | Dois sistemas de toast (sonner ×84 arquivos, `use-toast` ×9)                                                                                                              | P1         | Médio   | Baixa        | —                                        | Aberto |
| DS-003  | Design System/Feedback     | 3,5   | `window.confirm` nativo em 5 telas (Empresas, GMFeatureFlags, GruposNegociacao, InspecoesAgenda, GM)                                                                      | P2         | Médio   | Baixa        | —                                        | Aberto |
| DS-004  | Design System/Estados      | 3,5   | Subadoção de QueryState/EmptyState (spinner manual em 31 páginas; EmptyState preso em `components/obra/`)                                                                 | P2         | Médio   | Média        | DS-002                                   | Aberto |
| DS-005  | Design System/Consistência | 5     | Mapas status→rótulo/cor duplicados em 15 arquivos                                                                                                                         | P2         | Médio   | Baixa        | —                                        | Aberto |
| DS-006  | Design System/Consistência | 4,5   | Moeda: BRL formatado inline em 32 páginas; `lib/money`×`lib/currency` sobrepostos; `money-input` com 2 usos                                                               | P1         | Alto    | Baixa        | —                                        | Aberto |
| DS-007  | Design System/Dashboards   | 5     | KPI/StatCard reimplementado por dashboard (só `financeiro/dividas/KpiCard` extraído)                                                                                      | P2         | Médio   | Média        | —                                        | Aberto |
| DS-008  | Design System/Dashboards   | 5     | Recharts cru em 24 arquivos; wrapper `ui/chart.tsx` com 0 usos                                                                                                            | P2         | Médio   | Média        | DS-007                                   | Aberto |
| DS-009  | Design System/Tabelas      | 5     | 24/28 telas com tabela crua fora de `ui/data-table`; sem padrão de overflow/densidade                                                                                     | P2         | Médio   | Alta         | DS-004, DS-010                           | Aberto |
| DS-010  | Design System/Tabelas      | 3,5   | Paginação inexistente como padrão (primitivo pronto, 2 usos)                                                                                                              | P1         | Alto    | Média        | —                                        | Aberto |
| DS-011  | Design System/Duplicação   | 5     | 6 implementações independentes de Kanban (M1, M2, M7×2, M11, M12/M13)                                                                                                     | P3         | Médio   | Alta         | ARC-005                                  | Aberto |
| DS-012  | Design System/Duplicação   | 5     | 8 diálogos de importação repetindo a casca upload→prévia→confirmar em 4 pastas                                                                                            | P3         | Médio   | Média        | —                                        | Aberto |
| DS-013  | Design System/Higiene      | 5     | Peças mortas/presas: `ui/form`, `ui/drawer`, `ui/chart` (0 usos); `EmptyState` em pasta de domínio; `busy-overlay` 1 uso                                                  | P3         | Baixo   | Baixa        | DS-001, DS-004, DS-008 (decidem destino) | Aberto |
| DS-014  | Design System/Governança   | 5     | Biblioteca sem catálogo/documentação; adoção por arqueologia                                                                                                              | P2         | Médio   | Baixa        | —                                        | Aberto |
| DS-015  | Design System/Padronização | 5     | Sem escala de tamanhos de Dialog; sem contêiner padrão de barra de filtros                                                                                                | P3         | Baixo   | Baixa        | —                                        | Aberto |
| DS-016  | Design System/Componentes  | 5     | 31 diálogos de domínio autofetchantes (UI acoplada a dados), impedindo reuso apresentacional                                                                              | P3         | Alto    | Alta         | ARC-003, ARC-005                         | Aberto |
| UX-001  | UX/Navegação               | 1,2,3 | Telas sem porta: `/suprimentos/insumos`, `/composicoes`, `/orcamento`, `/curva-abc`, `/suprimentos/grupos-gestao`, Alçadas; configurações fragmentadas sem tela unificada | P1         | Alto    | Média        | —                                        | Aberto |
| UX-002  | UX/Pesquisa                | 2,3   | ⌘K só navega telas; não existe pesquisa global de registros (NF, colaborador, card, obra)                                                                                 | P2         | Médio   | Alta         | ARC-001                                  | Aberto |
| UX-003  | UX/Clareza                 | 2,3   | Rótulos analíticos indistintos na Obra 360º (Desempenho × Previsão × Análise)                                                                                             | P2         | Médio   | Baixa        | —                                        | Aberto |
| UX-004  | UX/Multiempresa            | 2,3   | Escopo multiempresa silencioso: filtro global sem indicação por tela do que é/não é filtrado; cobertura desigual entre módulos                                            | P1         | Alto    | Média        | —                                        | Aberto |
| UX-005  | UX/Acessibilidade          | 3     | 22 de 28 botões icon-only sem nome acessível; DnD sem alternativa de teclado; erros só em toast efêmero                                                                   | P2         | Médio   | Média        | —                                        | Aberto |
| UX-006  | UX/Responsividade          | 3     | 13 telas com `<Table>` sem proteção de overflow; telas desktop-only não sinalizadas (Gantt, matrizes, mapa de cotações)                                                   | P2         | Médio   | Média        | DS-009                                   | Aberto |
| UX-007  | UX/Duplicação              | 2,3   | Riscos e Lições Aprendidas em dois níveis (portfólio M4 × aba da Obra M3) com telas quase gêmeas e fonte ambígua                                                          | P2         | Médio   | Média        | —                                        | Aberto |
| UX-008  | UX/Onboarding              | 3     | Ausência de ajuda contextual nas telas analíticas (EVM/SPI/CPI/ES sem explicação) e de documentação de usuário                                                            | P3         | Médio   | Média        | —                                        | Aberto |
| UX-009  | UX/Produtividade           | 3     | Sem favoritos/recentes globais (visões salvas só em M2)                                                                                                                   | P3         | Baixo   | Média        | —                                        | Aberto |
| UX-010  | UX/Densidade               | 3     | Densidade `text-xs` universal (548 usos) penaliza leitura executiva e baixa visão                                                                                         | P3         | Baixo   | Baixa        | —                                        | Aberto |
| PRO-001 | Produto/M11 CRM            | 2     | Motivo de perda não capturado (fechado_perdido é só estágio)                                                                                                              | P1         | Alto    | Baixa        | —                                        | Aberto |
| PRO-002 | Produto/M11 CRM            | 2     | Sem tarefas/agenda de follow-up (interações são só registro passado)                                                                                                      | P2         | Médio   | Média        | —                                        | Aberto |
| PRO-003 | Produto/M9 DP              | 2     | Sem fechamento de competência (consolidar/travar mês; Fopag exibe, não fecha)                                                                                             | P1         | Alto    | Média        | —                                        | Aberto |
| PRO-004 | Produto/M9 DP              | 1,2   | Dualidade legado/novo: provisões, HE, histórico salarial e fopag existem no Backend PHP legado **e** no Supabase                                                          | P1         | Alto    | Alta         | ARC-002, ARC-004                         | Aberto |
| PRO-005 | Produto/M6 RDO             | 2     | RDO sem valor documental: sem assinatura/aprovação, sem PDF, sem numeração sequencial, sem trava retroativa                                                               | P1         | Alto    | Média        | —                                        | Aberto |
| PRO-006 | Produto/M6+M1              | 2,3   | Efetivo do RDO redigitado (não deriva da alocação do Board)                                                                                                               | P1         | Alto    | Média        | —                                        | Aberto |
| PRO-007 | Produto/M5 Qualidade       | 2     | NC sem workflow ativo: sem responsável/prazo cobrado, sem reinspeção/verificação de eficácia, sem notificação                                                             | P1         | Alto    | Média        | PRO-030                                  | Aberto |
| PRO-008 | Produto/Integração         | 2     | NC não gera restrição (M4) nem card (M2) automaticamente                                                                                                                  | P2         | Médio   | Média        | PRO-007                                  | Aberto |
| PRO-009 | Produto/M7 Suprimentos     | 2     | Fluxo cotação vencedora→OC não conduzido (OC nasce em rascunho manual)                                                                                                    | P1         | Alto    | Baixa        | —                                        | Aberto |
| PRO-010 | Produto/M7 Suprimentos     | 2     | Sem comunicação com fornecedor (OC/cotação por PDF/e-mail; nada "sai" do sistema)                                                                                         | P1         | Alto    | Média        | PRO-009                                  | Aberto |
| PRO-011 | Produto/Integração         | 2     | Recebimento de material não gera obrigação no Financeiro (sem three-way match OC×recebimento×NF)                                                                          | P1         | Alto    | Alta         | PRO-013                                  | Aberto |
| PRO-012 | Produto/M7 Suprimentos     | 2     | Sem inventário/contagem cíclica de estoque                                                                                                                                | P3         | Médio   | Média        | —                                        | Aberto |
| PRO-013 | Produto/M8 Financeiro      | 2     | Sem conciliação snapshot TOTVS × lançamentos manuais (coexistência informativa, não reconciliada)                                                                         | P1         | Alto    | Alta         | ARC-001                                  | Aberto |
| PRO-014 | Produto/M8 Financeiro      | 2     | Sem DRE/DFC gerencial formal por período (dados existem, demonstrativo não)                                                                                               | P2         | Médio   | Média        | PRO-013                                  | Aberto |
| PRO-015 | Produto/M8 Financeiro      | 2     | Importação TOTVS manual e periódica (alerta de idade é paliativo; sem agendamento)                                                                                        | P2         | Médio   | Média        | —                                        | Aberto |
| PRO-016 | Produto/M3 Obra            | 2     | Sem workflow de aprovação de medição (aceite contratada→fiscalização)                                                                                                     | P2         | Médio   | Média        | —                                        | Aberto |
| PRO-017 | Produto/M3 Obra            | 2     | Elo BMS aprovado→NF é manual fora do sistema (não emite NF/NFS-e)                                                                                                         | P3         | Alto    | Muito Alta   | —                                        | Aberto |
| PRO-018 | Produto/M3 Obra            | 1,2   | Importador BMS frágil a variações de layout (plano canônico em `.lovable/plan.md` pendente)                                                                               | P1         | Alto    | Média        | —                                        | Aberto |
| PRO-019 | Produto/M12 Contratos      | 2     | Sem alertas de vencimento/renovação de contratos                                                                                                                          | P2         | Médio   | Baixa        | PRO-030                                  | Aberto |
| PRO-020 | Produto/Integração         | 2     | Contratos não geram despesa recorrente no Financeiro                                                                                                                      | P2         | Médio   | Média        | —                                        | Aberto |
| PRO-021 | Produto/M12 Contratos      | 2     | Sem gestão documental do contrato (arquivo anexo, assinaturas)                                                                                                            | P3         | Baixo   | Baixa        | —                                        | Aberto |
| PRO-022 | Produto/M1 Board           | 2     | Sem visão de capacidade/demanda de mão de obra (necessidade × alocado por obra/função)                                                                                    | P2         | Médio   | Alta         | —                                        | Aberto |
| PRO-023 | Produto/M1 Board           | 3     | Sem mobilização em massa (seleção múltipla)                                                                                                                               | P3         | Baixo   | Baixa        | —                                        | Aberto |
| PRO-024 | Produto/M13 Ativos         | 2     | Sem manutenção preventiva programada (km/horímetro); manutenção só corretiva/histórica                                                                                    | P2         | Médio   | Média        | —                                        | Aberto |
| PRO-025 | Produto/M4 Lean            | 2     | Lookahead→compromissos manual; sem "repetir semana anterior"                                                                                                              | P2         | Médio   | Média        | —                                        | Aberto |
| PRO-026 | Produto/M4+M3              | 2     | Sem reconciliação formal entre plano Lean (pacotes) e cronograma CPM                                                                                                      | P3         | Médio   | Alta         | —                                        | Aberto |
| PRO-027 | Produto/M2 Quadros         | 2     | Sem automações por regra nos quadros (só lembrete de prazo)                                                                                                               | P3         | Médio   | Alta         | —                                        | Aberto |
| PRO-028 | Produto/M14 GM             | 2     | Sem perfis/papéis reutilizáveis (matriz de acesso por usuário, sem templates)                                                                                             | P3         | Baixo   | Média        | ARC-009                                  | Aberto |
| PRO-029 | Produto/M5 Qualidade       | 2     | Sem relatório PDF de inspeção para cliente/auditoria                                                                                                                      | P2         | Médio   | Baixa        | —                                        | Aberto |
| PRO-030 | Produto/Transversal        | 2     | Central de notificações com cobertura mínima de eventos (só prazo de card e idade de snapshot)                                                                            | P2         | Médio   | Média        | —                                        | Aberto |
| PRO-031 | Produto/M15 Multiempresa   | 2     | Sem parametrização por empresa (numerações, logotipos em saídas)                                                                                                          | P3         | Baixo   | Média        | UX-004                                   | Aberto |

**Total: 68 achados únicos** (ARC 11 · DS 16 · UX 10 · PRO 31). Registros que apareciam em mais de uma etapa foram fundidos sob um único ID — o mapa de deduplicação está na §1.2.

### 3.2 Fichas detalhadas

Formato: **Evidências → Diagnóstico → Impacto → Prioridade → Critérios de Aceite** (complexidade/dependências já na tabela-índice). Fichas completas para P0/P1; fichas compactas para P2/P3.

---

**ARC-001 — Tipagem Supabase desligada** · Arquitetura · Etapas 1, 4
**Evidências:** `src/integrations/supabase/client-augment.d.ts` (rebaixa `from()`/`rpc()` a `any`, comentário "schema in flux"); `src/integrations/supabase/types.ts` sem ~40 tabelas das migrations; interfaces locais re-declaradas (ex.: `src/pages/suprimentos/OrdensCompra.tsx` define OC/Cotação/Requisição próprias).
**Diagnóstico:** o compilador foi deliberadamente removido da metade Supabase do sistema — exatamente a que mais cresce; contratos de dados vivem duplicados por página e derivam em silêncio.
**Impacto:** Crítico — erros de contrato só em runtime; toda outra frente (repositories, formulários, monólitos) fica mais cara e arriscada sem tipos.
**Prioridade:** P0 — pré-requisito barateador de quase tudo.
**Critérios de aceite:** (a) tipos de banco gerados cobrindo 100% das tabelas/RPCs das migrations; (b) `client-augment.d.ts` sem afrouxamento global; (c) `tsc` sem erros com tipagem estrita nas chamadas Supabase; (d) zero interfaces locais duplicando tabelas em `src/pages` (verificável por busca).

---

**ARC-002 — God-context AppContext** · Arquitetura · Etapa 4
**Evidências:** `src/contexts/AppContext.tsx` (730 L, 63 membros expostos); 86 arquivos consumindo `useApp()`; `src/contexts/app/useMobilizacoes.ts` (755 L de regra de negócio); auth dupla + RBAC + 10 domínios PHP no mesmo provider.
**Diagnóstico:** um provider concentra sessão, autorização e estado de todos os domínios do Backend PHP legado; qualquer mudança tem raio de 86 arquivos e re-render global; acopla a autenticação à migração do legado.
**Impacto:** Crítico — principal bloqueador estrutural da saída do PHP e maior risco de regressão em manutenção.
**Prioridade:** P1 (após ARC-001, que protege a cirurgia).
**Critérios de aceite:** (a) sessão/identidade/`canAccess` isoladas em provider próprio sem estado de domínio; (b) cada domínio PHP exposto por interface própria substituível; (c) nenhum consumidor importando o contexto para obter dados de domínio de outro módulo; (d) contagem de consumidores do contexto de sessão documentada e reduzida ao necessário.

---

**ARC-003 — Bypass de repositories** · Arquitetura · Etapa 4
**Evidências:** 35 arquivos em `src/pages` com `supabase.from(`/`supabase.rpc(` direto vs 11 consumindo `src/lib/repositories/*`; regra escrita em `src/lib/repositories/README.md`; `src/lib/dpHoleriteRepo.ts` fora da pasta.
**Diagnóstico:** a camada anticorrupção existe, é boa e está documentada, mas é minoritária na prática.
**Impacto:** Alto — mudanças de schema exigem caça por dezenas de arquivos; convenção desmoralizada.
**Prioridade:** P1.
**Critérios de aceite:** (a) 100% das tabelas com repository designado; (b) zero `supabase.from(` em `src/pages` e `src/components` para tabelas cobertas (verificável por busca); (c) verificação automática impedindo reincidência; (d) `dpHoleriteRepo` residente em `repositories/`.

---

**ARC-004 — Duas máquinas de estado servidor** · Arquitetura · Etapa 4
**Evidências:** AppContext com fetch imperativo/otimismo manual (domínios PHP) × TanStack Query (domínios Supabase); fronteira não documentada em nenhuma convenção.
**Diagnóstico:** mesma responsabilidade, dois paradigmas, escolhidos pela origem do dado.
**Impacto:** Alto — dois modelos de cache/erro/otimismo; migrar entidade de backend implica trocar paradigma junto.
**Prioridade:** P1 (mesma cirurgia de ARC-002).
**Critérios de aceite:** (a) um único paradigma de dados-servidor consumido pelas telas; (b) origem PHP/Supabase invisível para componentes; (c) documento de convenção de dados atualizado.

---

**ARC-005 — Monólitos página/diálogo** · Arquitetura/Componentes · Etapas 4, 5
**Evidências:** `components/cards/CardGenericoDialog.tsx` 2.104 L; `pages/AprovacaoFinanceira.tsx` 1.399 L; `components/obra-detalhe/RevisoesTab.tsx` 1.174 L; `pages/QuadroBoard.tsx` 1.165 L; `PrevisaoTab` 966; `RdoTab` 868; `AllocationBoard` 819; `PacotesTrabalho` 811; `Board` 799; `EmployeeDPDialog` 779.
**Diagnóstico:** as features centrais são mini-apps monolíticos misturando UI+estado+dados+regra.
**Impacto:** Alto — custo máximo de mudança/revisão/conflito nos pontos mais quentes.
**Prioridade:** P1 (após ARC-001/003 firmarem tipos e dados).
**Critérios de aceite:** (a) nenhum dos 10 arquivos acima com responsabilidade múltipla UI+dados+regra no mesmo arquivo; (b) comportamento preservado (testes existentes verdes); (c) subcomponentes com contratos tipados.

---

**ARC-009 — Autorização em três sistemas** · Arquitetura · Etapa 4
**Evidências:** `canAccess` (acessos PHP por PageKey) no AppContext; `useObraMembership` (`obra_membros`); `has_role`/RLS/`user_empresas` no Supabase.
**Diagnóstico:** raciocinar "o que este usuário pode" exige três mecanismos; gate esquecido em tela nova é risco estrutural.
**Impacto:** Alto. **Prioridade:** P1.
**Critérios de aceite:** (a) API única de decisão de acesso consumida por menu, rotas e telas; (b) inventário de gates por tela documentado; (c) tela nova exige declaração de acesso no registro de navegação.

---

**DS-001 — Arquitetura de formulários ausente** · Design System · Etapas 3, 5
**Evidências:** `ui/form.tsx` com 0 usos; `useForm` em 1 arquivo, `zodResolver` em 0; validação imperativa + toast; mensagens sem padrão; máscaras parciais (`MaskedDateInput` 8, `money-input` 2).
**Diagnóstico:** a interação nº 1 do ERP não tem sistema — cada formulário re-decide validação, mensagens e estrutura.
**Impacto:** Crítico (para consistência futura) — cada tela nova amplia a entropia.
**Prioridade:** P1.
**Critérios de aceite:** (a) padrão único documentado de formulário (estrutura, validação, mensagens, obrigatoriedade); (b) 3 formulários de referência migrados (1 legado, 1 moderno, 1 novo); (c) inputs especiais (moeda, %, CNPJ, data) obrigatórios nos campos correspondentes; (d) mensagens de validação persistentes junto ao campo (não só toast).

---

**DS-002 — Duplo toast** · Design System · Etapas 3, 5
**Evidências:** sonner importado em 84 arquivos; `use-toast`/`toaster` em 9; ambos montados.
**Diagnóstico/Impacto:** duas infraestruturas para o mesmo feedback; divergência visível. Impacto Médio, custo Baixo.
**Prioridade:** P1 (quick win de consistência).
**Critérios de aceite:** (a) um único sistema em 100% dos arquivos; (b) o segundo removido do bundle; (c) busca por importações do removido retorna zero.

---

**DS-006 — Moeda sem fonte única** · Design System · Etapas 4, 5
**Evidências:** 32 páginas formatando BRL inline; `lib/money.ts` × `lib/currency.ts` sobrepostos; `ui/money-input` com 2 usos.
**Diagnóstico:** o dado mais sensível do ERP tem três caminhos de formatação e entrada.
**Impacto:** Alto (consistência financeira). **Prioridade:** P1 (custo Baixo).
**Critérios de aceite:** (a) módulo único de moeda (formatar/parsear/somar); (b) zero formatação BRL inline em páginas (verificável por busca); (c) todo campo monetário usando o input dedicado.

---

**DS-010 — Paginação inexistente** · Design System · Etapas 3, 5
**Evidências:** `ui/pagination` usado em 2 páginas (`ControleDespesas`, `AprovacaoFinanceira`); listas restantes renderizam tudo.
**Diagnóstico:** padrão de produto ausente para volume crescente (anos de lançamentos, NFs, cards).
**Impacto:** Alto (degradação previsível). **Prioridade:** P1.
**Critérios de aceite:** (a) padrão declarado de paginação/limite para listas; (b) aplicado às 5 listas de maior volume (M8 lançamentos, M8 faturamento, M3 medições/NFs, M2 tabela de cards, M9 ponto); (c) comportamento de filtros preservado com paginação.

---

**UX-001 — Telas sem porta + configurações fragmentadas** · UX/Navegação · Etapas 1, 2, 3
**Evidências:** rotas fora de menu/hub: `/suprimentos/insumos`, `/composicoes`, `/orcamento`, `/curva-abc`, `/suprimentos/grupos-gestao`, Alçadas; configurações espalhadas (alçadas M7, flags M14, empresas M15, estágios de funil M11, tipos de documento M10).
**Diagnóstico:** parte estruturante de M7 é indescobrível; não existe um lugar de "Configurações".
**Impacto:** Alto — módulo inteiro depende de conhecimento oral.
**Prioridade:** P1.
**Critérios de aceite:** (a) toda rota de `KNOWN_ROUTES` alcançável por menu, hub ou tela-pai visível; (b) ponto único de configurações agregando as existentes; (c) ⌘K deixa de ser o único caminho para qualquer tela.

---

**UX-004 — Escopo multiempresa silencioso** · UX/Multiempresa · Etapas 2, 3
**Evidências:** `EmpresaContext` + seletor global; filtro aplicado via obras vinculadas; módulos não ancorados em obra (M12, M13) sem indicação de aderência ao filtro.
**Diagnóstico:** o usuário não sabe, tela a tela, se o que vê respeita a empresa selecionada — falha silenciosa de escopo.
**Impacto:** Alto (decisão sobre dado errado).
**Prioridade:** P1.
**Critérios de aceite:** (a) inventário documentado de aderência por módulo; (b) indicação visível do escopo ativo nas telas; (c) módulos fora do filtro sinalizados como "todas as empresas".

---

**PRO-001 — Motivo de perda (CRM)** · Produto/M11 · Etapa 2
**Evidências:** `fechado_perdido` como mero estágio em `CRMFunil.tsx`; nenhuma captura de motivo (busca por "motivo" no CRM sem resultado pertinente).
**Diagnóstico:** o funil mede quanto se perde, não por quê.
**Impacto:** Alto (inteligência comercial). **Prioridade:** P1 (complexidade Baixa).
**Critérios de aceite:** (a) mover para perdido exige motivo (lista gerenciável + observação); (b) dashboard de conversão segmenta por motivo; (c) motivo visível no perfil da oportunidade.

---

**PRO-003 — Fechamento de competência (DP)** · Produto/M9 · Etapa 2
**Evidências:** Fopag (`pages/dp/Fopag.tsx`) exibe competências sem ação de fechamento; nenhuma trava pós-importação.
**Diagnóstico:** o mês nunca "fecha"; retro-edições silenciosas possíveis após custo publicado no EVM.
**Impacto:** Alto (integridade do custo). **Prioridade:** P1.
**Critérios de aceite:** (a) competência com estado aberto/fechado; (b) fechado bloqueia edição de holerites/tratativas/provisões do período; (c) reabertura só por perfil autorizado com auditoria.

---

**PRO-005 — Valor documental do RDO** · Produto/M6 · Etapa 2
**Evidências:** tabelas `rdo*` sem assinatura/aprovação; sem exportação PDF; sem numeração sequencial imutável.
**Diagnóstico:** o diário não substitui o documento formal exigido em contratos fiscalizados.
**Impacto:** Alto. **Prioridade:** P1.
**Critérios de aceite:** (a) RDO com numeração sequencial por obra; (b) fluxo de assinatura/aprovação (contratada e fiscal); (c) PDF fiel com fotos e assinaturas; (d) edição travada após aprovação.

---

**PRO-006 — Efetivo do RDO derivado do Board** · Produto/M6+M1 · Etapas 2, 3
**Evidências:** `components/obra/RdoTab.tsx` com digitação livre de efetivo; alocação do dia já existente em M1 (mobilizações).
**Diagnóstico:** redigitação diária de dado que o sistema possui.
**Impacto:** Alto (produtividade + divergência de dado). **Prioridade:** P1.
**Critérios de aceite:** (a) efetivo pré-preenchido pela alocação vigente da obra na data; (b) ajuste manual possível com diferença registrada; (c) tempo de preenchimento reduzido (validação com usuário).

---

**PRO-007 — Workflow ativo de NC** · Produto/M5 · Etapa 2
**Evidências:** `nao_conformidades` com tratativa 5W2H registrada; sem estados com responsável/prazo, sem reinspeção, sem notificação.
**Diagnóstico:** a NC é anotada, não gerida.
**Impacto:** Alto. **Prioridade:** P1.
**Critérios de aceite:** (a) ciclo de estados com responsável e prazo; (b) reinspeção/verificação de eficácia como etapa formal; (c) notificação de atribuição e atraso; (d) indicador de NCs vencidas no dashboard M5.

---

**PRO-009 — Cotação vencedora → OC conduzida** · Produto/M7 · Etapa 2
**Evidências:** `pages/suprimentos/Cotacoes.tsx` sem ação de gerar OC; `OrdensCompra.tsx` cria rascunho manual.
**Diagnóstico:** o elo central do procurement existe nos dados e não no fluxo.
**Impacto:** Alto. **Prioridade:** P1 (complexidade Baixa).
**Critérios de aceite:** (a) ação "gerar OC" a partir da proposta vencedora na tela de cotações; (b) OC nasce preenchida (fornecedor, itens, preços, requisição vinculada); (c) cotação marcada como convertida.

---

**PRO-010 — OC/cotação para o fornecedor** · Produto/M7 · Etapa 2
**Evidências:** nenhuma saída formal (PDF/e-mail) de OC ou pedido de cotação; `fornecedores` com contatos cadastrados.
**Diagnóstico:** o sistema compra sem falar com quem vende.
**Impacto:** Alto. **Prioridade:** P1.
**Critérios de aceite:** (a) OC exportável em PDF com identidade da empresa emissora; (b) envio registrado (quando/para quem); (c) pedido de cotação com a mesma capacidade.

---

**PRO-011 — Recebimento → obrigação financeira** · Produto/Integração · Etapa 2
**Evidências:** `recebimento_materiais` com NF; nenhum vínculo com `financeiro_lancamentos`/títulos.
**Diagnóstico:** a entrada física não cria o compromisso financeiro (sem three-way match).
**Impacto:** Alto. **Prioridade:** P1 (depende do desenho de PRO-013).
**Critérios de aceite:** (a) recebimento com NF gera pendência financeira rastreável à OC; (b) divergência OC×recebido×NF sinalizada; (c) M8 exibe origem "recebimento de material".

---

**PRO-013 — Conciliação TOTVS × lançamentos** · Produto/M8 · Etapa 2
**Evidências:** `financeiro_snapshots` (importação com hash/validação) coexistindo com `financeiro_lancamentos` manuais; badge de origem existe, reconciliação não.
**Diagnóstico:** quatro origens de número sem processo que as feche entre si.
**Impacto:** Alto (confiança no número). **Prioridade:** P1.
**Critérios de aceite:** (a) rotina de confronto snapshot×manuais por período/centro; (b) divergências listadas com estado (explicada/pendente); (c) indicador de período conciliado.

---

**PRO-018 — Importador BMS canônico** · Produto/M3 · Etapas 1, 2
**Evidências:** `lib/bms-excel.ts` sensível a layout; plano detalhado pendente em `.lovable/plan.md` (detecção dinâmica de colunas).
**Diagnóstico:** a porta de entrada da receita depende de layout fixo de planilha.
**Impacto:** Alto (operação mensal). **Prioridade:** P1 (plano já existe).
**Critérios de aceite:** (a) parser tolerante a variações de coluna/posição conforme plano; (b) fixtures das variantes reais passando; (c) relatório de importação aponta colunas reconhecidas/ignoradas.

---

**Fichas compactas (P2/P3)** — Evidência→Diagnóstico→Aceite em linha única:

- **ARC-006:** `lib/schemas/cliente.ts`→`ui/cnpj-input`; `MedicoesTab`→página FinObraDetalhe · direção de dependência violada · _Aceite:_ validação de CNPJ em `lib`; tipo compartilhado fora de página; regra automatizada de fronteira ativa.
- **ARC-007:** 35 soltos em `lib/` raiz e 35 em `components/` raiz · critério de organização ilegível · _Aceite:_ bms-*→domínio de medições; cards-*→`lib/cards`; dp*→`lib/dp`; `cpm`→`lib/cronograma`; raiz de components só com compostos de produto declarados.
- **ARC-008:** query keys ad-hoc · invalidação cruzada frágil · _Aceite:_ registro único de chaves por domínio; invalidações cruzadas (cards⇄suprimentos⇄obra) via registro.
- **ARC-010:** `services/` vestigial; hooks-por-domínio inconsistente · ruído de convenção · _Aceite:_ camada morta removida ou povoada por decisão documentada; uma convenção visível.
- **ARC-011:** 4 páginas órfãs (`Index`, `Ocorrencias`, `LicoesAprendidas` raiz, `Riscos` raiz) · peso morto · _Aceite:_ removidas ou roteadas; busca por importações confirma.
- **DS-003:** `confirm()` em Empresas, GMFeatureFlags, GruposNegociacao, InspecoesAgenda, GM · quebra de identidade/perigo · _Aceite:_ zero `window.confirm` no app; destrutivas com diálogo padrão.
- **DS-004:** spinner manual em 31 páginas; EmptyState em `components/obra/` · estados heterogêneos · _Aceite:_ EmptyState promovido a composto; QueryState (ou equivalente) nas listas principais dos 15 módulos; zero "spinner mudo" em telas de lista.
- **DS-005:** STATUS_LABEL/VARIANT ×15 · mudança de status = 15 arquivos · _Aceite:_ mapa central por domínio; telas consomem do mapa; busca confirma remoção dos locais.
- **DS-007:** StatCard por dashboard · face executiva divergente · _Aceite:_ KPI compartilhado adotado nos 6+ dashboards.
- **DS-008:** recharts cru ×24; `ui/chart` 0 usos · identidade manual · _Aceite:_ camada comum de gráfico (tema/tooltip/formatadores) adotada nos dashboards; decisão sobre `ui/chart` registrada.
- **DS-009:** tabela crua 24/28 · manutenção duplicada · _Aceite:_ padrão único de tabela (definição de colunas+overflow+densidade) nas 10 listas principais.
- **DS-011:** kanban ×6 · evolução sêxtupla · _Aceite:_ mecânica de quadro compartilhada servindo ao menos M7 e M11/M12/M13; M1 e M2 avaliados à parte.
- **DS-012:** casca de importador ×8 · cada importador do zero · _Aceite:_ shell comum (upload→prévia com erros→confirmar) adotado por ao menos 4 importadores.
- **DS-013:** `ui/form`/`ui/drawer`/`ui/chart` mortos; `busy-overlay` 1 uso · catálogo mente · _Aceite:_ cada peça com destino decidido (adotar/remover) e executado.
- **DS-014:** sem catálogo da biblioteca · duplicação por desconhecimento · _Aceite:_ catálogo navegável dos primitivos+compostos com regra de adoção.
- **DS-015:** sem escala de dialog/barra de filtros · variação estrutural · _Aceite:_ escala de tamanhos declarada; contêiner de filtros padrão nas listas migradas por DS-009.
- **DS-016:** 31 diálogos autofetchantes · sem reuso apresentacional · _Aceite:_ nos domínios refatorados por ARC-005, diálogos recebem dados por contrato e não buscam sozinhos.
- **UX-002:** ⌘K sem dados · expectativa padrão de ERP · _Aceite:_ busca global encontra ao menos obras, colaboradores, cards, NFs e fornecedores com navegação direta.
- **UX-003:** Desempenho×Previsão×Análise · três portas indistintas · _Aceite:_ rótulos/descrições distinguíveis sem abrir a aba (validação com usuário).
- **UX-005:** icon-only sem nome (22/28); DnD sem teclado; erro só em toast · exclusão de usuários · _Aceite:_ 100% de botões icônicos nomeados; alternativa de teclado documentada para mover cards; erros de formulário persistem junto ao campo (via DS-001).
- **UX-006:** 13 tabelas sem overflow; telas desktop-only não sinalizadas · quebra em telas menores · _Aceite:_ toda tabela com proteção de overflow; telas desktop-only com aviso/fallback.
- **UX-007:** Riscos/Lições ×2 níveis · fonte ambígua · _Aceite:_ relação portfólio×obra definida (visão consolidada vs cadastro) e refletida nas telas; sem telas gêmeas competindo.
- **UX-008:** sem ajuda contextual em EVM/PPC · curva de aprendizado sem apoio · _Aceite:_ glossário/tooltips nos indicadores analíticos de M3/M4.
- **UX-009:** sem favoritos/recentes · re-navegação diária manual · _Aceite:_ acesso rápido a itens recentes/fixados a partir do topo ou ⌘K.
- **UX-010:** `text-xs` universal · legibilidade executiva · _Aceite:_ escala tipográfica semântica definida; dashboards usando tamanho de leitura.
- **PRO-002:** sem follow-up · _Aceite:_ tarefa com data/responsável na oportunidade; pendências visíveis no dashboard M11.
- **PRO-004:** DP duplicado PHP×Supabase · _Aceite:_ fonte única por entidade declarada e migrada; telas legadas desligadas; dado histórico preservado.
- **PRO-008:** NC↛restrição/card · _Aceite:_ NC crítica oferece/gera vínculo em M4/M2 com rastreio bidirecional.
- **PRO-012:** sem inventário · _Aceite:_ contagem com ajuste auditado sobre `estoque_saldos`.
- **PRO-014:** sem DRE · _Aceite:_ demonstrativo por período/empresa a partir do plano de contas, exportável.
- **PRO-015:** TOTVS manual · _Aceite:_ importação agendável ou semiautomática com notificação de atraso (substitui o paliativo de idade).
- **PRO-016:** medição sem aceite · _Aceite:_ estados de medição com aprovação registrada (quem/quando) antes do faturamento.
- **PRO-017:** sem emissão de NF · _Aceite:_ decisão estratégica registrada (emitir × integrar emissor); se integrar, elo BMS→NF com número/status refletidos.
- **PRO-019:** sem alerta de renovação · _Aceite:_ alerta N dias antes do fim/reajuste, visível em M12 e notificações.
- **PRO-020:** contrato↛despesa · _Aceite:_ contrato ativo com recorrência gera previsão/lançamento em M8.
- **PRO-021:** sem anexo de contrato · _Aceite:_ arquivo do contrato anexável e versionado no registro.
- **PRO-022:** sem capacidade de MO · _Aceite:_ visão necessidade×alocado por obra/função com déficit destacado.
- **PRO-023:** sem mobilização em massa · _Aceite:_ seleção múltipla mobiliza N colaboradores em uma ação.
- **PRO-024:** sem preventiva · _Aceite:_ plano por km/horímetro/tempo gera pendência de manutenção.
- **PRO-025:** compromissos manuais · _Aceite:_ promoção lookahead→semana e "repetir semana anterior" disponíveis.
- **PRO-026:** Lean↛CPM · _Aceite:_ pacote vinculável a item de cronograma com leitura de aderência.
- **PRO-027:** sem automações de quadro · _Aceite:_ ao menos regras de movimentação→ação básicas por quadro.
- **PRO-028:** sem perfis de acesso · _Aceite:_ templates de perfil aplicáveis a usuários; matriz individual vira exceção.
- **PRO-029:** sem PDF de inspeção · _Aceite:_ relatório PDF com respostas, fotos e assinatura.
- **PRO-030:** notificações mínimas · _Aceite:_ catálogo de eventos notificáveis ampliado (NC, renovação, aprovação pendente, snapshot velho) com preferências.
- **PRO-031:** sem parametrização por empresa · _Aceite:_ logotipo/numeração por empresa aplicados às saídas (OC, RDO, inspeção).

---

## 4. Matriz de Dependências

### 4.1 Dependências obrigatórias (X depende de Y)

```
ARC-001 (tipos) ─────────────┬─► ARC-002 (god-context) ─► ARC-004 (estado único) ─► PRO-004 (DP fonte única)
                             ├─► ARC-003 (repositories) ─► ARC-005 (monólitos) ─► DS-016 (diálogos apresentacionais)
                             │                                        └─► DS-011 (kanban unificado)
                             ├─► DS-001 (formulários — beneficiado, não bloqueado)
                             ├─► UX-002 (busca global de dados)
                             └─► PRO-013 (conciliação) ─► PRO-011 (recebimento→financeiro)
                                                        └─► PRO-014 (DRE)
DS-002 (toast único) ─► DS-004 (estados) — mensagens padronizadas antes da varredura de estados
DS-004 + DS-010 ─► DS-009 (tabelas) — estados e paginação entram junto do padrão de tabela
DS-007 ─► DS-008 (KPI antes/junto de gráficos)
PRO-007 (workflow NC) ─► PRO-008 (NC→restrição/card)  e  usa PRO-030 (notificações)
PRO-009 (cotação→OC) ─► PRO-010 (OC→fornecedor)
ARC-009 (fachada de acesso) ─► PRO-028 (perfis)
UX-004 (escopo multiempresa) ─► PRO-031 (parametrização por empresa)
ARC-006/ARC-007 → sem dependentes; habilitam policiamento que protege tudo
```

### 4.2 Racional arquitetural das dependências-chave

1. **ARC-001 antecede quase tudo** porque religar o compilador reduz o risco e o custo de todas as cirurgias (repositories, god-context, monólitos, formulários tipados, busca global).
2. **ARC-002 e ARC-004 são a mesma operação** vista por dois ângulos (quem guarda o estado × como o estado é gerido); executá-las separadas duplicaria o retrabalho. **PRO-004 (DP)** é o primeiro domínio que só faz sentido migrar depois delas.
3. **ARC-005 antes de DS-011/DS-016**: não se extrai mecânica comum de kanban nem se torna diálogos apresentacionais enquanto os monólitos misturam tudo.
4. **PRO-013 é o desenho-mãe do financeiro**: three-way match (PRO-011) e DRE (PRO-014) pressupõem a reconciliação definida.
5. **Independentes e paralelizáveis desde já** (nenhuma dependência): DS-002, DS-003, DS-005, DS-006, DS-014, ARC-006, ARC-011, UX-001, UX-003, PRO-001, PRO-009, PRO-018, PRO-019, PRO-029.

## 5. MATRIZ DE IMPLEMENTAÇÃO (ordem recomendada para o Lovable)

| Ordem | ID           | Área         | Objetivo                                                                                 | Dependências      | Paralelizável?                |
| ----- | ------------ | ------------ | ---------------------------------------------------------------------------------------- | ----------------- | ----------------------------- |
| 1     | ARC-001      | Tipos        | Religar o compilador na metade Supabase                                                  | —                 | Base de tudo; iniciar sozinho |
| 2     | DS-002       | Feedback     | Toast único                                                                              | —                 | Sim (com 3–8)                 |
| 3     | DS-003       | Feedback     | Eliminar `confirm()` nativo                                                              | —                 | Sim                           |
| 4     | DS-006       | Moeda        | Fonte única de moeda + input dedicado                                                    | —                 | Sim                           |
| 5     | DS-005       | Status       | Mapa central de status                                                                   | —                 | Sim                           |
| 6     | PRO-001      | M11          | Motivo de perda                                                                          | —                 | Sim                           |
| 7     | PRO-009      | M7           | Cotação vencedora→OC                                                                     | —                 | Sim                           |
| 8     | PRO-018      | M3           | Importador BMS canônico (plano existente)                                                | —                 | Sim                           |
| 9     | ARC-003      | Dados        | Fechar bypass de repositories                                                            | ARC-001           | Sim (com 10–12)               |
| 10    | UX-001       | Navegação    | Dar porta às telas de M7 + configurações unificadas                                      | —                 | Sim                           |
| 11    | ARC-006      | Camadas      | Corrigir 2 inversões + regra de fronteira                                                | —                 | Sim                           |
| 12    | ARC-011      | Higiene      | Remover páginas órfãs                                                                    | —                 | Sim                           |
| 13    | DS-001       | Formulários  | Arquitetura única de formulário                                                          | ARC-001           | Sim (padrão), adoção contínua |
| 14    | DS-004       | Estados      | Varredura QueryState/EmptyState                                                          | DS-002            | Sim                           |
| 15    | DS-010       | Tabelas      | Padrão de paginação nas 5 maiores listas                                                 | —                 | Sim                           |
| 16    | ARC-009      | Autorização  | Fachada única de acesso                                                                  | —                 | Sim                           |
| 17    | UX-004       | Multiempresa | Sinalização e inventário de escopo                                                       | —                 | Sim                           |
| 18    | PRO-003      | M9           | Fechamento de competência                                                                | —                 | Sim                           |
| 19    | PRO-005      | M6           | RDO documental (assinatura/PDF/trava)                                                    | —                 | Sim                           |
| 20    | PRO-006      | M6+M1        | Efetivo derivado do Board                                                                | —                 | Sim                           |
| 21    | PRO-007      | M5           | Workflow ativo de NC                                                                     | PRO-030 (parcial) | Sim                           |
| 22    | PRO-010      | M7           | OC/cotação para fornecedor (PDF/envio)                                                   | PRO-009           | Sim                           |
| 23    | PRO-013      | M8           | Conciliação TOTVS×manuais                                                                | ARC-001           | Sim                           |
| 24    | PRO-030      | Transversal  | Ampliar catálogo de notificações                                                         | —                 | Sim                           |
| 25    | ARC-002      | Estado       | Desmontar god-context                                                                    | ARC-001           | **Não** — janela dedicada     |
| 26    | ARC-004      | Estado       | Paradigma único de dados-servidor                                                        | ARC-002           | **Não** — mesma janela de 25  |
| 27    | ARC-005      | Componentes  | Quebrar os 10 monólitos                                                                  | ARC-001, ARC-003  | Parcial (por arquivo)         |
| 28    | PRO-004      | M9           | DP fonte única (fim da dualidade)                                                        | ARC-002/004       | Após 25–26                    |
| 29    | PRO-011      | Integração   | Recebimento→financeiro (3-way)                                                           | PRO-013           | Sim                           |
| 30    | DS-009       | Tabelas      | Padrão único de tabela nas 10 principais                                                 | DS-004, DS-010    | Sim                           |
| 31    | DS-007/008   | Dashboards   | KPI + camada de gráficos                                                                 | —                 | Sim                           |
| 32    | UX-005/006   | A11y/Resp.   | Nomes acessíveis, teclado, overflow                                                      | DS-009 ajuda      | Sim                           |
| 33    | Demais P2    | vários       | UX-002/003/007; PRO-002/008/014/015/016/019/020/022/024/025/029; ARC-007/008; DS-012/014 | conforme fichas   | Sim (lotes)                   |
| 34    | P3 restantes | vários       | DS-011/013/015/016; UX-008/009/010; PRO-012/017/021/023/026/027/028/031; ARC-010         | conforme fichas   | Sim (contínuo)                |

---

## 6. RESUMO EXECUTIVO

**1. Consistência das auditorias:** Alta. Uma contradição factual encontrada e retificada (R1 — formulários), quatro sobreposições de registro (mesmo fato em duas etapas) consolidadas, nenhum diagnóstico conflitante de mérito. As Etapas 1–5 são mutuamente coerentes: a Etapa 2 aponta _o que falta_, a 3 _como dói_, a 4 e a 5 _por que custa caro_ — frequentemente sobre as mesmas raízes.

**2. Total de achados consolidados:** **68 IDs únicos** no catálogo (registros duplicados entre etapas foram fundidos sob um único ID cada; o mapa de deduplicação está na §1.2).

**3. Por categoria:** **PRO 31 · DS 16 · ARC 11 · UX 10 — total 68.**

**4. Por prioridade:** **P0: 1** (ARC-001) · **P1: 22** (ARC-002, ARC-003, ARC-004, ARC-005, ARC-009; DS-001, DS-002, DS-006, DS-010; UX-001, UX-004; PRO-001, PRO-003, PRO-004, PRO-005, PRO-006, PRO-007, PRO-009, PRO-010, PRO-011, PRO-013, PRO-018) · **P2: 27** · **P3: 18** — conferido contra a tabela-índice (§3.1): 1+22+27+18 = 68.

**5. Principais riscos:** (i) evoluir a metade nova sem religar tipos (ARC-001) multiplica custo de tudo; (ii) a migração do Backend PHP legado travar no god-context (ARC-002) perpetuando a dualidade que já dói no DP (PRO-004); (iii) entropia de formulários (DS-001) crescendo a cada feature; (iv) decisões financeiras sobre números não conciliados (PRO-013) e sobre escopo multiempresa silencioso (UX-004); (v) o produto continuar "mudo para fora" (PRO-005/010/029) limitando uso contratual/comercial.

**6. Principais áreas:** M3 Obra 360º e M2 Quadros são o patrimônio a proteger; M7 Suprimentos e M8 Financeiro concentram o maior valor por achado resolvido; M9 DP é a fronteira da migração; a camada transversal (tipos, formulários, feedbacks) é onde P0/P1 se acumulam.

**7. Principais dependências:** ARC-001 → (ARC-003 → ARC-005 → DS-011/016) e (ARC-002 → ARC-004 → PRO-004); PRO-013 → PRO-011/014; PRO-009 → PRO-010; DS-002 → DS-004 → DS-009.

**8. Prontidão para implementação:** **Alta.** Existem 12+ itens sem nenhuma dependência prontos para execução imediata e paralela (ordens 2–12 da matriz), um P0 claro e autocontido para abrir os trabalhos, e as duas janelas cirúrgicas (25–26) claramente demarcadas. Todos os 47 achados têm evidência, prioridade, complexidade e critérios de aceite verificáveis.

**9. Confirmação metodológica:** todas as auditorias futuras (performance, banco/SQL/RLS, segurança, testes, backend PHP, edge functions — lacunas registradas na §1.3) produzirão obrigatoriamente: Resumo Executivo, Evidências, Diagnóstico, Impacto, Prioridade (P0–P3), Complexidade, Dependências, Critérios de Aceite, novos registros no **Catálogo Mestre** (IDs contínuos, nunca reutilizados: próximos livres ARC-012+, DS-017+, UX-011+, PRO-032+, e novos prefixos PERF-/DB-/SEC-/TST-/BE- conforme a etapa) e atualização da **Matriz de Implementação**.

---

_Documento de consolidação. Nenhuma nova auditoria realizada; nenhum arquivo do projeto alterado. Este catálogo passa a ser a fonte oficial de rastreabilidade entre diagnóstico (Claude) e execução (Lovable)._
