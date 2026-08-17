/** @module-kind pure */
// Regras que transformam um dia apurado em ocorrência de tratativa.
//
// A Visão Geral responde "quanto"; a fila de Tratativas responde "o quê fazer".
// Estas funções produzem os fatos; quem persiste (e preserva o status já dado
// pelo DP) é o repositório — a UNIQUE (pessoa, dia, tipo) no banco garante que
// reprocessar o período não duplica nem apaga tratativa.

import { LIMITE_HE_DIARIA_MIN } from "@/lib/dp/codigos";
import {
  chaveColaborador,
  ehFaltaCritica,
  heTotalMin,
  nomeExibicao,
  type NomePorId,
  type RegistroPonto,
} from "./analise";

export type TipoOcorrencia =
  "falta" | "sem_marcacao" | "marcacao_invalida" | "interjornada" | "he_excedida";

export type SeveridadeOcorrencia = "alta" | "media" | "baixa";

export type StatusOcorrencia = "pendente" | "em_tratativa" | "justificada" | "descartada";

export const STATUS_OCORRENCIA: Record<StatusOcorrencia, string> = {
  pendente: "Pendente",
  em_tratativa: "Em tratativa",
  justificada: "Justificada",
  descartada: "Descartada",
};

export const ROTULO_TIPO: Record<TipoOcorrencia, string> = {
  falta: "Falta",
  sem_marcacao: "Dia sem marcação",
  marcacao_invalida: "Marcação inválida",
  interjornada: "Interjornada violada",
  he_excedida: "HE acima do teto diário",
};

/** Fato derivado de um dia — ainda sem estado de tratativa. */
export interface Ocorrencia {
  chavePessoa: string;
  data: string;
  tipo: TipoOcorrencia;
  registroId: string | null;
  colaboradorId: string | null;
  obraId: string | null;
  nome: string;
  severidade: SeveridadeOcorrencia;
  /** Frase curta que explica a ocorrência na fila, sem abrir o espelho. */
  detalhe: string;
  /** Magnitude em minutos — ordena a fila por tamanho do problema. */
  minutos: number;
}

/** Registro diário com o id da linha, para a ocorrência apontar de volta. */
export type RegistroComId = RegistroPonto & { id: string };

function hhmm(min: number): string {
  const sinal = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  return `${sinal}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/**
 * Ocorrências de um único dia. Um mesmo dia pode gerar mais de uma (faltar e
 * ainda ter marcação ímpar são problemas distintos, tratados por gente
 * diferente), por isso o tipo entra na chave de unicidade.
 */
export function derivarOcorrencias(r: RegistroComId, nomePorId: NomePorId): Ocorrencia[] {
  const base = {
    chavePessoa: chaveColaborador(r),
    data: r.data,
    registroId: r.id,
    colaboradorId: r.colaborador_id,
    obraId: r.obra_id,
    nome: nomeExibicao(r, nomePorId),
  };
  const ocorrencias: Ocorrencia[] = [];

  if (ehFaltaCritica(r)) {
    const minutos = r.horas_falta_min || r.horas_previstas_min;
    // A origem sinalizou falta, ou o dia simplesmente não teve marcação nenhuma:
    // o primeiro caso é ausência conhecida, o segundo costuma ser falha de coleta.
    ocorrencias.push(
      r.falta
        ? {
            ...base,
            tipo: "falta",
            severidade: "alta",
            detalhe: `Falta de ${hhmm(minutos)} sem justificativa`,
            minutos,
          }
        : {
            ...base,
            tipo: "sem_marcacao",
            severidade: "alta",
            detalhe: `Jornada de ${hhmm(r.horas_previstas_min)} prevista sem nenhuma marcação`,
            minutos,
          },
    );
  }

  if (r.marcacao_invalida) {
    ocorrencias.push({
      ...base,
      tipo: "marcacao_invalida",
      severidade: "media",
      detalhe: "Marcação ímpar ou inconsistente no dia",
      minutos: 0,
    });
  }

  if (r.interjornada_min > 0) {
    ocorrencias.push({
      ...base,
      tipo: "interjornada",
      severidade: "alta",
      detalhe: `Descanso entre jornadas violado em ${hhmm(r.interjornada_min)}`,
      minutos: r.interjornada_min,
    });
  }

  const he = heTotalMin(r);
  if (he > LIMITE_HE_DIARIA_MIN) {
    ocorrencias.push({
      ...base,
      tipo: "he_excedida",
      severidade: he > LIMITE_HE_DIARIA_MIN * 2 ? "alta" : "media",
      detalhe: `${hhmm(he)} de hora extra no dia (teto ${hhmm(LIMITE_HE_DIARIA_MIN)})`,
      minutos: he,
    });
  }

  return ocorrencias;
}

/** Ocorrências de um período inteiro, na ordem em que os dias chegaram. */
export function derivarOcorrenciasDoPeriodo(
  registros: readonly RegistroComId[],
  nomePorId: NomePorId,
): Ocorrencia[] {
  return registros.flatMap((r) => derivarOcorrencias(r, nomePorId));
}

/** Contagem por status, para os cartões no topo da fila. */
export function resumirPorStatus(
  ocorrencias: ReadonlyArray<{ status: StatusOcorrencia }>,
): Record<StatusOcorrencia, number> {
  const resumo: Record<StatusOcorrencia, number> = {
    pendente: 0,
    em_tratativa: 0,
    justificada: 0,
    descartada: 0,
  };
  for (const o of ocorrencias) {
    if (o.status in resumo) resumo[o.status] += 1;
  }
  return resumo;
}
