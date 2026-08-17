# ETAPA 7 — Auditoria do Gerenciamento de Estado e Fluxo de Dados — Planifik

**Perspectiva:** Auditor Técnico / Arquiteto de Software
**Metodologia:** padrão Etapa 5.5. Novo prefixo desta etapa: **EST-** (estado/fluxo de dados). IDs anteriores intocados; sobreposições resolvidas por enriquecimento de fichas existentes (indicado explicitamente), nunca por novo ID duplicado.
**Regra:** somente auditoria; nada foi alterado. Fora de escopo: regras de negócio, banco/SQL, performance, UX, segurança, testes.

---

## 1. Estratégia de Estado — o que realmente existe

| Mecanismo                            | Onde                                                                                                                                                                                        | Papel                                                                                                                                                      | Por que parece ter sido escolhido                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TanStack Query 5**                 | domínios Supabase (geração moderna)                                                                                                                                                         | estado servidor: fetch, cache, invalidação                                                                                                                 | padrão do ecossistema; defaults saudáveis no `App.tsx` (staleTime 60 s, gcTime 5 min, sem refetch on focus) + **26 ajustes finos de `staleTime` por consulta** |
| **Context API — `AppContext`**       | domínios do Backend PHP legado                                                                                                                                                              | estado servidor **manual**: `loadAll()` com `Promise.all` no login carrega TODOS os domínios PHP para a memória; mutações otimistas locais + chamada à API | herança da geração legada (pré-Query)                                                                                                                          |
| **Context API — `EmpresaContext`**   | escopo multiempresa                                                                                                                                                                         | seleção persistida + Query para empresas + helpers de filtro                                                                                               | correto por desenho; **fio desligado** (ver EST-002)                                                                                                           |
| **Context API — `ThemeContext`**     | tema                                                                                                                                                                                        | trivial e correto                                                                                                                                          | —                                                                                                                                                              |
| **Estado local (`useState`)**        | telas e diálogos                                                                                                                                                                            | formulários, seleção, UI                                                                                                                                   | universal; sem cópias locais de dados de servidor detectadas (busca pelo antipadrão "useEffect→setState(data)" retornou zero — positivo)                       |
| **IndexedDB (`lib/offline`)**        | RDO e Inspeções                                                                                                                                                                             | filas `sync_queue`/`media_queue` + `drafts` — máquina de estados explícita com backoff e upsert idempotente por UUID                                       | offline-first de campo                                                                                                                                         |
| **localStorage**                     | tokens de sessão (AppContext/Reauth), empresa selecionada, preferências de sidebar/visões (Layout, AllocationBoard, FinObras…), onboarding, baseline EWMA de p95 de RPC (`rpc-baseline.ts`) | persistência leve de sessão/preferência/telemetria                                                                                                         | conveniência                                                                                                                                                   |
| **Event bus mínimo (window events)** | `planifik:status` (saúde do gateway PHP → banner), `auth:expired` (401 → ReauthDialog)                                                                                                      | comunicação infra→UI sem acoplamento de import                                                                                                             | gateway não pode importar UI — solução correta                                                                                                                 |
| **Supabase Realtime**                | **apenas** `QuadroBoard` (canal por board: `card_board_posicao` + `board_listas`)                                                                                                           | colaboração ao vivo na única superfície verdadeiramente multiusuário-simultâneo                                                                            | escopo deliberado e econômico                                                                                                                                  |
| Ausentes                             | Zustand/Redux/Jotai/SWR/signals                                                                                                                                                             | —                                                                                                                                                          | —                                                                                                                                                              |

**Estratégia única?** Não — **duas estratégias completas segregadas por backend** (já catalogado como ARC-004), mais os satélites acima. A novidade desta etapa é o retrato do _fluxo_ de cada uma (§4) e três defeitos de fluxo próprios (§10).

## 2. Estado Local · Global · Providers · Contexts

