# Auditoria Etapa 0 — Compras, Cotações, OC, Recebimento, Estoque/Almoxarifado, Transferências e Produção

**Escopo:** `src/pages/suprimentos/*`, `src/components/suprimentos/*`, `src/hooks/suprimentos/*`,
`src/lib/estoque/*`, `src/lib/repositories/{requisicoes,fornecedores,insumos,suprimentos}.ts`,
`src/lib/recursos/*`, tabelas `card_recursos`, `card_setores`, `card_local`, `lead_time_templates`,
`ordens_compra`, `recebimento_materiais`/`recebimento_itens`, `estoque_saldos`/`estoque_movimentacoes`,
migrations em `supabase/migrations/`.

**Método:** leitura direta de migrations SQL (DDL, triggers, RPCs) e do código-fonte React/TS. Nenhum
código ou migration foi alterado. Este documento é só diagnóstico.

---

## 1. Inventário de entidades encontradas

| Camada | Entidade | Arquivo/migration | Observação |
|---|---|---|---|
| Cards (pool único) | `cards`, `card_recursos` | `20260624142446_...sql` | Modelo de "card de recurso" central do fluxo |
| Cards | `card_setores` | idem | Multi-setor por card, `subsetor` único (Solda/Corte/Dobra) |
| Cards | `card_local` | `20260630131600_...sql` | Geolocalização (endereço/lat/lng) — **não é "local de estoque"** |
| Cards | `lead_time_templates` | `20260624142446_...sql` | Templates de prazo por `tipo_recurso` |
| Cards | `card_membros`, `card_comentarios`, `card_checklist_itens`, `card_anexos` | `20260624142446/20260625192328` | Não há `card_pai`/subcard nem tabela de dependências entre cards |
| Suprimentos estruturado | `fornecedores`, `requisicoes`, `cotacoes`, `cotacao_propostas` | `20260616112645_...sql` | Requisição nasce do orçamento/card |
| Suprimentos estruturado | `ordens_compra`, `ordem_compra_itens` | idem | OC "nativa" do JOGAB |
| Suprimentos estruturado | `recebimento_materiais`, `recebimento_itens` | idem | Recebimento físico de OC |
| Suprimentos estruturado | `estoque_saldos`, `estoque_movimentacoes` | idem | Estoque simples (saldo único, sem reserva) |
| Financeiro (homônimo) | `recebimentos` | `20260616112645_...sql` (Onda A-01) | **Tabela distinta**: contas a receber (nota_fiscal_id), nada a ver com recebimento de materiais |
| Transferência | `fn_estoque_transferir` (RPC) | `20260626140848_...sql` | Move saldo entre dois valores de texto livre em `local` |

Não encontradas: `ordem_producao`/`ordens_producao`, `estoque_reservas`, `estoque_saldo_disponivel`,
`transferencias` (tabela dedicada — existe só a função RPC), `cotacao_itens` (os itens da cotação
vivem implicitamente via `requisicao_id` 1:1 por cotação).

---

## 2. `card_recursos` representa linha de necessidade multi-item?

**Não.** `card_recursos` é **1:1 com `cards`** (`card_id UUID PRIMARY KEY REFERENCES cards(id)`) e tem
colunas **singulares**: `tipo_recurso`, `quantidade` (uma só), `unidade`, `especificacao`,
`valor_estimado`, `valor_oc`. Não existe uma tabela `card_recurso_itens`.

- **Modelo real:** 1 card = 1 item/necessidade (material, serviço ou equipamento) — não uma "linha de
  necessidade" com múltiplos insumos. Um pacote de compra com N itens exige N cards (ou N
  `requisicoes` ligadas a cards diferentes).
- Já a tabela de negócio downstream (`requisicoes` → `ordem_compra_itens`) é sim multi-item por OC:
  `ordem_compra_itens.ordem_compra_id` permite múltiplas linhas por OC, cada uma referenciando uma
  `requisicao_id` (0..1) e um `insumo_id` (nullable).

**Risco:** confusão de granularidade entre "card" (Kanban, uma necessidade) e "requisição/OC" (documento
comercial, multi-item). Está coerente **desde que** cada card garanta exatamente 1 requisição associada
— o que é o caso (`requisicoes.card_recurso_id` aponta para 1 card).

---

## 3. Atendimento parcial de um card / múltiplas OCs por card / uma OC para vários cards

