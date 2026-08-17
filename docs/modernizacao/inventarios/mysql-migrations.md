# Inventário — Trilho MySQL (backend PHP legado)

Fonte da verdade documental do que existe no repositório vs. o que
está registrado como aplicado no host `jogabcom_gestao_obras`.

## Migrações versionadas no repositório

| #   | Arquivo                                                         | Objetivo                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00  | `0000_schema_migrations_control.sql`                            | Tabela de controle `schema_migrations` + backfill do histórico.                                                                                                                                                                                                                                                           |
| 01  | `2026_06_19_remix_context.sql`                                  | Suporte ao novo AppContext (colunas de pagamento em `obras`).                                                                                                                                                                                                                                                             |
| 02  | `2026_06_23_documento_tipos_vencimento_dias.sql`                | Vencimento em dias por tipo de documento.                                                                                                                                                                                                                                                                                 |
| 03  | `2026_06_24_crm.sql`                                            | Base do módulo CRM legado.                                                                                                                                                                                                                                                                                                |
| 04  | `2026_06_30_expand_clientes_financeiro.sql`                     | Colunas financeiras em `clientes`.                                                                                                                                                                                                                                                                                        |
| 05  | `2026_06_30_fix_clientes_primary_key.sql`                       | Corrige chave primária de `clientes`.                                                                                                                                                                                                                                                                                     |
| 06  | `2026_07_02_colaboradores_documentos_consolida_vencimentos.sql` | Consolida vencimentos por colaborador.                                                                                                                                                                                                                                                                                    |
| 07  | `2026_07_02_lead_comentarios.sql`                               | Comentários em `leads`.                                                                                                                                                                                                                                                                                                   |
| 08  | `2026_07_02_leads_campos_oportunidade.sql`                      | Campos de oportunidade em `leads`.                                                                                                                                                                                                                                                                                        |
| 09  | `2026_07_02_leads_local_obra_datas_potenciais.sql`              | Local/obra/datas potenciais em `leads`.                                                                                                                                                                                                                                                                                   |
| 10  | `2026_07_02_leads_servicos_multi.sql`                           | Serviços múltiplos por lead.                                                                                                                                                                                                                                                                                              |
| 11  | `2026_07_04_rename_leads_para_oportunidades.sql`                | Renomeia `leads` → `oportunidades` (fecha o resíduo apontado em DB-003).                                                                                                                                                                                                                                                  |
| 12  | `2026_07_16_usuarios_matriz_permissoes.sql`                     | —                                                                                                                                                                                                                                                                                                                         |
| 13  | `2026_07_17_colaboradores_integracoes.sql`                      | —                                                                                                                                                                                                                                                                                                                         |
| 14  | `2026_07_17_crm_persistencia_mysql.sql`                         | —                                                                                                                                                                                                                                                                                                                         |
| 15  | `2026_07_17_dp_persistencia_mysql.sql`                          | —                                                                                                                                                                                                                                                                                                                         |
| 16  | `2026_07_17_gm_auditoria_perfis_mysql.sql`                      | —                                                                                                                                                                                                                                                                                                                         |
| 17  | `2026_07_19_histograma_mysql.sql`                               | —                                                                                                                                                                                                                                                                                                                         |
| 18  | `2026_07_20_feature_flags_notificacoes_mysql.sql`               | —                                                                                                                                                                                                                                                                                                                         |
| 19  | `2026_07_21_comentarios_entidades_mysql.sql`                    | —                                                                                                                                                                                                                                                                                                                         |
| 20  | `2026_07_22_solicitacoes_setor_canonico.sql`                    | —                                                                                                                                                                                                                                                                                                                         |
| 21  | `2026_07_26_logistica_georreferenciada_mysql.sql`               | —                                                                                                                                                                                                                                                                                                                         |
| 22  | `2026_07_27_normaliza_cidade_uf_colaboradores_mysql.sql`        | —                                                                                                                                                                                                                                                                                                                         |
| 23  | `2026_07_30_colaborador_eventos_tipados_mysql.sql`              | `movimentacoes` vira log de eventos tipado do colaborador: `tipo`, `status_origem`/`status_destino`, `observacao`, `registrado_em`; `data_programada` passa a ser a data efetiva canônica. Backfill conservador dos destinos nulos.                                                                                       |
| 24  | `2026_07_31_patrimonio_eventos_tipados_mysql.sql`               | `movimentacoes_patrimonios` vira log tipado; importa os períodos de `responsabilidades_patrimonios` como eventos do bem.                                                                                                                                                                                                  |
| 25  | `2026_08_01_contrato_eventos_tipados_mysql.sql`                 | `movimentacoes_contratos` vira log tipado e **importa os 57 eventos de `contratos.historico`** via `JSON_TABLE`, recuperando obra de destino, data efetiva e autoria. A coluna JSON não é apagada — é a cópia original.                                                                                                   |
| 26  | `2026_08_03_ponto_ondas.sql`                                    | Tratativa de ponto: `ponto_registros` passa a guardar o JSON cru do ACJEF (`payload`) e o `rhid_id_person`; novas `ponto_ocorrencias` (fila com status, chaveada pelo fato pessoa+dia+tipo para sobreviver à re-sincronização), `rhid_pessoa_vinculo`, `ponto_departamento_obra` (de-para editável) e `ponto_sync_erros`. |
| 27  | `2026_08_04_ponto_justificativas.sql`                           | Espelho das justificativas da RHiD e dos tipos (com as cotas `qtd_mensal`/`qtd_anual`), para cruzar com a fila de tratativas sem consultar a API a cada leitura.                                                                                                                                                          |
| 28  | `2026_08_04_ponto_afd.sql`                                      | Snapshot dos REPs (`ponto_dispositivos`) e arquivamento do AFD (`ponto_afd_arquivos`: faixa de NSR, linhas, sha256, caminho no bucket privado `ponto-afd`).                                                                                                                                                               |
| 29  | `2026_08_05_fechamento_escopo.sql`                              | `escopo` em `dp_fechamento_competencia` (DEFAULT 'folha'): separa a trava do ponto da trava da folha, que fecham em momentos diferentes.                                                                                                                                                                                  |
| 30  | `2026_08_07_cliente_responsaveis_negociacao.sql`                | Junção `cliente_responsaveis (cliente_id, usuario_id)`: o "Responsável por negociação" do cadastro de cliente e o recorte de carteira do Funil de Vendas. **DB-005:** o CRM (clientes + oportunidades) roda 100% no MySQL/PHP — `oportunidades.cliente_id` e a rota `clientes` são deste trilho, e o filtro precisa rodar no `WHERE` do servidor. Junção em vez de coluna JSON porque o MySQL do host pode não ter operadores JSON (mesmo motivo de `papeis_permissao` ser LONGTEXT). |

