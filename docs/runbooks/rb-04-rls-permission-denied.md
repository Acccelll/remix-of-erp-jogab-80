# RB-04 — RLS negando leitura legítima

**Severidade padrão:** S2 (usuário autenticado vê tela quebrada).

## Sintoma

- Toast/console com `new row violates row-level security policy` ou
  `permission denied for table X`.
- Tela renderiza vazia mesmo com dados no banco.

## Diagnóstico

1. Identificar tabela e operação (SELECT/INSERT/UPDATE/DELETE) no
   erro exato — copiar HINT do Postgres se presente.
2. Confirmar via `supabase--get_table_schema` que a tabela tem:
   - `ENABLE ROW LEVEL SECURITY` ativo,
   - policies cobrindo o role afetado (`authenticated` é o padrão),
   - **GRANTs** correspondentes (RLS sozinho não basta — ver Core
     rule `public-schema-grants`).
3. Testar com `supabase--read_query` usando `set role authenticated`
   + `set request.jwt.claims` do usuário para reproduzir.

## Ação

| Causa | Ação |
| --- | --- |
| Falta GRANT | Rodar `GRANT SELECT/INSERT/... TO authenticated` (e `service_role`) via `supabase--migration`. |
| Policy ausente | Criar policy escopada (nunca `USING (true)` sem justificativa). |
| Policy recursiva | Refatorar com função `SECURITY DEFINER` (padrão `has_role`). |
| RLS quebrada por alter recente | Reverter migração; abrir Achado. |

## Verificação

- Repetir a operação como o mesmo usuário: sucesso.
- `supabase--linter` sem alertas novos.

## Pós-incidente

- Adicionar caso ao suite de testes de RLS (se existir).
- Atualizar `@security-memory` se a raiz foi assumption falsa.

## Histórico

_(vazio)_
