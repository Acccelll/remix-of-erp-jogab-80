# RB-06 — Pico de `login_fail` (possível brute force)

**Severidade padrão:** S2 (fluxo crítico de acesso sob suspeita).

## Sintoma

- Contagem anormal de eventos `login_fail` em `security_events`
  (visível em `/gm/security-events`).
- Reclamações de bloqueio ou desaceleração da tela de login.
- Alerta externo (Sentry breadcrumb `evt` com severity `warn/error`
  cluster em curto intervalo).

## Diagnóstico

1. Abrir **GM → Trilha de segurança** (`/gm/security-events`).
2. Filtrar `tipo = login_fail`, últimos 60 min. Ordenar por `login`.
3. Correlacionar:
   - **Mesmo `login`, muitos IPs** → tentativa distribuída contra 1 conta.
   - **Muitos `login` distintos** → varredura por dicionário.
   - **Mesmo IP, vários `login`** → bot/script único.
4. Cruzar com `login_ok` do mesmo intervalo — houve sucesso?
5. Verificar se há mudança recente em `useAuthSession` ou no endpoint
   `/login` da API (regressão que aumenta falhas legítimas).

## Ação

| Causa | Ação |
| --- | --- |
| Ataque distribuído a 1 conta | Forçar reset de senha do alvo; notificar usuário. |
| Varredura por dicionário | Habilitar CAPTCHA/rate limit no `/login`; bloquear IPs no edge/WAF. |
| Bot único (mesmo IP) | Banir IP no WAF/edge; abrir incidente de segurança. |
| Regressão que causa falha em massa | Rollback do último deploy que tocou `useAuthSession` ou `api/login`. |

## Verificação

- Contagem de `login_fail` volta ao baseline (≤ ruído histórico).
- `login_ok` de usuários legítimos retomado (verificar por amostragem).
- Sem novos alertas do Sentry na categoria `evt`/`auth` nos 30 min
  seguintes.

## Pós-incidente

- Registrar linha do tempo em `docs/modernizacao/EXECUCAO/00_EXECUTIVO/08_DESCOBERTAS.md`.
- Se causa foi regressão, abrir Achado (SEC-* ou QC-*).
- Se causa foi ataque, considerar: rate limit permanente no `/login`,
  MFA para GMs, redução do TTL de sessão.
- Revisar necessidade de novo alerta automatizado com base em
  `security_events` (feature futura).

## Referências

- Tabela: `public.security_events` (SEC-007).
- Página: `src/pages/GMSecurityEvents.tsx`.
- Emissor: `src/lib/auth/security-events.ts`.
