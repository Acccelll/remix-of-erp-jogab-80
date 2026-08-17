# 08 — Log de Descobertas de Execução

> Governança §5 do [Contrato de Execução](04_CONTRATO_EXECUCAO.md). Toda descoberta feita durante a implementação é registrada aqui com: ID afetado, desvio, motivo, decisão, impacto em dependências. Ao fim da onda avalia-se se (a) cabe no Achado existente, (b) exige auditoria pontual, ou (c) entra como débito registrado.

## E-01 — 36 tabelas/views fantasmas referenciadas por código

- **Data:** 2026-07-11
- **Onda:** 1
- **Achado afetado:** ARC-001
- **Origem:** diff entre `supabase.from('x')` no código e `Database` em `src/integrations/supabase/types.ts`
- **Desvio:** o `any` global em `client-augment.d.ts` estava mascarando **36 nomes de tabelas/views** usados pelo código que não existem no schema atual do Lovable Cloud.
- **Motivo:** derivação silenciosa de esquema (exatamente o sintoma que ARC-001 antecipava, mas em escala maior que o diagnóstico original — que falava em "tabelas defasadas", não fantasmas).
- **Decisão:** classificar como **débito registrado (opção c)**. ARC-001 é fechado narrando explicitamente as 36 fantasmas em `MissingTables` no `client-augment.d.ts`; o compilador volta a valer para as ~86 tabelas reais. Cada fantasma passa a exigir tratamento explícito (migration ou remoção de código morto) antes de ligar `strict` (QC-001) e antes das Ondas 3, 5, 6 e 7 que dependem delas.
- **Impacto em dependências:**
  - **QC-001** (mesma onda): fechado no critério mínimo da Onda 1 com `strict`/`strictNullChecks`/`noImplicitAny` ativo para `lib/` e `services` via `tsconfig.qc001.json`; o strict global permanece bloqueado enquanto `MissingTables` não for reduzido e enquanto UI/contextos mantiverem erros de `noImplicitAny`.
  - **Onda 3** (integração TOTVS): `fornecedores`, `insumos`, `contratos`, `contrato_medicoes`, `faturamento_nfse` estão na lista — a Onda 3 provavelmente cria essas tabelas.
  - **Onda 5** (financeiro/produto): `orcamento_itens`, `ordem_compra_itens`, `cotacoes`, `cotacao_propostas`, `requisicoes`, `pacotes_trabalho`, `pacote_restricoes`, `restricoes`, `alcadas_aprovacao`.
  - **Onda 6** (paridade card/obra/DP): `rdo`, `ponto_registros`, `compromissos_semanais`, `inspecoes`, `inspecao_agendas`, `inspecao_qr_alvos`, `frota_abastecimentos`, `frota_manutencoes`, `causas_nao_conclusao`, `obra_localizacoes`.
  - **Onda 7** (cronograma/BI): `cronograma_calendarios`, `cronograma_calendario_excecoes`, `cronograma_cenarios`, `cronograma_cenario_itens`, 4 views `vw_cutover_metrics_*`.
  - **Cross-cutting**: `feature_flags`, `import_validation_runs`.

### Lista completa das 36 fantasmas

```
alcadas_aprovacao              causas_nao_conclusao
composicoes                    composicao_itens
compromissos_semanais          contratos
contrato_medicoes              cotacoes
cotacao_propostas              cronograma_calendarios
cronograma_calendario_excecoes cronograma_cenarios
cronograma_cenario_itens       faturamento_nfse
feature_flags                  fornecedores
frota_abastecimentos           frota_manutencoes
import_validation_runs         inspecoes
inspecao_agendas               inspecao_qr_alvos
insumos                        obra_localizacoes
orcamento_itens                ordem_compra_itens
pacote_restricoes              pacotes_trabalho
ponto_registros                rdo
requisicoes                    restricoes
vw_cutover_metrics_cronograma  vw_cutover_metrics_financeiro
vw_cutover_metrics_ponto       vw_cutover_metrics_trello
```

### Ações requeridas antes de fechar cada onda dependente

Antes de cada onda listada acima, a lista `MissingTables` em `src/integrations/supabase/types.ts`-adjacente `client-augment.d.ts` DEVE ser reduzida no escopo daquela onda. Encerramento da modernização (Contrato §6.7) exige `MissingTables = never`.

## E-02 — Fachada única de autorização (ARC-009)

- **Data:** 2026-07-11
- **Onda:** 1
- **Achado afetado:** ARC-009
- **Origem:** mapeamento dos call-sites que decidem acesso.
- **Desvio:** ARC-009 previa consolidar três sistemas (`hasAccess` de página, `useCardPermissions` de setor, `useObraMembership/useObrasEditaveis` de obra). Ao mapear, ficou claro que **cada sistema resolve uma dimensão distinta e correta** — o débito real é a ausência de uma API que os componha, não a duplicidade em si.
- **Decisão:** entregar `src/lib/authz/` como fachada única (`useAuthz()` e `authorize()` puro), preservando os hooks especializados como blocos de construção. Migração dos call-sites é incremental e não bloqueia a Onda 1.
- **Impacto:** desbloqueia D-2 (RLS por empresa+role) — todas as futuras decisões de UI passam por `AuthzAction` tipado; qualquer nova dimensão (ex.: empresa) é adicionada num único ponto.

---

_Log de descobertas produzido durante a execução. Não altera Achados nem cria novos sem avaliação formal de fim de onda._
