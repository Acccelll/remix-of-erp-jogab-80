# Auditoria Etapa 0 — Integração Cronograma ↔ Cards

**Escopo:** `src/lib/cronograma/*`, `src/lib/import/*`, `src/lib/repositories/cronograma.ts`,
`src/pages/planejamento/*`, `src/components/planejamento/*`, `src/components/import/CronogramaImporter.tsx`
e `CronogramaSemanalImporter.tsx`, tabelas `cronograma_itens`, `cronograma_dependencias`,
`cronograma_revisoes`, `cronograma_item_revisoes`, `cronograma_baselines`, `cronograma_calendarios`,
`cronograma_marcos`, `cronograma_cenarios`, e o vínculo `cards.cronograma_item_id` + `card_recursos`.

> **ATUALIZADO (31/07/2026): o XML real foi disponibilizado e processado.**
> O arquivo `CRONOGRAMA - PÁTIOS - RAÍZEN BARRA - REV00.xml` (1,7 MB, MS Project SaveVersion 14,
> build 16.0.20026) foi executado contra o parser real do ERP (`parseMppXml` + `validateMpp`).
> Resultado e achados na **seção 0** abaixo. O restante do documento (análise estática do parser,
> importadores e migrations) permanece válido.

---

## 0. Validação com o arquivo real (RAÍZEN BARRA REV00)

### 0.1 Retrato do arquivo

| Campo | Valor |
|---|---|
| Título | `OBRA 214 - PÁTIOS` |
| GUID do projeto | `11A23654-4795-F011-847F-5CCD5BC53EBE` |
| Período | 19/01/2026 → 13/05/2026 |
| `StatusDate` / `CurrentDate` | 15/05/2026 / 09/06/2026 |
| Moeda | BRL, `MinutesPerDay` 480, `DaysPerMonth` 20 |
| Tarefas no XML | 148 (inclui a raiz UID 0) |
| Recursos / Atribuições | 1 / 107 |
| Calendários | 5 (padrão UID 1) |
| ExtendedAttributes definidos | **108** |

### 0.2 Resultado do parser real do ERP

```
parseMppXml  → 147 tarefas (raiz descartada), 5 calendários, calendarUidPadrao = 1
validateMpp  → { ok: true, errors: [], warnings: [] }
stats: tarefasLidas 147 · folhas 107 · custoTotal R$ 1.390.000 · percentualMedio 0
```

**O parser lê o arquivo real sem erros nem avisos.** Foram corretamente extraídos: `uid`, `wbs`,
`outlineLevel`, `start`/`finish`, `isSummary` (40), `hasChildren` (40), `isMilestone` (37),
`predecessors` (103 tarefas), `custo` (147/147), `baselines` (baseline 0 presente com
start/finish/duração/custo), `constraintTipo`, `prioridade`, `parentUid`.

### 0.3 Achados críticos confirmados com dado real

| # | Achado | Evidência no arquivo | Impacto |
|---|---|---|---|
| **A1** | **75 tarefas têm nome duplicado** (147 tarefas, 72 nomes únicos) | ex.: `Terrraplanagem - Corte`, `Montagem - Tubulação...` repetidos entre RESERVATÓRIO 01/02 | O **fallback de reconciliação por nome** (seção 2) é comprovadamente inseguro: metade das tarefas colidiria. Reconciliação **deve** ser por `uid_mpp` + WBS |
| **A2** | **0 tarefas com recursos** apesar de **107 `<Assignments>`** no XML | `recursos: []` em 147/147 | O parser **descarta as atribuições**. Todo o custo de recurso/mão de obra do cronograma se perde na importação |
| **A3** | **`percentComplete` = 0 em 100% das tarefas** | `percentualMedio: 0` | O cronograma real é **de planejamento puro**; o avanço físico virá do ERP, não do MPP. Reconciliação semanal **não pode** sobrescrever avanço com 0 |
| **A4** | 108 ExtendedAttributes (incl. `Real(%)`, `Plan(%)`, `SPI(#)`, `SPI(O)`, `CAPEX`, `Custo Compromissado/Real/Previsto - Mês 01..12`, `EDR`, `Centro de Custo da Demanda`, `Ordem de Investimento`) | seção `<ExtendedAttributes>` | **Nenhum é lido pelo parser.** São os campos de governança do cliente (Raízen). Ignorá-los inviabiliza relatórios de SPI/CPI e rastreio de CAPEX |
| **A5** | Erro de digitação propagado (`Terrraplanagem`) | 2 tarefas | Reforça A1: nome não é chave |
| **A6** | `uid` duplicado: **0** | 147 UIDs únicos | `uid_mpp` é chave viável **dentro de uma revisão**; a estabilidade entre revisões continua não garantida pelo formato |

