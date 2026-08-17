/** @module-kind orchestration */
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import type { EstoqueProvider } from "./EstoqueProvider";
import { estoqueInternoProvider } from "./providers/estoqueInternoProvider";
import { totvsRmProvider } from "./providers/totvsRmProvider";

/** Chave da flag que liga o provider real do TOTVS RM quando ele existir. */
export const TOTVS_RM_ESTOQUE_FLAG = "totvs_rm_estoque_ativo";

/**
 * Resolve qual EstoqueProvider a UI de Romaneio deve usar. Hoje sempre
 * resolve para o provider interno (a flag não existe/está desligada); é o
 * ponto único de troca para o TOTVS RM assim que o provider real existir.
 */
export function useEstoqueProvider(): EstoqueProvider {
  const { enabled } = useFeatureFlag(TOTVS_RM_ESTOQUE_FLAG);
  return enabled ? totvsRmProvider : estoqueInternoProvider;
}
