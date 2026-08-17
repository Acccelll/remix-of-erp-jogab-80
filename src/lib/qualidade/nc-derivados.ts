/** @module-kind pure */
/**
 * Derivações puras de uma Não Conformidade — PRO-008.slice-01
 *
 * Dado o estado observável de uma NC (id, obra, severidade, descrição,
 * responsável, prazo, status), produz payloads puros para:
 *  - Restrição operacional (M4 — `restricoes`)
 *  - Card automático (M2 — `cards`)
 *
 * Sem I/O, sem UI, sem Date.now — o repositório aplica os payloads (próxima
 * slice) e a UI apenas dispara. A regra de negócio vive aqui, testável.
 *
 * Regras:
 *  - NC com status `aberta`, `em_tratativa` ou `aguardando_reinspecao` gera
 *    restrição/card ATIVO.
 *  - NC `resolvida` ou `cancelada` fecha a restrição e conclui/arquiva o card.
 *  - O vínculo é 1:1: mesma NC ⇒ mesma restrição e mesmo card (`origem_id`).
 */

import type { NCStatus } from "@/lib/qualidade/nc-workflow";

export type NCSeveridade = "baixa" | "media" | "alta" | "critica" | string;

export interface NCDerivavel {
  id: string;
  obraId: string | null;
  severidade: NCSeveridade | null;
  descricao: string | null;
  status: NCStatus;
  responsavelId: string | null;
  prazoISO: string | null;
  inspecaoId?: string | null;
}

export type RestricaoStatusPayload = "aberta" | "resolvida" | "cancelada";

export interface RestricaoPayload {
  obra_id: string | null;
  tipo: "seguranca" | "outro";
  descricao: string;
  responsavel_id: string | null;
  prazo: string | null;
  status: RestricaoStatusPayload;
  origem_tipo: "nao_conformidade";
  origem_id: string;
}

export type CardStatusPayload = "aberto" | "em_andamento" | "concluido" | "cancelado";

export interface CardPayload {
  tipo: "nc";
  titulo: string;
  descricao: string | null;
  obra_id: string | null;
  responsavel_id: string | null;
  prazo: string | null;
  status: CardStatusPayload;
  arquivado: boolean;
  origem_externa: "nao_conformidade";
  origem_id: string;
}

export function isNCAtiva(status: NCStatus): boolean {
  return status === "aberta" || status === "em_tratativa" || status === "aguardando_reinspecao";
}

export function severidadeParaTipoRestricao(sev: NCSeveridade | null): "seguranca" | "outro" {
  if (!sev) return "outro";
  const s = String(sev).toLowerCase();
  if (s === "alta" || s === "critica") return "seguranca";
  return "outro";
}

export function ncParaRestricao(nc: NCDerivavel): RestricaoPayload {
  const ativa = isNCAtiva(nc.status);
  const status: RestricaoStatusPayload = ativa
    ? "aberta"
    : nc.status === "cancelada"
      ? "cancelada"
      : "resolvida";
  const descricao = (nc.descricao ?? "").trim() || `NC ${nc.id}`;
  return {
    obra_id: nc.obraId,
    tipo: severidadeParaTipoRestricao(nc.severidade),
    descricao,
    responsavel_id: nc.responsavelId,
    prazo: nc.prazoISO ? nc.prazoISO.slice(0, 10) : null,
    status,
    origem_tipo: "nao_conformidade",
    origem_id: nc.id,
  };
}

export function ncParaCard(nc: NCDerivavel): CardPayload {
  const status: CardStatusPayload =
    nc.status === "resolvida"
      ? "concluido"
      : nc.status === "cancelada"
        ? "cancelado"
        : nc.status === "aberta"
          ? "aberto"
          : "em_andamento";
  const descricao = (nc.descricao ?? "").trim() || null;
  const titulo = descricao
    ? `NC · ${descricao.slice(0, 80)}`
    : `NC · ${nc.id.slice(0, 8)}`;
  return {
    tipo: "nc",
    titulo,
    descricao,
    obra_id: nc.obraId,
    responsavel_id: nc.responsavelId,
    prazo: nc.prazoISO ? nc.prazoISO.slice(0, 10) : null,
    status,
    arquivado: nc.status === "cancelada",
    origem_externa: "nao_conformidade",
    origem_id: nc.id,
  };
}
