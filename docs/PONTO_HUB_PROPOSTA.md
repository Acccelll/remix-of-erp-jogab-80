# Ponto — Diagnóstico da Análise de Ponto e proposta de Hub

Análise da página **DP › Ponto** (`/dp/ponto/analise`, `src/pages/dp/PontoAnalise.tsx`) com
sugestões de correção e de novas páginas para transformá-la num **hub**, aproveitando dados
da API RHiD que a integração atual ainda não consome.

Complementa `docs/RHID_INTEGRATION.md` (que descreve a integração como ela é hoje);
aqui o foco é **o que falta**.

> **Status de execução** (atualizado em 2026-08-03)
>
> | Onda               | Situação                                                                       |
> | ------------------ | ------------------------------------------------------------------------------ |
> | 0 — Higiene        | ✅ implementada — correções da §2.1, hub com `HubTabs`, aba Sincronizações     |
> | 1 — Fechar o ciclo | ✅ implementada — Espelho, Tratativas, Banco de Horas, Conciliação de Cadastro |
> | 2 — Conformidade   | ✅ implementada — Justificativas, Relógios & AFD, sincronização automática     |
> | 3 — Financeiro     | ✅ implementada — Fechamento do ponto + conciliação Ponto × Folha              |
>
> **Ações de operação necessárias.** Até que sejam feitas, as abas afetadas mostram o que
> falta aplicar, em vez de erro:
>
> 1. Publicar o `api.php` deste repositório.
> 2. Aplicar as migrations com `ops/mysql-migrate.sh`: `2026_08_03_ponto_ondas.sql`,
>    `2026_08_04_ponto_justificativas.sql`, `2026_08_04_ponto_afd.sql` e
>    `2026_08_05_fechamento_escopo.sql`.
> 3. Deployar as edge functions `rhid-apuracao` (atualizada) e `rhid-afd` (nova).
> 4. Criar o bucket privado `ponto-afd` e aplicar as policies de
>    `supabase/migrations/20260804120000_ponto_afd_bucket_policies.sql`.
> 5. Cadastrar os secrets do workflow `sync-rhid` (`VITE_API_URL`, `SUPABASE_URL`,
>    `SUPABASE_ANON_KEY`) — a sincronização automática só roda depois disso.
>
> O texto abaixo é o diagnóstico original, preservado como registro da decisão.

---

## 1. Onde estamos

```
/dp/ponto/analise  →  PontoAnalise.tsx
   ├─ RhidSyncDialog        período → prévia → confirmar   (RHiD: /login, /person, /department, /apuracao_ponto)
   ├─ PontoImportar (Sheet) CSV manual
   └─ usePontoRegistros     ponto_registros (MySQL via api.php)
```

A página entrega hoje: 4 KPIs (absenteísmo, HE total, falhas de marcação, top infrator),
3 gráficos (ocorrências por obra, evolução de HE, distribuição do absenteísmo),
3 tabelas de exceção (faltas críticas, HE estouradas, atrasos) e exportação CSV.

O pipeline de dados é sólido — parser puro e testado, credenciais no backend, janelas de 90
dias, vínculo por CPF. O problema não é a coleta: é que **tudo que a RHiD devolve é reduzido a
uma única tela de leitura**, sem tratativa, sem histórico e sem os outros domínios da API.

---

## 2. Diagnóstico da página atual

### 2.1 Correções pontuais

