// ARC-001 — Onda 1 (2026-07-11)
// Este augment deixou de alargar `from()`/`rpc()` para `any` no cliente inteiro.
// Agora só narra como `any` os nomes de tabelas/views/RPCs que o código
// referencia mas que NÃO existem no schema atual do Lovable Cloud (types.ts).
//
// Cada entrada em `MissingTables`/`MissingRpcs` é débito registrado na
// Descoberta de Execução E-01 e precisa (a) virar tabela/função real via
// migration, ou (b) ser removida do código. Enquanto isso, `types.ts` (gerado)
// segue como fonte da verdade — o compilador volta a valer nas ~86 tabelas
// e ~15 functions reais.
import "@supabase/supabase-js";

type MissingTables =
  // Suprimentos / compras
  | "contratos"
  | "contrato_medicoes"
  | "cotacoes"
  | "cotacao_propostas"
  | "fornecedores"
  | "insumos"
  | "composicoes"
  | "composicao_itens"
  | "orcamento_itens"
  | "ordens_compra"
  | "ordem_compra_itens"
  | "requisicoes"
  | "recebimento_itens"
  | "recebimento_materiais"
  // Estoque
  | "estoque_movimentacoes"
  | "estoque_saldos"
  // Inspeções / RDO / QSMS
  | "inspecoes"
  | "inspecao_agendas"
  | "inspecao_qr_alvos"
  | "inspecao_modelos"
  | "nao_conformidades"
  | "rdo"
  | "rdo_atividades"
  | "rdo_efetivo"
  | "rdo_ocorrencias"
  | "causas_nao_conclusao"
  // Cards / cronograma / pacotes / restrições
  | "card_custom_fields"
  | "pacotes_trabalho"
  | "pacote_restricoes"
  | "restricoes"
  | "cronograma_calendarios"
  | "cronograma_calendario_excecoes"
  | "cronograma_cenarios"
  | "cronograma_cenario_itens"
  | "compromissos_semanais"
  // Financeiro (rollups / snapshots complementares)
  | "faturamento_nfse"
  | "financeiro_evolucao_rollup"
  | "financeiro_matriz_rateios"
  | "alcadas_aprovacao"
  // Ponto / frota
  | "frota_abastecimentos"
  | "frota_manutencoes"
  // Localização / infra
  | "obra_localizacoes"
  | "user_setores"
  // Cross-cutting
  | "cutover_legacy_flags"
  | "import_validation_runs"
  | "system_events"
  | "security_events"
  | "totvs_import_runs"
  // Trello / cards
  | "cards"
  | "card_comentarios"
  // Logística de ativos
  | "romaneios"
  // Empresas / setores
  | "empresas"
  | "user_empresas"
  // DP
  | "dp_fechamento_competencia"
  // Views/materializadas
  | "vw_cutover_metrics_cronograma"
  | "vw_cutover_metrics_financeiro"
  | "vw_cutover_metrics_ponto"
  | "vw_cutover_metrics_trello"
  | "vw_obra_dashboard"
  | "vw_mv_obra_dashboard";

type MissingRpcs =
  | "aprovar_orcamento_obra"
  | "criar_medicao_atomica"
  | "excluir_nf_atomica"
  | "fechar_bms_atomica"
  | "fn_estoque_transferir"
  | "fn_importar_matriz"
  | "fn_importar_relatorio_totvs"
  | "fn_inspecao_materializar_pendentes"
  | "fn_oc_aprovar"
  | "rdo_upsert_from_checklist"
  | "salvar_nf_atomica";

declare module "@supabase/supabase-js" {
  interface SupabaseClient {
    // Overloads apenas para nomes fantasmas — os demais caem no tipo original
    // parametrizado por `Database` (tipado corretamente pelo types.ts gerado).
    from(relation: MissingTables): any;
    rpc(fn: MissingRpcs, args?: any, opts?: any): any;
  }
}

export {};
