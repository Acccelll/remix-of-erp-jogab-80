// @module-kind pure
// PERF-002 — Limites default para queries de listagem em repositories.
// Cada constante deve refletir o teto operacional realista da tabela
// para evitar full-table scans acidentais quando um filtro é omitido.

export const REPO_LIMIT_DEFAULT = 5000;

/**
 * Limites por domínio. Usar constantes nomeadas em vez de números soltos
 * garante auditoria e ajuste centralizado quando o volume crescer.
 */
export const REPO_LIMITS = {
  obras: 5000,
  colaboradores: 10000,
  fornecedores: 10000,
  insumos: 20000,
  cards: 5000,
  cronograma_itens: 20000,
  requisicoes: 20000,
  ordens_compra: 20000,
  financeiro: 50000,
  ponto_registros: 100000,
  dp_holerite: 100000,
} as const;

export type RepoLimitKey = keyof typeof REPO_LIMITS;