- **Local:** uso correto e disciplinado; nenhum abuso sistêmico encontrado; a lógica de negócio em componentes existe, mas via monólitos (ARC-005/BIZ-001), não via inflação de useState.
- **Global:** o que é global de fato — sessão, permissões, empresa, tema — **deveria** ser global ✔; o que **não deveria** e é: os 10 domínios PHP inteiros, residentes em memória desde o login (`loadAll`), com atualidade congelada até refresh manual/re-login. Consequências de fluxo: (a) pegada de memória proporcional à base inteira do legado; (b) **staleness estrutural** — edições de outro usuário nos domínios PHP são invisíveis durante toda a sessão; (c) qualquer `set*` re-renderiza a árvore de 86 consumidores. _(Registrado como evidência adicional de ARC-002/ARC-004 — sem novo ID.)_
- **Providers:** árvore mínima e correta (Query→Theme→App→Empresa); dependência declarada e unidirecional (Empresa depende de App para `currentPlayer` — aceitável); sem aninhamento excessivo. O problema não é a árvore, é o conteúdo de um nó (ARC-002).
- **Contexts:** objetivos claros em Theme/Empresa; AppContext abrangente demais (catalogado); **EmpresaContext subutilizado ao extremo** — ver EST-002; sem sobreposição entre contexts.

## 3. Custom Hooks (ótica de fluxo)

- Transversais (`useUrlState`, `useTableSort`, `useOnlineStatus`, `useSyncQueueStatus`, `useFeatureFlag`, `useObraMembership`): encapsulam estado com um propósito, reutilizados, sem ciclos — saudáveis.
- `contexts/app/use*State` (12): são a _máquina_ legada — fetch imperativo + otimismo manual; concentram responsabilidade por construção (ARC-002).
- `hooks/financeiro/*`: padrão "hook de domínio sobre Query" — o embrião do modelo certo, não replicado (já em ARC-010).
- Dependência circular: nenhuma encontrada.

## 4. Ciclo de Vida dos Dados — fluxos reais mapeados

**Pipeline A — Geração moderna (Supabase):**

```
Postgres ──(repository ou from() direto [ARC-003])──► TanStack Query cache
   ▲                                                        │ staleTime 60s (26 exceções afinadas)
   │ RPC atômica p/ regras críticas                          ▼
   └── mutação (página/diálogo) ◄── UI ◄── render ◄── select/useMemo local
            │
            └─► invalidateQueries (171 chamadas / 46 arquivos, chaves ad-hoc [ARC-008]) ─► refetch
Exceções: Realtime no QuadroBoard (push→invalidate); setQueryData em 1 único ponto (sem otimismo no lado Query — padrão conservador, previsível)
```

**Pipeline B — Geração legada (Backend PHP):**

```
Login ─► loadAll(): Promise.all de TODOS os domínios ─► arrays em AppContext (memória)
UI lê do contexto ─► mutação: set local OTIMISTA ─► api.update/remove
                                    │
                                    ├─ sucesso: nada a fazer (estado já "certo")
                                    └─ falha: console.error — SEM rollback, SEM aviso [EST-001]
Atualidade: congelada até loadAll manual/re-login; concorrência multiusuário invisível
```

**Pipeline C — Offline (RDO/Inspeções):**

```
Form ─► draft (IndexedDB) ─► sync_queue (UUID do cliente = PK remota → upsert idempotente, FIFO, backoff)
fotos ─► media_queue ─► Storage ─► pai referencia URL só após concluir
reconexão ─► sync-runner ─► banners de status ─► GM Saúde
```

Pipeline C é o mais bem especificado dos três — máquina de estados explícita com resolução de concorrência por idempotência.

**Persistências satélites:** preferências e sessão em localStorage — com **três prefixos de marca simultâneos** (`obraflow.`, `buildflow:`, `planifik:`) sem inventário (EST-003).

## 5. Fontes da Verdade

