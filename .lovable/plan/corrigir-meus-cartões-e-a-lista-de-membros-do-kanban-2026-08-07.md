# Corrigir "Meus cartões" e a lista de membros do kanban

## O que foi verificado no banco

- Os 5 cartões existem e têm `responsavel_id = 072f4caa…`, que é o usuário de autenticação `cappucceno@planifik.local` (não arquivados, board "Identidade Visual").
- Existe uma **segunda conta de autenticação para o mesmo login**: `cappucceno@obraflow.local` (criada em 04/08). Vários usuários têm esse par duplicado (`copatto@obraflow.local`, `julia.corebusiness@obraflow.local`, além de contas `@jogab.com.br`).
- O código tem dois caminhos de login que geram e-mails diferentes para o mesmo usuário: o login normal usa `@planifik.local` e o reparo automático de sessão (`ensureCloudSession`) usa `@obraflow.local`.
- A página `/quadros/meus` filtra os cartões por `currentPlayer.id` (id do usuário do backend legado, ex.: `b0c8850f…` para Cappucceno), que **nunca** é igual ao `responsavel_id` gravado nos cartões. Por isso ela sempre volta vazia.
- A lista de membros do cartão vem da tabela `profiles` do Supabase (27 registros, com duplicatas antigas como "Adriana"/"Adriana.Penso", "gilson"/"Gilson.Correia", "Copato"/"copatto", "Kellen"/"Kellen.Silva"), enquanto a tela de usuários do GM vem do backend legado (5 usuários ativos). Daí a lista misturada.

## O que será feito

### 1. Uma identidade só por usuário

- Unificar o e-mail técnico usado nas duas rotas de login para `@planifik.local`, eliminando a criação de contas `@obraflow.local` duplicadas.
- Criar um utilitário único ("qual é o meu id de usuário") que resolve o id do usuário logado e, se a sessão atual for de uma conta duplicada, também considera o id da conta correspondente ao mesmo login. Esse utilitário passa a ser usado em todos os lugares que hoje misturam `auth.uid()` e `currentPlayer.id`.

### 2. "Meus cartões abertos" (Dashboard) e "Meus cards"

- O hook do dashboard passa a buscar por **todos os ids do usuário** (conta atual + conta equivalente pelo login), como responsável ou membro.
- `/quadros/meus` deixa de filtrar por `currentPlayer.id` e passa a usar o mesmo utilitário, incluindo também os cartões em que sou membro (hoje só considera responsável e menção).
- Antes de mudar o código, confirmar em execução qual conta a sessão do navegador está usando, para garantir que o diagnóstico da duplicidade está correto.

### 3. Lista de membros do cartão

- A lista suspensa passa a mostrar apenas perfis que correspondem a um usuário **ativo** cadastrado no GM (casamento por login, sem diferenciar maiúsculas/pontos), removendo duplicatas e contas de teste.
- Exibir o nome do usuário como no GM, ordenado alfabeticamente.

### 4. Higienização dos dados (opcional, com sua aprovação)

- Listar as contas duplicadas/órfãs (`@obraflow.local` e perfis sem usuário ativo) e, se você confirmar, remover/mesclar para evitar que o problema volte.

## Detalhes técnicos

- Arquivos: `src/lib/auth/ensureCloudSession.ts`, `src/contexts/app/useAuthSession.ts`, novo `src/lib/auth/identidade.ts`, `src/hooks/quadros/useMeusCartoes.ts`, `src/pages/quadros/QuadroMeus.tsx`, `src/lib/repositories/cards.ts` (variação `listMinByResponsavelIn`), `src/components/cards/CardGenericoDialog.tsx` (filtro de `profiles` cruzado com `usePlayers`).
- Sem migração de banco obrigatória; o item 4 seria um script/limpeza separado.
