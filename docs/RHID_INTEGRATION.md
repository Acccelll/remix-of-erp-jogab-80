# Integração RHiD — Sincronização de Ponto

Traz a apuração de ponto da **API RHiD (ControlID)** direto para a página
**DP › Análise de Ponto** (`/dp/ponto/analise`), dispensando o upload manual do CSV
no fechamento da folha.

- Base URL: `https://www.rhid.com.br/v2/api.svc`
- Swagger: <https://www.rhid.com.br/v2/swagger.svc/index.html>
- Suporte ControlID: integracao@controlid.com.br

## Arquitetura

A chamada à RHiD acontece **no backend**, nunca no navegador: a API não emite CORS para
a origem do ERP e as credenciais não podem trafegar pelo cliente. É o mesmo padrão da
edge function `cnpj-lookup`.

```
PontoAnalise.tsx  ── botão "Sincronizar RHiD"
  └─ RhidSyncDialog.tsx        período → prévia → confirmar
       └─ useRhidSync.ts       useRhidPreview (lê) + useRhidSync (grava)
            ├─ rhidRepo        supabase.functions.invoke("rhid-apuracao")
            │    └─ EDGE FUNCTION rhid-apuracao (Deno)
            │         POST /login          ← secrets RHID_EMAIL / RHID_PASSWORD
            │         GET  /person         → cpf, registration, idDepartment
            │         GET  /department     → nome do departamento
            │         GET  /apuracao_ponto → 1 objeto por dia, por pessoa
            ├─ mapApuracaoToRows()         puro → ParsedPontoRow[]
            └─ useImportarPonto()          pipeline de importação já existente
```

| Arquivo                                     | Papel                                                         |
| ------------------------------------------- | ------------------------------------------------------------- |
| `supabase/functions/rhid-apuracao/index.ts` | Cliente HTTP da RHiD, login, janelas de 90 dias, concorrência |
| `src/lib/rhid/mapApuracao.ts`               | Conversão ACJEF → `ParsedPontoRow` (módulo puro, testado)     |
| `src/lib/repositories/rhid.ts`              | Wrapper de `supabase.functions.invoke`                        |
| `src/hooks/dp/useRhidSync.ts`               | `useRhidPreview` (lê) e `useRhidSync` (grava)                 |
| `src/components/dp/RhidSyncDialog.tsx`      | Diálogo: período, prévia, diagnóstico                         |

## Configuração

As credenciais ficam **apenas** nos secrets do backend:

```bash
supabase secrets set RHID_EMAIL='rh02@jogab.com.br'
supabase secrets set RHID_PASSWORD='<senha-da-conta-rhid>'
supabase functions deploy rhid-apuracao
```

Sem os secrets, a function responde `500` com uma mensagem explícita.

> **Nunca** commitar a senha. Em versões anteriores deste documento e do arquivo de teste
> ela estava em texto puro — foi removida, mas **permanece no histórico do Git**
> (commits `f12b801` e `4c24021`). Recomenda-se trocar a senha da conta e atualizar o secret.

## Como usar

1. Abrir **DP › Análise de Ponto** e clicar em **Sincronizar RHiD**.
2. Escolher o período (o padrão é o mês corrente) e clicar em **Buscar da RHiD**.
   Nada é gravado nesta etapa.
3. Conferir a prévia: total de registros, colaboradores, quantos foram **vinculados por CPF**
   ao cadastro do ERP e o total de HE 60%.
4. Clicar em **Confirmar importação**. Os KPIs e as tabelas de exceção da página passam a
   refletir o período sincronizado.

Sincronizar o mesmo período novamente **substitui** a importação anterior — `importarPonto()`
apaga as importações sobrepostas antes de inserir, então não há duplicidade.

## Vínculo com o cadastro do ERP

| Campo do ponto  | Origem                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- |
| Colaborador     | CPF da RHiD (`GET /person`) → CPF do cadastro; _fallback_ por matrícula e nome           |
| Obra            | Nome do departamento (ex.: `210 - COPI`) → código numérico da obra, via `resolveObras()` |
| Centro indireto | Departamentos ADM/Barracão, via `isCentroIndireto()`                                     |

Colaboradores sem CPF correspondente aparecem como **Não cadastrado** na prévia e são
gravados sem `colaborador_id` — o registro não se perde, só fica sem vínculo.

## Mapeamento dos campos ACJEF

A RHiD documenta nominalmente apenas `pis`, `idPerson`, `name`, `date`,
`totalHorasTrabalhadas` e `saldoBancoFinalDia`, afirmando existirem "dezenas de campos"
do motor ACJEF. Por isso `mapApuracao.ts` casa os campos por **aliases tolerantes**
(mesma técnica que `parseRelatorioCsv.ts` usa nos cabeçalhos do CSV): a comparação ignora
caixa, acentos e separadores, de modo que `totalHorasTrabalhadas`,
`Total_Horas_Trabalhadas` e `TOTAL HORAS TRABALHADAS` casam igualmente.

### Unidade das durações

| Formato recebido           | Interpretação   | Exemplo             |
| -------------------------- | --------------- | ------------------- |
| `"HH:MM"`                  | horas e minutos | `"08:30"` → 510 min |
| número inteiro             | já em minutos   | `480` → 480 min     |
| número fracionário         | horas decimais  | `7.5` → 450 min     |
| ausente / vazio / inválido | zero            | `null` → 0          |

### Fechando o mapeamento com dados reais