- **Múltiplas OCs por card:** **sim, é possível e é o desenho pretendido.** `ordem_compra_itens` tem
  `requisicao_id` nullable e várias linhas de OCs diferentes podem apontar, via `requisicoes`, para o
  mesmo `card_recurso_id`. A trigger `fn_oc_atualizar_valor_oc()` (em `20260616112645_...sql`) já
  **soma** `valor_total` de todos os itens de OCs *emitidas* que caem no mesmo `card_recurso_id`:
  ```sql
  select r.card_recurso_id, sum(oci.valor_total) ...
    from ordem_compra_itens oci
    join requisicoes r on r.id = oci.requisicao_id
    join ordens_compra oc on oc.id = oci.ordem_compra_id
   where oc.status = 'emitida' and r.card_recurso_id is not null
   group by r.card_recurso_id
  ```
  → confirma que **N OCs podem atender 1 card** (compra fracionada/parcial em fornecedores diferentes).
- **1 OC atendendo vários cards:** também possível — `ordem_compra_itens` não tem `UNIQUE` nem
  restrição por `ordem_compra_id`+`card`; cada item pode vir de uma `requisicao_id` diferente, e cada
  requisição pode ter `card_recurso_id` diferente. Uma OC pode consolidar itens de N cards distintos
  (compra consolidada por fornecedor).
- **Atendimento parcial ao nível de OC:** suportado no schema — `ordens_compra.status` inclui
  `'recebida_parcial'` (visto em `Recebimento.tsx` e no RPC `registrar_recebimento_atomico`), e
  `registrar_recebimento_atomico` valida que a soma de `quantidade_recebida` não excede o pedido, por
  item.
- **Atendimento parcial ao nível de card:** **não há campo explícito.** O card não tem
  "quantidade recebida" ou "% atendido"; o único sinal é o `valor_oc` (monetário, sem relação de
  quantidade) e o `status` livre do card (texto, sem enum documentado nesta camada). Não há
  view/consulta que amarre `recebimento_itens` de volta ao card — o rastro card → requisição → OC →
  item → recebimento existe via joins manuais, mas **nenhuma coluna de estoque físico "recebido do
  card"** é escrita de volta em `card_recursos`.

---

## 4. Valor de OC digitado no card (duplicidade)

**Sim — duplicidade confirmada.** `card_recursos.valor_oc NUMERIC(14,2)` existe como coluna própria do
card, **mas é preenchida automaticamente por trigger** (`fn_oc_atualizar_valor_oc`, disparada em
`INSERT/UPDATE OF status` em `ordens_compra`), somando os itens de OC ligados via `requisicoes`. Ou
seja:
- Não é digitação manual do usuário (mitiga risco de erro humano direto), mas **é um valor
  denormalizado/duplicado** (a fonte de verdade real é `ordem_compra_itens.valor_total`, que já é
  `quantidade * preco_unitario` calculado, `stored`).
- **Risco de divergência:** a trigger só recalcula quando `ordens_compra.status` passa a `'emitida'`.
  Se uma OC emitida for **cancelada** ou seus itens alterados/excluídos depois da emissão, não há
  trigger de recomputo de `valor_oc` correspondente (o UPDATE trigger dispara apenas em
  `INSERT or UPDATE OF status`, e mesmo assim só recalcula quando `NEW.status = 'emitida'` — não há
  ramo para status ≠ 'emitida' que zere/recalcule). Isso pode deixar `valor_oc` "preso" com valor
  desatualizado (obsolescência silenciosa).
- Não há campo equivalente para "quantidade comprada"/"quantidade recebida" no card, só o valor
  monetário — reforça que o custo comprometido (EVM) é tratado, mas o controle físico não.

---

## 5. `ordens_compra` — compatível com manter a OC oficial no TOTVS?

A tabela `ordens_compra` do JOGAB é uma **OC própria e completa** (fornecedor, itens, valor total,
status de aprovação, emissão, vínculo com obra e requisições), com numeração local via
`GENERATED ALWAYS AS IDENTITY` (`numero bigint`). Não há nenhuma coluna do tipo `numero_totvs`,
`codigo_totvs`, `origem_sistema` ou `sincronizado_totvs` na definição de `ordens_compra` (confirmado —
nenhuma ocorrência de "totvs" nas migrations que tocam `ordens_compra`/`ordem_compra_itens`). Em
contraste, `obras` **já tem** `codigo_totvs`/`centro_custo_totvs` (padrão de integração usado em outras
áreas do sistema), e `centros_custo_totvs` é uma tabela dedicada de espelho.

