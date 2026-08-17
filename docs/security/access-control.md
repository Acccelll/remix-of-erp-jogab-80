# Controle de Acesso — Planifik / GestãObra

Este documento descreve o modelo de autorização usado no backend (Supabase/Postgres),
como as políticas RLS são estruturadas e onde os dados sensíveis estão protegidos.
Use-o como referência para auditorias e para adicionar novas tabelas/políticas.

---

## 1. Modelo de autenticação

O app usa autenticação **híbrida**:

| Camada | Papel |
| --- | --- |
| **PHP legado** | Fonte primária de credenciais (login/senha). Retorna o "player" e suas permissões. |
| **Supabase Auth** | Sessão espelhada, criada pela edge function `sync-player-auth` (usa `service_role`). É essa sessão que fornece `auth.uid()` nas policies. |
| **`public.profiles`** | Liga `auth.uid()` → `players.login` (campo `login`). Populada pelo trigger `handle_new_user` e pelo sync. |
| **`public.players`** | Fonte de verdade das permissões de aplicação. Colunas relevantes: `login`, `is_gm` (bool), `acessos` (jsonb — `{ modulo: "editar" \| "visualizar" \| "nenhum" }`), `senha` (hash — nunca exposta a `authenticated`). |

> **Nota:** `public.user_roles` e `has_role(uuid, app_role)` existem por compatibilidade,
> mas **não** são usados para gating de dados sensíveis. A fonte de verdade é `players.acessos`.

---

## 2. Função-chave: `current_player_has_access(_module text)`

```sql
CREATE OR REPLACE FUNCTION public.current_player_has_access(_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.players  pl ON pl.login = pr.login
    WHERE pr.id = auth.uid()
      AND (
        pl.is_gm = true
        OR COALESCE(pl.acessos->>_module, 'nenhum') IN ('editar','visualizar')
      )
  );
$$;
```

Características:

- **SECURITY DEFINER** — executa com o dono da função e ignora o RLS de `profiles`/`players`,
  evitando recursão e vazamento de leitura indireta.
- **STABLE** — o Postgres pode cachear o resultado por linha na mesma query.
- **`search_path = public`** — evita hijack de schema.
- Aceita qualquer chave usada em `players.acessos` (`dp`, `financeiro`, `compras`, `crm`, ...).
- **GM sempre passa.** Um usuário com `is_gm = true` tem acesso a qualquer módulo.

**Como usar em uma policy:**

```sql
CREATE POLICY tabela_sensivel_select ON public.tabela_sensivel
  FOR SELECT TO authenticated
  USING (public.current_player_has_access('dp'));
```

---

## 3. Padrões de policy no projeto

Todas as tabelas em `public.*` têm **RLS habilitada** e são acessíveis apenas ao role
`authenticated` (nunca `anon`). Existem três padrões:

### 3.1. Tabelas operacionais (padrão amplo)

Ex.: `obras`, `cards`, `cronograma_*`, `financeiro_*`, `notas_fiscais`, `patrimonios`, ...

```sql
CREATE POLICY <tab>_auth_select ON public.<tab> FOR SELECT TO authenticated USING (true);
CREATE POLICY <tab>_auth_insert ON public.<tab> FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY <tab>_auth_update ON public.<tab> FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY <tab>_auth_delete ON public.<tab> FOR DELETE TO authenticated USING (true);
```

**Justificativa:** ERP interno; gating fino é feito no frontend a partir de
`players.acessos`. Aceito como risco (ver `security-memory`).

### 3.2. Tabelas com PII / dados sensíveis (SELECT restrito)

| Tabela | SELECT | INSERT/UPDATE/DELETE |
| --- | --- | --- |
| `colaboradores` | `current_player_has_access('dp')` | `authenticated` (amplo) |
| `dp_holerite`   | `current_player_has_access('dp')` | `authenticated` (amplo) |

> Escrita fica ampla porque as telas de cadastro/importação de folha são acessíveis
> a operadores que ainda não têm o módulo `dp` marcado como `editar`. Se essa premissa
> mudar, aplique o mesmo gating em `INSERT/UPDATE/DELETE`.

### 3.3. Tabela `players` (colunas sensíveis revogadas)

