# 06 — Análise do Importador Trello × Quadro real "214 - BARRA"

> Base: `src/lib/cards/trello-parse.ts`, `src/lib/cards/trello-import.ts`,
> `src/components/cards/ImportarTrelloDialog.tsx`, `src/lib/repositories/trelloImport.ts`.
>
> **ATUALIZADO (31/07/2026): o export real do quadro foi disponibilizado** (`214 - BARRA`,
> board `zMwP0qLh`, 1,25 MB de JSON). Esta versão substitui a análise puramente estática anterior.

---

## 1. Retrato factual do quadro real

| Métrica | Valor |
|---|---|
| Board | `214 - BARRA` (org `66336f24...`, permissão `org`) |
| Listas | 14 (nenhuma arquivada) |
| Cartões | 51 (49 abertos, 2 arquivados) |
| Checklists | 49 |
| Ações no export | 1.000 (limite do export do Trello — histórico truncado) |
| Labels | 11 |
| Campos personalizados | 3 (`Local entrega`, `Retirada`, `Manufaturado` — todos tipo `list`) |

**Listas (ordem real):** `NÃO INICIADO`, `EM ANDAMENTO`, `PARA APROVAÇÃO`, `APROVADO`, `À RETIRAR`,
`À ENTREGAR - ALMOX.`, `À ENTREGAR - OBRA`, `CONCLUÍDO`, `OS CORTE E DOBRA`, `OS PRODUÇÃO`,
`DIVISÃO ------...`, `CONCRETO`, `TEMPLATE`, `PRIORIDADES`.

**Distribuição de cartões abertos:** CONCLUÍDO 31 · NÃO INICIADO 6 · PRIORIDADES 5 · EM ANDAMENTO 2 ·
TEMPLATE 2 · OS CORTE E DOBRA 1 · OS PRODUÇÃO 1 · CONCRETO 1.

**Labels reais:** `URGENTE` (red_dark), `IMPORTANTE` (orange), `NORMAL` (yellow), `BAIXA` (lime),
`CONCLUÍDO` (black_dark), `LIBERADO COMPRA` (pink), `LIBERADO PRA COMPRA` (pink),
`PENDENTE FINANCEIRO` (yellow), `EM ESTOQUE` (sky), `AG. INFO. OBRA` (orange_light),
`Revisar!` (purple_light).

**Checklists reais (por nome):** `Material p/ compra` (36 ocorrências),
`Recebimento Materiais (Almoxarifado)` (11), `Checklist p/ Caderno da Obra` (1), `Checklist` (1).
Itens no formato **`<qtd><un> - <DESCRIÇÃO>`**, ex.: `3292pç - BLOCO DE CONCRETO 19X19X39`.

---

## 2. Compatibilidade confirmada com o parser

Validação executada com `listasComFallback()` sobre o JSON real: **14/14 listas reconhecidas**,
sem exceção de parsing. Todos os campos consumidos pelo parser (`lists`, `cards`, `labels`,
`checklists`, `actions`, `customFields`, `customFieldItems`, `attachments`, `badges`, `due`,
`dateLastActivity`) estão presentes no export. **Nenhuma incompatibilidade estrutural.**

Divergências pontuais observadas:

1. **Paleta de cores estendida.** O quadro usa `red_dark`, `black_dark`, `orange_light`,
   `purple_light` — variantes *shades* que **não estão na allowlist** de `corLabelTrello()`
   (green/yellow/orange/red/purple/blue/sky/lime/pink/black). Consequência prática: essas labels
   caem no fallback de cor e perdem a distinção visual (URGENTE `red_dark` vira o mesmo vermelho de
   qualquer outra label vermelha). **Correção barata** — ampliar o mapa de cores.
2. **Cartões que não são trabalho.** 9 dos 49 cartões abertos são *rótulos de sistema*: os 5 da
   lista `PRIORIDADES` (BAIXA/NORMAL/IMPORTANTE/URGENTE/CONCLUÍDO, usados só como legenda), 2 de
   `TEMPLATE`, e 3 cartões-instrução em `OS CORTE E DOBRA`/`OS PRODUÇÃO`/`CONCRETO`. Importar tudo
   cru gera ~18% de lixo no board ERP. **Precisa de filtro/opt-out por lista na UI de importação.**
