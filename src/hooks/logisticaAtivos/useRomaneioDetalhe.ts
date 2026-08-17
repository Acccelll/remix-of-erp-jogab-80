import { useQuery } from "@tanstack/react-query";
import { romaneiosRepo } from "@/lib/repositories/romaneios";
import { queryKey } from "@/lib/query-keys";
import type { RomaneioResumo } from "./useRomaneios";

export interface RomaneioItemEstoque {
  id: string;
  romaneio_id: string;
  insumo_id: string;
  quantidade: number;
  local_origem: string;
  local_destino: string;
  baixado: boolean;
  baixado_em: string | null;
  observacao: string | null;
}

export interface RomaneioItemPatrimonio {
  id: string;
  romaneio_id: string;
  patrimonio_id: string;
  patrimonio_codigo: string | null;
  patrimonio_nome: string | null;
  mobilizado: boolean;
  mobilizado_em: string | null;
  mobilizacao_erro: string | null;
}

export interface RomaneioDetalhe {
  romaneio: RomaneioResumo;
  itensEstoque: RomaneioItemEstoque[];
  itensPatrimonio: RomaneioItemPatrimonio[];
}

export function useRomaneioDetalhe(romaneioId: string | null | undefined) {
  return useQuery({
    queryKey: queryKey("romaneios", "detalhe", romaneioId ?? ""),
    queryFn: () => romaneiosRepo.getById(romaneioId as string) as Promise<RomaneioDetalhe>,
    enabled: Boolean(romaneioId),
    staleTime: 10_000,
  });
}