> **Nota:** as linhas 12 a 22 foram acrescentadas ao inventário em 2026-07-30 a
> partir da listagem do diretório `migrations/`, e as descrições estão em branco
> porque não foram registradas na época. O inventário havia parado na linha 11
> enquanto o diretório seguia crescendo — quem tiver o contexto de cada uma pode
> preencher. A justificativa DB-005 da linha 23 está no cabeçalho do próprio
> arquivo de migração: o domínio de colaborador roda 100% no MySQL/PHP.

> **Nota (2026-08-07):** o diretório `migrations/` tem **32** arquivos de
> domínio, mas a tabela acima lista 30 — seguem sem linha
> `2026_07_31_obras_flowcast_id_mysql.sql` e
> `2026_08_05_almoxarifado_desacopla_de_obras.sql`. Não foram preenchidos aqui
> para não inventar intenção; quem tiver o contexto, complete.

**Total no repositório:** 32 migrações de domínio + 1 de controle
(30 inventariadas acima).

## Dump `schema_migrations.tsv` (a preencher no host)

Este arquivo espelha exatamente o output de:

```sh
mysql --batch --raw --skip-column-names \
      -e "SELECT filename FROM schema_migrations ORDER BY filename" \
      jogabcom_gestao_obras > schema_migrations.tsv
```

Comitar o TSV em `docs/modernizacao/inventarios/schema_migrations.tsv`
habilita o gate `scripts/verify-mysql-migrations.sh` (que compara com o
inventário acima e imprime pendências ou divergências).

## Convenções resumidas

- Nome: `YYYY_MM_DD_descricao.sql` — ver `migrations/README.md`.
- Cabeçalho de intenção obrigatório.
- Idempotência sempre (`IF NOT EXISTS`, `INSERT IGNORE`, notas
  explícitas sobre erros esperados).
- Registro após aplicar (`INSERT INTO schema_migrations (...)`) com
  `sha256` do arquivo comitado.

## Extinção

Este trilho é temporário. Cada nova migração aqui exige justificativa
sob DB-005 (matriz de canonicidade): "por que ainda não fomos ao
Postgres?". Novas features de domínio já migrado para Lovable Cloud
não devem tocar este trilho.
