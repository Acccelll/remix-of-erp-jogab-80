# Glossário

## Resumo Executivo

Terminologia normalizada, obrigatória em toda a documentação e execução. Fixada na Etapa 5.5.

## Objetivo

Eliminar ambiguidade entre auditoria, planejamento e execução.

## Escopo

Módulos, camadas, conceitos de arquitetura e vocabulário de governança.

## Conteúdo

### Módulos do produto

| Código | Módulo                                                |
| ------ | ----------------------------------------------------- |
| M1     | Gestão de Equipe (Board de alocação)                  |
| M2     | Quadros / Cards (Kanban genérico)                     |
| M3     | Obra 360º (cronograma, medição, faturamento, análise) |
| M4     | Planejamento Lean (Last Planner)                      |
| M5     | Qualidade / Inspeções                                 |
| M6     | RDO (Diário de Obra)                                  |
| M7     | Suprimentos                                           |
| M8     | Financeiro                                            |
| M9     | Departamento Pessoal                                  |
| M10    | Recursos Humanos                                      |
| M11    | CRM                                                   |
| M12    | Contratos                                             |
| M13    | Ativos & Frotas                                       |
| M14    | GM / Governança                                       |
| M15    | Admin / Multiempresa                                  |

### Termos canônicos

| Termo                             | Definição                                                                       | Proibido usar              |
| --------------------------------- | ------------------------------------------------------------------------------- | -------------------------- |
| **Backend PHP legado**            | `api.php` em jogab.com.br + entidades servidas por ele                          | "API antiga", "MySQL"      |
| **Supabase**                      | Postgres/Auth/Storage/Edge Functions do projeto                                 | "backend novo"             |
| **Geração legada**                | Padrão AppContext + PHP (fetch imperativo, otimismo manual)                     | "código velho"             |
| **Geração moderna**               | Padrão lib pura + repositories + TanStack Query                                 | "código novo"              |
| **Fronteira dupla**               | A coexistência PHP ↔ Supabase; causa-raiz recorrente                            | —                          |
| **Primitivos**                    | Componentes em `components/ui/`                                                 | "átomos"                   |
| **Compostos de produto**          | Componentes compartilhados acima de `ui/` (QueryState, HubTabs…)                | "helpers", "commons"       |
| **Hub**                           | Página com `HubTabs` e estado em `?tab=`                                        | "página com abas"          |
| **Achado**                        | Item do Catálogo Mestre, com ID permanente                                      | "problema", "issue" sem ID |
| **Descoberta de Execução (D-xx)** | Item encontrado durante a implementação; **não** é Achado                       | —                          |
| **Cisão**                         | Divisão de um Achado em partes executáveis em ondas distintas; não cria ID novo | —                          |

### Conceitos técnicos

- **EVM** — Earned Value Management (BAC/PV/EV/AC/SPI/CPI/EAC/ES).
- **CPM** — Critical Path Method (cronograma).
- **LPS / Last Planner** — pacotes, restrições, lookahead, PPC.
- **BMS** — Boletim de Medição de Serviços.
- **RLS** — Row Level Security (Postgres).
- **Three-way match** — conferência OC × recebimento × nota fiscal.
- **god-context** — provider único concentrando sessão, autorização e estado de vários domínios.

## Conclusão

Divergir desta terminologia gera ambiguidade rastreável. Use os termos canônicos.

## Referências

- [Convenções](Convencoes.md) · [Taxonomia de Prioridades](Taxonomia_Prioridades.md) · [Catálogo Mestre](../../EXECUCAO/02_CATALOGO/Catalogo_Mestre.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
