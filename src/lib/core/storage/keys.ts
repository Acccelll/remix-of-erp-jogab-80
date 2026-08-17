/** @module-kind io */
/**
 * EST-003 — Inventário canônico das chaves de `localStorage`.
 *
 * Objetivo: centralizar todas as chaves usadas no app, documentar seu domínio
 * e evitar novas colisões / novos prefixos de marca ad-hoc.
 *
 * Histórico dos prefixos:
 *  - `planifik:*`   — nome de marca legado (UI/navegação/PWA).
 *  - `obraflow*`    — nome de marca legado (rascunhos de mobilização, empresa).
 *  - `buildflow:*`  — nome de marca legado (telemetria interna).
 *  - `lovable.*`    — plataforma (hints de onboarding).
 *  - `go_*`         — sessão local (auth simplificado do bootstrap).
 *  - sem prefixo    — legado, não migrar sem plano de compat.
 *
 * NOVAS CHAVES devem usar o prefixo canônico `gestaobra:<dominio>:<nome>`
 * via `makeStorageKey`. Renomeações das chaves legadas exigem migração
 * (`localStorage.getItem(old) -> setItem(new)`) e ficam para uma onda futura.
 *
 * Este arquivo é a fonte da verdade. Nenhum call-site deve inline-string
 * uma chave já listada aqui.
 */

export const CANONICAL_PREFIX = "gestaobra";

/** Prefixos legados ainda em uso — não introduzir novos. */
export const LEGACY_PREFIXES = ["planifik", "obraflow", "buildflow", "lovable", "go_"] as const;

/**
 * Compõe uma chave canônica `gestaobra:<namespace>:<name>`.
 * Use apenas para chaves NOVAS. Chaves já existentes ficam em `STORAGE_KEYS`.
 */
export function makeStorageKey(namespace: string, name: string): string {
  return `${CANONICAL_PREFIX}:${namespace}:${name}`;
}

/** Inventário congelado — mantém compat de estado do usuário. */
export const STORAGE_KEYS = {
  // Auth / sessão local
  authToken: "go_token",
  currentPlayer: "go_player",

  // Tema / UI
  theme: "planifik_theme",
  navOpenGroups: "planifik:nav:openGroups",
  navRecent: "planifik:nav:recent",
  navFavorites: "planifik:nav:favorites",

  // PWA / onboarding
  pwaInstallDismissed: "planifik:pwa:installDismissed",
  onboardingHintPrefix: "lovable.onboarding.", // + storageKey do hint

  // Notificações
  notifBellTiposOcultos: "notif-bell-tipos-ocultos",

  // Empresa / contexto
  empresaAtualId: "obraflow.empresaAtualId",

  // Rascunhos e telemetria
  mobilizacaoProvisoriaDraft: "obraflow:mob-prov",
  rpcP95Baseline: "buildflow:rpc-p95-baseline:v1",

  // Visibilidade de colunas
  obrasColumnVisibility: "obras:columnVisibility",

  // CRM — tarefas / follow-up (PRO-002)
  crmTarefas: "gestaobra:crm:tarefas",

  // CRM — motivos de perda (PRO-001)
  crmMotivosPerda: "gestaobra:crm:motivosPerda",
  crmPerdas: "gestaobra:crm:perdas",

  // Central de notificações — categorias ocultas (PRO-030)
  notifCategoriasOcultas: "gestaobra:notif:categoriasOcultas",

  // Financeiro — cadência esperada de importação TOTVS (PRO-015)
  finImportCadencia: "gestaobra:fin:importCadencia",

  // Suprimentos — saídas formais a fornecedores (PRO-010)
  suprimentoEnvios: "gestaobra:suprimentos:envios",

  // Quadros — automações locais já executadas por card/status (PRO-027)
  quadroAutomacoesExecutadas: "gestaobra:quadro:automacoesExecutadas",
  quadroAutomacoesDesativadas: "gestaobra:quadro:automacoesDesativadas",

  // Contratos — documentos anexados/versionados localmente (PRO-021)
  contratoDocumentos: "gestaobra:contratos:documentos",

  // Players — perfis reutilizáveis de permissões (PRO-028)
  perfisPermissao: "gestaobra:players:perfisPermissao",

  // RDO — numeração sequencial + trava local (PRO-005)
  rdoNumeracao: "gestaobra:rdo:numeracao",

  // DP — fechamentos de competência da folha (PRO-003)
  dpFechamentosCompetencia: "gestaobra:dp:fechamentosCompetencia",

  // BMS — perfis de layout salvos (PRO-018)
  bmsLayoutPerfis: "gestaobra:bms:layoutPerfis",

  // Contratos — silenciar alertas por (contratoId,tipo) até data ISO (PRO-019)
  contratosAlertaSilenciados: "gestaobra:contratos:alertaSilenciados",

  // Empresa — parametrizações locais por empresa: logo + numerações (PRO-031)
  empresaParametrizacao: "gestaobra:empresa:parametrizacao",

  // Empresa — números documentais emitidos localmente por documento (PRO-031)
  documentoNumeracaoLocal: "gestaobra:empresa:documentoNumeracao",

  // Suprimentos — contagens cíclicas de estoque (PRO-012)
  estoqueContagensCiclicas: "gestaobra:estoque:contagensCiclicas",

  // Central de notificações — dedupe client-side por chave estável (PRO-030)
  notifDedupe: "gestaobra:notif:dedupe",

  // Financeiro — carrinho de títulos (persistente entre sessões)
  finCarrinho: "gestaobra:fin:carrinho",

  // Financeiro — último recorte de filtros por página
  filtrosAprovacaoFinanceira: "gestaobra:fin:filtros:aprovacao",
  filtrosFinObras: "gestaobra:fin:filtros:obras",
  filtrosFinFluxo: "gestaobra:fin:filtros:fluxo",
} as const;



export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