### 0.4 Consequência para o plano

A2 e A4 são **lacunas de parser**, não de modelo — baratas de corrigir e de alto valor
(custo por recurso e campos de governança do cliente). A1 **confirma** a recomendação de eliminar o
fallback por nome. A3 exige que a reconciliação semanal trate `percentComplete` como campo
*não-autoritativo* vindo do MPP.

---


---

## 1. Uso de UID/GUID do MS Project — SIM, mas parcial

O parser (`src/lib/cronograma/mpp.ts:350`) extrai o `UID` nativo do MS Project de cada `<Task>`
(`get("UID")`) e o persiste em `cronograma_itens.uid_mpp` (ver
`src/components/import/CronogramaImporter.tsx:321` e `CronogramaSemanalImporter.tsx:580`).
Também são capturados:

- `PredecessorUID` → `cronograma_dependencias.predecessor_uid_mpp` (chave "fraca", resolvida depois
  para `predecessor_item_id` via `fn_backfill_cronograma_dep_item_id`, migration
  `20260728191640_...sql:21-40`, que faz `UPDATE ... WHERE predecessor_uid_mpp = i.uid_mpp`).
- `CalendarUID` → `cronograma_itens.calendario_uid_mpp` e `cronograma_calendarios`.
- `ResourceUID`/`TaskUID` de `<Assignments>` (usados só em memória, não persistidos em tabela própria
  de assignments — não há `cronograma_item_recursos_mpp` ou equivalente).

O MS Project **não** usa GUID (GUID é conceito de outros formatos, ex. Primavera P6); o UID do MPP é
um inteiro sequencial **por arquivo**, reatribuído pelo MS Project sempre que uma tarefa é
inserida/removida/reordenada de forma não trivial, e **não é garantidamente estável entre exportações
consecutivas do mesmo cronograma** (é estável apenas enquanto a tarefa não é fisicamente removida e
recriada dentro do MPP nativo). Isso é uma limitação estrutural do próprio formato, não do parser.

## 2. Existe chave estável para reconciliação? — SIM (uid_mpp), com fallback frágil por descrição

O importador semanal (`CronogramaSemanalImporter.tsx:84-107`) reconcilia cada tarefa do XML com um
item existente em `cronograma_itens` em duas etapas:

```
if (t.uid && porUid.has(String(t.uid))) { m = porUid.get(...) }         // match primário: uid_mpp
else if (porDescricao.has(normalizar(t.name))) { ... por = "descricao" } // fallback: nome normalizado
```

- **Match primário:** `uid_mpp` (índice em memória `Map<uid_mpp, item>`, não há índice único de banco
  — ver seção 8).
- **Fallback:** comparação por `descricao` normalizada (`normalizar()` em `mpp.ts:455`, que faz
  lower-case + remove acentos + colapsa espaços). Esse fallback é **frágil**: duas atividades com o
  mesmo nome em WBS diferentes (comum em cronogramas de obra, ex. "Alvenaria" repetido por pavimento)
  colidem no `Map` (o último sobrescreve o primeiro em `porDescricao.set`), e uma tarefa renomeada no
  planejamento deixa de casar e vira "órfã" (`semCorrespondencia`).
- Tarefas do XML sem correspondência (`semCorrespondencia`, linha 96-111) **não são inseridas nem
  reportadas como erro bloqueante** — apenas contadas em `totais.sem_correspondencia` na revisão. Ou
  seja, **atividades novas incluídas no cronograma pelo planejador não entram no sistema pela rotina
  semanal**; só entram via reimportação completa da baseline.

## 3. A importação apaga e recria atividades (delete-all + insert)? — SIM, na importação inicial