```sql
REVOKE SELECT ON public.players FROM authenticated;
GRANT  SELECT (id, login, email, is_gm, acessos, created_at)
       ON public.players TO authenticated;
GRANT  ALL ON public.players TO service_role;
```

- A coluna **`senha`** só é acessível via `service_role` (edge functions e admin).
- As policies `players_auth_*` continuam existindo para autorizar as demais colunas.

---

## 4. Checklist ao criar uma nova tabela

1. `CREATE TABLE public.<t> (...)`.
2. `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;`
   `GRANT ALL ON public.<t> TO service_role;`
   *(não inclua `anon` — o app é 100% autenticado).*
3. `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;`
4. Escolha o padrão:
   - **Operacional** → 4 policies `USING (true)` / `WITH CHECK (true)`.
   - **Sensível** → SELECT (e possivelmente INSERT/UPDATE/DELETE) usando
     `public.current_player_has_access('<modulo>')`.
5. Se a tabela contiver colunas ultrassensíveis (senhas, tokens, hashes),
   revogue SELECT amplo e regrante apenas as colunas seguras (ver §3.3).
6. Nunca faça policy que consulte a **própria tabela** — use SECURITY DEFINER.

---

## 5. Como auditar

Consultas úteis (rodar como service_role):

```sql
-- Todas as policies do schema public
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Tabelas sem RLS habilitada
SELECT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

-- Grants por coluna (útil para players.senha)
SELECT table_name, column_name, privilege_type, grantee
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'players'
ORDER BY column_name, grantee;

-- Quem tem cada módulo hoje
SELECT login, is_gm, acessos FROM public.players ORDER BY login;
```

---

## 6. Regras invioláveis

- ❌ `players.senha` **nunca** pode ser lida por `authenticated`/`anon`.
- ❌ PII de `colaboradores` e valores de `dp_holerite` **nunca** podem ser lidos
  por usuário sem `dp` (ou GM).
- ❌ Nenhuma tabela `public.*` pode ficar sem RLS habilitada.
- ❌ Nenhuma policy pode conceder acesso a `anon`.
- ✅ Toda escrita sensível feita fora do cliente (folha, sync de auth, admin) deve
  usar `service_role` via edge function.

---

## 7. Referências no código

- Edge function de sincronização: `supabase/functions/sync-player-auth/`
- Hook de sessão/permissões no frontend: `src/context/AppContext.tsx`
- Utilitário de permissões UI: `src/lib/permissions.ts` (mesma semântica de `acessos`)
- Migration da função e policies sensíveis: ver histórico com
  `current_player_has_access` no timeline de migrations.

---

## 8. Matriz de permissões, Setores e Aprovação Financeira (MySQL/PHP + React)

> **Leia antes de mexer na matriz de permissões, no módulo de Gerenciamento (GM)
> ou na lista de Setores.** Estas peças estão fortemente acopladas; alterar uma
> sem as outras cria brechas silenciosas ou tranca usuários. Esta seção cobre o
> caminho **MySQL/PHP (`api.php`) + React** — complementar ao RLS do Supabase
> descrito acima.

### 8.1. Setor tem UMA fonte de verdade, espelhada em 3 lugares

A lista canônica de setores é `SETORES_SUPABASE` em
`src/lib/authz/paginas.ts`. Os valores são **slugs** (`engenharia`, `dp`,
`financeiro`, `compras`, `seguranca`, `fiscalizacao`, `qualidade`,
`almoxarifado`, `frotas`) — `dp` tem o rótulo "Depto. Pessoal". Ela é
**espelhada manualmente** em três lugares que precisam ser mantidos em
sincronia:

| Onde | Arquivo | O que espelha |
| --- | --- | --- |
| Frontend (fonte) | `src/lib/authz/paginas.ts` → `SETORES_SUPABASE`, `normalizarSetores`, `normalizarSetorLegado` | slugs + rótulos + normalização de rótulos legados |
| Backend MySQL | `api.php` → `setoresValidosFin() / setoresLabelFin() / setoresLegadoFin() / normalizarSetorLegadoFin()` | **cópia idêntica** da lista e da normalização, para filtrar no servidor |
| Backend Supabase | `supabase/functions/sync-player-auth/index.ts` → `SETORES_VALIDOS` + enum `public.app_role` | allowlist para o RLS legado |

