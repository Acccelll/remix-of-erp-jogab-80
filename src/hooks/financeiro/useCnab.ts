// Fase 5 — CNAB 240 (remessa + retorno + conciliação).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cnabRepo,
  type ContaBancariaEmpresa,
  type CnabRemessaRow,
  type CnabRemessaItemRow,
  type CnabRetornoRow,
  type CnabItemEntrada,
} from "@/lib/repositories/cnab";
import { queryKey } from "@/lib/query-keys";

export const cnabKeys = {
  contasBancarias: queryKey("contas_bancarias_empresa"),
  remessas: queryKey("cnab_remessas"),
  remessaItens: (remessaId: string) => queryKey("cnab_remessa_itens", remessaId),
  retornos: queryKey("cnab_retornos"),
  ocorrencias: (retornoId: string) => queryKey("cnab_retorno_ocorrencias", retornoId),
};

export function useContasBancarias() {
  return useQuery({
    queryKey: cnabKeys.contasBancarias,
    queryFn: () => cnabRepo.listContasBancarias() as Promise<ContaBancariaEmpresa[]>,
    staleTime: 60_000,
  });
}

export function useCriarContaBancaria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof cnabRepo.criarContaBancaria>[0]) =>
      cnabRepo.criarContaBancaria(payload),
    onError: (err: Error) => toast.error("Erro ao criar conta bancária: " + err.message),
    onSettled: () => qc.invalidateQueries({ queryKey: cnabKeys.contasBancarias }),
  });
}

export function useAtualizarContaBancaria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; patch: Partial<ContaBancariaEmpresa> }) =>
      cnabRepo.atualizarContaBancaria(args.id, args.patch),
    onError: (err: Error) => toast.error("Erro ao atualizar conta bancária: " + err.message),
    onSettled: () => qc.invalidateQueries({ queryKey: cnabKeys.contasBancarias }),
  });
}

export function useCnabRemessas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: cnabKeys.remessas,
    queryFn: () => cnabRepo.listRemessas() as Promise<CnabRemessaRow[]>,
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });
}

export function useCnabRemessaItens(remessaId: string) {
  return useQuery({
    queryKey: cnabKeys.remessaItens(remessaId),
    queryFn: () => cnabRepo.listRemessaItens(remessaId) as Promise<CnabRemessaItemRow[]>,
    enabled: !!remessaId,
    staleTime: 15_000,
  });
}

/**
 * Orquestra a geração de uma remessa completa: cria cabeçalho + itens
 * (RPC atômica), monta o arquivo-texto CNAB240 (função pura, cnab240.ts),
 * sobe pro storage e marca a remessa como gerada.
 */
export function useGerarRemessaCnab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      carrinhoId: string;
      contaBancariaId: string;
      empresa: import("@/lib/financeiro/cnab240").EmpresaCedente;
      itens: CnabItemEntrada[];
    }) => {
      const { gerarRemessaCnab240 } = await import("@/lib/financeiro/cnab240");
      const criado = await cnabRepo.criarRemessa(args.carrinhoId, args.contaBancariaId, args.itens);
      const conteudo = gerarRemessaCnab240(
        args.empresa,
        criado.itens.map((it) => ({
          nome: it.favorecido_nome,
          documento: it.favorecido_documento,
          bancoCodigo: it.favorecido_banco,
          agencia: it.favorecido_agencia,
          agenciaDv: it.favorecido_agencia_dv ?? undefined,
          conta: it.favorecido_conta,
          contaDv: it.favorecido_conta_dv ?? undefined,
          valor: it.valor,
          nossoNumero: it.nosso_numero,
          dataPagamento: new Date(),
        })),
        criado.numeroArquivo,
      );
      const path = await cnabRepo.uploadArquivoRemessa(criado.remessaId, conteudo);
      await cnabRepo.marcarRemessaGerada(criado.remessaId, path);
      return { ...criado, arquivoPath: path };
    },
    onError: (err: Error) => toast.error("Erro ao gerar remessa CNAB: " + err.message),
    onSuccess: () => toast.success("Remessa CNAB gerada."),
    onSettled: () => qc.invalidateQueries({ queryKey: cnabKeys.remessas }),
  });
}

export function useCnabRetornos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: cnabKeys.retornos,
    queryFn: () => cnabRepo.listRetornos() as Promise<CnabRetornoRow[]>,
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });
}

export function useCnabOcorrencias(retornoId: string) {
  return useQuery({
    queryKey: cnabKeys.ocorrencias(retornoId),
    queryFn: () => cnabRepo.listOcorrenciasRetorno(retornoId),
    enabled: !!retornoId,
    staleTime: 15_000,
  });
}

/**
 * Orquestra a importação de um retorno: sobe o arquivo, parseia (função pura,
 * cnab240.ts), concilia cada ocorrência (RPC) e, para itens de origem
 * `solicitacao`, completa a baixa no backend certo (api.php para id
 * numérico — Aprovação Financeira real hoje mora no MySQL).
 */
export function useProcessarRetornoCnab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { file: File; bancoCodigo: string }) => {
      const { parseRetornoCnab240 } = await import("@/lib/financeiro/cnab240");
      const { api } = await import("@/lib/api");
      const texto = await args.file.text();
      const ocorrencias = parseRetornoCnab240(texto);
      if (ocorrencias.length === 0) {
        throw new Error("Nenhuma ocorrência de Segmento A encontrada no arquivo.");
      }
      const path = await cnabRepo.uploadArquivoRetorno(args.file);
      const retornoId = await cnabRepo.criarRetorno(path, args.bancoCodigo);

      let semMatch = 0;
      for (const oc of ocorrencias) {
        const resultado = await cnabRepo.conciliarOcorrencia(retornoId, {
          nossoNumero: oc.nossoNumero,
          codigoOcorrencia: oc.codigoOcorrencia,
          dataOcorrencia: oc.dataOcorrencia,
          valorPago: oc.valorPago,
        });
        if (!resultado.matched) {
          semMatch += 1;
          continue;
        }
        if (resultado.origem_tipo === "solicitacao" && resultado.origem_id) {
          const numerico = /^\d+$/.test(resultado.origem_id);
          if (numerico) {
            await api.update("solicitacoesFinanceiras", resultado.origem_id, {
              pagamento_pendente: false,
            });
          }
          // id em formato uuid: solicitação Postgres vestigial (fluxo legado,
          // sem rota de baixa dedicada hoje) — fica só conciliada no CNAB.
        }
      }

      await cnabRepo.marcarRetornoStatus(retornoId, semMatch > 0 ? "com_erros" : "processado");
      return { retornoId, total: ocorrencias.length, semMatch };
    },
    onError: (err: Error) => toast.error("Erro ao processar retorno CNAB: " + err.message),
    onSuccess: (r) =>
      toast.success(
        r.semMatch > 0
          ? `Retorno processado: ${r.total - r.semMatch}/${r.total} ocorrências conciliadas (${r.semMatch} sem título correspondente).`
          : `Retorno processado: ${r.total} ocorrência(s) conciliada(s).`,
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: cnabKeys.retornos }),
  });
}
