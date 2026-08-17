# RB-07 — Rollback de migration com regressão

**Severidade padrão:** S1 se afetar leitura/escrita crítica; S2 caso contrário.

## Sintoma

- Após deploy de migration, erros `permission denied`, `column ... does not exist`,
  `relation ... does not exist` ou `null value in column` em telas antes estáveis.
- Testes SEC-002 (`scripts/db/run-sec-002-tests.sh`) começam a falhar.
- Edge functions retornam 500 apontando para tabela recém alterada.

## Diagnóstico

1. Identificar a migration mais recente aplicada:
   `select * from public.schema_migrations order by applied_at desc limit 5;`
2. Ler o SQL da migration em `supabase/migrations/<timestamp>_*.sql`
   e o par correspondente em `migrations/` (canonicidade — ver
   `docs/db/CANONICIDADE.md`).
3. Reproduzir a query com falha no SQL editor autenticado como
   `authenticated` (usar `set local role authenticated`) para
   confirmar se é RLS, GRANT ou schema.
4. Checar `supabase--linter` para `security definer` / RLS ausentes.

## Ação

| Causa | Ação |
| --- | --- |
| GRANT esquecido em nova tabela pública | Aplicar migration corretiva com `GRANT ... TO authenticated;` (nunca editar a migration já publicada). |
| RLS ativado sem policies | Migration corretiva adicionando as policies mínimas; se urgente, desabilitar temporariamente **apenas** em tabela não sensível. |
| Coluna renomeada quebra front | Reverter rename via nova migration (`alter table ... rename column back`) e re-planejar rename em duas etapas (add → dual-write → drop). |
| Constraint `not null` sem default | Nova migration com `default` ou back-fill; jamais reordenar histórico. |
| Migration aplicada fora de ordem | Marcar como `dirty` e criar migration corretiva; não editar arquivos antigos. |

**Nunca:**
- Editar migration já registrada em `schema_migrations`.
- Rodar `drop table` sem `if exists` e sem backup.
- Rodar SQL manual em produção sem versionar como migration.

## Verificação

- `scripts/db/run-sec-002-tests.sh` passa localmente.
- Telas afetadas voltam a responder 200 (amostragem manual + logs de
  edge function).
- `supabase--linter` sem novos alertas.
- `security_events` sem picos de `permission denied` (via
  `/gm/security-events`).

## Pós-incidente

- Registrar em `08_DESCOBERTAS.md` com ID da migration culpada e da
  corretiva.
- Se causa foi ausência de GRANT, atualizar checklist do PR
  (`docs/db/README.md`) para exigir GRANT explícito.
- Considerar teste automatizado de RLS para a tabela impactada.

## Referências

- `docs/db/CANONICIDADE.md` · `docs/db/README.md`
- `supabase/tests/sec-002/` (bateria de RLS)
- `migrations/README.md`