➡️ **Ao adicionar/renomear/remover um setor:** edite os **três** lugares (e, no
Supabase, o enum `app_role` via migration). Se os rótulos legados mudarem
(hoje só `RH→dp`), atualize o mapa nos dois `normalizarSetorLegado*` (TS e PHP)
— eles precisam devolver o mesmo slug.

⚠️ **Promover um rótulo legado a setor exige tirá-lo do mapa legado**, nos dois
lados. Foi o caso de `Almoxarifado` e `Frotas`, que colapsavam em
`compras`/`engenharia` até virarem setor próprio. Em TS a entrada só fica morta
(o slug canônico é testado antes), mas no PHP `setoresRawAceitosFin()` monta o
`WHERE` a partir dela: mantida, conceder **Compras** voltaria a aceitar as linhas
de Almoxarifado. Não há teste de PHP no repo — este parágrafo e o comentário em
`api.php` são a única rede.

### 8.2. Onde os Setores do usuário são gravados

Ficam dentro do JSON `usuarios.papeis_permissao` (coluna LONGTEXT, migração
`migrations/2026_07_16_usuarios_matriz_permissoes.sql`), no formato
`{ aprovarCompras, aprovarFinanceiro, setores: string[] }`. Editados na tela
**Permissões** (`src/pages/gm/Permissoes.tsx`), persistidos por
`usePlayers.playerPayload` → `api.php` (chave `papeisPermissao`). **Sem essa
migração aplicada, o `api.php` degrada e nada de setor é gravado nem filtrado**
(`usuariosTemColunasMatriz()`).

### 8.3. Matriz é por PÁGINA; `hasAccess` é por MÓDULO — não confunda

Existem **duas granularidades** de permissão e elas convivem:

- **Matriz fina (por rota):** `matrizPermissoes[rota][ação]` — fonte-verdade
  editada na tela Permissões. Consultada por `can(rota, "V")` /
  `podePlayerAcao(player, rota, ação)`.
- **Acesso grosso (por `PageKey`/módulo):** `player.acessos[pageKey]` —
  consultado por `hasAccess(pageKey, nível)`.

⚠️ **Gotcha crítico:** várias páginas compartilham a **mesma** `PageKey`. No
financeiro, **todas** as 7 páginas do NAV têm `permission: "financeiro"` (ver
`src/config/navigation.ts`). `acessosDerivadosDeMatriz()` **colapsa** a matriz
para `PageKey` pegando o maior nível — então conceder V a **uma** página
financeira já deixa `acessos.financeiro = "visualizar"`. Por isso a
**visibilidade de página** (sidebar, command palette e guard de rota) precisa
usar o gate **fino** `can(i.to, "V")`, **não** `hasAccess`. Se você voltar a
gatear por `hasAccess`, liberar uma página reabre o módulo inteiro (bug já
corrigido — não regrida).

Pontos que decidem visibilidade de página (todos usam `can`/rota):

- `src/components/Layout.tsx` — filtro da sidebar (só itens do `NAV_REGISTRY`,
  que sempre têm linha; usa `can(i.to,"V")` direto).
- `src/components/layout/CommandPalette.tsx` — filtro do ⌘K.
- `src/components/auth/RequireAccess.tsx` — guard de rota.

#### A matriz só tem linha para `NAV_REGISTRY` — use `rotaDaMatrizPara`

`listarModulos()` (e portanto `rotasDaMatriz()`) deriva **apenas** de
`NAV_REGISTRY`: 31 linhas. Ficam de fora **43** páginas de `HIDDEN_NAV_ITEMS`
(abas de hub e deep links) e **7** rotas dinâmicas (`/obras/:id`,
`/quadros/:boardId`, …). Isso quebrava os dois lados:

- **`RequireAccess`** não achava linha e afrouxava para `hasAccess(page)` — o
  gate grosso. Com PageKey compartilhada, liberar *uma* página do Financeiro
  abria Previsão de Pagamento, Centros de Custo, Importação TOTVS…
- **`CommandPalette`** filtra `NAV_ITEMS` (registry **+** hidden) e chamava
  `can(n.to,"V")`; sem linha, `can` devolve `false` e **as 43 páginas
  escondidas sumiam do ⌘K** para todo não-GM.

