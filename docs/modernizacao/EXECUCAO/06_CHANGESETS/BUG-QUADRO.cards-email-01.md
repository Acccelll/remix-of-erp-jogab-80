# BUG-QUADRO · cards-email-01 — Onda 6

## Objetivo
Corrigir falha de abertura dos cards no módulo **Quadro** após o diálogo passar a consultar `profiles.email` no responsável e na lista de perfis.

## Sintoma
- Cards abriam o modal, mas exibiam `Falha ao carregar o card`.
- Backend retornava `column profiles_1.email does not exist` em consultas de `profiles` e no relacionamento `cards -> responsavel`.
- Capas/anexos importados do Trello também geravam erro ao tentar assinar URLs externas como se fossem caminhos do Storage.

## Causa raiz
- A aplicação já referenciava `profiles.email`, mas a tabela canônica `public.profiles` ainda não possuía essa coluna.
- Registros importados do Trello guardam `storage_path` como URL externa (`https://trello.com/...`), incompatível com `createSignedUrl` de bucket.

## Mudanças
- Backend: adicionada coluna `email` em `public.profiles` e preenchimento inicial a partir das contas vinculadas quando disponível.
- `src/lib/repositories/storage.ts`: `createSignedUrl`, `getPublicUrl`, `download` e `remove` passam a tratar URLs externas como links diretos, sem chamar Storage para assinar/remover caminhos `http(s)`.

## Verificação
- `profiles.email` existe no banco e há preenchimento para o perfil atual.
- `bunx tsgo --noEmit --pretty false` → sem erros.

## Impacto
Cards do **Quadro** voltam a carregar o detalhe com responsável/lista de perfis. Capas/anexos externos do Trello deixam de disparar requisições inválidas para assinatura no Storage.

## Próximo passo
`ARC-002.slice-27` — retomar a extração de estado do `AppContext` mantendo o foco em membros derivados/estáticos ou domínio pequeno (candidato: `sidebarOpen`/`setSidebarOpen` para `ui/`).