| #   | Achado                                                                                                                         | Evidência                                                               | Correção                                                                                                                | Esforço |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | KPI rotulado **"Top Infrator (HE 60%)"** soma HE 50+60+100                                                                     | `PontoAnalise.tsx:160` vs rótulo em `:419`                              | Renomear para "HE total" ou somar só `horas_extra_60_min` — o rótulo é o que vai para a reunião de fechamento           | P       |
| 2   | Accordion diz **"HE 60% ≥ 02:00"**, mas a regra é HE60 ≥ 15% do previsto                                                       | regra em `:252` (`LIMITE_HE_FOLHA_PCT`), rótulo em `:520`               | Alinhar o texto à regra e exibir o percentual apurado por colaborador                                                   | P       |
| 3   | Limiar de risco **210 min** cravado no JSX                                                                                     | `:544`                                                                  | Mover para `src/lib/dp/codigos.ts` junto de `LIMITE_HE_FOLHA_PCT`                                                       | P       |
| 4   | **Faltas críticas incluem atestado**: o filtro pega `previstas > 0 && trabalhadas === 0` sem excluir `atestado`                | `:224-226` — enquanto o KPI de absenteísmo exclui atestado em `:147`    | Excluir atestado da fila crítica (ou separar em coluna "justificada") — hoje as duas métricas da mesma tela discordam   | P       |
| 5   | Botão **"Ajustar"** sem `onClick`                                                                                              | `:507`                                                                  | É a ação mais importante da tela; ver aba _Tratativas_ (§4.3)                                                           | —       |
| 6   | CSV: coluna **"CPF/Matricula"** recebe `colaborador_id` (id interno)                                                           | header `:65`, valor `:87`                                               | `api.php:5586` nem seleciona `cpf_csv`/`matricula_csv`; incluir no SELECT + em `PontoRegistroRow`, ou renomear a coluna | P       |
| 7   | **Datas padrão com erro de fuso**: `toISOString()` sobre horário local — depois das 21h (BRT) o período começa no dia seguinte | `:48-55`; mesmo padrão em `RhidSyncDialog.tsx:34-41`                    | Usar `hojeBrasilia()` (`src/lib/core/date.ts:59`), que já existe no repo                                                | P       |
| 8   | Tabelas exibem `nome_csv` (nome da RHiD), KPIs exibem o nome do cadastro                                                       | `:230`, `:246`, `:260` vs `:166`                                        | Resolver sempre pelo cadastro com fallback — a mesma pessoa aparece com duas grafias na mesma tela                      | P       |
| 9   | Sem estado de erro: em falha a tela mostra "Carregando…" e depois zera                                                         | `:129` (só `isLoading`), `:474`                                         | Usar `QueryState` (`src/components/common/QueryState.tsx`), como em `HorasExtras.tsx`                                   | P       |
| 10  | `Input` importado e não usado                                                                                                  | `:3`                                                                    | Remover                                                                                                                 | P       |
| 11  | Filtro de colaborador é client-side; obra vai ao servidor                                                                      | `:132` vs `:136`; `api.php:5599` traz até 100.000 linhas                | Enquanto o volume for baixo, tudo bem — mas o caminho é um endpoint de agregação (ver §6)                               | M       |
| 12  | KPI **"Falhas de Marcação"** mistura marcação ímpar e violação de interjornada                                                 | `:153`                                                                  | São exceções de naturezas diferentes (uma é erro de registro, a outra é risco trabalhista) — separar                    | P       |
| 13  | Nenhuma indicação de **proveniência**: qual importação alimenta a tela, quando foi sincronizada, por quem                      | `ponto_importacoes` tem `importado_em`, `importado_por`, `arquivo_nome` | Barra "Última sincronização RHiD: 02/08 08:14 · 1.240 registros · rh02"                                                 | P       |

### 2.2 Limites estruturais

O que impede a página de crescer:

- **Aba única.** `Tabs` com um só `TabsTrigger` (`:304-307`) é vestígio. O repo já tem
  `HubTabs` (`src/components/common/HubTabs.tsx`) com sincronização por `?tab=`, usado em
  `CustosHub.tsx`. Migrar é pré-requisito de tudo abaixo.
- **O registro cru da RHiD é descartado.** `amostraBruta` só vive na prévia do diálogo. Sem
  guardar o JSON do dia apurado não há espelho de ponto, nem re-mapeamento sem novo fetch,
  nem auditoria de "por que esse dia deu falta".
- **Os erros por colaborador somem.** `erros[]` (`useRhidSync.ts`) aparece no diálogo e é
  perdido. Colaborador que falha na apuração todo mês nunca vira alerta.
- **Não há chave estável RHiD ↔ ERP.** O `idPerson` não é gravado; o vínculo é refeito por CPF
  a cada importação. Quem não casa vira registro órfão silencioso (`colaborador_id = null`).