`CronogramaImporter.tsx:304` (fluxo de primeira baseline / reimportação manual):

```ts
await cronogramaRepo.removeByObra(obraId);   // DELETE FROM cronograma_itens WHERE obra_id = ...
...
await cronogramaRepo.insertMany(rows as any); // INSERT novos itens com novos UUIDs
```

`cronogramaRepo.removeByObra` (`src/lib/repositories/cronograma.ts:221-224`) é um `DELETE` físico e
incondicional por `obra_id` — não há soft-delete nem filtro por revisão. Esse caminho é usado sempre
que a obra ainda não tem cronograma principal (`!obraTemCronograma`), inclusive em reimportações de
correção. A interface avisa o usuário (`CronogramaSemanalImporter.tsx:644-658`) para não reimportar a
baseline quando já existe uma, mas **nada no código impede tecnicamente uma segunda chamada** ao mesmo
fluxo de "importar base" se o guard de UI (`obraTemCronograma`) falhar ou for contornado (ex. chamada
direta ao repositório, script, ou race condition entre duas abas).

Já o **fluxo semanal** (`CronogramaSemanalImporter.tsx:195-288`, "atualização de progresso") **não
apaga nada**: faz apenas `UPDATE` item a item (`cronogramaRepo.update`, linha 250) para os itens que
casaram e mudaram, e grava um snapshot em `cronograma_item_revisoes`. É o único fluxo hoje que se
aproxima de um "upsert idempotente", mas cobre só campos de progresso/datas — não trata inserção de
atividades novas nem inativação das removidas (ver seção 6).

## 4. Cards ficam órfãos ou duplicados?

**Órfãos: SIM, por design de FK.** A coluna `cards.cronograma_item_id` é declarada em várias migrations
como:

```sql
cronograma_item_id UUID REFERENCES public.cronograma_itens(id) ON DELETE SET NULL
```

(ex. `20260624142446_...sql:37`, `20260625184155_...sql:34`, `20260701131652_...sql:3`, entre outras).
Isso significa que, quando `removeByObra`/`removeMany` apaga uma linha de `cronograma_itens`
(reimportação da baseline), **o Postgres automaticamente zera `cards.cronograma_item_id` para NULL**
em todos os cards vinculados àquele item — o card não é apagado, mas **perde silenciosamente o vínculo
com o cronograma**, sem nenhum registro do vínculo anterior (não há tabela de histórico de vínculo
card↔item). Efeitos colaterais observados:

- O trigger `trg_cards_sync_crono` (migration `20260624142446_...sql`, `AFTER INSERT OR UPDATE OR
  DELETE ON cards`) dispara `fn_card_recurso_sync_crono(OLD.cronograma_item_id)` quando o vínculo muda,
  recalculando `cronograma_itens.recursos_count/recursos_status` — mas isso só ajusta o item antigo (que
  se ainda existir fica com recursos "perdidos"); o card não recebe nenhuma notificação de que seu
  vínculo caiu.
- `src/components/cards/CardGenericoDialog.tsx:522-523` mostra que a UI já trata a possibilidade de
  `cronograma_item_id: null` manualmente (desvínculo explícito pelo usuário), mas não distingue esse
  caso de um desvínculo "silencioso" causado por reimportação.
- Prazos calculados por `src/lib/recursos/lead-times.ts` e as cascatas de
  `src/lib/recursos/cascata-marcos.ts`/`alertas-prazo.ts` são derivados de campos já **persistidos** no
  card (`prazo_notif_compras`, `prazo_pedido`, etc.), não recalculados dinamicamente a partir do
  cronograma-fonte — logo, se o item de cronograma some, os prazos do card **não são automaticamente
  recalculados nem invalidados**, ficando "congelados" com base em um item que não existe mais.

