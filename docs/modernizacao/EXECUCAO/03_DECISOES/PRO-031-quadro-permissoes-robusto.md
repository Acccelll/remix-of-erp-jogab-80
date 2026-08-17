# PRO-031 — Quadro de Permissões Robusto (GM / Permissões)

> Status: **Proposta de design** · Onda: aderente ao contrato atual (não requer abrir Ondas 2/6)
> Origem: pedido do GM para transformar `/gm/permissoes` em ferramenta operacional
> (hoje é somente-leitura) e separar **cadastro de usuário** de **atribuição de permissão**.

---

## 1. Diagnóstico da tela atual

Arquivo: `src/pages/gm/Permissoes.tsx` · Modelo: `Player.acessos: Record<PageKey, NivelAcesso>`
(tipos em `src/types/index.ts`, hooks em `src/contexts/auth/usePermissions.ts` e
`src/lib/authz/index.ts`).

| Aspecto | Situação hoje | Limitação |
|---|---|---|
| Escopo | Matriz **usuário × módulo** (10 `PageKey`) | Cada módulo tem várias páginas — hoje herdam o mesmo nível |
| Níveis | `nenhum · visualizar · editar · compras · financeiro` | "compras" e "financeiro" convivem no mesmo eixo de "editar" (dupla função: nível **e** papel) |
| Ações | Não distingue **Editar / Excluir / Importar / Exportar** | Regras finas ficam espalhadas no código (`useAuthz`, hooks de página) |
| Edição | Somente-leitura; edição real fica em `/gm` (Usuários) | GM precisa alternar de tela e o form do usuário mistura cadastro + permissão |
| Presets | Existem via `PerfisPermissaoDialog` (PRO-028) mas só por **módulo**, não por **página × ação** | Perfis atuais ficam grossos demais para funções comuns (Fiscal, Comprador, RH-Ver, etc.) |
| Escala | 10 colunas × N usuários, badge por célula | Não escala para páginas; ilegível em telas pequenas |

**Conclusão:** o modelo `PageKey × NivelAcesso` é bom como *fallback* de módulo, mas
precisa de uma **camada de granularidade por página e por ação** para virar operacional.

---

## 2. Modelo proposto

### 2.1 Eixos

```
Módulo  ─►  Página        ─►  Ação
(grupo)     (rota real)      V · E · X · I · Ex  (+ papéis especiais)
```

- **Módulo** = grupo do `NAV_REGISTRY` (`Obras`, `RH`, `DP`, `Suprimentos`, `Financeiro`, …).
- **Página** = cada `NavItem` do registro (Gestão de Equipe, Quadros, Colaboradores, …), incluindo `HIDDEN_NAV_ITEMS` relevantes.
- **Ações** (colunas fixas):
  - **V — Visualizar**: leitura da página + relatórios (auditoria).
  - **E — Editar**: criar/atualizar registros.
  - **X — Excluir**: apagar/arquivar (log obrigatório).
  - **I — Importar**: carga em massa (XLS/CSV/TOTVS).
  - **Ex — Exportar**: baixar planilhas, PDFs, dumps.
- **Papéis especiais** (não são níveis, são *capabilities*, fora da grade V/E/X/I/Ex):
  - **Aprovar Compras** (`role:approve.compras`)
  - **Aprovar Financeiro** (`role:approve.financeiro`)
  - **Gerir Setor** (fiscalização, qualidade, engenharia, segurança) — usado pelas RLS `user_pode_aprovar_medicao` etc.

Isso resolve o item 3 do pedido: **compras/financeiro deixam de disputar o eixo "nível"**
e passam a ser *toggles* claros na coluna direita da linha da página **Aprovação Financeira**.

### 2.2 Regra de herança

1. **GM** — sempre `true` em tudo (short-circuit em `useAuthz`).
2. Toggle na linha do **Módulo** funciona como *bulk toggle* — marca/desmarca todas as páginas filhas para aquela ação. Fica em estado `indeterminate` quando as filhas divergem.
3. Cada **página** pode sobrescrever ponto-a-ponto.
4. **Excluir** exige **Editar** marcado (validação de UI + no serviço).
5. **Importar/Exportar** independem de Editar (auditor pode exportar sem editar).

### 2.3 Presets (item 4)

Presets salvos como `PerfilPermissao` (já existe em `mem://funcionalidades` e `src/lib/players/perfisPermissao.ts`),
estendendo o schema para o novo formato:

