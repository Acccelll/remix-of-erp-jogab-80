/** @module-kind io */
// Sincronização de ponto com a API RHiD.
//
// Em duas etapas deliberadas:
//   1. `useRhidPreview` busca e converte, SEM gravar — o operador confere a prévia;
//   2. `useRhidSync` grava as linhas já conferidas pelo pipeline de importação existente.

import { useMutation } from "@tanstack/react-query";
import { rhidRepo } from "@/lib/repositories/rhid";
import {
  camposNaoMapeados,
  explicarMapeamento,
  mapApuracaoToRows,
  type RhidDia,
  type RhidPessoa,
} from "@/lib/rhid/mapApuracao";
import type { ParsedPontoRow } from "@/lib/ponto/parseRelatorioCsv";
import { pontoRepo } from "@/lib/repositories/ponto";
import { swallow } from "@/lib/core/errors";
import { useImportarPonto, type ImportarPontoMutationResult } from "./usePonto";

/** Pessoas por chamada à edge function — mantém cada invocação curta. */
const LOTE_PESSOAS = 25;

export interface RhidPreviewInput {
  periodoInicio: string; // AAAA-MM-DD
  periodoFim: string; // AAAA-MM-DD
  /** Progresso de colaboradores processados, para a barra na tela. */
  onProgress?: (feito: number, total: number) => void;
}

export interface RhidPreviewResult {
  rows: ParsedPontoRow[];
  pessoas: RhidPessoa[];
  amostraBruta: RhidDia | null;
  naoMapeados: string[];
  explicacao: ReturnType<typeof explicarMapeamento>;
  erros: Array<{ idPerson: number; error: string }>;
}

/**
 * Busca o cadastro + a apuração de todos os colaboradores no período e converte
 * para linhas de ponto. Não grava nada.
 */
export function useRhidPreview() {
  return useMutation({
    mutationFn: async (input: RhidPreviewInput): Promise<RhidPreviewResult> => {
      const periodo = { dataIni: input.periodoInicio, dataFinal: input.periodoFim };

      const pessoas = await rhidRepo.listarPessoas(periodo);
      if (pessoas.length === 0) {
        throw new Error("A RHiD não retornou nenhuma pessoa cadastrada.");
      }

      const pessoasPorId = new Map(pessoas.map((p) => [p.idPerson, p]));
      const ids = pessoas.map((p) => p.idPerson);

      const dias: RhidDia[] = [];
      const erros: Array<{ idPerson: number; error: string }> = [];
      let amostraBruta: RhidDia | null = null;

      input.onProgress?.(0, ids.length);
      for (let i = 0; i < ids.length; i += LOTE_PESSOAS) {
        const lote = ids.slice(i, i + LOTE_PESSOAS);
        const resposta = await rhidRepo.buscarApuracao(periodo, lote);
        dias.push(...resposta.dias);
        erros.push(...resposta.erros);
        if (!amostraBruta) amostraBruta = resposta.amostraBruta;
        input.onProgress?.(Math.min(i + lote.length, ids.length), ids.length);
      }

      return {
        rows: mapApuracaoToRows(dias, pessoasPorId),
        pessoas,
        amostraBruta,
        naoMapeados: camposNaoMapeados(amostraBruta),
        explicacao: explicarMapeamento(amostraBruta),
        erros,
      };
    },
  });
}

export interface RhidSyncInput {
  rows: ParsedPontoRow[];
  periodoInicio: string;
  periodoFim: string;
  importadoPor?: string | null;
  colaboradoresCtx?: Array<{ id: string; nome: string; cpf?: string; matricula?: string }>;
  /** Falhas por colaborador da prévia — registradas junto com a importação. */
  erros?: Array<{ idPerson: number; error: string }>;
  /** Cadastro RHiD da prévia, para nomear o colaborador que falhou. */
  pessoas?: RhidPessoa[];
}

/**
 * Grava as linhas conferidas. Delega a `useImportarPonto`, que já resolve
 * colaborador/obra, grava em lotes e invalida os caches de ponto.
 *
 * Grava TUDO de uma vez: `importarPonto` apaga as importações sobrepostas do período
 * antes de inserir, então gravar lote a lote faria cada um apagar o anterior.
 */
export function useRhidSync() {
  const importarPonto = useImportarPonto();

  return useMutation({
    mutationFn: async (input: RhidSyncInput): Promise<ImportarPontoMutationResult> => {
      if (input.rows.length === 0) {
        throw new Error("Nada a importar: a prévia está vazia.");
      }
      const resultado = await importarPonto.mutateAsync({
        arquivoNome: `rhid_apuracao_${input.periodoInicio}_a_${input.periodoFim}.json`,
        rows: input.rows,
        periodoInicio: input.periodoInicio,
        periodoFim: input.periodoFim,
        importadoPor: input.importadoPor ?? "RHID_SYNC",
        colaboradoresCtx: input.colaboradoresCtx,
      });

      // Falhas por colaborador viravam um aviso efêmero no diálogo. Persistidas,
      // mostram quem falha em toda apuração — quase sempre cadastro quebrado.
      // Nunca derruba a importação: os registros bons já estão gravados.
      if (input.erros?.length) {
        const nomePorId = new Map((input.pessoas ?? []).map((p) => [p.idPerson, p.name]));
        try {
          await pontoRepo.registrarSyncErros(
            input.erros.map((e) => ({
              importacao_id: resultado.importacaoId,
              periodo_inicio: input.periodoInicio,
              periodo_fim: input.periodoFim,
              id_person: e.idPerson,
              nome_rhid: nomePorId.get(e.idPerson) ?? null,
              mensagem: e.error,
            })),
          );
        } catch (err) {
          swallow("rhidSync.registrarErros", err, "log de erros de sincronização indisponível");
        }
      }

      return resultado;
    },
  });
}
