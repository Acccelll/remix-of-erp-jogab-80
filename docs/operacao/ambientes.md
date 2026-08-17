# Perfis de ambiente e matriz de configuração

> **OPS-005** — Documento canônico dos ambientes do GestãObra: quais existem, quem provisiona, quais variáveis cada um exige.

## 1. Perfis

| Perfil       | Descrição                                                                 | Modo Vite  | Origem das vars                                        |
| ------------ | ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| **dev**      | Estação local do desenvolvedor. Backend pode ser Cloud compartilhado.     | `dev`      | `.env.local` (não versionado) + `.env` (plataforma).   |
| **preview**  | Preview automático do Lovable a cada mudança (sandbox por sessão).        | `dev`      | `.env` injetado pela plataforma; sem `.env.local`.     |
| **staging**  | Publicação intermediária para validação antes do promote.                 | `production` | Cofre da plataforma + `.env` do projeto stage.       |
| **prod**     | Publicação oficial do domínio custom.                                     | `production` | Cofre da plataforma; DSN Sentry obrigatório.         |

- `.env` é **gerenciado pela plataforma** (Lovable Cloud) — nunca editar manualmente.
- `.env.local` é local e ignorado pelo Git — usado só em `dev`.
- `.env.example` é o **template versionado** — a fonte da verdade sobre "quais variáveis existem".

## 2. Matriz de variáveis

Legenda: **R** obrigatória · **O** opcional · **—** não usar.

| Variável                       | dev | preview | staging | prod | Provisor                | Observação                                             |
| ------------------------------ | :-: | :-----: | :-----: | :--: | ----------------------- | ------------------------------------------------------ |
| `VITE_SUPABASE_URL`            |  R  |    R    |    R    |  R   | Plataforma (auto)       | Injetado no `.env` — não editar.                       |
| `VITE_SUPABASE_PUBLISHABLE_KEY`|  R  |    R    |    R    |  R   | Plataforma (auto)       | Chave pública (anon). Nunca a service role no cliente. |
| `VITE_SUPABASE_PROJECT_ID`     |  R  |    R    |    R    |  R   | Plataforma (auto)       | Usado por tipos gerados.                               |
| `VITE_API_URL`                 |  R  |    R    |    R    |  R   | Ops (por ambiente)      | Backend legado (MySQL). Zero fim: PRO-018/DB-004.      |
| `VITE_SENTRY_DSN`              |  O  |    O    |    R    |  R   | Cofre da plataforma     | Vazio desliga. OPS-002 depende disto.                  |
| `VITE_APP_RELEASE`             |  O  |    O    |    R    |  R   | CI (SHA/tag)            | Aparece no Sentry para agrupar por release.            |

**Secrets NUNCA vão para `.env`.** Chaves privadas (Stripe, OpenAI, service_role, senha MySQL) ficam apenas no cofre e são consumidas por Edge Functions.

## 3. Fluxo de configuração de um ambiente novo

1. Duplicar `.env.example` → `.env.local` (dev) ou registrar no cofre (staging/prod).
2. Preencher `VITE_API_URL` conforme o backend do ambiente.
3. Em staging/prod: cadastrar `VITE_SENTRY_DSN` e `VITE_APP_RELEASE` no cofre.
4. Rodar `bunx tsgo --noEmit` + smoke test (login, listar obras) antes de liberar.

## 4. Referências cruzadas

- `SEC-003` — secrets fora do repositório e `.env` no `.gitignore`.
- `OPS-002` — Sentry ativo em prod usa `VITE_SENTRY_DSN` desta matriz.
- `OPS-006` — runbook de backup/rollback cita este documento como pré-condição.
- Etapa 13 — [Observabilidade & Operação](../modernizacao/GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md).

## 5. Manutenção

Quem adiciona uma variável nova **deve** editar simultaneamente:

- `.env.example` (com valor placeholder e comentário).
- Este documento (linha na matriz + provisor).

Sem esses dois passos, o achado OPS-005 reabre.