- **O de-para departamento → obra é heurística implícita** (`extrairCodigoNumerico`,
  `isCentroIndireto` em `codigos.ts`): funciona enquanto o depto se chamar "210 - COPI". Não há
  tela para corrigir exceção, e um depto novo entra sem obra sem avisar ninguém.
- **Sem sincronização automática** (assumido em `RHID_INTEGRATION.md`). Além do agendamento,
  falta um caminho de **escrita server-side**: hoje a gravação passa pelo browser
  (`useRhidSync` → `useImportarPonto`).
- **Sem trava de competência no ponto.** A folha já tem (`dp_fechamento_competencia`,
  `CompetenciaFechamentoBar`). O ponto pode ser re-sincronizado depois do fechamento e mudar
  a base de uma folha já paga.

---

## 3. O que a RHiD oferece e o ERP ainda não usa

| Endpoint                                    | Dado disponível                                                                                               | Status                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `POST /login`                               | token, `listCustomer`                                                                                         | ✅ em uso                        |
| `GET /person`                               | `cpf`, `pis`, `registration`, `idDepartment`, `idCompany`                                                     | ✅ parcial                       |
| `GET /person`                               | `status`, `numberOfTemplates`, `linkedDeviceIds`, `rfid`, `barCode`                                           | ❌ ignorados                     |
| `GET /person/withtemplates`                 | quem tem biometria cadastrada                                                                                 | ❌                               |
| `GET /department`                           | nome do depto                                                                                                 | ✅ (só para resolver obra)       |
| `GET /apuracao_ponto`                       | ~10 campos ACJEF mapeados                                                                                     | ✅ parcial — a API tem "dezenas" |
| `POST /justifications`                      | justificativas com `approvalStatus`, filtros por depto/cargo/turno/centro de custo                            | ❌                               |
| `GET /justificationstype`                   | `abonarDiaFalta`, `descontaDsr`, `informarCid`, `qtdMensal/Anual`, `colunaHorasAbonadas`                      | ❌                               |
| `GET /device`                               | REPs: `lastConnectionDate`, `lastSyncDate`, `status`, `statusPapel`, `numberOfPeople`, `numberOfFingerprints` | ❌                               |
| `GET /report/afd/download` e `/download671` | AFD layout 1510 / 671 por equipamento (fiscalização)                                                          | ❌                               |
| `GET /company`                              | CNPJ, CEI/CNO/CAEPF, `serialRep`, `timeZone`                                                                  | ❌                               |
| `GET /costcenters` · `GET /personroles`     | centro de custo e cargo                                                                                       | ❌                               |

Traduzindo em oportunidades:

1. **Justificativas** fecham o ciclo: hoje a tela mostra a exceção e o operador vai resolver
   _fora do ERP_, na RHiD. Lendo `/justifications` dá para dizer o que já foi tratado, o que
   está pendente de aprovação e o que ninguém olhou.
2. **Dispositivos** explicam a exceção: relógio de obra offline há 3 dias é a causa de metade
   das marcações ímpares daquela obra. É o dado que transforma "falha de marcação" de sintoma
   em causa.
3. **AFD** é obrigação legal (Portarias 1510/671). Baixar e arquivar pelo ERP, com registro de
   quem baixou e qual faixa de NSR, resolve fiscalização sem depender do portal da ControlID.
4. **Cargo e centro de custo** abrem recortes que a análise hoje não tem: HE por cargo,
   absenteísmo por centro de custo — dimensões que o CSV nunca trouxe.
5. **Cadastro completo** (`status`, biometria, vínculo com REP) resolve na origem o
   "não cadastrado" que reaparece todo mês na prévia.

---

## 4. Hub de Ponto proposto

Estrutura sugerida — `PontoHub.tsx` usando `HubTabs`, com o cabeçalho (período, obra,
sincronizar, exportar) **acima** das abas, compartilhado por todas:

| Aba                 | Página                         | Fonte                                          | Onda |
| ------------------- | ------------------------------ | ---------------------------------------------- | ---- |
| Visão Geral         | `PontoAnalise` (atual, enxuta) | `ponto_registros`                              | 0    |
| Espelho de Ponto    | `PontoEspelho`                 | `ponto_registros` + JSON cru                   | 1    |
| Tratativas          | `PontoTratativas`              | `ponto_ocorrencias` (nova) + `/justifications` | 1    |
| Justificativas      | `PontoJustificativas`          | `/justifications`, `/justificationstype`       | 2    |
| Banco de Horas      | `PontoBancoHoras`              | `banco_saldo_min` (já gravado)                 | 1    |
| Cadastro RHiD × ERP | `PontoConciliacaoCadastro`     | `/person`, `/department`                       | 1    |
| Relógios & AFD      | `PontoRelogiosAfd`             | `/device`, `/report/afd/*`                     | 2    |
| Sincronizações      | `PontoSincronizacoes`          | `ponto_importacoes` + log novo                 | 0    |
| Fechamento          | `PontoFechamento`              | `ponto_registros` × `dp_holerite`              | 3    |

### 4.1 Visão Geral (evolução da tela atual)

Manter KPIs e gráficos, corrigindo §2.1 e acrescentando:

- **Tendência**: variação vs. período anterior de igual duração em cada KPI (hoje o número
  aparece sem referência — 4,2% de absenteísmo é bom ou ruim?).