**Duplicados: possível, no fluxo de nova baseline sem reimportar tudo.** O segundo `aplicar()` de
`CronogramaSemanalImporter.tsx` (linhas 555-642, "criar nova baseline") **insere itens novos**
(`insertManyReturningResumo`, linha 594) sem apagar os itens da baseline/obra anterior. Esse caminho só
é exibido quando `!obraTemCronograma` (guarda de UI), mas evidencia que o **modelo de dados permite
coexistência de múltiplas gerações de `cronograma_itens` para a mesma obra** sem um mecanismo de
"aposentar" a geração anterior — se esse guard de UI puder ser contornado (bug de estado,
`obraTemCronograma` desatualizado em cache, chamada direta), o resultado são **linhas duplicadas** para
as mesmas atividades físicas, cada uma com `uid_mpp` igual (não há `UNIQUE(obra_id, uid_mpp)`, seção 8).

## 5. Datas alteradas recalculam prazos de recursos automaticamente? — NÃO

- `src/lib/recursos/lead-times.ts` (`calcularPrazos`) é **função pura** (`/** @module-kind pure */`),
  sem I/O: recebe uma `dataInicioAtividade` e devolve prazos calculados, mas **não é acionada
  automaticamente** por nenhuma trigger de banco nem por hook reativo a mudanças em
  `cronograma_itens.data_inicio`. Não há `rg` de chamadores automáticos a partir do importador semanal —
  a atualização de `l.iniNovo`/`l.fimNovo` em `CronogramaSemanalImporter.tsx:230-239` só atualiza
  `cronograma_itens.data_inicio/data_fim/data_inicio_reprog/data_fim_reprog`; os prazos já gravados em
  `card_recursos` (`prazo_pedido`, `prazo_notif_compras`, etc.) **não são recalculados** nessa rotina.
- `src/lib/recursos/cascata-marcos.ts` (`calcularCascataLinha`) também é função pura que **lê** os
  prazos já persistidos nos cards (`CardCascataInput`) — não deriva do cronograma em tempo real.
- `src/lib/recursos/alertas-prazo.ts` (não lido em detalhe, mas referenciado por `cascata-marcos.ts`
  via `hojeUtcMs`/`Severidade`) opera sobre os mesmos campos persistidos, comparando com a data atual —
  também não reage a mudança de data do cronograma.
- **Conclusão:** a reprogramação de uma atividade (revisão semanal com `atualizarDatas=true`) altera
  `data_inicio`/`data_fim` do item, mas os prazos em cascata dos recursos vinculados (`card_recursos`)
  ficam **desatualizados até que algum fluxo manual os recalcule** (não localizado nenhum botão/rotina
  de "recalcular prazos dos recursos vinculados a este item" no código auditado).

## 6. Atividades removidas do XML são apagadas ou inativadas? — NENHUMA DAS DUAS (no fluxo semanal)

- Fluxo semanal: uma atividade que **existia** em `cronograma_itens` mas **não aparece mais** no XML
  novo simplesmente não é tocada — não há passo que compare "itens ativos do banco menos itens do XML"
  e feche/inative os que sumiram. A coluna `cronograma_itens.ativo` existe e é usada como filtro de
  leitura em vários lugares (`listAtivosProgressoByObra`, `listAtivosParaVinculoByObra`,
  `listCustosByObra`, `listSnapshotSourceByObra`), mas **nenhum trecho do importador semanal ou do
  importador de baseline escreve `ativo=false`** para desativar itens removidos — `ativo` só é setado
  para `true` na inserção (`CronogramaSemanalImporter.tsx:592`, `CronogramaImporter.tsx` na baseline
  inicial).
- Fluxo de reimportação total (`removeByObra` + `insertMany`): aí sim há remoção física, mas de
  **toda a obra**, não seletiva por atividade removida — é "tudo ou nada", não uma reconciliação
  item a item.
- **Consequência prática:** hoje, atividades canceladas/removidas do cronograma real continuam
  aparecendo como ativas no ERP indefinidamente até uma reimportação total (que por sua vez rompe os
  vínculos de card, seção 4).

## 7. Há versionamento/histórico de revisão? — SIM, parcial e assimétrico

Tabelas envolvidas:

- `cronograma_baselines` (+ `cronograma_item_baseline`, ver `cronogramaBaselineItensRepo`): snapshot de
  custo/datas por versão de baseline (`versao`, `motivo`, `observacoes`). Criada a cada "nova baseline"
  (`CronogramaSemanalImporter.tsx:562-567`).