3. **Cartão órfão de URL** (`https://trello.com/c/S7966iEu` como *nome* do cartão) — resíduo de
   mirror/link colado; entra como card sem semântica.
4. **`actions` truncado em 1.000** pelo próprio Trello: o histórico de atividades reconstruído pelo
   importador é **parcial por definição**. Não é bug do ERP, mas deve ser comunicado na UI.
5. **Nomes duplicados**: `Material - Vergalhões (Pátio de Mistura)` aparece 2×. Qualquer heurística
   de deduplicação por nome é insegura — usar sempre `origem_id` (id do cartão Trello).

---

## 3. Semântica de negócio embutida no quadro (o que o ERP precisa absorver)

O quadro **não é um kanban genérico**: é um fluxo de **suprimentos ponta a ponta** codificado em
listas + labels + checklists.

- **Fluxo de compra** (listas): NÃO INICIADO → EM ANDAMENTO → PARA APROVAÇÃO → APROVADO → À RETIRAR
  → À ENTREGAR (ALMOX. / OBRA) → CONCLUÍDO. Mapeia 1:1 com o ciclo de **requisição → cotação →
  aprovação → OC → recebimento** já existente no módulo Suprimentos do ERP.
- **Labels = 2 dimensões misturadas**: prioridade (BAIXA/NORMAL/IMPORTANTE/URGENTE) e
  **estado financeiro/logístico** (LIBERADO COMPRA, PENDENTE FINANCEIRO, EM ESTOQUE, AG. INFO. OBRA).
  No modelo alvo isso deve virar **campo `prioridade` (enum) + `status_suprimento`**, não labels
  livres.
- **Checklist `Material p/ compra` = itens da requisição**; `Recebimento Materiais (Almoxarifado)` =
  **conferência de recebimento**. Ou seja: o quadro já opera **multi-item por cartão** — exatamente
  a lacuna apontada no doc 11 (`card_recursos` sem suporte multi-item). **Confirmado como bloqueio
  real, não teórico.**
- **Campos personalizados** `Local entrega` / `Retirada` / `Manufaturado` (listas) → devem virar
  colunas tipadas no card de suprimento (`local_entrega`, `retirada_por`, `is_manufaturado`), com o
  último direcionando o card para o fluxo de **Produção / OS Corte e Dobra**.
- **Listas `OS CORTE E DOBRA`, `OS PRODUÇÃO`, `CONCRETO`** são *buckets de roteamento* por tipo de
  material — evidência direta de que o Motor B (Compras/Produção hard-coded) foi modelado a partir
  deste quadro.

---

## 4. Lacunas do importador confirmadas contra o dado real

| # | Lacuna | Severidade | Ação |
|---|---|---|---|
| L1 | Shades de cor (`*_dark`, `*_light`) não mapeados | Baixa | Ampliar `corLabelTrello` |
| L2 | Sem filtro de listas na importação (importa TEMPLATE/PRIORIDADES) | **Alta** | Seleção de listas na UI |
| L3 | Checklist de material não vira item estruturado (fica texto) | **Crítica** | Parser `<qtd><un> - <DESC>` → `card_recursos` multi-item |
| L4 | Labels de estado tratadas como labels visuais, não como status | **Alta** | Mapeamento label → campo de domínio |
| L5 | Campos personalizados tipo `list` não mapeados para colunas | Média | Mapeamento configurável |
| L6 | `actions` truncado sem aviso ao usuário | Baixa | Banner na UI |
| L7 | Cartões duplicados por nome | Média | Deduplicar só por `origem_id` |

---

## 5. Conclusão

O importador **lê o quadro real sem quebrar** — risco técnico de parsing é baixo. O risco está na
**perda semântica**: hoje a importação produziria um board visualmente parecido, porém sem os itens
de material estruturados (L3) e sem os estados de suprimento (L4), que são justamente o valor
operacional do quadro. **L3 e L4 devem entrar no escopo da Etapa 1.**