| Dado                | Fonte(s)                                     | Situação                                                                                                     |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Domínios Supabase   | Postgres → cache Query                       | ✔ única, com janela de staleness declarada                                                                   |
| Domínios PHP        | MySQL remoto → **cópia integral em memória** | 🟡 duas cópias por construção; a da memória mente em falha de mutação (EST-001) e envelhece a sessão inteira |
| Obra                | PHP (dona) + espelho Supabase (`sync-obra`)  | 🟡 dupla escrita assumida com reparo automático — funcional, dependente de disciplina do sync                |
| Empresa selecionada | EmpresaContext + localStorage                | ✔ única — porém **não consumida** pelo fluxo de dados (EST-002)                                              |
| Cards/posições      | Postgres com RPC atômica + Realtime no board | ✔ exemplar                                                                                                   |
| Estado derivado     | `useMemo` locais; sem camada de seletores    | 🟡 duplicação já comprovada num caso executivo (BIZ-001); demais derivações são locais e baratas             |

## 6. Cache, Invalidação e Sincronização

- **Estratégia de cache:** clara e conservadora no Pipeline A (invalidate→refetch, quase zero otimismo) — previsível, à custa de refetches largos; inexistente como conceito no Pipeline B (a "cache" é o estado global eterno).
- **Invalidação:** consistente em intenção, frágil em mecânica — 171 chamadas espalhadas por 46 arquivos de UI com strings ad-hoc; invalidações cruzadas entre módulos integrados (cards⇄suprimentos⇄obra) dependem de memória do autor. _(Enriquece ARC-008 com números de fluxo; sem novo ID.)_
- **Sincronização UI⇄cache:** correta no A; **quebrada no B em caso de falha** (EST-001); manual repetitiva apenas na fronteira Obra (sync-obra — aceitável e catalogada na estratégia de migração).
- **Concorrência:** resolvida por idempotência no C; por Realtime no board; ignorada no B (last-write-wins invisível).
- **Cache redundante/desnecessário:** nenhum caso além da cópia integral do B (que é o próprio ARC-004).

## 7. Comunicação entre Módulos

Mecanismos observados, do mais ao menos usado: (1) invalidação de chaves alheias (implícita, não registrada — risco ARC-008); (2) navegação com estado em URL (`?tab=`, `?cView=`, prefill CRM→Obra) — explícita e boa; (3) event bus mínimo (2 eventos, infra→UI) — correto; (4) Realtime (1 superfície). Dependência implícita perigosa: um módulo alterar dados que outro exibe **sem** conhecer a chave a invalidar — o registro central (ARC-008) é a resposta já catalogada.

## 8. Escalabilidade do Estado

- **Novos módulos:** Pipeline A absorve bem (receita provada).
- **Mais usuários simultâneos:** A ok (staleness de 60 s aceitável + Realtime onde dói); **B não** — snapshot de login ignora o colega de trabalho.
- **Mais telas:** A ok; B agrava re-render global.
- **Mais integrações:** filas offline e RPCs dão o molde certo.
- **Mais desenvolvedores:** o risco número 1 é o de sempre — dois paradigmas + invalidação por memória oral; o número 2 é copiar o otimismo-sem-rollback do B por imitação.

## 9. Padrões Positivos (com evidências)

1. **Defaults de Query sensatos e afinados** — política global no `App.tsx` + 26 `staleTime` cirúrgicos.
2. **Zero cópia local de dado de servidor** — nenhuma ocorrência do antipadrão useEffect→setState(data).
3. **Realtime cirúrgico** — só onde há colaboração simultânea real (board), com filtro por `board_id`.
4. **Pipeline offline exemplar** — idempotência por UUID do cliente, filas separadas de dado e mídia, backoff, visibilidade em banner e no GM Saúde.
5. **Event bus mínimo e justificado** — infra fala com UI sem importá-la.
6. **URL como estado compartilhável** — deep links por toda parte.
7. **Mutação crítica sem otimismo** — regras financeiras/BMS vão à RPC e voltam por invalidação: conservador e correto para dinheiro.

## 10. NOVOS ACHADOS (Catálogo Mestre — prefixo EST-)

