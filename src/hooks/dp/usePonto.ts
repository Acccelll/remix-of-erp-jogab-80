// ARC-013 · Onda 6 — Ponto sob leitura + importação via TanStack Query (fonte única).
// Encapsula `pontoRepo` como camada interna; páginas devem consumir estes hooks.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  pontoRepo,
  type ColaboradorRow,
  type HomemHoraRow,
  type ObraRow,
  type PontoFiltros,
  type PontoImportacaoRow,
  type PontoRegistroRow,
} from "@/lib/repositories/ponto";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import { importarPonto, resolveColaboradores, resolveObras } from "@/lib/ponto/pontoRepo";
import type { ParsedPontoRow } from "@/lib/ponto/parseRelatorioCsv";
import { queryKey } from "@/lib/query-keys";

export type { PontoFiltros };
export type PontoRegistro = PontoRegistroRow;
export type PontoImportacao = PontoImportacaoRow;
export type HomemHoraLinha = HomemHoraRow;
export type PontoColaborador = ColaboradorRow;
export type PontoObra = ObraRow;

export const pontoKeys = {
  registros: {
    all: queryKey("ponto_registros"),
    list: (filtros: PontoFiltros) => queryKey("ponto_registros", filtros),
  },
  importacoes: {
    all: queryKey("ponto_importacoes"),
    periodo: (inicio: string, fim: string) => queryKey("ponto_importacoes", { inicio, fim }),
  },
  homemHora: {
    all: queryKey("homem_hora"),
    mensal: (competencia: string) => queryKey("homem_hora", competencia),
  },
  custoPrevisto: {
    all: queryKey("custo_previsto"),
    competencia: (competencia: string) => queryKey("custo_previsto", competencia),
  },
};

export interface ImportarPontoMutationInput {
  arquivoNome: string;
  rows: ParsedPontoRow[];
  periodoInicio: string;
  periodoFim: string;
  importadoPor?: string | null;
  colaboradoresCtx?: Array<{ id: string; nome: string; cpf?: string; matricula?: string }>;
}

export interface ImportarPontoMutationResult {
  importacaoId: string;
  colabMap: Map<string, string>;
  obraMap: Map<string, string>;
  indiretoMap: Map<string, boolean>;
}

export function usePontoRegistros(filtros: PontoFiltros) {
  return useQuery({
    queryKey: pontoKeys.registros.list(filtros),
    queryFn: () => pontoRepo.listRegistros(filtros),
    staleTime: 30_000,
  });
}

/**
 * Importações que cobrem o período — proveniência dos números da tela e
 * conteúdo da aba Sincronizações.
 *
 * Sem retry: quando a rota ainda não existe no `api.php` do host, insistir só
 * atrasa o aviso de pendência que a página já sabe exibir.
 */
export function usePontoImportacoes(inicio: string, fim: string) {
  return useQuery({
    queryKey: pontoKeys.importacoes.periodo(inicio, fim),
    queryFn: () => pontoRepo.listImportacoes(inicio, fim),
    retry: (falhas, erro) => !isRecursoIndisponivel(erro) && falhas < 1,
    staleTime: 30_000,
  });
}

export function useHomemHora(competencia: string) {
  return useQuery({
    queryKey: pontoKeys.homemHora.mensal(competencia),
    queryFn: () => pontoRepo.listHomemHoraMensal(competencia),
    staleTime: 30_000,
  });
}

export function useCustoPrevisto(competencia: string) {
  return useQuery({
    queryKey: pontoKeys.custoPrevisto.competencia(competencia),
    queryFn: () => pontoRepo.listCustoColabCompetencia(competencia),
    staleTime: 30_000,
  });
}

function invalidateAllPonto(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: pontoKeys.registros.all });
  qc.invalidateQueries({ queryKey: pontoKeys.homemHora.all });
}

export function useImportarPonto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportarPontoMutationInput): Promise<ImportarPontoMutationResult> => {
      const colabMap = await resolveColaboradores(input.rows, input.colaboradoresCtx);
      const { obraMap, indiretoMap } = await resolveObras(input.rows);
      const importacaoId = await importarPonto({
        arquivoNome: input.arquivoNome,
        rows: input.rows,
        periodoInicio: input.periodoInicio,
        periodoFim: input.periodoFim,
        importadoPor: input.importadoPor ?? null,
        colabMap,
        obraMap,
        indiretoMap,
      });

      return { importacaoId, colabMap, obraMap, indiretoMap };
    },
    onSettled: () => invalidateAllPonto(qc),
  });
}