`rotaDaMatrizPara(path)` (em `src/lib/authz/paginas.ts`) resolve qual linha
governa uma rota, nesta ordem:

1. a própria rota, quando tem linha;
2. o mapa `ROTA_MAE` — abas/botões que mudaram de lugar e **perderam o prefixo**
   (`/financeiro/centros` → `/financeiro/cadastros`, `/dp/horas-extras` →
   `/dp/ponto/analise`, `/quadro-contratos` → `/contratos`);
3. o **prefixo de URL mais longo** com linha (`/obras/123` → `/obras`,
   `/financeiro/fluxo/caixa` → `/financeiro/fluxo`);
4. `null` → aí sim cai no gate grosso.

Um teste garante que **nenhum** item de `HIDDEN_NAV_ITEMS` fica sem linha que o
governe (`paginas.test.ts`). Se você acrescentar uma aba de hub cuja URL não
começa com a URL do hub, o teste falha até você registrá-la em `ROTA_MAE`.

➡️ **Ao adicionar uma página nova a um módulo:** ela entra na matriz automaticamente
(via `NAV_REGISTRY` → `listarModulos()`), mas herda a `PageKey` que você definir
em `navigation.ts`. Se reusar uma `PageKey` existente, lembre que `hasAccess`
não distingue as páginas — só o gate fino distingue.

➡️ **Ao adicionar uma página em `HIDDEN_NAV_ITEMS`:** ela **não** ganha linha
na matriz. Garanta que `rotaDaMatrizPara` a resolva — por prefixo ou por
`ROTA_MAE` — senão ela herda o módulo inteiro.

#### Rotas administrativas sem link (`/admin/*`)

`/admin/empresas` e `/admin/obras/importar` não aparecem em nenhuma navegação e
só se alcança por URL. Usavam `RequireAccess page="admin"`, mas a PageKey
`admin` é derivada das linhas `/gm*` da matriz — então um não-GM com "V" em
`/gm/auditoria` entrava nas ferramentas administrativas **sem** conseguir abrir
o próprio `/gm` (que já era `RequireAccess gm`). Hoje estão sob guard `gm`,
coerente com o resto de `/gm`.

### 8.3.1. ⚠️ Quatro coisas diferentes se chamam "compras"

Antes de mexer em qualquer `"compras"` no código, identifique **qual eixo** é:

| Eixo | Onde vive | Valores | Quem consulta |
| --- | --- | --- | --- |
| **PageKey** (módulo) | `usuarios.acesso_*`, `Player.acessos` | `rh`, `dp`, `financeiro`, `almoxarifado`… | `hasAccess`, `$moduloDasRotas` |
| **NivelAcesso** | valor do ENUM `acesso_financeiro` | `nenhum`, `visualizar`, `compras`, `financeiro` | `hasAccess(page, nível)` |
| **Setor** | `papeis_permissao.setores` | `SETORES_SUPABASE` (inclui `compras`) | Aprovação Financeira, RLS `current_has_setor` |
| **role_scope** | `notificacoes.role_scope` | `compras`, `financeiro` | sino de notificações |

`hasAccess("financeiro", "compras")` combina **dois** eixos: PageKey `financeiro`
com o NivelAcesso `compras`. Não tem relação alguma com o módulo Suprimentos nem
com o setor Compras.

**O módulo Suprimentos é `almoxarifado`, não `compras`.** Ele declarava
`permission: "obras_div"`, o que fazia `acessosDerivadosDeMatriz` colapsá-lo
dentro de Obras: conceder Suprimentos gravava `acesso_obras`. Inofensivo
enquanto o gate era só de UI — mas com o gate por módulo do `api.php`,
`obras_div` libera `medicoes`, `recebimentos`, `notas_fiscais` e
`bms_previstas`, então quem tinha só Suprimentos lia medições e notas fiscais
das obras. Testes em `paginas.test.ts` travam a separação nos dois sentidos.

A PageKey `almoxarifado` persiste na coluna **legada** `usuarios.acesso_compras`
— o nome da coluna não acompanha a PageKey, exatamente como `rh` mora em
`acesso_colaboradores` e `obras_div` em `acesso_obras`. Ver
`colunaAcessoDaPage()` no `api.php`.

Dois pontos de atenção herdados:

- No Quadro de Perfis (`PerfisPermissaoDialog`), a PageKey **`patrimonios`** já
  é rotulada **"Almoxarifado"**. Para não haver dois "Almoxarifado" na tela, o
  módulo novo usa o rótulo da navegação: **"Suprimentos"**. Se quiser desfazer a
  ambiguidade, o certo é rotular `patrimonios` como "Patrimônios".
- **"Almoxarifado" e "Frotas" agora existem nos dois eixos**, com o mesmo nome e
  significados diferentes: como **PageKey** dizem quais páginas o usuário abre;
  como **Setor** (`SETORES_SUPABASE`) dizem quais solicitações financeiras ele
  enxerga. Conceder um **não** concede o outro. Até virarem setor, o rótulo
  legado `"Almoxarifado"` normalizava para `compras` e `"Frotas"` para
  `engenharia` — quem só tinha Compras via as solicitações antigas de
  Almoxarifado, e deixou de ver. Ver §8.1.

### 8.4. Aprovação Financeira: visibilidade por setor (frontend + backend)

O Setor da Aprovação Financeira usa **a mesma** `SETORES_SUPABASE`, e a regra é:
**GM vê tudo; não-GM só vê/mexe em solicitações dos setores concedidos a ele (+
as que ele mesmo criou, `criado_por`).** Enforçado em **duas camadas** que devem
concordar:

- **Frontend** (`src/pages/financeiro/AprovacaoFinanceira.tsx` +
  `podePlayerVerSetorFinanceiro`, `setoresVisiveis`, `setorLabel` em
  `paginas.ts`): filtra a lista, restringe o dropdown de Setor e exibe rótulos.
- **Backend** (`api.php`, rota `solicitacoesFinanceiras` e `solicitacaoComentarios`):
  - Leitura (GET lista/por-id) filtra por setor via `papelSetorFin()` +
    `setoresRawAceitosFin()`.
  - Escrita (POST criar, PUT aprovar/recusar/cancelar/editar, `aprovarSolicitacao`,
    POST de comentário) valida com `podeMexerSolicitacaoFin()` e responde `403`
    fora do escopo.

➡️ **Ao mexer nesta regra:** mude **as duas camadas juntas**. A do backend é a que
vale como segurança real; a do frontend é UX/defesa em profundidade. As duas
usam a mesma normalização de setor — mantenha `normalizarSetorLegado` (TS) e
`normalizarSetorLegadoFin` (PHP) equivalentes.

### 8.5. Checklist rápido "mudei X → lembre de Y"

- **Adicionei/removi um setor** → `paginas.ts` (`SETORES_SUPABASE`), `api.php`
  (`setoresValidosFin/LabelFin/LegadoFin`), edge `SETORES_VALIDOS` + enum
  `app_role`. Rode os testes de `src/lib/authz/__tests__/paginas.test.ts`.
- **Mudei a granularidade do gate (página vs módulo)** → mantenha `Layout`,
  `CommandPalette` e `RequireAccess` usando o gate **fino** por rota.
- **Adicionei página a um módulo** → confira a `PageKey` em `navigation.ts` e que
  a visibilidade continua por rota.
- **Mudei a regra de visibilidade/escrita do financeiro** → sincronize
  `AprovacaoFinanceira.tsx` (front) e os handlers de `solicitacoesFinanceiras` /
  `solicitacaoComentarios` em `api.php` (back).
- **Banco novo/host novo** → aplique `2026_07_16_usuarios_matriz_permissoes.sql`,
  senão setores não persistem nem filtram (degradação silenciosa).

---

## 9. Autorização no `api.php` — o gate de UI **não** protege a rota

O ERP tem dois planos de dados com garantias muito diferentes:

| Plano | Módulos | Autorização |
| --- | --- | --- |
| **Supabase (Postgres)** | Suprimentos, Planejamento, Qualidade, Quadros | RLS real (`current_is_gm()`, `user_em_obra()`, `current_has_setor()`) |
| **`api.php` (MySQL)** | RH, DP, Financeiro, CRM, Patrimônios, Contratos, Usuários | **apenas "o token é válido"** |

No `api.php`, estar em `$protectedRoutes` significa **autenticado**, não
autorizado. A `PageKey` da matriz de permissões **não existe no backend MySQL**:
`RequireAccess`, a sidebar e o Command Palette escondem a página, mas a rota
continua respondendo a qualquer usuário logado que a chame direto.

