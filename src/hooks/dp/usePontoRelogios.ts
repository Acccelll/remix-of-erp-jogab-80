// Relógios (REP) e AFD — dados de conformidade do ponto eletrônico.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pontoRepo } from "@/lib/repositories/ponto";
import { rhidRepo } from "@/lib/repositories/rhid";
import { pontoAfdStorage } from "@/lib/repositories/storage";
import { queryKey } from "@/lib/query-keys";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import { normalizarDispositivos } from "@/lib/ponto/dispositivos";

const retryExcetoIndisponivel = (falhas: number, erro: unknown) =>
  !isRecursoIndisponivel(erro) && falhas < 1;

export const relogiosKeys = {
  dispositivos: queryKey("ponto_dispositivos"),
  afd: queryKey("ponto_afd_arquivos"),
};

export function usePontoDispositivos() {
  return useQuery({
    queryKey: relogiosKeys.dispositivos,
    queryFn: () => pontoRepo.listDispositivos(),
    retry: retryExcetoIndisponivel,
    staleTime: 60_000,
  });
}

/** Busca os REPs na RHiD e atualiza o snapshot local. */
export function useSincronizarDispositivos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const brutos = await rhidRepo.buscarDispositivos();
      const dispositivos = normalizarDispositivos(brutos);
      await pontoRepo.upsertDispositivos(
        dispositivos.map((d) => ({
          id_device: d.id,
          nome: d.nome,
          serial: d.serial,
          versao: d.versao,
          status: d.status,
          status_papel: d.statusPapel,
          id_empresa: d.idEmpresa,
          num_pessoas: d.numPessoas,
          num_digitais: d.numDigitais,
          ultima_conexao: d.ultimaConexao,
          ultima_sincronizacao: d.ultimaSincronizacao,
        })),
      );
      return dispositivos.length;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: relogiosKeys.dispositivos }),
  });
}

export function usePontoAfdArquivos() {
  return useQuery({
    queryKey: relogiosKeys.afd,
    queryFn: () => pontoRepo.listAfdArquivos(),
    retry: retryExcetoIndisponivel,
    staleTime: 30_000,
  });
}

export interface GerarAfdInput {
  idEquipamento: number;
  equipamentoNome: string | null;
  layout: "1510" | "671";
  coletor?: boolean;
  dataIni?: string;
  dataFinal?: string;
  geradoPor?: string | null;
}

/**
 * Gera o AFD, arquiva no bucket privado e registra os metadados.
 *
 * A ordem importa: o arquivo sobe **antes** do registro. Metadado sem arquivo é
 * um comprovante que não se pode honrar numa fiscalização; arquivo sem metadado
 * ainda pode ser reconciliado pelo caminho no bucket.
 */
export function useGerarAfd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GerarAfdInput) => {
      const gerado = await rhidRepo.gerarAfd({
        idEquipamento: input.idEquipamento,
        layout: input.layout,
        coletor: input.coletor,
        dataIni: input.dataIni,
        dataFinal: input.dataFinal,
      });

      if (gerado.linhas === 0) {
        throw new Error("A RHiD não devolveu nenhum registro para este equipamento e período.");
      }

      const periodo =
        input.dataIni && input.dataFinal ? `${input.dataIni}_a_${input.dataFinal}` : "completo";
      const caminho = `rep-${input.idEquipamento}/afd_${input.layout}_${periodo}_${Date.now()}.txt`;
      const { error } = await pontoAfdStorage.upload(
        caminho,
        new Blob([gerado.conteudo], { type: "text/plain;charset=utf-8" }),
        { contentType: "text/plain;charset=utf-8" },
      );
      if (error) throw new Error(`Falha ao arquivar o AFD: ${error.message}`);

      await pontoRepo.registrarAfd({
        id_device: input.idEquipamento,
        equipamento_nome: input.equipamentoNome,
        layout: input.layout,
        coletor: input.coletor ?? false,
        periodo_inicio: input.dataIni ?? null,
        periodo_fim: input.dataFinal ?? null,
        nsr_inicial: gerado.nsrInicial,
        nsr_final: gerado.nsrFinal,
        linhas: gerado.linhas,
        sha256: gerado.sha256,
        storage_path: caminho,
        truncado: gerado.truncado,
        gerado_por: input.geradoPor ?? null,
      });

      return { ...gerado, caminho };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: relogiosKeys.afd }),
  });
}

/** URL assinada de curta duração para baixar um AFD arquivado. */
export function useBaixarAfd() {
  return useMutation({
    mutationFn: async (storagePath: string) => {
      const { data, error } = await pontoAfdStorage.createSignedUrl(storagePath, 300);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? "Não foi possível gerar o link do arquivo.");
      }
      return data.signedUrl;
    },
  });
}
