# Matriz de Canonicidade de Entidades

**DB-005 · Onda 1 · Programa de Modernização.**
Declaração formal, exigida pela Decisão [D-3](../modernizacao/EXECUCAO/00_EXECUTIVO/07_DECISOES.md),
de qual tabela é a **fonte da verdade** para cada entidade compartilhada
entre bancos/schemas e quais são **espelhos read-only**.

## Matriz

| Entidade    | Tabela canônica (fonte da verdade) | Espelhos read-only           | Origem de escrita permitida no espelho |
| ----------- | ---------------------------------- | ---------------------------- | -------------------------------------- |
| Colaborador | `public.colaboradores`             | `public.players`             | **nenhuma** — sincronização derivada   |
| Obra        | `public.obras`                     | `public.centros_custo_totvs` | somente import TOTVS (service_role)    |
| Cliente     | `public.clientes` (Postgres)       | `clientes` (MySQL)           | **nenhuma hoje** — ver nota abaixo     |
| Aprovação Financeira | `solicitacoesFinanceiras` (MySQL, via `api.php`) | `public.solicitacoes_financeiras` | **nenhuma** — congelada, ver nota abaixo |

> **Cliente — ciclo "fechado → reaberto" (registrado em 2026-08-18).**
> Cliente já foi um módulo fechado no MySQL — a tabela `clientes` de lá tem
> schema financeiro completo (`prazo_pagamento_dias`, alíquotas, endereço) e
> uma rota viva em `api.php` (`case 'clientes'`). Ele foi **reaberto** para uma
> nova rodada de desenvolvimento em Postgres (`public.clientes`), que hoje é a
> tabela que toda a UI (CRM e Financeiro) efetivamente lê e escreve — via
> `src/lib/repositories/clientes.ts`/`useClientes.ts`, sem nenhuma chamada a
> `api.php`.
>
> A versão Postgres, porém, é um recorte mais enxuto que a do MySQL: não tem
> `ativa`, `contato`, `email`, nem os campos de endereço (cep/logradouro/
> numero/bairro/municipio/uf), e não tem equivalente à feature de
> `cliente_responsaveis` (responsáveis de negociação, MySQL). Esses dados
> ficam deliberadamente adormecidos em Postgres até o fechamento deste ciclo.
>
> **Enquanto este ciclo não fechar**: tratar `public.clientes` (Postgres) como
> fonte de verdade operacional — é nela que a UI lê e escreve. A tabela
> `clientes` do MySQL é o último estado fechado do módulo, não deve receber
> escrita nova, e servirá de base de reconciliação quando Cliente fechar
> novamente (chave de correlação candidata: `cnpj` — checar unicidade/nulos
> antes de usar como chave real, não há FK cruzada declarada hoje).

> **Divergência conhecida entre esta matriz e o runtime (2026-07-30).**
> A matriz declara o Postgres canônico para Colaborador, mas o domínio roda
> integralmente no MySQL via `api.php`: cadastro, mobilização, alocação e
> histórico são lidos e escritos lá. As tabelas Postgres correspondentes
> (`mobilizacoes_periodos`, em particular) **não recebem escrita alguma** —
> nenhum código do repositório insere nelas.
>
> Isso já custou caro em silêncio: `ExportMovimentacoesDialog` e `RdoTab` liam
> `mobilizacoes_periodos` no Supabase enquanto todas as mobilizações eram
> gravadas no MySQL, então a exportação de movimentações e a lista de presentes
> do RDO vinham vazias ou desatualizadas sem nenhum erro. Ambos passaram a
> consumir a rota `mobilizacoesPeriodos` do `api.php` nesta data.
>
> Enquanto o domínio não for de fato migrado, tratar o MySQL como fonte da
> verdade operacional de Colaborador e **não** adicionar leitores das tabelas
> Postgres espelho.
>
> **Atualização 2026-08-01.** Patrimônio e Contrato entraram no mesmo trilho:
> o histórico dos três é agora um log de eventos tipado no MySQL
> (`movimentacoes`, `movimentacoes_patrimonios`, `movimentacoes_contratos`),
> lido pelas rotas `mobilizacoesPeriodos`, `patrimoniosPeriodos` e
> `contratosPeriodos`. Em contrato, a coluna `contratos.historico` foi
> preservada como cópia original do que a migração importou e saiu do conjunto
> gravável — é legado somente-leitura, e escrever nela de novo faria as duas
> fontes divergirem.
>
> **Veículo é o único que ainda não migrou:** `VeiculoHistoricoSection` segue
> derivando períodos por regex sobre a descrição, com período-base sintético.

