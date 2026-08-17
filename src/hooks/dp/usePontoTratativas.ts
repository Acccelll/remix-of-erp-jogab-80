// Leitura e escrita da fila de tratativas de ponto (Onda 1).
//
// A regeneração é deliberadamente manual: reprocessar o período é uma ação do
// operador, não um efeito colateral de abrir a tela — a fila mistura fato
// (derivado do registro) com trabalho humano (status, responsável, prazo).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  pontoRepo,
  type PontoOcorrenciaPatch,
  type PontoOcorrenciaRow,
  type PontoRegistroRow,
} from "@/lib/repositories/ponto";
import { queryKey } from "@/lib/query-keys";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import { derivarOcorrenciasDoPeriodo } from "@/lib/ponto/ocorrencias";
import type { NomePorId } from "@/lib/ponto/analise";

export type PontoOcorrencia = PontoOcorrenciaRow;

export const ocorrenciasKeys = {
  all: queryKey("ponto_ocorrencias"),
  periodo: (inicio: string, fim: string, status?: string) =>
    queryKey("ponto_ocorrencias", { inicio, fim, status: status ?? "" }),
};

/** Sem retry quando o recurso ainda não existe no host — o aviso é imediato. */
const retryExcetoIndisponivel = (falhas: number, erro: unknown) =>
  !isRecursoIndisponivel(erro) && falhas < 1;

export function usePontoOcorrencias(inicio: string, fim: string, status?: string) {
  return useQuery({
    queryKey: ocorrenciasKeys.periodo(inicio, fim, status),
    queryFn: () => pontoRepo.listOcorrencias(inicio, fim, status),
    retry: retryExcetoIndisponivel,
    staleTime: 30_000,
  });
}

export interface RegenerarInput {
  registros: PontoRegistroRow[];
  nomePorId: NomePorId;
}

/** Deriva as ocorrências do período carregado e grava (upsert idempotente). */
export function useRegenerarOcorrencias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ registros, nomePorId }: RegenerarInput) => {
      const comId = registros.map((r) => ({ ...r, id: String(r.id) }));
      const ocorrencias = derivarOcorrenciasDoPeriodo(comId, nomePorId);
      return await pontoRepo.upsertOcorrencias(
        ocorrencias.map((o) => ({
          chave_pessoa: o.chavePessoa,
          data: o.data,
          tipo: o.tipo,
          registro_id: o.registroId,
          colaborador_id: o.colaboradorId,
          obra_id: o.obraId,
          nome: o.nome,
          severidade: o.severidade,
          detalhe: o.detalhe,
          minutos: o.minutos,
        })),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ocorrenciasKeys.all }),
  });
}

export function useAtualizarOcorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PontoOcorrenciaPatch) => pontoRepo.patchOcorrencia(patch),
    onSettled: () => qc.invalidateQueries({ queryKey: ocorrenciasKeys.all }),
  });
}