### 9.1. Regra

> Se a página é GM-only no frontend (`RequireAccess gm`), a rota que a alimenta
> **precisa** de `exigirGm($conn, $authUser, '...')`. Esconder o link não é gate.

`exigirGm()` (api.php) resolve `is_gm` **consultando o banco** via
`usuarioEhGm()`. Nunca decida por:

- `$authUser['is_gm']` — o token carrega só `{user_id, login, exp}`; esse campo
  nunca existe, então o teste sempre falha e finge estar protegendo (era
  exatamente o caso de `diagnostico-permissoes`);
- qualquer campo do corpo da requisição — está sob controle do cliente.

### 9.2. Rotas com gate de GM hoje

`usuarios` (POST/PUT/DELETE), `perfisPermissao`, `featureFlags` (escrita),
`auditLogs`, `auditLogins` (GET), `diagnostico-permissoes`.

Exceções deliberadas, todas com motivo:

- **`usuarios` PUT** aceita não-GM **apenas** para trocar a própria senha — o
  corpo precisa conter só `senha` e o `id` precisa ser o do próprio token
  (`ChangePasswordDialog`). Qualquer outra chave (`login`, `email`, `is_gm`,
  `acessos`, `matrizPermissoes`, `papeisPermissao`) exige GM. Sem isso, um
  `PUT usuarios&id=<meu_id> {"is_gm":1}` promovia qualquer autenticado a GM.
- **`usuarios` GET** continua aberto a autenticados porque telas comuns (CRM,
  NCs, comentários) precisam da lista de logins — mas não-GM recebe uma
  **projeção reduzida** (`id`, `login`, `email`, `isGM`); `acessos`,
  `matrizPermissoes` e `papeisPermissao` alheios só vão para o GM.
  Aceita o parâmetro opcional **`?setor=<slug>`** (normalizado por
  `normalizarSetorLegadoFin`), que devolve só quem tem aquele setor em
  `papeis_permissao.setores`. Serve o campo "Responsável por negociação" do
  cadastro de cliente (`?setor=engenharia`), consumido por
  `src/hooks/crm/useUsuariosPorSetor.ts`. ⚠️ O filtro roda **antes** da projeção
  reduzida — é exatamente isso que permite a um não-GM receber a lista certa sem
  aprender o mapa de permissões alheio; se alguém inverter a ordem, o recurso
  passa a vazar `papeisPermissao`. Sem a migração `2026_07_16` não há em que
  filtrar: degrada devolvendo a lista inteira (lista maior, não vazamento).
- **`featureFlags` GET** é aberto a autenticados: `useFeatureFlag`/`FeatureGate`
  consultam flags em telas comuns. Só a escrita é GM.
- **`auditLogins` POST** fica fora de `$protectedRoutes`: registra tentativas de
  login, inclusive as que falharam, quando ainda não existe token. O GET valida
  o token inline e exige GM.
- **`notificacoes`** grava autoria a partir do **token**, nunca de
  `autor_login`/`autor_id` do corpo (autoria era forjável).

### 9.3. Gate por MÓDULO: a tabela `$moduloDasRotas`

O gate de módulo é **tabelado num único ponto**, logo antes do `switch`, no
mesmo espírito de `$protectedRoutes` — não espalhado por 40 blocos `case`:

```php
$moduloDasRotas = [
    'dpHolerites' => ['pages' => ['dp'], 'gateGet' => true],
    'colaboradores' => ['pages' => ['rh', 'obras_div'], 'gateGet' => false],
    // ...
];
```

- **`pages`** — PageKeys aceitas; basta **uma** satisfazer (`exigirAcesso`).
- **`gateGet`** — `true` restringe também a LEITURA; `false` restringe só a
  escrita.
- Nível exigido: `GET` → `visualizar`; qualquer outro método → `editar`. GM
  passa sempre.

**De onde sai o nível.** `nivelAcessoModulo()` lê as colunas `acesso_*` de
`usuarios`, não `matriz_permissoes`. Motivo: as duas ficam em sincronia (o
Quadro de Permissões salva `matrizPermissoes` **e** `acessos`, este derivado por
`acessosDerivadosDeMatriz` — ver `Permissoes.tsx`), mas as colunas `acesso_*`
existem em **qualquer host**, inclusive nos sem a migração `2026_07_16`. Assim o
gate nunca degrada para "libera tudo" num banco desatualizado.

