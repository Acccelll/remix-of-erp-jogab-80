# Onboarding — GestãObra

Guia mínimo para um novo colaborador técnico ser produtivo apenas com a documentação. Meta: **checkout → app rodando localmente em ≤ 30 min**.

## 1. Pré-requisitos

- Node 20+ e Bun 1.1+
- Conta no workspace Lovable (acesso ao projeto)
- Acesso de leitura ao repositório

## 2. Setup local

```bash
bun install
bun run dev            # http://localhost:8080
bunx vitest run        # deve terminar verde (≈ 118 arquivos)
```

Variáveis de ambiente auto-geradas (não editar):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

## 3. Mapa de leitura obrigatório

Ordem sugerida (~2h):

1. `docs/modernizacao/EXECUCAO/00_EXECUTIVO/00_LEIA_PRIMEIRO.md`
2. `docs/modernizacao/EXECUCAO/00_EXECUTIVO/04_CONTRATO_EXECUCAO.md` — regras não-negociáveis
3. `docs/modernizacao/EXECUCAO/00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md` — ondas
4. `docs/db/README.md` (se existir) e `src/integrations/supabase/types.ts` — schema
5. `docs/design-system/` — tokens semânticos
6. `docs/runbooks/README.md` — 7 runbooks operacionais
7. `docs/operacao/ambientes.md` — perfis de ambiente

## 4. Convenções

- **Design tokens semânticos.** Nunca hardcode cor (`text-white`, `bg-[#...]`). Ver `src/index.css` + `tailwind.config.ts`.
- **Persistência.** Dados operacionais em Lovable Cloud (Supabase); dados de UI/preferência em `localStorage` via `STORAGE_KEYS`.
- **Permissões.** Roles em tabela separada (`user_roles`) + `has_role()` security-definer. Nunca em `profiles`.
- **Testes.** Cada slice do Catálogo tem contrato ou teste unit. E2E de caracterização em `e2e/journeys/`.
- **Governança.** Toda mudança referencia um ID do Catálogo (PRO-, OPS-, UX-, SEC-, PERF-, DB-, EST-, TST-).

## 5. Fluxo diário

1. Ler o Checklist de Conclusão da onda corrente (`docs/modernizacao/EXECUCAO/05_ONDAS/ONDA_XX/10_Checklist_Conclusao.md`)
2. Pegar próximo achado do Plano de Execução
3. Slice → changeset em `06_CHANGESETS/<ID>.slice-NN.md` ou `<ID>.NOTA-FIM.md`
4. `bunx vitest run` verde antes de fechar
5. Atualizar checklist e entregáveis da onda

## 6. Onde pedir ajuda

- Bugs de plataforma: `docs/runbooks/rb-0*.md`
- Decisões arquiteturais: `docs/modernizacao/EXECUCAO/03_DECISOES/`
- Desvios registrados: `docs/modernizacao/EXECUCAO/00_EXECUTIVO/06_WAIVERS.md`

## 7. Aceite

Novo colaborador está onboardado quando consegue, sem assistência:
- Rodar app + vitest verde localmente
- Abrir um achado do Catálogo e explicar em uma frase seu impacto de negócio
- Localizar o runbook adequado para um incidente hipotético (ex.: “RLS permission denied”)
