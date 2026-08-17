# Etapa 2 — Camada de Extensões e Vínculos com o ERP

## Princípio

O motor Kanban não conhece domínio. Ele conhece **contratos**. Cada módulo do ERP
publica uma *extensão* (metadados + adaptador) e o quadro decide se a ativa.

## Modelo de dados

| Tabela                 | Papel                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| `kanban_extensoes`     | Catálogo central de capacidades (código, nome, módulo, versão).    |
| `board_extensoes`      | Ativação/configuração por quadro (`ativo`, `mostrar_resumo`, ordem).|
| `card_tipos`           | Tipos de card + extensões padrão; `cards.card_tipo_id`.            |
| `card_entity_links`    | Vínculo polimórfico card ↔ entidade (`entity_type`, `entity_id`).  |
| `kanban_extensao_log`  | Auditoria de criação, remoção e ações de extensão.                 |

Toda escrita passa por RPCs `SECURITY DEFINER` (`card_entity_link_criar`,
`card_entity_link_remover`, `card_entity_link_definir_principal`,
`card_entity_links_listar`, `cards_por_entidade`,
`card_entity_links_verificar_integridade`), que validam existência da entidade,
empresa, duplicidade e permissão. A UI apenas espelha as regras.

## Camada de código

- `src/lib/quadros/extensoes/tipos.ts` — contratos (`ExtensaoDef`, `EntityAdapter`, `CardVinculo`).
- `src/lib/quadros/extensoes/registry.ts` — metadados de apresentação (puro).
- `src/lib/quadros/extensoes/vinculos.ts` — regras puras de validação, ordenação e resumo (testado).
- `src/lib/quadros/extensoes/adapters.ts` — adaptadores por domínio (obra, cronograma, usuário).
- `src/lib/repositories/kanbanExtensoes.ts` — acesso a dados.
- `src/hooks/quadros/useExtensoes.ts` — hooks React Query.

## UI

- `BoardExtensoesTab` — aba "Extensões" na configuração do quadro.
- `CardVinculosSection` — painel por extensão no detalhe do card, cada um em
  *error boundary*: extensão que falha não derruba o card.
- `VincularEntidadeDialog` — busca de entidade + criação de vínculo.
- `CardsVinculadosPanel` — navegação inversa (entidade → cards).

## Como adicionar uma nova extensão

1. Inserir linha em `kanban_extensoes` (migration).
2. Adicionar `ExtensaoDef` em `registry.ts`.
3. Implementar `EntityAdapter` em `adapters.ts` (busca, resumo, rota).
4. Estender `kanban_entidade_info` para o novo `entity_type`.

Nenhum arquivo do motor Kanban precisa mudar.

## Fora do escopo desta etapa

Regras funcionais de compras, produção, estoque e reconciliação de cronograma.
Aqui os vínculos são técnicos e neutros.