```ts
type Acao = "V" | "E" | "X" | "I" | "Ex";
type PermMatriz = Record<
  string /* rota do NavItem */,
  Partial<Record<Acao, boolean>>
>;

interface PerfilPermissao {
  id: string;
  nome: string;             // "Fiscal de Obra", "Comprador", "Auditor", …
  descricao?: string;
  matriz: PermMatriz;
  papeis: {
    aprovarCompras?: boolean;
    aprovarFinanceiro?: boolean;
    setores?: string[];     // fiscalizacao | qualidade | engenharia | seguranca
  };
  createdAt: string;
  updatedAt: string;
}
```

Presets de fábrica (seed inicial):

| Preset | Perfil típico |
|---|---|
| **Auditor** | V em tudo · Ex em relatórios · nunca E/X/I · sem papéis |
| **Fiscal de Obra** | V/E em Obras, Qualidade, RDO · setor `fiscalizacao` |
| **Engenheiro Residente** | V/E/X em Obras, Planejamento, Qualidade · aprovar compras |
| **Comprador** | V/E em Suprimentos · I/Ex em cotações e OCs · aprovar compras |
| **Almoxarife** | V/E em Patrimônios, Estoque, Recebimento · Ex |
| **RH — Visualização** | V em RH, DP, Colaboradores · Ex |
| **RH — Operação** | V/E/I em RH · V/E/I/Ex em DP · aprovar folha |
| **Financeiro — Analista** | V/E em Financeiro (menos Aprovação) · I/Ex |
| **Financeiro — Aprovador** | herda Analista + aprovar financeiro |
| **CRM — Vendedor** | V/E em CRM · Ex em relatórios |
| **GM (read-only preview)** | usado só para *dry-run*: V/Ex em tudo |

Presets vivem em `localStorage` (chave já existente `STORAGE_KEYS.perfisPermissao`)
enquanto **PRO-028/slice-02** não migrar para Cloud; API do hook `usePerfisPermissao`
segue igual, ganha campo `matriz` e `papeis`.

### 2.4 Cobertura (item 5)

Fonte única de páginas = `NAV_REGISTRY` + subset curado de `HIDDEN_NAV_ITEMS`
(gerado com um helper `listPaginasParaPermissao()` em `src/lib/authz/paginas.ts`).
Toda página listada ali aparece automaticamente no quadro — sem código morto.

---

## 3. Layout (item 6)

Wireframe ASCII (desktop ≥ 1280px), fiel ao pedido do GM:

```text
┌─ Permissões · Usuário: Fulano da Silva ───── [Preset ▾] [Salvar como preset] [Salvar] ─┐
│                                                                                        │
│  ┌─ Obras ─────────────────────────────  [▾]  [☐ V] [☐ E] [☐ X] [☐ I] [☐ Ex] ─────┐    │
│  │  Gestão de Equipe                          [☑]   [☑]   [☐]   [☐]   [☐]        │    │
│  │  Quadros                                   [☑]   [☑]   [☐]   [☐]   [☐]        │    │
│  │  Planejamento Lean                         [☑]   [☐]   [☐]   [☐]   [☐]        │    │
│  │  Qualidade                                 [☑]   [☑]   [☐]   [☐]   [☐]        │    │
│  │  Mobilização Provisória                    [☑]   [☐]   [☐]   [☐]   [☐]        │    │
│  │  Obras                                     [☑]   [☑]   [☑]   [☐]   [☑]        │    │
│  │  Dashboard de Obras                        [☑]   [☐]   [☐]   [☐]   [☐]        │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                        │
│  ┌─ Financeiro ────────────────────────  [▾]  [☐ V] [☐ E] [☐ X] [☐ I] [☐ Ex] ─────┐    │
│  │  Dashboard                                 [☑]   [☐]   [☐]   [☐]   [☑]        │    │
│  │  Lançamentos                               [☑]   [☑]   [☐]   [☑]   [☑]        │    │
│  │  Aprovação Financeira    [Papel: ☑ Aprovar compras   ☑ Aprovar financeiro]     │    │
│  │  Despesas                                  [☑]   [☑]   [☐]   [☐]   [☑]        │    │
│  │  …                                                                             │    │
│  └────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                        │
│  [+ Mostrar módulos vazios]                                                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

Componentes shadcn a usar: `Accordion` para o cabeçalho do módulo, `Checkbox` com estado `indeterminate` para a linha do módulo, `Tooltip` explicando cada ação, `Command` para o seletor de preset, `Sheet` lateral para "Duplicar permissões de outro usuário".

### 3.1 Cabeçalho / rodapé

- **Seletor de usuário** (autocomplete) no topo — GM edita um usuário por vez.
- **Preset ▾** com lista de perfis + botão *Aplicar (substituir)* / *Aplicar (mesclar)* — reaproveita `aplicarPerfilEmPlayer` que já existe em `perfisPermissao.ts`.
- **Salvar como preset** — grava a matriz atual como novo `PerfilPermissao`.
- **Diff badge** — ao editar, mostra "3 alterações não salvas" antes de gravar.
- **Botão "Duplicar de…" ** — copia matriz de outro usuário.
- **Somente-leitura** para não-GM (mantém o comportamento atual da rota).

### 3.2 Mobile / <1024px

Colapsa em **Sheet** por módulo; ações viram lista vertical com `Switch`.

---

## 4. Separação: **Cadastro** vs **Permissão**

| Tela | Papel |
|---|---|
| `/gm` (Usuários) | Só cadastro: login, e-mail, empresa, papel base, ativar/desativar, resetar senha, GM sim/não |
| `/gm/permissoes` | Editor completo da matriz (novo) — abre já filtrado no usuário selecionado, com link direto do card de usuário |

Fluxo do GM ao criar usuário novo:

1. `/gm` → *Novo usuário* → escolhe **Preset inicial** (dropdown obrigatório).
2. Sistema grava player + aplica `preset.matriz` + `preset.papeis`.
3. Botão "Ajustar permissões" leva direto para `/gm/permissoes?user=<id>`.

O form de usuário deixa de mostrar a matriz de acessos (hoje mistura tudo).

---

## 5. Integração com `useAuthz` / RLS

- `useAuthz.can({ kind: "page", page, level })` continua a API **estável** para o resto do app.
- Sob o capô, o resolvedor passa a mapear a nova matriz para os `NivelAcesso` legados:
  - `V` → mínimo `visualizar`
  - `E` → mínimo `editar`
  - `X/I/Ex` → capabilities lidas por `useAuthz.can({ kind: "action", page, action: "excluir" })` (extensão do enum `AuthzAction`).
- Papéis `aprovarCompras` / `aprovarFinanceiro` alimentam `useAuthz.can({ kind: "action", action: "aprovar.*" })`.
- **RLS no banco** (setores, obra_membros) permanece intacta — a UI só espelha.

Migração é **compatível**: usuários existentes têm sua `acessos` atual convertida por regra:
`{ V: nivel ≥ visualizar, E: nivel ≥ editar, X/I/Ex: nivel ≥ editar }` como default até
o GM refinar.

---

## 6. Entregáveis sugeridos (para virar backlog)

| ID | Item | Tamanho |
|---|---|---|
| PRO-031-01 | `src/lib/authz/paginas.ts` — derivar lista de páginas do `NAV_REGISTRY` + curadoria de `HIDDEN_NAV_ITEMS` | S |
| PRO-031-02 | Estender `PerfilPermissao` para `matriz` + `papeis` (com migração retro-compatível dos perfis salvos hoje) | M |
| PRO-031-03 | Nova `/gm/permissoes` editável (accordion + checkboxes com `indeterminate` + presets) | L |
| PRO-031-04 | Extensão de `useAuthz` para eixo de ações (`excluir`, `importar`, `exportar`, `aprovar.*`) | M |
| PRO-031-05 | Remoção da matriz do form de `/gm` (Usuários) + botão "Ajustar permissões" | S |
| PRO-031-06 | Seed dos 11 presets de fábrica + testes puros | M |
| PRO-031-07 | Doc de operação em `docs/onboarding.md` (como GM aplica preset) | S |

Não requer migration de banco nesta fase — a persistência é local (mesma chave já usada
por `usePerfisPermissao`). Movimentação para Cloud fica junto com PRO-028/slice-02.

---

## 7. Decisões pendentes p/ GM

1. Confirmar as **5 ações** propostas (V/E/X/I/Ex) ou incluir uma sexta (ex.: *Publicar*, *Comentar*)?
2. Presets de fábrica: aprovar a lista da §2.3 ou ajustar nomes?
3. "Excluir requer Editar" — manter como regra dura ou permitir excluir-somente para papéis de auditoria?
4. Onde exibir o botão "Duplicar de…" — no header da tela ou dentro do menu "Preset ▾"?