> **Aprovação Financeira — fechada e congelada (2026-08-18).** A Aprovação
> Financeira sempre rodou de fato 100% em MySQL (rota `solicitacoesFinanceiras`
> de `api.php`, consumida via `src/hooks/financeiro/useSolicitacoesFinanceiras.ts`)
> desde antes desta entrada existir na matriz — nunca havia sido documentada.
> A tabela Postgres homônima (`public.solicitacoes_financeiras`) só existia
> como resíduo de uma versão anterior: sem nenhum caminho de escrita no
> frontend (confirmado por grep — o único uso restante é leitura, em
> `financeiro.ts:listCarrinhoSolicitacoesAoVivo`), mas com RLS ainda permitindo
> `INSERT`/`UPDATE` de `authenticated`.
>
> Ao fechar esta entrada (mesma migration que corrigiu `fn_lancamento_
> solicitacao_aprovada`, que gravava `solicitacao_id` como `uuid` — sempre
> falhava para ids reais, numéricos, do MySQL — ver histórico de migrations
> de 2026-08-18), a tabela Postgres foi **congelada de verdade**, não só
> declarada: `REVOKE INSERT, UPDATE, DELETE ON public.solicitacoes_financeiras
> FROM authenticated, anon` já aplicado, ao contrário do enforcement "previsto"
> descrito mais abaixo para `players`/`centros_custo_totvs`. Só resta `SELECT`,
> para o caminho de leitura legado do carrinho continuar funcionando.

## Regras derivadas (contrato)

1. **UI** só escreve em `colaboradores` e `obras`. Nenhuma tela pode
   inserir/alterar/excluir diretamente em `players` ou
   `centros_custo_totvs`.
2. `players` é populada a partir de `colaboradores` (via job/trigger a
   ser implementado na Onda 2/3 quando a autenticação estiver
   consolidada). Enquanto o job não existir, `players` permanece como
   tabela auxiliar de perfil de acesso — **não** deve ganhar campos que
   duplicam colaborador.
3. `centros_custo_totvs` é populada exclusivamente pelo importador TOTVS
   (`src/lib/financeiro-totvs/centros.ts` e `pages/financeiro/FinImportar.tsx`).
   Todo import roda com service_role; a UI comum não deve escrever.
4. Consultas cruzadas entre canônico e espelho fazem `JOIN` pela chave
   natural declarada abaixo. Divergência = bug do lado do espelho.

## Chaves naturais de junção

| De → Para                       | Chave                                                            |
| ------------------------------- | ---------------------------------------------------------------- |
| `colaboradores` → `players`     | `players.email` = `colaboradores.email` (a formalizar na Onda 2) |
| `obras` → `centros_custo_totvs` | `centros_custo_totvs.obra_id` = `obras.id`                       |

## Enforcement previsto

O RLS/GRANT desses espelhos não foi ainda restrito nesta onda porque os
importadores atuais escrevem via `authenticated` (não service_role). A
Onda 6 (paridade card/obra/DP) executará a migração de trancamento:

```sql
-- previsto para Onda 6 (após migrar importador para service_role/edge function)
REVOKE INSERT, UPDATE, DELETE ON public.centros_custo_totvs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.players            FROM authenticated;
```

Até lá, esta matriz vale como **contrato editorial**: qualquer PR que
introduza escrita a partir de UI em tabela-espelho é rejeitado no
review, citando este documento.

## Referências

- Decisão [D-3](../modernizacao/EXECUCAO/00_EXECUTIVO/07_DECISOES.md#d-3-canonicidade)
- Contrato de Execução §4.3 (canonicidade)
- Auditoria — [Etapa 8 · Arquitetura de Dados](../modernizacao/GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)