**EST-001 — Otimismo sem rollback nos domínios PHP** · Estado/Fluxo · Etapa 7
**Evidências:** `contexts/app/useColaboradoresState.ts` — `deleteColaborador` remove do estado **antes** da API e, em falha, apenas `console.error` (sem rollback, sem toast); padrão replicado nos 12 `use*State` da geração legada (mutações `set` otimistas com tratamento de erro heterogêneo).
**Diagnóstico:** em falha de rede/servidor, a UI mostra um mundo que o servidor não aceitou — o registro "excluído" volta no próximo login; edições "salvas" somem. O usuário não é avisado.
**Impacto:** Alto — divergência silenciosa entre o que o usuário viu e o que existe, nos cadastros-mestre (colaboradores, obras, veículos, contratos).
**Prioridade:** P1. **Complexidade:** Média (interina) — a solução definitiva é absorvida por ARC-002/ARC-004, mas o defeito é grave demais para esperar a cirurgia. **Dependências:** nenhuma para a correção interina; convergirá com ARC-004. **Isolável:** Sim (por hook de estado).
**Critérios de aceite:** (a) toda mutação otimista da geração legada reverte o estado local em falha; (b) falha comunicada ao usuário (mensagem padrão de erro); (c) comportamento coberto por teste (falha simulada → estado restaurado); (d) ao concluir ARC-004, esta ficha é encerrada por absorção.

**EST-002 — Escopo multiempresa não flui para os dados** · Estado/Fluxo · Etapa 7
**Evidências:** `EmpresaContext` expõe `obraIdsDaEmpresa` e `filtrarObras` (documentados no próprio arquivo como o mecanismo de recorte); busca em todo o `src`: **nenhum consumidor** além do próprio contexto — `useEmpresa()` é importado apenas por `EmpresaSelector` (o dropdown). Nenhuma página/consulta usa o filtro.
**Diagnóstico:** do ponto de vista do fluxo de dados, o seletor de empresa persiste uma escolha que **não altera dado nenhum exibido pelo cliente**. Se algum recorte ocorre, ocorre por outro caminho não conectado à seleção (ex.: RLS por vínculo — que ignoraria a troca de empresa de um usuário multi-vínculo e o modo "Todas" do GM). Em qualquer hipótese, o circuito declarado seleção→filtro→consulta **não fecha** — é a confirmação, em nível de mecanismo, do risco apontado em UX-004 (que tratava da sinalização; aqui trata-se do próprio fio).
**Impacto:** **Crítico** — usuário multiempresa toma decisão acreditando ver o recorte da empresa selecionada.
**Prioridade:** P1 (execução imediata; P0 permanece reservado ao pré-requisito ARC-001 conforme convenção do catálogo). **Complexidade:** Média. **Dependências:** nenhuma técnica; UX-004 passa a depender deste (sinalizar escopo só faz sentido depois que o escopo existir de fato). **Isolável:** Sim.
**Critérios de aceite:** (a) inventário módulo a módulo de qual recorte se aplica (por obra vinculada / global / fora de escopo); (b) a seleção de empresa altera comprovadamente os dados das listas ancoradas em obra (teste com usuário de 2 empresas); (c) modo "Todas" (GM) comprovadamente sem recorte; (d) helpers do contexto consumidos pelas consultas ou substituídos por mecanismo equivalente documentado; (e) UX-004 executada na sequência (sinalização do escopo agora real).

**EST-003 — Persistência local sem inventário e com três prefixos de marca** · Estado/Fluxo · Etapa 7
**Evidências:** chaves de localStorage com prefixos `obraflow.` (EmpresaContext), `buildflow:` (rpc-baseline), `planifik:` (eventos/status), além de chaves sem prefixo (preferências de board/telas, onboarding, tokens†). († tokens: tratamento na etapa de Segurança.)
**Diagnóstico:** o armazenamento local cresceu sem convenção — três marcas históricas convivem, não há inventário do que se persiste nem política de limpeza/versionamento (um único caso versionado: `rpc-p95-baseline:v1`).
**Impacto:** Baixo — risco de colisão/lixo residual e confusão em suporte/debug.
**Prioridade:** P3. **Complexidade:** Baixa. **Dependências:** nenhuma. **Isolável:** Sim.
**Critérios de aceite:** (a) inventário documentado de todas as chaves persistidas (chave, dono, ciclo de vida); (b) prefixo único de produto com migração das chaves vivas; (c) chaves órfãs limpas no boot.

_(Sem novo ID, por sobreposição consciente: staleness/eager-load do Pipeline B → evidência anexada a ARC-002/ARC-004; invalidação dispersa 171×46 com chaves ad-hoc → evidência anexada a ARC-008.)_