- `cronograma_revisoes` (+ `cronograma_item_revisoes`): registra cada rodada de atualização semanal
  (`numero`, `data_corte`, `totais` em JSON) e, por item alterado, um snapshot de "antes/depois" de
  `percentual_realizado` e datas (`cronogramaItemRevisoesRepo.insertMany`,
  `CronogramaSemanalImporter.tsx:254-267`).
- `fn_reverter_revisao_cronograma(p_revisao_id)` (migration `20260728191640_...sql:43-65`): copia os
  valores `*_anterior`... — na verdade, lê `cronograma_item_revisoes` e regrava em `cronograma_itens` os
  campos `data_inicio_novo`, `data_fim_novo`, `percentual_realizado_novo`, `custo_novo` via `COALESCE`.
  **Atenção:** o código da função usa `r.custo_novo`, mas o `INSERT` feito pelo app em
  `cronograma_item_revisoes` (linhas 254-265 do importador semanal) **não grava `custo_novo`** — o
  objeto `snaps` só tem `percentual_realizado_novo`, `data_inicio_novo`, `data_fim_novo`. Ou seja, a
  RPC de reversão espera uma coluna que a aplicação não popula na prática; `COALESCE` evita erro (fica
  `NULL` e mantém valor atual), mas o campo é inerte — **potencial código morto/incompleto** que merece
  confirmação em outra frente de auditoria (não corrigido aqui).
- Não há histórico de qual `uid_mpp` foi inserido/removido entre revisões, nem histórico do vínculo
  `cards.cronograma_item_id` (perda de vínculo por `ON DELETE SET NULL` não é auditada em lugar nenhum).

## 8. Ausência de constraints de unicidade (achado transversal)

Não foi localizada nenhuma constraint `UNIQUE(obra_id, uid_mpp)` em `cronograma_itens` nas migrations
varridas — a reconciliação por `uid_mpp` depende inteiramente da lógica JS (`Map` em memória) descrita
na seção 2, sem proteção de banco contra duas linhas com o mesmo `uid_mpp` na mesma obra (o que pode
ocorrer justamente no cenário de "nova baseline" descrito na seção 4).

## 9. Triggers/RPCs envolvidos — mapeamento

| Objeto | Tipo | Onde definido | Papel |
|---|---|---|---|
| `fn_atualizar_cpm(obra_id, resultados jsonb)` | RPC | migrations `20260623121912`, `20260701194635`, `20260723133741` (stub), `20260724113349`, `20260728211905` (última, restringe `EXECUTE` a `authenticated, service_role`) | Recebe resultado do CPM calculado no cliente (`src/lib/cronograma/cpm.ts`, `recalcular-cpm.ts`) e grava em `cronograma_itens`. Chamado por `cronogramaRepo.rpcAtualizarCpm` (`repositories/cronograma.ts:111-123`), que **degrada silenciosamente** (`logger.warn`) se a função não existir — mascarando falhas de deploy de migration. |
| `fn_reverter_revisao_cronograma(p_revisao_id)` | RPC | `20260728191640_...sql:43-65` | Restaura campos de `cronograma_itens` a partir de `cronograma_item_revisoes`; ver limitação do campo `custo_novo` na seção 7. |
| `fn_backfill_cronograma_dep_item_id(obra_id)` | RPC | mesma migration, linhas 21-40 | Resolve `cronograma_dependencias.predecessor_item_id` a partir de `predecessor_uid_mpp`, casando por `uid_mpp` — reforça que `uid_mpp` é a chave de fato usada para reconciliar dependências. |
| `trg_cards_sync_crono` / `fn_card_recurso_sync_crono` | Trigger | `20260624142446_...sql` | Mantém `cronograma_itens.recursos_count/recursos_status` sincronizados quando `cards.cronograma_item_id` muda (insert/update/delete de card). |
| `trg_card_recursos_sync_aiud` / `fn_card_recurso_sync_crono` | Trigger | mesma migration | Mesmo objetivo, disparado por mudanças em `card_recursos` (ex. prazo). |

Nenhuma trigger foi localizada sobre `cronograma_itens` (INSERT/UPDATE/DELETE) que recalcule CPM,
prazos de recursos ou notifique cards automaticamente — o recálculo de CPM é **client-side**
(`src/lib/cronograma/cpm.ts`, `recalcular-cpm.ts`) e só é persistido quando o app chama a RPC
`fn_atualizar_cpm` explicitamente.