**Recomendação:** **adaptar, não recriar.** `ordens_compra` deveria deixar de ser tratada como a "OC
oficial" e passar a ser um **espelho/rascunho local** com adição de colunas de integração
(`numero_totvs TEXT`, `status_sincronizacao`, `sincronizado_em`, `payload_totvs jsonb`), seguindo o
padrão já usado em `obras.codigo_totvs`/`centros_custo_totvs`. Hoje, se o TOTVS for o sistema de registro
oficial da OC, o JOGAB roda um processo de compras paralelo com sua própria numeração e workflow de
aprovação (`status_aprovacao`, `emitir_oc_atomico`) sem qualquer link de volta — risco de a "OC" do
JOGAB divergir silenciosamente do TOTVS (numeração diferente, sem reconciliação, sem campo de
correlação).

---

## 6. Recebimento altera estoque? Suporta parcialidade/divergência? Usa `obra_id` como local?

- **Altera estoque:** sim, via RPC `registrar_recebimento_atomico` (`20260629131638_...sql`, reforçada em
  `20260701193238` e `20260701194635`). Para cada item recebido com `insumo_id` não nulo, insere em
  `estoque_movimentacoes` (`tipo='entrada'`) e faz upsert em `estoque_saldos`:
  ```sql
  INSERT INTO estoque_movimentacoes (local, insumo_id, tipo, quantidade, origem, ...)
    VALUES (v_oc.obra_id, v_item.insumo_id, 'entrada', v_item.qtd, 'recebimento:'||v_rec_id, ...);
  INSERT INTO estoque_saldos (local, insumo_id, saldo)
    VALUES (v_oc.obra_id, v_item.insumo_id, v_item.qtd)
    ON CONFLICT (local, insumo_id) DO UPDATE SET saldo = estoque_saldos.saldo + EXCLUDED.saldo;
  ```
- **Parcialidade:** suportada e validada. A função impede receber mais que o saldo em aberto do item
  (`qtd > pedido - recebido` levanta exceção) e recalcula o status da OC como `'recebida'` ou
  `'recebida_parcial'` conforme `bool_and` sobre todos os itens.
- **Divergência:** só é tratada no sentido "não deixar receber além do pedido" (quantidade). **Não há**
  suporte para: divergência de preço, item recebido com defeito/rejeitado, nota fiscal com valor
  diferente do pedido, ou item não pedido mas entregue (recebimento "avulso" sem OC). O único metadado
  livre é `observacao`/`nota_fiscal` (texto).
- **`obra_id` como "local" — confirmado, é um erro de modelo.** A coluna `estoque_saldos.local` e
  `estoque_movimentacoes.local` são `TEXT` livre, e o próprio RPC de recebimento grava
  `v_oc.obra_id` (um UUID convertido para texto) diretamente como `local`. Isso significa:
  - Não existe uma tabela de "locais físicos" (almoxarifados/depósitos) com FK — `local` é texto
    solto, aceitando tanto um UUID de obra quanto (na função de transferência) qualquer outra string
    arbitrária como `'central'`.
  - A UNIQUE key de estoque é `(local, insumo_id)` — ou seja, o modelo assume implicitamente **1 saldo
    por obra por insumo**, misturando o conceito de "obra" (entidade de negócio/contrato) com "local de
    estoque físico" (depósito). Uma obra com dois almoxarifados fisicamente distintos (ex.: canteiro A e
    canteiro B) não é representável; e o "estoque central" da empresa é apenas uma string mágica sem
    modelagem própria (não há tabela `depositos`/`almoxarifados`).

---

## 7. Distinção local de entrega vs. destino final

Existe uma distinção **parcial e não integrada com o estoque**:
- `card_recursos.local_entrega TEXT CHECK (local_entrega IN ('obra','almoxarifado','outro'))` — captura
  a intenção declarada no card (para onde o item deve ser entregue).
- Mas essa informação **não se conecta** ao `local` usado em `estoque_saldos`/`estoque_movimentacoes`.
  O recebimento real sempre grava o saldo em `v_oc.obra_id` (a obra da OC), independentemente do que foi
  marcado em `card_recursos.local_entrega`. Ou seja, se o card diz "entregar no almoxarifado central" mas
  a OC pertence a uma obra, o saldo entra mesmo assim na obra.
- `card_local` (endereço/lat/lng) é sobre **geolocalização do card no mapa**, não é o "local de estoque"
  nem o "destino final" da mercadoria — não confundir os dois conceitos (nomes parecidos, propósitos
  totalmente diferentes).
- Não há campo separado para "destino final" (ex.: obra que efetivamente vai consumir o item quando a
  compra é centralizada/almoxarifado compra para múltiplas obras).

---

## 8. Saldo físico / reservado / disponível e reserva

