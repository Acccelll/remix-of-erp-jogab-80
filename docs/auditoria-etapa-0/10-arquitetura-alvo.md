# 10 — Arquitetura Alvo (Alto Nível)

> Documento de diagnóstico/proposta. **Sem código ou migrations.** Baseado nas evidências de `08-matriz-reaproveitamento.md` e `09-matriz-roadmap.md`.

## 1. Diagnóstico que motiva a mudança

- `public.cards` já é um motor Kanban genérico embrionário (título, status, posição, prazo, comentários), mas está **contaminado por colunas de domínio** (`cronograma_item_id`, `grupo_negociacao_id`, `origem_externa`). Isso obriga a tabela `cards` a crescer a cada novo módulo do ERP que precisa de um card.
- Existem **41 arquivos de migração** com `card_id`, cada um implementando de forma isolada o relacionamento "card pertence a X". Não há tabela de vínculo comum, nem conceito de card pertencer a mais de um quadro.
- **Não existe** conceito de evento de domínio, outbox ou log de mudança de estado (0 ocorrências de `domain_event`/`outbox` no código). Reações a mudanças de card (notificação, automação, atualização de outro módulo) são feitas por acoplamento direto em hooks/componentes de frontend.
- A camada de repositório (`src/lib/repositories/*`) **já é respeitada de forma consistente**: 0 chamadas diretas `supabase.from(...)` em `pages`/`components`. Isso é a base sólida sobre a qual construir os serviços de domínio.
- RPCs atômicas (`emitir_oc_atomico`, `registrar_recebimento_atomico`, `fechar_bms_atomica`, etc.) mostram que o padrão "transação + validação no banco" já existe para os fluxos mais críticos — deve ser o padrão-referência, não a exceção.
- `localStorage` guarda hoje tanto preferência de UI (ex.: `permissoes:expanded`, painel expandido) quanto **estado operacional** que deveria ser server-side (`quadroAutomacoesDesativadas` — quais automações estão ligadas por quadro; baseline de performance de RPC). Isso quebra sincronização entre dispositivos/usuários.

## 2. Princípio central: Motor Kanban genérico + Extensões de domínio

A arquitetura alvo separa claramente duas camadas:

**Motor Kanban genérico** — conhece apenas conceitos universais de quadro: quadro, coluna/etapa, card, posição, capa, comentário, anexo, histórico, permissão de card. Não sabe o que é "ordem de compra" ou "pacote de cronograma". É reaproveitado por qualquer domínio do ERP que precise de fluxo visual tipo Kanban (Compras, Cronograma, RH, Qualidade etc.).

**Extensões de domínio por card** — cada módulo de negócio (Compras, Cronograma, Produção, Financeiro...) define sua própria extensão de dados amarrada a um card do motor genérico, sem alterar a tabela `cards`. A extensão é dona da fonte oficial daquele dado (ex.: quantidade e preço de uma cotação vivem na extensão de Compras, não em `cards`).

Consequência prática: um card nunca mais precisa ganhar uma coluna nova em `cards` para servir a um novo módulo — ele ganha uma linha em uma tabela de extensão nova, referenciando o card por vínculo.

## 3. Vínculos polimórficos (card ↔ registros de domínio)

Hoje cada domínio cria sua própria FK direta (`card_id` em 41 lugares). A arquitetura alvo introduz um conceito de **vínculo** como cidadão de primeira classe:

- Um vínculo conecta um card a **uma entidade de domínio identificada por tipo + id** (ex.: tipo=`ordem_compra`, id=`<uuid>`), permitindo que o mesmo tipo de relação sirva qualquer módulo sem nova tabela de junção a cada vez.
- Um card pode ter **múltiplos vínculos** (ex.: um card de "necessidade de compra" vinculado à obra, ao pacote de cronograma que o originou e à ordem de compra gerada depois).
- Uma mesma entidade de domínio pode aparecer em **múltiplos cards/quadros diferentes** através de vínculos distintos, sem duplicar o registro de negócio — resolvendo o requisito de "quadros virtuais sem duplicar cards" (ver seção 7).
- O vínculo carrega metadado de papel (`papel_do_vinculo`: origem, referência, consequência) para permitir navegação e trilha de proveniência entre módulos.

Esse desenho substitui o padrão atual de FK solta e resolve a ambiguidade de "qual módulo é dono do dado" — a resposta passa a ser sempre "a extensão de domínio", nunca `cards`.

## 4. Eventos de domínio