#### Por que `gateGet: false` em tantas rotas

Não é leniência: `App.tsx` monta providers globais que buscam dados **para todo
usuário autenticado**, antes de qualquer decisão de rota — `obras`, `funcoes`,
`documentoTipos`, `usuarios`, `clientes`, `oportunidades`, `funil_estagios`,
`colaboradores`, `patrimonios`, `veiculos`, `contratos`, `responsabilidades`.
Gatear o GET dessas rotas devolveria 403 no carregamento do app para quase todo
mundo. Enquanto esses providers carregarem incondicionalmente, só a escrita
pode ser restrita.

> Para apertar mais: fazer o `enabled` de cada provider depender da permissão do
> módulo. Aí `gateGet` pode virar `true` nessas rotas. Foi o que se fez em
> `useCrmTarefas` (o NotificationBell agora passa `canSeeCrm`).

#### Escritas que cruzam módulos de propósito

Algumas rotas aceitam mais de uma PageKey porque o produto realmente cruza a
fronteira — documente o motivo ao acrescentar mais uma:

| Rota | Aceita | Por quê |
| --- | --- | --- |
| `colaboradores` | `rh`, `obras_div` | o board `/rh/equipes` libera edição por qualquer um dos dois (`Board.tsx: canEdit`) |
| `mobilizar` | `obras_div`, `rh` | mobilizar um colaborador para uma obra parte das duas telas |
| `delegacoes` | `obras_div`, `rh` | aparece no Histograma e na aba de RH |
| `patrimonios`, `responsabilidades` | `patrimonios`, `rh` | inativar colaborador encerra responsabilidades e desvincula patrimônios |
| `despesas`, `formasPagamento` | `financeiro`, `contratos` | a tela de Contratos consome as duas |
| `clientes` | `crm`, `financeiro` | `FinClientes` e o CRM compartilham o cadastro |

#### Abas financeiras da obra exigem o módulo Financeiro

`medicoes`, `recebimentos`, `notas_fiscais`, `bms_previstas` e
`centros_custo_totvs` **já aceitaram `obras_div`**, porque as abas de
`/obras/:id` exibiam o financeiro da obra sem exigir o módulo. Isso foi
fechado: hoje exigem `financeiro`, e o gate está em três lugares:

1. **`obra-tabs.ts`** — o marcador `requerFinanceiro` (derivado em
   `OBRA_TABS_FINANCEIRAS`) cobre a seção *Medição & Faturamento* inteira mais
   Previsão de faturamento, Físico × Financeiro e Desempenho (EVM parte do que
   foi medido).
2. **`ObraTabs.tsx`** — a aba **continua visível** e mostra `SemAcessoModulo`
   dizendo qual módulo pedir ao GM. Sumir com a aba esconderia do usuário que a
   área existe.
3. **`FinObraDetalhe.tsx`** — as consultas financeiras ficam com
   `enabled: canLoadFinanceiro`. Não é só economia de rede: sem isso os totais
   chegariam zerados e a aba Resumo exibiria `R$ 0,00` como se fosse fato sobre
   a obra. Por isso o Resumo também troca seus cards financeiros pelo aviso.

⚠️ **Limite desta camada.** A página de detalhe da obra lê medições, NFs,
recebimentos e BMs do **Supabase**, não do `api.php` — os repositórios usam
`supabase.from(...)`. O gate do `api.php` acima protege chamadas diretas àquelas
rotas, mas quem tiver `obras_div` e usar o cliente Supabase direto ainda passa
pela RLS, que hoje libera a LEITURA por vínculo com a obra (`medicoes read por
obra`); a escrita já exige o **setor** `financeiro` (`current_has_setor`).
Fechar a leitura no Postgres significaria exprimir "módulo Financeiro" em RLS —
e o Supabase não conhece a matriz de PageKeys, só `app_role`/setor e vínculo com
obra. Ou seja: para essas abas, o módulo é gate de **UI + api.php**, não de RLS.

#### Escopo de LINHA no CRM: a carteira de clientes