## 11. Matriz de Maturidade — Estado e Fluxo

| Área                                         | Organização | Consistência        | Escalabilidade | Manutenibilidade | Maturidade |
| -------------------------------------------- | ----------- | ------------------- | -------------- | ---------------- | ---------- |
| Estado Local                                 | ★★★★★       | ★★★★☆               | ★★★★★          | ★★★★★            | ★★★★★      |
| Estado Global (sessão/tema/empresa)          | ★★★★☆       | ★★★☆☆ (fio EST-002) | ★★★★☆          | ★★★★☆            | ★★★☆☆      |
| Estado Global (domínios PHP)                 | ★★☆☆☆       | ★★☆☆☆               | ★☆☆☆☆          | ★★☆☆☆            | ★★☆☆☆      |
| Providers (árvore)                           | ★★★★★       | ★★★★★               | ★★★★☆          | ★★★★★            | ★★★★★      |
| Contexts (conteúdo)                          | ★★☆☆☆       | ★★★☆☆               | ★★☆☆☆          | ★★☆☆☆            | ★★☆☆☆      |
| Hooks                                        | ★★★★☆       | ★★★★☆               | ★★★★☆          | ★★★★☆            | ★★★★☆      |
| Cache (Query)                                | ★★★★☆       | ★★★★☆               | ★★★★☆          | ★★★☆☆ (chaves)   | ★★★★☆      |
| Sincronização (invalidação/realtime/eventos) | ★★★☆☆       | ★★★☆☆               | ★★★☆☆          | ★★★☆☆            | ★★★☆☆      |
| Persistência (offline)                       | ★★★★★       | ★★★★★               | ★★★★☆          | ★★★★☆            | ★★★★★      |
| Persistência (localStorage)                  | ★★☆☆☆       | ★★☆☆☆               | ★★★☆☆          | ★★★☆☆            | ★★☆☆☆      |
| Fluxo de Dados (fim a fim)                   | ★★★☆☆       | ★★★☆☆               | ★★★☆☆          | ★★★☆☆            | ★★★☆☆      |

## 12. Atualização da Matriz de Implementação

| Ordem sugerida                                  | ID          | Área               | Objetivo Arquitetural                                                       | Impacto | Prioridade | Complexidade | Dependências                      | Isolável? | Critérios de Aceite |
| ----------------------------------------------- | ----------- | ------------------ | --------------------------------------------------------------------------- | ------- | ---------- | ------------ | --------------------------------- | --------- | ------------------- |
| **imediata — junto às ordens 2–8 (quick wins)** | **EST-002** | Multiempresa       | Fechar o circuito seleção→filtro→consulta; escopo real antes de sinalização | Crítico | P1         | Média        | — (UX-004 passa a depender deste) | Sim       | ficha §10           |
| junto à ordem 9 (janela de dados)               | **EST-001** | Estado legado      | Mutações otimistas com rollback+aviso até a absorção por ARC-004            | Alto    | P1         | Média        | — (absorvido por ARC-004 ao fim)  | Sim       | ficha §10           |
| lote de higiene P3 (ordem 34)                   | **EST-003** | Persistência local | Inventário + prefixo único + limpeza                                        | Baixo   | P3         | Baixa        | —                                 | Sim       | ficha §10           |

**Reordenação decorrente:** UX-004 (sinalização de escopo) muda de "ordem 17" para **imediatamente após EST-002** — sinalizar um filtro que não filtra agravaria o problema. Nenhuma outra ordem alterada.

## 13. Plano Diretor do Gerenciamento de Estado

**Visão:** o estado do Planifik são **três pipelines**: o moderno (Query — saudável, conservador, com chaves frágeis), o legado (snapshot global otimista — os defeitos graves moram aqui) e o offline (o mais maduro dos três). A direção não é adotar tecnologia nova: é **aposentar o Pipeline B no paradigma do A** (já catalogado: ARC-002→ARC-004), consertando antes os dois fios desencapados que não podem esperar a cirurgia: o filtro de empresa que não filtra (EST-002) e o otimismo que mente em falha (EST-001).

