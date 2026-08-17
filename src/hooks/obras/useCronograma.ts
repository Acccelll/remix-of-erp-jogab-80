// @ts-nocheck
/**
 * useCronograma — camada canônica de acesso a `cronogramaRepo` para
 * componentes de UI (ARC-013). Encapsula chaves tipadas, queryFns e
 * mutations reaproveitadas fora das rotinas de importação e recálculo
 * (que continuam consumindo o repo diretamente).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cronogramaBaselineItensRepo,
  cronogramaBaselinesRepo,
  cronogramaCenariosRepo,
  cronogramaCenarioItensRepo,
  cronogramaDependenciasRepo,
  cronogramaItemRevisoesRepo,
  cronogramaRepo,
  cronogramaRevisoesRepo,
  type CronogramaItemInsert,
  type CronogramaItemRow,
  type CronogramaItemUpdate,
} from "@/lib/repositories/cronograma";

export type { CronogramaItemInsert, CronogramaItemRow, CronogramaItemUpdate };

export const cronogramaKeys = {
  itensParaVinculoByObra: (obraId: string) =>
    ["cronograma-itens-por-obra", obraId] as const,
  lobByObra: (obraId: string) => ["crono_lob", obraId] as const,
};

export type CronogramaItemVinculo = {
  id: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  ordem: number;
};

export const cronogramaQueryFns = {
  async listAtivosParaVinculoByObra(obraId: string): Promise<CronogramaItemVinculo[]> {
    return (await cronogramaRepo.listAtivosParaVinculoByObra(obraId)) as CronogramaItemVinculo[];
  },
};

/**
 * Wrappers imperativos para componentes que ainda executam a mutação em fluxo
 * `async` custom (sem `useMutation`). Mantém o repositório fora da camada de UI.
 */
export const cronogramaMutationFns = {
  async create(payload: CronogramaItemInsert) {
    await cronogramaRepo.create(payload);
  },
  async update(id: string, patch: CronogramaItemUpdate) {
    await cronogramaRepo.update(id, patch);
  },
  async remove(id: string) {
    await cronogramaRepo.remove(id);
  },
};

/** Wrappers imperativos para snapshots de revisões de itens (`cronograma_item_revisoes`). */
export const cronogramaItemRevisoesMutationFns = {
  async insertMany(rows: Array<Record<string, unknown>>) {
    await cronogramaItemRevisoesRepo.insertMany(rows as any);
  },
};

/** Wrappers imperativos para revisões (cabeçalhos). */
export const cronogramaRevisoesMutationFns = {
  async listIdsByObra(obraId: string): Promise<string[]> {
    return cronogramaRevisoesRepo.listIdsByObra(obraId);
  },
  async removeMany(ids: string[]) {
    await cronogramaRevisoesRepo.removeMany(ids);
  },
  async remove(id: string) {
    await cronogramaRevisoesRepo.remove(id);
  },
};

/** Leituras/remoções de snapshots por revisão. */
export const cronogramaItemRevisoesQueryFns = {
  async listSnapshotsByRevisao(revisaoId: string) {
    return cronogramaItemRevisoesRepo.listSnapshotsByRevisao(revisaoId);
  },
};

Object.assign(cronogramaItemRevisoesMutationFns, {
  async removeByRevisao(revisaoId: string) {
    await cronogramaItemRevisoesRepo.removeByRevisao(revisaoId);
  },
  async removeByRevisaoIds(revisaoIds: string[]) {
    await cronogramaItemRevisoesRepo.removeByRevisaoIds(revisaoIds);
  },
});

/**
 * Orquestrador da limpeza total do cronograma de uma obra: revisões + baselines
 * + dependências + itens. Usado por `LimparImportadosButton` para não expor os
 * repos individuais na camada de UI.
 */
export async function limparCronogramaCompletoByObra(obraId: string): Promise<void> {
  const revIds = await cronogramaRevisoesRepo.listIdsByObra(obraId);
  if (revIds.length) {
    await cronogramaItemRevisoesRepo.removeByRevisaoIds(revIds);
    await cronogramaRevisoesRepo.removeMany(revIds);
  }

  const blIds = await cronogramaBaselinesRepo.listIdsByObra(obraId);
  if (blIds.length) {
    await cronogramaBaselineItensRepo.removeByBaselineIds(blIds);
    await cronogramaBaselinesRepo.removeMany(blIds);
  }

  await cronogramaDependenciasRepo.removeByObra(obraId);
  await cronogramaRepo.removeByObra(obraId);
}

/**
 * Passthroughs completos dos repositórios de cronograma, expostos para
 * componentes de UI complexos (ex.: `RevisoesTab`) que orquestram várias
 * chamadas sequenciais. Mantém os repos fora da camada de componentes sem
 * duplicar a superfície método a método.
 */
export const cronogramaFns = { ...cronogramaRepo };
export const cronogramaRevisoesFns = { ...cronogramaRevisoesRepo };
export const cronogramaItemRevisoesFns = { ...cronogramaItemRevisoesRepo };
export const cronogramaBaselinesFns = { ...cronogramaBaselinesRepo };
export const cronogramaBaselineItensFns = { ...cronogramaBaselineItensRepo };
export const cronogramaDependenciasFns = { ...cronogramaDependenciasRepo };
export const cronogramaCenariosFns = { ...cronogramaCenariosRepo };
export const cronogramaCenarioItensFns = { ...cronogramaCenarioItensRepo };

/** Mutation genérica de atualização de item de cronograma. */
export function useUpdateCronogramaItem(opts?: { invalidateKeys?: readonly unknown[][] }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CronogramaItemUpdate }) => {
      await cronogramaRepo.update(id, patch);
    },
    onSettled: () => {
      for (const key of opts?.invalidateKeys ?? []) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