- **Recortes novos** habilitados pela API: filtro por **cargo** e **centro de custo**.
- **Barra de proveniência** (§2.1 #13).
- **Drill-down**: clicar em obra/colaborador leva ao Espelho já filtrado.
- As 3 tabelas de exceção saem daqui e viram a fila de Tratativas — a Visão Geral fica
  diagnóstico, a Tratativa fica execução.

### 4.2 Espelho de Ponto _(maior ganho por esforço)_

Dia a dia de um colaborador no período: previsto, trabalhado, HE 50/60/100, faltas, banco,
observação e o **registro cru da RHiD** em painel lateral. É a tela que o DP abre quando o
encarregado liga perguntando "por que o Fulano deu falta dia 12?".

Depende de guardar o JSON do dia (§6). Todo o resto já está no banco.

### 4.3 Tratativas (fila de exceções)

Worklist com estado — o que o botão "Ajustar" deveria abrir:

- Regras que geram ocorrência: falta sem justificativa, marcação ímpar, interjornada violada,
  HE acima do limite, jornada acima de X horas, dia sem marcação com obra ativa.
- Cada ocorrência tem status (`pendente` → `em_tratativa` → `justificada` → `descartada`),
  responsável, prazo e histórico de comentários (o repo já tem
  `comentarios_entidades`, `src/hooks/comentarios/`).
- Cruzamento com `/justifications`: ocorrência que já tem justificativa aprovada na RHiD
  fecha sozinha. **É esse cruzamento que evita retrabalho** — hoje o DP trata na RHiD e a
  tela do ERP continua acusando o mesmo problema.
- Regras puras e testáveis em `src/lib/ponto/ocorrencias.ts`, no padrão do módulo.

### 4.4 Justificativas & Abonos

Leitura de `POST /justifications` + `GET /justificationstype`:

- Pendentes de aprovação por departamento/obra, com idade em dias.
- Por tipo, destacando os que **abonam dia de falta** ou **descontam DSR** — impacto direto na
  folha.
- **Limites estourados**: `qtdMensal/qtdTrimestral/qtdSemestral/qtdAnual` do tipo vs. uso do
  colaborador. A API entrega o limite; ninguém confere hoje.
- Tipos com `informarCid` alimentam o controle de atestados do RH.

### 4.5 Banco de Horas

`saldoBancoFinalDia` já é mapeado (`bancoSaldo` em `mapApuracao.ts`) e gravado em
`banco_saldo_min` — e **nenhuma tela mostra**. Proposta:

- Saldo atual por colaborador, ordenado por risco (positivos altos = passivo a pagar,
  negativos = desconto a fazer).
- Evolução do saldo consolidado no período.
- **Valorização**: saldo × custo/hora, reaproveitando `useCustoPrevisto`/`HomemHora`
  (`JORNADA_MENSAL_HORAS` já centralizado). Converte horas em R$ de passivo.
- Alerta de vencimento do acordo de compensação.

### 4.6 Conciliação de Cadastro (RHiD × ERP)

Divergências, com ação em cada linha:

| Situação                                                            | Ação                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| Na RHiD, sem CPF correspondente no ERP                              | Criar colaborador / vincular manualmente             |
| No ERP, ativo, sem pessoa na RHiD                                   | Cadastrar na RHiD (`POST /person`) ou marcar exceção |
| Demitido no ERP, ativo na RHiD (`status`)                           | Inativar — risco de ponto batido por desligado       |
| Sem biometria (`numberOfTemplates = 0`)                             | Encaminhar coleta                                    |
| Sem REP vinculado (`linkedDeviceIds` vazio) na obra em que trabalha | Vincular ao relógio da obra                          |
| Departamento sem obra correspondente                                | Editar de-para (abaixo)                              |

Inclui o **de-para Departamento × Obra** editável, hoje só heurística em `codigos.ts` —
com fallback para a regra atual e possibilidade de marcar centro indireto na mão.

### 4.7 Relógios (REP) & AFD

Duas metades da mesma preocupação — fiscalização e confiabilidade da coleta:

- **Saúde dos REPs** via `/device`: última conexão, última sincronização, pessoas e digitais
  no equipamento, `statusPapel`. Alerta de relógio sem comunicar há N dias, cruzado com as
  falhas de marcação da obra.
- **AFD**: geração por equipamento/período (`/report/afd/download` 1510 e `download671`),
  arquivamento com hash e faixa de NSR, e registro de quem baixou. Paginação por
  `nsrInicial`/`limit` (máx. 50.000) já prevista pela API.

Acesso restrito — o AFD contém PIS/CPF de toda a base (§7).

### 4.8 Sincronizações

O que hoje é efêmero no diálogo vira histórico:

- Execuções (manuais e agendadas): período, quem, quantos registros, duração, erros.
- **Colaboradores que falharam** (`erros[]`) com o `idPerson` e a mensagem — repetição é sinal
  de cadastro quebrado.
- Diagnóstico de mapeamento (campos não mapeados) persistido: campo novo do ACJEF vira aviso
  em vez de ficar escondido atrás do `Collapsible`.
- Botão de sincronização **incremental** (últimos N dias) além do período cheio.

### 4.9 Fechamento do Ponto _(maior ganho financeiro)_

Trava de competência no padrão da folha (`dp_fechamento_competencia`) + **conciliação
Ponto × Folha**: HE apuradas em `ponto_registros` vs. HE pagas em `dp_holerite`
(`HE_CODIGOS` já mapeado em `codigos.ts`), falta apurada vs. desconto lançado.

Os dois lados já estão no banco e **nunca foram cruzados**. É a checagem que pega
pagamento a maior/menor antes de o dinheiro sair.

### 4.10 O que _não_ colocar no hub

**Custo de MO por obra / Homem-Hora** já existem no hub de Custos
(`CustosHub.tsx`: MOD, Homem/Hora, Horas Extras). Não duplicar — linkar. O hub de Ponto é
_apuração e conformidade_; o de Custos é _dinheiro_.

---

## 5. Roadmap

| Onda                   | Entrega                                                       | Depende de                                                       |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| **0 — Higiene**        | Correções §2.1 + migração para `HubTabs` + aba Sincronizações | nada                                                             |
| **1 — Fechar o ciclo** | Espelho, Tratativas, Banco de Horas, Conciliação de Cadastro  | guardar JSON cru; tabela `ponto_ocorrencias`; vínculo `idPerson` |
| **2 — Conformidade**   | Justificativas, Relógios & AFD, sincronização automática      | novos modos na edge function; escrita server-side                |
| **3 — Financeiro**     | Fechamento + conciliação Ponto × Folha                        | Onda 1; trava de competência                                     |

A Onda 0 é independente e cabe em um changeset. As demais devem seguir o padrão de slices do
repo (`docs/modernizacao/EXECUCAO/06_CHANGESETS/`).

---

## 6. Impactos técnicos

**Schema (MySQL, padrão das migrações do repo)**

| Tabela                                                                   | Para quê                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `ponto_apuracao_raw` (ou coluna `payload` LONGTEXT em `ponto_registros`) | JSON cru do dia — espelho, auditoria, re-mapeamento                       |
| `ponto_ocorrencias`                                                      | fila de tratativas com status/responsável/prazo                           |
| `ponto_sync_execucoes`                                                   | histórico de sincronização + erros por `idPerson`                         |
| `rhid_pessoa_vinculo` (`id_person` ↔ `colaborador_id`)                   | chave estável; hoje o CPF é refeito a cada import                         |
| `ponto_departamento_obra`                                                | de-para editável (fallback na heurística atual)                           |
| `ponto_afd_arquivos`                                                     | AFD arquivado: equipamento, período, NSR inicial/final, hash, quem baixou |

Atenção: `colaboradores.integracoes` **não** serve para o vínculo — no ERP esse campo é
integração de segurança do trabalho por obra (`EmployeeProfileDialog.tsx`), não integração de
sistema.

**Edge function** — `rhid-apuracao` já tem login, retry em 401, janelas de 90 dias e
concorrência. Estender com uma ação por domínio (`acao: "justificativas" | "devices" | "afd"`)
mantém o login e o CORS num lugar só; o AFD, por ser texto grande, provavelmente merece
function própria com streaming.

**Escrita server-side** — a sincronização automática precisa gravar sem o browser. Ou a edge
function passa a chamar o `api.php` (`pontoImportacoes`/`pontoRegistros`), ou o agendamento
roda no próprio backend PHP. Decisão de arquitetura a tomar antes da Onda 2.

**Performance** — com o histórico crescendo, migrar KPIs e gráficos para agregação em SQL
(um `dpPontoResumo` no `api.php`, como já existe `dpHomemHora`), deixando o payload bruto só
para o Espelho.

**Frontend** — rotas em `App.tsx` + `navigation.ts` (registro de rotas na linha ~817 e
`ROUTE_LABELS`); query keys em `pontoKeys` (`usePonto.ts`); regras novas como módulos puros
testados (`@module-kind pure`), respeitando `verify:lib-purity` e o limite de repositório.

---

## 7. Riscos e limites da API

- **90 dias por requisição** — já tratado por `fatiarPeriodo`; vale para justificativas também.
- **`/apuracao_ponto` exige `idPerson`** — não há consulta "todos de uma vez". Hoje: lotes de 25
  pessoas, concorrência 5, timeout de 20s por chamada. Sincronização diária incremental é bem
  mais segura que reprocessar o mês inteiro.
- **Paginação de `/person` declarada mas não implementada** (a própria doc da API avisa) —
  não confiar em `start`/`length`.
- **JSON serializado como string** em apuração e justificativas — `comoLista()` já cobre.
- **AFD**: `limit` máx. 50.000 por chamada, paginar por `nsrInicial`.
- **LGPD** — AFD e `/person` carregam CPF e PIS de toda a base. Arquivo com acesso restrito,
  download auditado e retenção definida. A permissão `dp` atual talvez seja larga demais para
  a aba fiscal.
- **Senha da conta RHiD** — `RHID_INTEGRATION.md` registra que a senha esteve em texto puro no
  histórico do Git (commits `f12b801`, `4c24021`). Antes de ampliar o uso da API, trocar a
  senha e atualizar o secret.

---

## 8. Resumo

Três recomendações, se for para escolher:

1. **Onda 0** — as correções da §2.1 são baratas e removem contradições visíveis na mesma tela
   (rótulo que não bate com a métrica, atestado contado como falta em um lugar e não em outro).
2. **Espelho + Tratativas** — é o que muda o comportamento: a tela deixa de listar problemas e
   passa a resolvê-los, sem sair do ERP.
3. **Conciliação Ponto × Folha** — os dois lados já estão no banco e nunca foram cruzados; é
   onde mora o erro que custa dinheiro.