**Não existe.** `estoque_saldos` tem apenas:
```sql
saldo   NUMERIC(14,4) NOT NULL DEFAULT 0,
minimo  NUMERIC(14,4) NOT NULL DEFAULT 0,
```
Não há colunas `reservado`/`comprometido` nem uma tabela de reservas (`estoque_reservas`). Consequências:
- Não é possível saber quanto do saldo físico já está comprometido para uma obra/atividade específica
  antes de sair fisicamente.
- Qualquer "disponível" seria igual ao `saldo` bruto — sem separar o que já tem destino certo.
- Requisições e cards não fazem reserva de estoque existente antes de gerar nova compra; o fluxo é
  sempre requisição → cotação → OC → recebimento, mesmo que já haja saldo suficiente em outro local
  (não há checagem cruzada visível no código lido).

---

## 9. Transferências entre obras e central

Implementadas via **uma única função RPC** (`fn_estoque_transferir`, `20260626140848_...sql`) e um
componente de UI dedicado (`TransferenciaDialog.tsx`), sem tabela própria de "transferência" (o
registro fica só em `estoque_movimentacoes`, marcado com `origem = 'transferencia:<uuid>'` para
correlacionar as duas linhas entrada/saída).
- Move saldo entre dois valores de `local` (texto livre) — pode ser obra→obra, obra→"central",
  central→obra, etc., sem qualquer validação de que os `local` informados representem entidades reais
  (não há FK, não há tabela de depósitos).
- Trava concorrência com `FOR UPDATE` no saldo de origem e bloqueia transferência com saldo
  insuficiente — isso está correto tecnicamente.
- Autorização: exige GM ou setor "Compras" (checagem dentro da função, `SECURITY DEFINER`).
- **Risco:** por `local` ser texto livre, é possível criar "locais" inconsistentes por erro de digitação
  (ex.: "Central" vs "central" vs UUID de obra errado) sem nenhuma validação de integridade referencial.

---

## 10. Produção: setor/subsetor único por card? Multi-etapa Corte→Dobra→Solda? Ordem de produção?

- **Setor/subsetor:** `card_setores` tem `PRIMARY KEY (card_id, setor)`, com `subsetor` como coluna
  **escalar** (`CHECK (subsetor IN ('Solda','Corte','Dobra'))`) dentro dessa mesma linha. Isso significa
  que **um card só pode ter UM subsetor de Produção ativo por vez** — não é possível o mesmo card ter
  simultaneamente um registro para "Corte" e outro para "Dobra" (a chave primária do tipo
  `(card_id, 'Producao')` é única, então um segundo INSERT com o mesmo `card_id`+`setor='Producao'`
  colidiria).
- **Multi-etapa (Corte e Dobra → Solda):** **não suportado no modelo atual.** O fluxo sequencial de
  etapas de fabricação exigiria ou (a) múltiplas linhas por card para o mesmo setor com subsetores
  diferentes — impossível pela PK atual —, ou (b) uma tabela de "etapas de produção" com ordem/sequência
  — que **não existe**. Na prática, o `QuadroProducao.tsx` só filtra cards pelo valor único de
  `subsetor` (`Solda`/`Corte`/`Dobra`/`Todos`), tratando cada subsetor como categoria estanque, não como
  etapa de um roteiro de produção.
- **Ordem de produção:** **não existe** entidade `ordem_producao`/`ordens_producao` em nenhuma migration
  (confirmado por busca — zero ocorrências). O "card" no `QuadroProducao` cumpre informalmente o papel
  de ordem de produção, mas sem estrutura de roteiro (etapas, sequenciamento, apontamento de horas,
  consumo de insumos por etapa).

---

## 11. Duplicação entre card de Compras e card de Produção

Não há duplicação de registro — **é o mesmo card** reaproveitado. `QuadroCompras.tsx` filtra
`card_setores.setor = 'Compras'` e `QuadroProducao.tsx` filtra `card_setores.setor = 'Producao'`; como
`card_setores` é `(card_id, setor)` (multi-setor por card), **um único card `tipo_recurso='manufaturado'`
pode ter duas linhas em `card_setores`: uma para 'Compras' outra para 'Producao'**, aparecendo nos dois
quadros ao mesmo tempo, cada um com seu próprio `status_setor` textual independente. Isso é
arquiteturalmente razoável para representar "compra da matéria-prima" + "fabricação" no mesmo item, mas:
- **Risco de sincronização:** os dois `status_setor` são campos de texto livres e independentes — nada
  garante que o card só entre em "Producao" depois que "Compras" tenha, de fato, recebido o material
  (não há constraint/trigger de transição de estado entre setores).
