// Tipos de veículo — cadastro com grupo Veículos/Equipamentos (MySQL via api.php).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { GrupoVeiculoTipo, VeiculoTipoCadastro } from "@/types";

export const veiculoTiposKeys = {
  all: queryKey("veiculo_tipos"),
};

export function useVeiculoTipos() {
  return useQuery({
    queryKey: veiculoTiposKeys.all,
    queryFn: async (): Promise<VeiculoTipoCadastro[]> => {
      const data = await apiFetch<any[]>("veiculoTipos");
      return (Array.isArray(data) ? data : []).map((r) => ({
        id: String(r.id),
        nome: r.nome ?? "",
        grupo: (r.grupo === "Equipamentos" ? "Equipamentos" : "Veículos") as GrupoVeiculoTipo,
        ativo: !!r.ativo,
      }));
    },
    staleTime: 60_000,
  });
}

export function useSaveVeiculoTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id?: string;
      payload: { nome: string; grupo: GrupoVeiculoTipo; ativo?: boolean };
    }) =>
      args.id
        ? apiFetch("veiculoTipos", { method: "PUT", params: { id: args.id }, body: args.payload })
        : apiFetch("veiculoTipos", { method: "POST", body: args.payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: veiculoTiposKeys.all }),
    onError: () => toast.error("Erro ao salvar tipo"),
  });
}

export function useDeleteVeiculoTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch("veiculoTipos", { method: "DELETE", params: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: veiculoTiposKeys.all }),
    onError: () => toast.error("Erro ao remover tipo"),
  });
}
