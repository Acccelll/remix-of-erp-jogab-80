# Catálogo da Biblioteca de Componentes (DS-014)

**Status:** fonte única de referência para a UI do GestãObra.
**Origem:** Achado DS-014 · Onda 4 · Programa de Modernização.

Todo componente novo deve procurar aqui antes de ser criado. Duplicações
são bloqueadas por revisão. Componentes marcados `[canônico]` são de uso
obrigatório para o caso de uso descrito.

---

## 1. Primitivos shadcn (`src/components/ui/`)

Base do design system. Não editar diretamente sem discussão — são o
espelho tokenizado do shadcn/ui.

| Componente        | Uso                                                   |
| ----------------- | ----------------------------------------------------- |
| `accordion`       | Expansão vertical em listas longas.                   |
| `alert`           | Bandeira contextual de aviso/erro/info.               |
| `alert-dialog`    | Confirmações destrutivas (via `confirmDialog`).       |
| `avatar`          | Foto/iniciais de colaborador ou perfil.               |
| `badge`           | Status curtos (usar variantes semânticas).            |
| `breadcrumb`      | Navegação hierárquica em telas de detalhe.            |
| `busy-overlay`    | Overlay de operação em progresso sobre bloco.         |
| `button`          | Toda ação primária/secundária/destrutiva.             |
| `calendar`        | Seleção de data (combinar com Popover).               |
| `card`            | Contêiner de bloco visual (título + conteúdo).        |
| `carousel`        | Carrossel horizontal responsivo.                      |
| `chart`           | Wrapper tokenizado de recharts (**DS-008 preferido**).|
| `checkbox`        | Booleanos e multi-seleção em listas.                  |
| `chips-number-input` | Entrada de múltiplos números como chips.           |
| `cnpj-input`      | Máscara e validação de CNPJ.                          |
| `collapsible`     | Expansão inline curta.                                |
| `combobox`        | Select com busca embutida.                            |
| `command`         | Palette / lista comandável.                           |
| `context-menu`    | Menu por clique direito.                              |
| `data-table`      | **[canônico]** Tabela paginada com sort.              |
| `dialog`          | Modal genérico. Tamanhos: sm/md/lg/xl (DS-015).       |
| `dropdown-menu`   | Menu de ações contextuais.                            |
| `filter-bar`      | Barra padronizada de filtros no topo de listas.       |
| `form`            | Wrapper react-hook-form + zod.                        |
| `hover-card`      | Preview em hover.                                     |
| `input` / `input-otp` | Entrada de texto e OTP.                           |
| `label`           | Rótulo semântico para formulários.                    |
| `menubar` / `navigation-menu` | Menus horizontais.                        |
| `money-input`     | **[canônico]** Entrada de valores monetários BRL.     |
| `multi-select`    | Seleção múltipla com chips.                           |
| `pagination`      | Primitivo — prefira `PaginationControls` (common).    |
| `percent-input`   | Entrada de percentuais 0–100.                         |
| `popover`         | Contêiner flutuante ancorado.                         |
| `progress`        | Barra de progresso 0–100.                             |
| `radio-group`     | Escolha única.                                        |
| `resizable`       | Painéis com divisor arrastável.                       |
| `scroll-area`     | Rolagem estilizada.                                   |
| `select`          | Escolha única em lista curta.                         |
| `separator`       | Divisor visual.                                       |
| `sheet`           | Drawer lateral (off-canvas).                          |
| `sidebar`         | Sidebar principal do app.                             |
| `skeleton`        | Placeholder de carregamento.                          |
| `slider`          | Faixa numérica.                                       |
| `sonner`          | **[canônico]** Sistema único de toasts (DS-002).      |
| `sort-header`     | Cabeçalho ordenável de tabela.                        |
| `sparkline`       | Mini-gráfico de tendência.                            |
| `switch`          | Booleano com efeito visual.                           |
| `table`           | Primitivo — prefira `data-table` (DS-009).            |
| `tabs`            | Navegação em abas.                                    |
| `textarea`        | Texto multi-linha.                                    |
| `toast`           | **DEPRECADO** — usar `sonner`.                        |
| `toggle` / `toggle-group` | Toggle simples ou agrupado.                   |
| `tooltip`         | Dica curta em hover/focus.                            |

---

## 2. Componentes de aplicação (`src/components/common/`)

Compostos, com convenções do app.

| Componente             | Uso                                                        |
| ---------------------- | ---------------------------------------------------------- |
| `ChangePasswordDialog` | Diálogo canônico de troca de senha.                        |
| `CollapsibleSection`   | Bloco expansível com título/contador.                      |
| `ColumnFilter`         | Popover para ocultar/reordenar colunas em tabelas.         |
| `ContactsManager`      | Editor embutido de contatos (nome/telefone/e-mail).        |
| `DeleteConfirmDialog`  | **[canônico]** Confirmação destrutiva com nome do item.    |
| `DesktopOnlyHint`      | Aviso "abra no desktop" para telas complexas.              |
| `EmptyState`           | **[canônico]** Estado vazio com CTA (DS-004).              |
| `ErrorBoundary`        | Captura de erros React por região.                         |
| `FeatureGate`          | Renderização condicional por feature flag.                 |
| `HistoricoSection`     | Seção de histórico paginada padrão.                        |
| `HubTabs`              | Abas de hubs (Financeiro, Contratos etc.).                 |
| `Kpi`                  | **[canônico]** KPI compacto (DS-007) — abolir StatCards.   |
| `MaskedDateInput`      | Entrada de data com máscara pt-BR.                         |
| `NavLink`              | Link com estado ativo consistente.                         |
| `ObrasFilter`          | Filtro multi-obra padrão.                                  |
| `PageLoading`          | Skeleton de página inteira em loading inicial.             |
| `PaginationControls`   | **[canônico]** Paginação padrão de listas (DS-010).        |
| `QueryState`           | **[canônico]** `<QueryState query={q}>` — envolve loading/erro/vazio (DS-004). |
| `ReauthDialog`         | Reautenticação em ações sensíveis.                         |
| `StatusFilter`         | Filtro múltiplo por status com contagem.                   |

---

## 3. Fontes únicas fora de `components/`

| Fonte           | Módulo                             | Substitui                    |
| --------------- | ---------------------------------- | ---------------------------- |
| `formatBRL`     | `@/lib/currency`                   | inline `toLocaleString BRL`. |
| `fmtData*`      | `@/lib/date`                       | inline `toLocaleDateString`. |
| `STATUS_*`      | `@/lib/status`                     | mapas status locais.         |
| `confirmDialog` | `@/lib/ui/confirm`                 | `window.confirm`.            |
| `reportError` / `swallow` | `@/lib/errors`           | `console.warn/error` em catch. |
| `queryKey()`    | `@/lib/query-keys`                 | strings soltas em TanStack.  |

---

## 4. Regras editoriais

1. **Nada de shadcn cru** para casos com `[canônico]` declarado.
2. **Toasts** só via `sonner` (import `toast` de `sonner`).
3. **Estados de query** via `QueryState` — evita spinner manual.
4. **Tabelas grandes** via `data-table`; pequenas via `Table` cru.
5. **Diálogos destrutivos** via `DeleteConfirmDialog` ou `confirmDialog`.
6. **Moeda/Datas/Status** — sempre a fonte única (seção 3).
7. Componentes novos precisam de justificativa (não substitui existente).

## Referências

- Achado DS-014 · Onda 4.
- Achados relacionados: DS-002, DS-004, DS-006, DS-007, DS-009, DS-010,
  DS-015, BIZ-004, QC-003.
