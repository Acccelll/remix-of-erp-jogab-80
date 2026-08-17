// Espelho de ponto: o dia a dia de uma pessoa, com o JSON cru da apuração.
import { useQuery } from "@tanstack/react-query";
import { pontoRepo } from "@/lib/repositories/ponto";
import { queryKey } from "@/lib/query-keys";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";

export interface EspelhoParams {
  inicio: string;
  fim: string;
  /** Colaborador do cadastro; use `nome` para quem ficou sem vínculo. */
  colaboradorId?: string | null;
  nome?: string | null;
}

export const espelhoKeys = {
  all: queryKey("ponto_espelho"),
  de: (p: EspelhoParams) =>
    queryKey("ponto_espelho", {
      inicio: p.inicio,
      fim: p.fim,
      colaboradorId: p.colaboradorId ?? "",
      nome: p.nome ?? "",
    }),
};

export function usePontoEspelho(params: EspelhoParams) {
  const alvoDefinido = Boolean(params.colaboradorId || params.nome);
  return useQuery({
    queryKey: espelhoKeys.de(params),
    queryFn: () => pontoRepo.listEspelho(params),
    // Sem pessoa escolhida não há o que buscar — a tela pede a seleção.
    enabled: alvoDefinido,
    retry: (falhas, erro) => !isRecursoIndisponivel(erro) && falhas < 1,
    staleTime: 30_000,
  });
}