O módulo CRM tem, além do gate de módulo, um recorte **por linha**: nem todo
usuário com `crm` enxerga todas as negociações.

> **Regra.** GM vê tudo. Qualquer outro usuário vê as oportunidades dos clientes
> em que consta como **"Responsável por negociação"** (a sua *carteira*) **mais**
> aquelas em que ele é o responsável do próprio card.

- **Onde mora a carteira:** tabela de junção MySQL `cliente_responsaveis
  (cliente_id, usuario_id)`, migração
  `migrations/2026_08_07_cliente_responsaveis_negociacao.sql`. É lida e gravada
  pela própria rota `clientes` (chave `responsaveisNegociacao` no JSON), não por
  rota separada.
- **Quem pode ser responsável:** só usuários do setor `engenharia` — o cadastro
  monta a lista com `usuarios?setor=engenharia` (ver §9.2).
- **O braço `responsavel_id` não é redundante:** é ele que mantém visível uma
  oportunidade ainda **sem cliente vinculado**. Sem `cliente_id` não há carteira
  que a carregue, e o card sumiria do funil de quem o criou.

Enforçado em **duas camadas que precisam concordar** — mesmo contrato da
Aprovação Financeira (§8.4):

| Camada | Onde | Papel |
| --- | --- | --- |
| **Servidor** (vale como segurança) | `escopoOportunidadesFin()` no `api.php`, aplicado em `oportunidades` (GET lista e por id) e em **todos** os ramos de `crmStats` | devolve o predicado SQL; `is_gm` vem de `usuarioEhGm()`, nunca do token |
| **Cliente** (UX/defesa em profundidade) | `podeVerOportunidade()` em `src/lib/crm/escopo.ts`, via `useCrmScopeFilter()` | filtra Funil, Lista e Dashboard |

➡️ **Mudou a regra num lado, mude no outro.** Os testes de
`src/lib/crm/__tests__/escopo.test.ts` travam a versão TS.

⚠️ **`crmStats` faz parte da regra, não é detalhe.** Os KPIs do Dashboard eram
globais; sem o mesmo recorte, um usuário que enxerga 3 cards no funil leria o
pipeline e a taxa de conversão da empresa inteira nos cards de cima.

⚠️ **Degradação é ABERTA, de propósito.** Sem a tabela aplicada,
`clienteResponsaveisDisponivel()` devolve `false` e **nenhum** filtro é aplicado.
Degradar fechado esvaziaria o funil de todo mundo num host desatualizado — um
incidente pior que a visibilidade ampla que já existia antes.

⚠️ **Limite desta camada:** o recorte cobre a **leitura**. `oportunidades`
PUT/DELETE, `oportunidadeEstagio` e `oportunidadeConverter` seguem sem checagem
de posse — quem souber o id ainda escreve. Fechar isso é trabalho à parte.

#### Cobertura

Todas as rotas do `api.php` têm gate. As que não aparecem em `$moduloDasRotas`
têm gate **mais forte**, não mais fraco: `usuarios`, `perfisPermissao`,
`auditLogs`, `auditLogins`, `featureFlags`, `diagnostico-permissoes` e
`dpFechamentoCompetencia` exigem GM; `aplicarInativacoesProgramadas` exige token
ou `CRON_SECRET`; `notificacoes` exige token e deriva a autoria dele.

### 9.4. Checklist ao criar rota nova no `api.php`

1. A rota entra em `$protectedRoutes`? (fora dela = **sem token nenhum**)
2. Qual página a consome e qual é o gate dela no frontend?
3. Se a página é GM-only → `exigirGm()` no topo do `case`.
4. Senão, entre com a rota em `$moduloDasRotas` com a PageKey do módulo dono.
5. `gateGet`: a leitura é dado do módulo (`true`) ou referência lida por várias
   telas / provider global (`false`)? **Confira quem consome antes de decidir** —
   um `gateGet: true` numa rota buscada globalmente derruba o app inteiro com
   403 no load.
6. Autoria/identidade sai do token, nunca do corpo.
7. Mutação registra `logAudit()`?

Para conferir a cobertura depois de mexer, o mapa é legível por script: extraia
`$protectedRoutes` e `$moduloDasRotas` e cruze com os `case` do switch — nenhuma
rota deve ficar sem gate de módulo **nem** de GM.