---

## Resumo dos riscos identificados

1. **Reimportação de baseline é destrutiva** (`DELETE` físico por `obra_id`) e desvincula cards em
   cascata (`ON DELETE SET NULL`) sem log/auditoria do vínculo perdido.
2. **Reconciliação semanal depende de `uid_mpp` sem constraint de unicidade**, com fallback por nome
   normalizado que pode colidir ou falhar em cronogramas com atividades homônimas (comum em obras
   civis, ex. "Alvenaria Pav 1/2/3").
3. **Atividades novas no XML semanal não são inseridas** (ficam em "sem correspondência") — divergência
   silenciosa entre o cronograma real e o ERP até a próxima baseline.
4. **Atividades removidas do XML nunca são inativadas** — o ERP nunca "esquece" uma atividade sem
   reimportação total.
5. **Prazos de recursos (`card_recursos`) não recalculam automaticamente** quando datas do cronograma
   mudam — risco de alertas de prazo (`alertas-prazo.ts`, `cascata-marcos.ts`) desatualizados.
6. **`fn_reverter_revisao_cronograma` referencia coluna (`custo_novo`) não populada** pelo fluxo atual
   de gravação de `cronograma_item_revisoes` — reversão de custo é inerte na prática.
7. **Coexistência de baselines/itens duplicados é estruturalmente possível** (sem `UNIQUE(obra_id,
   uid_mpp)`), hoje contida apenas por um guard de UI (`obraTemCronograma`), não por regra de banco.

---

## PROPOSTA TÉCNICA — Reconciliação semanal idempotente (apenas proposta, sem implementação)

> Nenhum código ou migration foi alterado para esta proposta; o objetivo é documentar um desenho de
> solução a ser avaliado e implementado em etapa posterior.

### 9.1 Chave natural de reconciliação

Adotar como chave natural composta: **`(obra_id, uid_mpp)`**, complementada por uma chave de
_desempate/fallback_ auditável quando `uid_mpp` mudar entre exportações (o que o MS Project pode fazer
ao reindexar tarefas):

- Chave primária de reconciliação: `(obra_id, uid_mpp)` — exigir `UNIQUE(obra_id, uid_mpp)` em
  `cronograma_itens` (hoje ausente).
- Chave secundária de fallback controlado (não automático/silencioso como hoje): `(obra_id, wbs)` —
  `OutlineNumber` do MS Project tende a ser mais estável estruturalmente que o nome livre da tarefa, e
  já é capturado pelo parser (`t.wbs`, `mpp.ts:352`). Propõe-se substituir o fallback atual por
  "descrição normalizada" (frágil e silencioso) por: (a) tentar `wbs` igual; (b) se não achar, sinalizar
  como **candidato a novo item ou renomeação**, exigindo confirmação humana na tela de importação
  (diff explícito "sem correspondência: nova atividade? renomeação de UID xxx?"), nunca aplicar
  automaticamente.

### 9.2 Upsert idempotente (substituindo delete-all)

Trocar o fluxo de `removeByObra` + `insertMany` por um `UPSERT` real:

```sql
INSERT INTO cronograma_itens (obra_id, uid_mpp, descricao, data_inicio, data_fim, ...)
VALUES (...)
ON CONFLICT (obra_id, uid_mpp)
DO UPDATE SET
  descricao   = EXCLUDED.descricao,
  data_inicio = EXCLUDED.data_inicio,
  data_fim    = EXCLUDED.data_fim,
  ...
  updated_at  = now()
WHERE cronograma_itens.ativo IS TRUE; -- não reativa itens soft-deletados sem decisão explícita
```

Rodar isso dentro de uma única transação por importação (hoje os `insertMany`/`update` já são feitos em
lote, mas sem transação explícita nem `ON CONFLICT`). Isso garante que rodar a mesma importação duas
vezes (reprocessamento, retry de rede) produza o mesmo estado final — propriedade de idempotência hoje
ausente tanto no fluxo de baseline (delete-all) quanto no semanal (que reaplicaria o mesmo `UPDATE`,
mas sem proteção contra duplicar linhas de `cronograma_item_revisoes` a cada retry).

