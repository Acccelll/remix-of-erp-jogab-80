// PRO-003 · slice-05 — Hook remoto de fechamento de competência DP (MySQL via api.php).
// Substitui a persistência local quando há sessão autenticada. Consumidores
// devem usar `useDpFechamentoCompetenciaMerged` para escolher a fonte correta.
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  competenciaValida,
  type CompetenciaMes,
  type FechamentoCompetencia,
} from "@/lib/dp/fechamento-competencia";
import { useDpFechamentoCompetencia } from "./useDpFechamentoCompetencia";
import { useAuth } from "@/contexts/auth/useAuth";

type Row = any;

const QK = ["dp", "fechamento-competencia"] as const;

function rowToFechamento(r: Row): FechamentoCompetencia {
  return {
    competencia: r.competencia,
    fechadoEm: r.fechado_em,
    fechadoPor: r.fechado_por,
    motivo: r.motivo ?? undefined,
    reabertoEm: r.reaberto_em ?? undefined,
    reabertoPor: r.reaberto_por ?? undefined,
    motivoReabertura: r.motivo_reabertura ?? undefined,
  };
}

export function useDpFechamentoCompetenciaRemoto() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<FechamentoCompetencia[]> => {
      const data = await apiFetch<Row[]>("dpFechamentoCompetencia");
      return (Array.isArray(data) ? data : []).map(rowToFechamento);
    },
    staleTime: 30_000,
  });

  const fechamentos = query.data ?? [];

  const fecharMut = useMutation({
    mutationFn: async (v: { competencia: CompetenciaMes; fechadoPor: string; motivo?: string }) => {
      const data = await apiFetch<Row>("dpFechamentoCompetencia", {
        method: "POST",
        body: {
          acao: "fechar",
          competencia: v.competencia,
          fechado_por: v.fechadoPor,
          motivo: v.motivo ?? null,
        },
      });
      return rowToFechamento(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const reabrirMut = useMutation({
    mutationFn: async (v: {
      competencia: CompetenciaMes;
      reabertoPor: string;
      motivoReabertura: string;
    }) => {
      const data = await apiFetch<Row>("dpFechamentoCompetencia", {
        method: "POST",
        body: {
          acao: "reabrir",
          competencia: v.competencia,
          reaberto_por: v.reabertoPor,
          motivo_reabertura: v.motivoReabertura,
        },
      });
      return rowToFechamento(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const ativo = useCallback(
    (comp: CompetenciaMes) => {
      if (!competenciaValida(comp)) return null;
      const doMes = fechamentos.filter((f) => f.competencia === comp);
      const a = [...doMes].sort((x, y) => y.fechadoEm.localeCompare(x.fechadoEm))[0];
      if (!a || a.reabertoEm) return null;
      return a;
    },
    [fechamentos],
  );

  const fechar = useCallback(
    (comp: CompetenciaMes, fechadoPor: string, motivo?: string) =>
      fecharMut.mutateAsync({ competencia: comp, fechadoPor, motivo }),
    [fecharMut],
  );
  const reabrir = useCallback(
    (comp: CompetenciaMes, reabertoPor: string, motivoReabertura: string) =>
      reabrirMut.mutateAsync({ competencia: comp, reabertoPor, motivoReabertura }),
    [reabrirMut],
  );

  return {
    hydrated: !query.isLoading,
    fechamentos,
    ativo,
    fechar,
    reabrir,
    saving: fecharMut.isPending || reabrirMut.isPending,
    error: query.error,
  };
}

/**
 * Escolhe automaticamente entre remoto (autenticado) e local (fallback).
 * Mantém o mesmo contrato do hook local para uso na UI existente.
 */
export function useDpFechamentoCompetenciaMerged() {
  const { isAuthenticated } = useAuth();
  const remoto = useDpFechamentoCompetenciaRemoto();
  const local = useDpFechamentoCompetencia();

  if (isAuthenticated) {
    return {
      remoto: true as const,
      hydrated: remoto.hydrated,
      ativo: remoto.ativo,
      fechar: remoto.fechar,
      reabrir: remoto.reabrir,
    };
  }
  return {
    remoto: false as const,
    hydrated: local.hydrated,
    ativo: local.ativo,
    fechar: async (c: CompetenciaMes, p: string, m?: string) => local.fechar(c, p, m),
    reabrir: async (c: CompetenciaMes, p: string, m: string) => local.reabrir(c, p, m),
  };
}
