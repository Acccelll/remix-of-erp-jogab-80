# Runbooks operacionais — Planifik

Documentação viva de resposta a incidentes e rotinas operacionais.
Cada runbook segue o padrão: **Sintoma → Diagnóstico → Ação →
Verificação → Pós-incidente**. Escritos para on-call em plantão sem
contexto prévio.

## Índice

| ID | Runbook | Sintoma-gatilho |
| --- | --- | --- |
| RB-01 | [Falha em edge function](rb-01-edge-function-erro.md) | 5xx recorrente em `/functions/*` |
| RB-02 | [Import TOTVS/BMS travado](rb-02-import-totvs-bms.md) | Job de import não sai de "pending" |
| RB-03 | [Fila de notificações parada](rb-03-notificacoes.md) | Sino sem novidades > 30 min |
| RB-04 | [RLS negando leitura legítima](rb-04-rls-permission-denied.md) | `permission denied` em tela autenticada |
| RB-05 | [Perda de sessão em massa](rb-05-perda-sessao.md) | Múltiplos usuários redirecionados a `/auth` |
| RB-06 | [Pico de `login_fail`](rb-06-picos-login-fail.md) | Anomalia em `security_events` (GM → Trilha) |
| RB-07 | [Rollback de migration](rb-07-rollback-migration.md) | Erros SQL após deploy de migration |

## Onboarding on-call (checklist inicial)

Ao entrar em plantão, em ordem:

1. **Acessos** — confirmar login no app com conta GM (`/gm`) e leitura
   de `/gm/security-events` e `/gm/auditoria`.
2. **Canais** — presença em `#planifik-ops` e acesso ao board `Ops`.
3. **Ferramentas** — Sentry (link no README do repo), painel de edge
   functions e SQL editor do backend disponíveis.
4. **Ler** — este README, `docs/operacao/ambientes.md`, e os runbooks
   RB-01 a RB-07 em diagonal.
5. **Smoke test** — rodar `scripts/db/run-sec-002-tests.sh` localmente
   uma vez para validar ambiente.
6. **Anotar** — ID do usuário GM usado, para poder ser encontrado em
   `security_events` durante o plantão.

## Convenções

- **Severidade:** S1 (fora do ar), S2 (fluxo crítico degradado),
  S3 (fluxo secundário), S4 (cosmético).
- **Latência de resposta esperada:** S1 15min · S2 1h · S3 4h · S4 24h.
- **Canal de comunicação:** issue no board `Ops` + alerta no canal
  `#planifik-ops`.
- **Ambientes:** `local` · `preview` · `prod`. Ver
  [`docs/operacao/ambientes.md`](../operacao/ambientes.md).

## Governança

- Todo novo runbook nasce de um incidente real ou de um Achado do
  Catálogo — sem runbooks especulativos.
- Após cada uso, o on-call deve anexar timestamps + link para o
  incidente na seção **Histórico** do próprio runbook.
- Revisão trimestral: retirar passos obsoletos, dobrar em subprocesso
  quando > 30min de execução.

## Referências

- [OPS-005 — Perfis de ambiente](../operacao/ambientes.md)
- [Onda 07 — OPS-007](../modernizacao/EXECUCAO/05_ONDAS/ONDA_07/02_Achados.md)