- **Sem roteiro:** como visto no item 10, mesmo dentro de "Producao" não há sequenciamento de etapas —
  então mesmo a integração Compras→Produção é binária (feito/não feito), sem rastrear
  Corte→Dobra→Solda como pipeline.

---

## 12. Subcards / dependências entre cards

**Não encontrado.** Não existe `card_pai`, `parent_card_id`, tabela de dependências entre cards, nem
qualquer referência a "subcard" no código ou nas migrations pesquisadas. `card_membros` cobre apenas
"pessoas atribuídas ao card", não hierarquia/dependência entre cards. Logo, não há como modelar, por
exemplo, "esta Solda depende da conclusão daquele Corte" a nível de card — reforça a lacuna do item 10.

---

## 13. Resumo de classificação funcional

| Fluxo | Classificação | Evidência |
|---|---|---|
| Requisição → Cotação → OC (emissão) | **Funcional** | RPC `emitir_oc_atomico`, tabelas com FKs consistentes, valida aprovação e itens |
| Recebimento parcial de OC | **Funcional** | `registrar_recebimento_atomico` valida saldo, atualiza status da OC |
| Recebimento → Estoque (entrada) | **Funcional, mas com modelo de local incorreto** | grava `obra_id` como `local` em vez de depósito físico |
| Estoque: saldo simples | **Funcional (limitado)** | sem reservado/disponível, sem cadastro de locais |
| Transferência de estoque | **Funcional (limitado)** | RPC funciona, mas `local` é texto livre sem integridade referencial |
| Card de recurso (necessidade) | **Funcional, mas 1 item por card** | não é "linha multi-item" |
| Valor de OC no card | **Funcional via trigger, com duplicidade de dado** | `valor_oc` denormalizado, sem recomputo em cancelamento |
| OC oficial vs. TOTVS | **Não integrado** | nenhuma coluna de correlação com TOTVS |
| Produção (setor/subsetor) | **Parcial/mock de processo** | card existe e é filtrável, mas sem roteiro de etapas nem ordem de produção real |
| Multi-etapa Corte→Dobra→Solda | **Não implementado** | modelo de dados impede (PK única por setor) |
| Subcards/dependências | **Não implementado** | nenhuma tabela/coluna encontrada |

---

## 14. Recomendações (sem implementar)

1. **Modelar locais de estoque como entidade própria** (`depositos`/`almoxarifados` com `id`, `tipo`
   [obra|central|fornecedor], `obra_id` opcional) e trocar `estoque_saldos.local`/
   `estoque_movimentacoes.local` de `TEXT` para FK. Isso resolve o uso indevido de `obra_id` como
   "local" e viabiliza múltiplos depósitos por obra e um estoque central de verdade.
2. **Separar local de entrega (logística) do local de estoque (custódia).** Hoje `card_recursos.local_entrega`
   é decorativo e não influencia onde o saldo é lançado no recebimento; ligar `registrar_recebimento_atomico`
   ao local realmente pretendido, com fallback explícito.
3. **Adicionar saldo reservado/comprometido** (`estoque_saldos.reservado` ou tabela `estoque_reservas`)
   antes de tratar qualquer feature de "disponível para nova obra".
4. **Decidir e documentar a fonte de verdade da OC:** se o TOTVS é oficial, adicionar campos de
   correlação/sincronização em `ordens_compra` (não recriar do zero) e tratar a tabela local como
   espelho/rascunho pré-TOTVS, replicando o padrão já usado em `obras.codigo_totvs`.
5. **Revisar a trigger `fn_oc_atualizar_valor_oc`** para cobrir cancelamento/edição de itens pós-emissão
   (hoje só atualiza ao emitir, podendo deixar `valor_oc` obsoleto).
6. **Modelar card_recursos como potencialmente multi-item** (ou documentar explicitamente que a
   convenção é "1 card = 1 item" e formalizar isso na UI/validações) para evitar expectativa de que o
   card cobre uma "linha de necessidade" completa.
7. **Para Produção:** avaliar tabela `ordem_producao_etapas` (ou similar) com sequência
   Corte→Dobra→Solda, liberando `card_setores` de tentar (sem sucesso) representar múltiplas etapas
   simultâneas via um único campo `subsetor`.
8. **Para dependências entre cards/subcards:** se o negócio precisa (ex.: Solda depende de Corte
   concluído), desenhar tabela de dependências dedicada — hoje inexistente.
9. **Adicionar tratamento de divergência no recebimento** (preço, item rejeitado/avariado, recebimento
   sem OC) — hoje só a quantidade é validada.