Diagnóstico: hoje toda reação a uma mudança (mover card, aprovar orçamento, registrar recebimento) é implementada ponto a ponto — cada tela que precisa saber de uma mudança busca o dado de novo (polling), ou a lógica de "o que fazer quando X acontece" fica dentro do componente de frontend.

Proposta:
- Toda mudança relevante de estado (card mudou de coluna, extensão de domínio mudou de status, vínculo criado/removido) publica um **evento de domínio** nomeado e versionado (ex.: `card.movido`, `ordem_compra.aprovada`, `recebimento.registrado`).
- Eventos são a única forma correta de acoplar módulos entre si: Notificações, Automações e Visões Consolidadas **assinam** eventos, nunca leem tabela de outro módulo diretamente.
- Eventos originados por RPCs atômicas (o padrão já existente e correto) devem ser emitidos dentro da própria transação que já garante atomicidade hoje (`emitir_oc_atomico` etc.), preservando a garantia de que evento e mudança de estado nunca ficam dessincronizados.
- Histórico de card (JÁ existe como necessidade visível em `HistoricoSection.tsx`, `ContratoHistoricoSection.tsx`, `PatrimonioHistoricoSection.tsx` — três implementações paralelas hoje) passa a ser uma **projeção derivada do stream de eventos**, não uma tabela alimentada manualmente por cada módulo.

## 5. Serviços e fonte oficial de cada dado

Princípio: **cada dado tem exatamente um dono**.

| Domínio | Serviço responsável | Fonte oficial de quê |
|---|---|---|
| Motor Kanban | Serviço de Quadros/Cards | Existência do card, coluna, posição, comentário, anexo |
| Vínculos | Serviço de Vínculos | Relação card ↔ entidade de domínio |
| Cronograma | Serviço de Cronograma | Datas planejadas, pacotes, reconciliação de avanço físico |
| Compras | Serviço de Compras (necessidades → cotação → OC → recebimento) | Status da compra, fornecedor, condição comercial |
| Estoque | Serviço de Estoque | Saldo, movimentação, transferência |
| Financeiro | Serviço Financeiro | Lançamento, aprovação, previsão de custo |
| Produção | Serviço de Produção | Apontamento de produção, subcards |
| Notificações | Serviço de Notificações | Fila de envio e leitura, nunca a regra que gera a notificação |
| Automações | Serviço de Automações | Regras "quando evento X, fazer ação Y" e seu estado ligado/desligado (hoje incorretamente em `localStorage`) |
| Permissões | Serviço de Permissões | Quem pode ver/mover/editar cada card e cada visão |

Frontend deixa de decidir "quem manda" — ele sempre lê a visão consolidada e escreve através do serviço dono, nunca direto em tabela de outro domínio (mantendo e generalizando o padrão de repositório que já existe hoje sem exceções).

## 6. Regras de negócio: sair do frontend

Diagnóstico: 140 ocorrências de palavras-chave de cálculo/validação/regra dentro de `src/components` e `src/pages`, concentradas em componentes gigantes (`CardGenericoDialog.tsx` com 2306 linhas, `PrevisaoTab.tsx` com 1329, `ContagensCiclicas.tsx` com 1960). Isso significa que hoje é possível dois clientes (web e uma futura integração) calcularem resultado diferente para a mesma regra.

Proposta: toda regra que decide **se uma transição é permitida** ou **qual o valor correto de um campo derivado** migra para:
1. RPC atômica no banco, quando a regra protege consistência transacional (padrão já validado — replicar o modelo das 8 RPCs existentes); ou
2. Serviço de domínio (camada intermediária), quando a regra é de orquestração entre módulos (ex.: decidir se uma necessidade de compra pode virar cotação).

Frontend mantém apenas regra de **apresentação** (o que habilitar/desabilitar visualmente, validação otimista antes de enviar).

## 7. Visões consolidadas / quadros virtuais sem duplicar cards

Diagnóstico: `AllocationBoard.tsx` (858 linhas) já é, na prática, uma tentativa de "quadro virtual" (visão especializada sobre cards), implementada de forma paralela e específica, sem generalização.

Proposta: uma **visão consolidada** é uma consulta declarativa sobre vínculos + extensões de domínio (ex.: "todos os cards de compra vinculados a esta obra, agrupados por status de cotação") que renderiza usando o mesmo motor Kanban genérico, mas **sem criar nenhuma linha nova em `cards`**. Isso permite:
- Um mesmo card físico aparecer simultaneamente no quadro do setor de origem e em uma visão consolidada por obra/gerência, sem duplicação e sem risco de divergência.
- Visões "por setor" (Etapa 21) e "lista consolidada" (Etapa 22) do roadmap serem instâncias desse mecanismo único, não construções ad-hoc como hoje.

