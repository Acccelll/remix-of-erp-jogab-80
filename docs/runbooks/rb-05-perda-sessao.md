# RB-05 — Perda de sessão em massa

**Severidade padrão:** S1 (bloqueio de acesso generalizado).

## Sintoma

- Múltiplos usuários redirecionados para `/auth` sem ação de logout.
- Toast "Sessão expirada" após F5.
- Métrica de sessões ativas cai abruptamente.

## Diagnóstico

1. Confirmar escopo: um usuário isolado, um empresa/tenant ou
   todos.
2. Checar mudanças recentes em:
   - JWT signing keys (`supabase--migrate_signing_keys`),
   - `AuthProvider` no cliente,
   - `supabase/config.toml` (não deve ser editado — se foi, reverter),
   - políticas de cookie (SameSite, domínio).
3. Testar login com conta de smoke test e monitorar Network:
   `/auth/v1/token` deve retornar 200 com `access_token` + `refresh_token`.

## Ação

| Causa | Ação |
| --- | --- |
| Rotação de signing key sem carência | Reverter rotação; comunicar usuários no próximo login. |
| Bug no cliente (refresh loop) | Rollback do último deploy do front; abrir Achado. |
| Provider externo (Google) fora do ar | Comunicar downtime; habilitar login por e-mail temporariamente. |
| Cookies bloqueados por domínio novo | Ajustar Site URL/Redirect URLs no painel de auth. |

## Verificação

- Login de smoke test volta a funcionar.
- Sessão persiste após F5 e após 5 min (refresh silencioso).

## Pós-incidente

- Postmortem obrigatório (S1). Registrar minutos até detecção e
  minutos até mitigação.
- Se causa foi rotação, atualizar `docs/operacao/ambientes.md` com o
  playbook correto de rotação.

## Histórico

_(vazio)_