**Riscos principais:** decisão sob escopo errado (EST-002); divergência silenciosa UI×servidor no legado (EST-001 + staleness do snapshot); invalidação cruzada por memória oral (ARC-008); dois paradigmas ensinando dois reflexos a cada dev novo (ARC-004).

**Pontos fortes a preservar:** disciplina de estado local; árvore de providers mínima; Query bem calibrado; Realtime cirúrgico; offline com idempotência; URL como estado; mutações financeiras sem otimismo.

**Sequência recomendada ao Lovable (consolidada):** ARC-001 → **EST-002 → UX-004** (par inseparável, junto aos quick wins) → quick wins já ordenados (DS-002/003/005/006, BIZ-004, PRO-001/009/018) → **EST-001** na janela de dados (com ARC-003+BIZ-002) → programa de validação (DS-001+BIZ-003) → BIZ-001 → ARC-005 → janela cirúrgica ARC-002+ARC-004 (encerra EST-001 por absorção) → PRO-004 → demais ordens da Etapa 5.5 inalteradas → EST-003 no lote final de higiene.

---

# RESUMO EXECUTIVO

**1. Visão geral:** três pipelines de dados convivem — Query (moderno, conservador e bem calibrado), snapshot global do legado (carga integral no login, otimismo sem rede de segurança) e offline (o mais bem especificado do sistema). A árvore de providers é mínima e correta; o conteúdo de um provider concentra os problemas já conhecidos; e esta etapa encontrou **dois fios desligados** que nenhuma etapa anterior podia ver: o filtro multiempresa que não alcança os dados e o rollback que não existe.

**2. Organização: ★★★★☆** — mecanismos certos nos lugares certos, com um nó superlotado (catalogado).

**3. Previsibilidade: ★★★☆☆** — alta no Pipeline A (invalidate→refetch, quase zero otimismo) e no C (idempotência); baixa no B (falha silenciosa, staleness de sessão).

**4. Consistência: ★★★☆☆** — dois paradigmas por origem de dado; dentro de cada um, consistente.

**5. Escalabilidade: ★★★★☆ no A e C; ★☆☆☆☆ no B** — mais usuários simultâneos é exatamente o cenário que o snapshot de login não suporta.

**6. Principais riscos:** decisões sob escopo de empresa irreal (EST-002 — Crítico); UI divergindo do servidor em falha no legado (EST-001); invalidação cruzada dependente de memória (ARC-008); paradigma duplo perpetuado (ARC-004).

**7. Principais pontos fortes:** offline com filas idempotentes e visibilidade operacional; Realtime cirúrgico no board; Query com defaults e afinações corretas; zero cópia local de dado de servidor; URL como estado; dinheiro sem otimismo.

**8. Novos achados: 3** (EST-001 P1 · EST-002 P1/Impacto Crítico · EST-003 P3) + 3 enriquecimentos de fichas existentes (ARC-002, ARC-004, ARC-008) sem novos IDs.

**9. Catálogo Mestre atualizado:** 72 → **75 achados** (PRO 31 · DS 16 · ARC 11 · UX 10 · BIZ 4 · **EST 3**). Prioridades: P0 1 · P1 **27** · P2 28 · P3 **19**.

**10. Matriz de Implementação atualizada:** EST-002 promovido ao bloco imediato (com UX-004 reposicionada logo após); EST-001 na janela de dados; EST-003 no lote final. Demais ordens preservadas.

**11. Conclusão:** à pergunta — _"os dados fluem de maneira consistente, previsível, escalável e sustentável?"_ — a resposta é **sim em dois dos três pipelines, e não no legado**; e, transversal a tudo, um alerta que não admite fila: hoje o dado mais importante que o usuário escolhe (a empresa) **não flui**. Fechar esse circuito e dar rede de segurança ao otimismo legado são as duas ações de estado que devem andar na frente de qualquer refatoração maior.

---

_Auditoria conforme metodologia da Etapa 5.5. Nenhum arquivo alterado. Banco de dados, RLS, performance, segurança (incl. tokens em localStorage) e testes permanecem reservados às suas etapas._