O diálogo tem um bloco recolhível **Diagnóstico do mapeamento** que mostra:

- **Interpretação das durações** — para cada campo do ERP, qual campo da RHiD foi usado,
  o valor bruto e quantos minutos resultaram. É aqui que se confere se a unidade foi lida
  corretamente.
- **Campos retornados sem mapeamento** — tudo que a RHiD devolveu e nenhum alias reconheceu.
- **Primeiro registro cru** — o JSON completo do primeiro dia apurado.

Se algum campo relevante aparecer como não mapeado, basta acrescentar o nome dele à lista
`ALIASES` correspondente em `src/lib/rhid/mapApuracao.ts` — nenhuma outra camada muda.

## Limites da API

- Intervalo `dataIni`↔`dataFinal` de **no máximo 90 dias** por requisição. A edge function
  fatia períodos maiores automaticamente (`fatiarPeriodo`) e concatena o resultado.
- Token JWT expira; em `401` a function refaz o login uma vez e repete a requisição.
- `/apuracao_ponto` exige `idPerson` — não existe consulta "de todos de uma vez". A function
  percorre as pessoas com concorrência limitada (5) e o cliente envia em lotes de 25.
- Alguns endpoints devolvem **JSON serializado como string**; o parse é tratado.

## Testes

```bash
bun run test -- mapApuracao
```

Os testes são **offline**: usam fixtures e não tocam a API nem exigem credenciais.

## O que é guardado da resposta (Onda 1)

Desde `migrations/2026_08_03_ponto_ondas.sql`, cada linha de `ponto_registros` guarda também:

| Coluna           | Conteúdo                                           |
| ---------------- | -------------------------------------------------- |
| `payload`        | o JSON do dia **exatamente** como o ACJEF devolveu |
| `rhid_id_person` | o `idPerson` da RHiD, chave estável do vínculo     |

O `payload` é o que permite o **Espelho de Ponto** (`/dp/ponto?tab=espelho`) explicar um dia
e, se um campo novo aparecer, fechar o mapeamento sem refazer a coleta contra a API — que é
por pessoa, em janelas de 90 dias. Ele nunca trafega no GET de lista: só na rota
`pontoEspelho`, que é por colaborador.

`GET /person` passou a trazer `status`, `numberOfTemplates` e `linkedDeviceIds`, que a
function descartava. São eles que alimentam a **Conciliação de Cadastro**: quem está ativo na
catraca mas demitido no ERP, quem não tem biometria coletada e quem não está vinculado a
nenhum REP. Enquanto a function não for redeployada, os campos chegam `undefined` e as
colunas correspondentes ficam vazias — nada quebra.

As falhas por colaborador (`erros[]`) passam a ser gravadas em `ponto_sync_erros`, com o
período e o `idPerson`. Antes viviam só no diálogo.

## Outros domínios da API (Onda 2)

| Endpoint                                    | Onde aparece no ERP                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `POST /justifications`                      | aba **Justificativas**, e o cruzamento que fecha ocorrências já resolvidas na RHiD |
| `GET /justificationstype`                   | flags de folha (abona falta, desconta DSR, exige CID) e cotas                      |
| `GET /device`                               | aba **Relógios & AFD** — última conexão de cada REP                                |
| `GET /report/afd/download` e `/download671` | geração e arquivamento do AFD                                                      |

As três primeiras entram pela `rhid-apuracao`, num despacho por `acao`
(`"justificativas"`, `"tipos-justificativa"`, `"devices"`), para login, CORS e retry em 401
continuarem num lugar só. O AFD tem **function própria** (`rhid-afd`): a resposta é texto de
até 50.000 linhas por página, paginada por NSR, com timeout maior.

### Custódia do AFD

O arquivo vai para o bucket privado `ponto-afd` (policies restritas a GM, em
`supabase/migrations/20260804120000_*`); o MySQL guarda só a prova do que foi gerado — faixa
de NSR, contagem de linhas, `sha256` e responsável. Guardar apenas metadados não bastaria: a
API só serve janelas de 90 dias, então um AFD não arquivado a tempo **não pode mais ser
reproduzido**.

## Sincronização automática

`.github/workflows/sync-rhid.yml` roda `scripts/sync-rhid.ts` diariamente às 03:10 de
Brasília (e sob demanda por `workflow_dispatch`, com `--dry-run` disponível).

O script roda com `bun`, coleta pela edge function e grava pelo `api.php` — o mesmo caminho
do navegador. Ele **reusa os módulos puros** (`mapApuracaoToRows`, `src/lib/ponto/vinculo.ts`)
em vez de reimplementar o mapeamento em Deno: se o cron e a tela derivassem regras
diferentes, a divergência apareceria só no fechamento da folha.

A janela é incremental (7 dias por padrão): `/apuracao_ponto` é por pessoa, e reprocessar o
mês inteiro todo dia multiplica chamadas sem ganho.

> **Constatação de segurança** (pré-existente, vale para todo o `api.php`): as rotas de ponto
> não exigem token — `validateToken` só é chamado em `login`, `refresh` e mais duas rotas.
> É o que permite a gravação server-side sem credencial, e é também uma exposição: qualquer
> um que alcance a URL pode gravar. Corrigir isso é mudança de escopo do backend inteiro,
> não do módulo de ponto.

## Não implementado

- Fechamento de competência do ponto e conciliação Ponto × Folha (HE apuradas × HE pagas) —
  Onda 3 de `docs/PONTO_HUB_PROPOSTA.md`.