### 9.3 Soft-delete em vez de DELETE físico

- Nunca fazer `DELETE FROM cronograma_itens` a partir de uma reimportação de rotina. Introduzir
  `cronograma_itens.ativo` (já existe) como flag de soft-delete real: qualquer `uid_mpp` presente no
  banco e ausente na nova importação passa a `ativo = false`, `inativado_em = now()`,
  `inativado_por_revisao_id = <id da revisão/baseline que causou a inativação>` (nova coluna proposta).
- `DELETE` físico ficaria restrito a uma rotina administrativa explícita e auditada (ex. "excluir obra
  de teste"), nunca ao caminho normal de importação — eliminando o `ON DELETE SET NULL` disparado
  incidentalmente sobre `cards.cronograma_item_id` durante o ciclo semanal normal.

### 9.4 Preservação de vínculos (cards)

- Ao inativar um item (soft-delete), **não** desvincular o card automaticamente. Manter
  `cards.cronograma_item_id` apontando para o item inativo e expor na UI do card um aviso "atividade de
  cronograma inativada em {data} pela revisão {n}", permitindo ao usuário revincular manualmente a um
  novo item (útil quando a atividade foi apenas renomeada/reindexada no MPP, não removida de fato).
- Se o negócio exigir manter a FK `ON DELETE SET NULL` para casos de exclusão administrativa
  verdadeira, criar uma tabela de auditoria `cards_cronograma_vinculo_historico
  (card_id, cronograma_item_id, motivo, revisao_id, criado_em, removido_em)` alimentada por trigger
  `BEFORE UPDATE OR DELETE` em `cards`/`cronograma_itens`, para nunca perder o rastro do vínculo
  original mesmo quando a FK zera a coluna.

### 9.5 Tabela de revisões — consolidar semântica única

- Unificar `cronograma_revisoes`/`cronograma_item_revisoes` (progresso semanal) com
  `cronograma_baselines`/`cronograma_item_baseline` (linha de base) sob um modelo único de "eventos de
  importação" com um campo `tipo_evento` (`baseline_inicial | revisao_semanal | reimportacao_corretiva`),
  guardando para cada evento: hash/nome do arquivo XML importado, usuário, itens
  criados/atualizados/inativados/reativados (contadores e IDs), e o diff completo por item afetado —
  incluindo campos hoje não versionados como `custo` (corrigindo a lacuna do `custo_novo` não populado,
  seção 7) e o estado de `ativo`.
- Garantir que `fn_reverter_revisao_cronograma` reverta exatamente os campos que o evento alterou
  (registrados no diff), incluindo reativação de itens inativados pela revisão e reversão de
  `data_inicio_reprog/data_fim_reprog`, hoje fora do escopo da função.

### 9.6 Execução semanal recomendada (idempotente)

1. Parse do XML (`parseMppXml`) → lista de tarefas-folha com `uid_mpp`.
2. `SELECT` de todos os itens ativos da obra (chave `uid_mpp`).
3. Calcular três conjuntos: `match` (uid presente nos dois lados), `novos` (uid só no XML — hoje
   descartados), `sumidos` (uid só no banco — hoje ignorados).
4. Dentro de uma transação: `UPSERT` em `match`+`novos` (ver 9.2), soft-delete em `sumidos` (ver 9.3),
   grava um único registro de evento com os três conjuntos e seus diffs (ver 9.5).
5. Disparar (fora da transação, best-effort, com fila/retry) o recálculo de prazos de recursos
   (`lead-times.ts`) e cascata de marcos (`cascata-marcos.ts`) apenas para os cards vinculados aos itens
   cujo `data_inicio`/`data_fim` mudou de fato — hoje inexistente (seção 5) — evitando que alertas de
   prazo fiquem baseados em datas de cronograma obsoletas.

Esta proposta não cobre geração de UI nem RLS/policies específicas; assume que a decisão de negócio
sobre reativação automática de itens "sumidos e depois reaparecidos" (comum quando o planejador exclui
e reinsere uma tarefa no MPP) será definida antes da implementação.