## 8. Histórico

Hoje há pelo menos três implementações de histórico paralelas e não unificadas: `HistoricoSection.tsx` (comum, 533 linhas), `ContratoHistoricoSection.tsx` (567 linhas) e `PatrimonioHistoricoSection.tsx` (555 linhas) — evidência de que cada módulo reimplementa a mesma necessidade.

Proposta: histórico único, derivado do stream de eventos de domínio (seção 4), com um componente de apresentação genérico parametrizado por tipo de entidade — eliminando as reimplementações específicas por módulo.

## 9. Notificações

Diagnóstico: `NotificationBell.tsx` (993 linhas) mistura polling, agrupamento e regra de disparo dentro do componente de UI; edge functions `alertas-operacao` e `card-prazo-lembrete` já mostram o padrão correto de notificação assíncrona fora do frontend.

Proposta: Serviço de Notificações consome eventos de domínio, decide o que notificar e para quem (respeitando permissões), grava fila de notificação; frontend só lê a fila e marca como lida. `NotificationBell.tsx` é reduzido a componente de apresentação puro.

## 10. Automações

Diagnóstico: a única automação hoje mapeada (`useQuadroAutomacoesConfig.ts`) guarda **quais automações estão desativadas por quadro em `localStorage`** — ou seja, o estado de configuração de uma regra de negócio não é compartilhado entre usuários/dispositivos e se perde ao trocar de navegador.

Proposta: Serviço de Automações com regras persistidas server-side (evento gatilho → condição → ação), com estado de ativação por quadro auditável e visível a todos os usuários com permissão, substituindo o mecanismo local.

## 11. Permissões

Diagnóstico: `useCardPermissions.ts` já isola a regra de permissão de card do componente visual — é o único ponto do levantamento onde o padrão "regra fora do componente" já está bem aplicado. `RequireAccess` controla rotas em `App.tsx` por página inteira.

Proposta: generalizar esse padrão para permissão por **visão** e por **ação sobre card** (mover, editar extensão, ver campo sensível), não apenas por página, para suportar as visões consolidadas da seção 7 sem vazar dado entre setores.

## 12. Fonte de verdade para integrações externas (TOTVS/Trello)

Diagnóstico: existem 4 importadores independentes (`BmsImporter`, `CronogramaImporter`, `CronogramaSemanalImporter`, `ImportarTrelloDialog`) sem núcleo comum, e cadência de importação TOTVS hoje vive em `localStorage` no hook `useTotvsImportStatus.ts`.

Proposta: um serviço de Importação genérico (parse → preview → validação server-side → aplicação idempotente) reaproveitado pelos quatro fluxos; status/cadência de importação passa a ter registro server-side auditável (mantendo preferência de UI, se houver, separada do dado operacional).

## 13. Transacionalidade e idempotência — padrão a generalizar

As RPCs atômicas existentes (`emitir_oc_atomico`, `salvar_nf_atomica`, `registrar_recebimento_atomico`, `fechar_bms_atomica`, `criar_medicao_atomica`, `fn_estoque_transferir`, `fn_oc_aprovar`, `aprovar_orcamento_obra`) demonstram que o time já resolveu corretamente, para os fluxos mais críticos, o problema de "múltiplas escritas relacionadas precisam ser tudo-ou-nada". A arquitetura alvo eleva isso a exigência transversal:

- Toda operação que mexe em mais de uma tabela (ou emite mais de um evento) é uma RPC/transação server-side, nunca uma sequência de chamadas de repositório do frontend.
- Toda operação disparada por evento externo (webhook, importação, retry de notificação) é idempotente por identificador de origem, replicando o cuidado já visível em `totvs-import-validar`.

---

## Resumo visual da camada alvo

```
Frontend (apresentação + validação otimista)
        │
        ▼
Serviços de domínio (Compras, Cronograma, Estoque, Financeiro, Produção, Notificações, Automações, Permissões)
        │                                  ▲
        ▼                                  │ assina
RPCs/transações atômicas no banco ──> Eventos de domínio ──> Notificações / Automações / Histórico / Visões consolidadas
        │
        ▼
Motor Kanban genérico (boards, cards, colunas, posição)  +  Vínculos polimórficos  +  Extensões de domínio por card
```
