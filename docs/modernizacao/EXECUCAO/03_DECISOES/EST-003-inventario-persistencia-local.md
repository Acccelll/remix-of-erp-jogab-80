# EST-003 — Inventário de persistência local

> **Status:** inventário fechado. Fonte da verdade: `src/lib/storage/keys.ts`.
> **Prefixos legados em uso:** `planifik:*`, `obraflow*`, `buildflow:*`, `lovable.*`, `go_*`.
> **Prefixo canônico:** `gestaobra:<dominio>:<nome>` via `makeStorageKey`.

## 1. Chaves catalogadas (28)

Todas registradas em `STORAGE_KEYS`. Nenhuma chave nova deve ser criada fora deste inventário.

| Domínio | Chave | Prefixo | Origem |
|---|---|---|---|
| Auth | `go_token`, `go_player` | `go_` | Bootstrap |
| Tema/UI | `planifik_theme`, `planifik:nav:openGroups`, `planifik:nav:recent`, `planifik:nav:favorites` | `planifik*` | Legado |
| PWA | `planifik:pwa:installDismissed`, `lovable.onboarding.*` | `planifik*`/`lovable.` | Legado |
| Sino | `notif-bell-tipos-ocultos` | *(sem)* | Legado |
| Empresa | `obraflow.empresaAtualId`, `gestaobra:empresa:parametrizacao`, `gestaobra:empresa:documentoNumeracao` | misto | PRO-031 canônico |
| Rascunhos | `obraflow:mob-prov`, `buildflow:rpc-p95-baseline:v1` | Legado |  |
| Colunas | `obras:columnVisibility` | *(sem)* | Legado |
| CRM | `gestaobra:crm:*` (tarefas, motivosPerda, perdas) | canônico | PRO-001/002 |
| Notif | `gestaobra:notif:categoriasOcultas`, `gestaobra:notif:dedupe` | canônico | PRO-030 |
| Financeiro | `gestaobra:fin:importCadencia` | canônico | PRO-015 |
| Suprimentos | `gestaobra:suprimentos:envios`, `gestaobra:estoque:contagensCiclicas` | canônico | PRO-010/012 |
| Quadros | `gestaobra:quadro:automacoes(Executadas\|Desativadas)` | canônico | PRO-027 |
| Contratos | `gestaobra:contratos:documentos`, `gestaobra:contratos:alertaSilenciados` | canônico | PRO-021/019 |
| Players | `gestaobra:players:perfisPermissao` | canônico | PRO-028 |
| RDO/DP | `gestaobra:rdo:numeracao`, `gestaobra:dp:fechamentosCompetencia` | canônico | PRO-005/003 |
| BMS | `gestaobra:bms:layoutPerfis` | canônico | PRO-018 |

## 2. Chaves dinâmicas (não catalogáveis 1:1)

Composições de template em runtime — aceitáveis desde que documentadas aqui:

| Padrão | Origem | Uso |
|---|---|---|
| `allocboard:${storageKey}` | `AllocationBoard.tsx` | Estado do board por instância |
| `collapsible:${storageKey}` | `CollapsibleSection.tsx` | Estado aberto/fechado por seção |
| `lovable.onboarding.${storageKey}` | Hints de onboarding | Fora do domínio de negócio |

**Recomendação:** migrar `allocboard:*` e `collapsible:*` para `makeStorageKey("ui", "allocboard:*"/"collapsible:*")` em onda futura — nenhum ganho imediato sem migração de estado do usuário.

## 3. Chaves fora do escopo (sessionStorage)

- `obraPrefill` — `sessionStorage` em `CRMFunil.tsx` / `Obras.tsx`. Volátil por aba, não é objeto deste inventário.

## 4. Órfãos encontrados e corrigidos

- **`gestaobra:notif:dedupe`** — criada no PRO-030 slice-02 inline. Registrada como `STORAGE_KEYS.notifDedupe` e o call-site (`src/lib/notificacoes/index.ts`) passou a referenciar a constante. **Nenhuma chave inline restante** no domínio canônico após esta correção.

## 5. Plano de migração (não escopo Onda 7)

Prefixos legados coexistem por compatibilidade com estado do usuário. Migração exige:

1. Reader dual em cada call-site (`localStorage.getItem(nova) ?? getItem(antiga)`).
2. Writer só na nova (`setItem(nova)`).
3. `removeItem(antiga)` após N releases.

Achados sujeitos a migração futura:
- `planifik_theme` → `gestaobra:ui:theme`
- `planifik:nav:*` → `gestaobra:nav:*`
- `planifik:pwa:installDismissed` → `gestaobra:pwa:installDismissed`
- `obraflow.empresaAtualId` → `gestaobra:empresa:atualId`
- `obraflow:mob-prov` → `gestaobra:mobilizacao:draft`
- `buildflow:rpc-p95-baseline:v1` → `gestaobra:telemetria:rpc-p95-baseline`
- `obras:columnVisibility` → `gestaobra:obras:columnVisibility`
- `notif-bell-tipos-ocultos` → `gestaobra:notif:bellTiposOcultos`
- `go_token`/`go_player` → **manter** (auth com semântica de sessão, migrar só quando trocarmos o adaptador de auth).
- `lovable.onboarding.*` → **manter** (namespace de plataforma).

## 6. Guarda-corpo

- Novo linter recomendado (onda futura): eslint rule que proíba `localStorage.getItem/setItem/removeItem` com literal string, exigindo `STORAGE_KEYS.<chave>` ou `makeStorageKey`.
- CI check simples: `rg 'localStorage\.(get|set|remove)Item\(\s*"'` deve retornar zero em `src/**` (hoje ainda retorna auth legados e templates dinâmicos — aceitos por exceção documentada).
