// PRO-030 slice-03 — snapshot velho (idade do snapshot TOTVS ativo).
import { useQuery } from "@tanstack/react-query";
import { fetchSnapshotAtivo } from "@/lib/financeiro-totvs/queries";

export interface SnapshotVelhoAlerta {
  status: "ok" | "aviso" | "critico";
  ageDays: number;
  importadoEm: string;
}

export function useSnapshotVelho(
  enabled: boolean,
  warnDays = 3,
  errorDays = 7,
): SnapshotVelhoAlerta | null {
  const { data } = useQuery({
    queryKey: ["snapshot_ativo_age"],
    queryFn: fetchSnapshotAtivo,
    staleTime: 60_000,
    enabled,
  });

  if (!enabled || !data?.importado_em) return null;
  const ageDays = Math.floor(
    (Date.now() - new Date(data.importado_em).getTime()) / 86_400_000,
  );
  if (ageDays < warnDays) return null;
  return {
    status: ageDays > errorDays ? "critico" : "aviso",
    ageDays,
    importadoEm: data.importado_em,
  };
}
