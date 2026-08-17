// Justificativas da RHiD: leitura do cache local e sincronização sob demanda.
//
// O cache existe porque o cruzamento com a fila de tratativas roda a cada
// abertura da aba — consultar a RHiD nesse caminho (login + janela de 90 dias)
// seria inviável. Sincronizar é ação explícita do operador.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pontoRepo } from "@/lib/repositories/ponto";
import { rhidRepo } from "@/lib/repositories/rhid";
import { queryKey } from "@/lib/query-keys";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import {
  normalizarJustificativas,
  normalizarTipos,
  type Justificativa,
  type TipoJustificativa,
} from "@/lib/ponto/justificativas";

const retryExcetoIndisponivel = (falhas: number, erro: unknown) =>
  !isRecursoIndisponivel(erro) && falhas < 1;

export const justificativasKeys = {
  all: queryKey("ponto_justificativas"),
  periodo: (inicio: string, fim: string) => queryKey("ponto_justificativas", { inicio, fim }),
  tipos: queryKey("ponto_justificativa_tipos"),
};

/** Justificativas gravadas que se sobrepõem ao período. */
export function usePontoJustificativas(inicio: string, fim: string) {
  return useQuery({
    queryKey: justificativasKeys.periodo(inicio, fim),
    queryFn: async (): Promise<Justificativa[]> => {
      const linhas = await pontoRepo.listJustificativas(inicio, fim);
      // O banco guarda o formato já normalizado; reusar o tipo do domínio evita
      // duas formas da mesma coisa circulando pela tela.
      return linhas.map((l) => ({
        id: l.id_rhid,
        idPerson: l.id_person,
        nome: l.nome_rhid,
        cpf: l.cpf,
        dataInicio: l.data_inicio,
        dataFim: l.data_fim,
        idTipo: l.id_tipo,
        tipoNome: l.tipo_nome,
        status: l.status_aprovacao as Justificativa["status"],
        motivo: l.motivo,
      }));
    },
    retry: retryExcetoIndisponivel,
    staleTime: 30_000,
  });
}

export function usePontoJustificativaTipos() {
  return useQuery({
    queryKey: justificativasKeys.tipos,
    queryFn: async (): Promise<TipoJustificativa[]> => {
      const linhas = await pontoRepo.listJustificativaTipos();
      return linhas.map((l) => ({
        id: l.id,
        nome: l.nome,
        abreviacao: l.abreviacao,
        abonarDiaFalta: l.abonar_dia_falta,
        descontaDsr: l.desconta_dsr,
        exigeCid: l.exige_cid,
        qtdMensal: l.qtd_mensal,
        qtdTrimestral: l.qtd_trimestral,
        qtdSemestral: l.qtd_semestral,
        qtdAnual: l.qtd_anual,
      }));
    },
    retry: retryExcetoIndisponivel,
    staleTime: 5 * 60_000,
  });
}

export interface SincronizarJustificativasInput {
  inicio: string;
  fim: string;
  /** idPerson → colaborador do ERP, para desnormalizar o vínculo na gravação. */
  colaboradorPorIdPerson?: ReadonlyMap<number, string>;
  colaboradorPorCpf?: ReadonlyMap<string, string>;
}

/** Busca da RHiD, normaliza e grava tipos + justificativas do período. */
export function useSincronizarJustificativas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SincronizarJustificativasInput) => {
      const [brutas, tiposBrutos] = await Promise.all([
        rhidRepo.buscarJustificativas({ dataIni: input.inicio, dataFinal: input.fim }),
        rhidRepo.buscarTiposDeJustificativa().catch(() => []),
      ]);

      const tipos = normalizarTipos(tiposBrutos);
      if (tipos.length > 0) {
        await pontoRepo.upsertJustificativaTipos(
          tipos.map((t) => ({
            id: t.id,
            nome: t.nome,
            abreviacao: t.abreviacao,
            abonar_dia_falta: t.abonarDiaFalta,
            desconta_dsr: t.descontaDsr,
            exige_cid: t.exigeCid,
            qtd_mensal: t.qtdMensal,
            qtd_trimestral: t.qtdTrimestral,
            qtd_semestral: t.qtdSemestral,
            qtd_anual: t.qtdAnual,
          })),
        );
      }

      const justificativas = normalizarJustificativas(brutas);
      const gravadas = await pontoRepo.upsertJustificativas(
        justificativas.map((j) => ({
          id_rhid: j.id,
          id_person: j.idPerson,
          // Resolve o vínculo aqui para o cruzamento com a fila não depender
          // de join com o cadastro a cada leitura.
          colaborador_id:
            (j.idPerson !== null ? input.colaboradorPorIdPerson?.get(j.idPerson) : undefined) ??
            (j.cpf ? input.colaboradorPorCpf?.get(j.cpf) : undefined) ??
            null,
          nome_rhid: j.nome,
          cpf: j.cpf,
          data_inicio: j.dataInicio,
          data_fim: j.dataFim,
          id_tipo: j.idTipo,
          tipo_nome: j.tipoNome,
          status_aprovacao: j.status,
          motivo: j.motivo,
        })),
      );

      return { justificativas: gravadas, tipos: tipos.length };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: justificativasKeys.all }),
  });
}
