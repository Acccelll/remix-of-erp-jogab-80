# E2E de Caracterização — TST-001.a

Jornadas cobertas (baseline, não validação de correção):

| Marco | Jornada                                    | Spec                              |
| ----- | ------------------------------------------ | --------------------------------- |
| M1    | Mobilização de colaborador em obra         | `journeys/M1-mobilizacao.spec.ts` |
| M5    | Inspeção de qualidade (captura + registro) | `journeys/M5-inspecao.spec.ts`    |
| M7    | Suprimentos (requisição → OC)              | `journeys/M7-suprimentos.spec.ts` |
| M8    | Financeiro (lançamento + fluxo)            | `journeys/M8-financeiro.spec.ts`  |

## Rodar localmente

1. Instalar navegador uma vez: `bunx playwright install chromium`
2. Opcional: copiar `.env.e2e.example` → `.env.e2e` e preencher `E2E_USER` / `E2E_PASSWORD` com um usuário real da instância, ou executar a partir de um preview com sessão gerenciada injetada.
3. `bun run test:e2e`

## Autenticação

`auth.setup.ts` primeiro reutiliza uma sessão gerenciada injetada pelo preview,
quando disponível. Na ausência dela, faz login via UI contra Lovable Cloud
(email + senha) e grava a sessão em `e2e/.auth/storageState.json`. Se também
não houver credenciais E2E, usa o GM local legado (`defaultPlayers`) para
caracterizar o comportamento atual sem depender de login manual. As specs
reutilizam essa sessão via `storageState` — **nunca** commitar esse arquivo
(já no `.gitignore`).

## CI

O job `e2e` em `.github/workflows/ci.yml` executa somente quando os secrets
`E2E_USER` e `E2E_PASSWORD` estão presentes no repositório. Sem os secrets, o
job é pulado (não bloqueia PRs de contribuidores externos).

## Regra de ouro (caracterização)

Se um spec falha, a pergunta é: **o comportamento mudou?**

- Sim, mudança intencional (fix/refactor) → atualize o baseline no mesmo PR e cite o ID do Achado.
- Sim, não intencional → regressão; **não** atualize o spec.
- Não → o spec estava flakiness; estabilize antes de mesclar.
