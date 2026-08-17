// PRO-015 — Cadência esperada da importação TOTVS.
// Lê o snapshot mais recente e a cadência configurada em localStorage
// para calcular a próxima importação prevista e o atraso.
import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { financeiroRepo } from "@/lib/repositories/financeiro";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { swallow } from "@/lib/core/errors";

export type ImportCadencia = "semanal" | "quinzenal" | "mensal";

export const CADENCIA_DIAS: Record<ImportCadencia, number> = {
  semanal: 7,
  quinzenal: 15,
  mensal: 30,
};

export const CADENCIA_LABEL: Record<ImportCadencia, string> = {
  semanal: "Semanal (7 dias)",
  quinzenal: "Quinzenal (15 dias)",
  mensal: "Mensal (30 dias)",
};

const KEY = STORAGE_KEYS.finImportCadencia;
const EVT = "gestaobra:fin:cadencia:changed";
const DEFAULT_CADENCIA: ImportCadencia = "mensal";

function loadCadencia(): ImportCadencia {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "semanal" || raw === "quinzenal" || raw === "mensal") return raw;
  } catch (err) {
    swallow("totvs.cadencia.load", err, "localStorage indisponível");
  }
  return DEFAULT_CADENCIA;
}

function saveCadencia(c: ImportCadencia) {
  try {
    localStorage.setItem(KEY, c);
    window.dispatchEvent(new Event(EVT));
  } catch (err) {
    swallow("totvs.cadencia.save", err, "localStorage indisponível");
  }
}

export function useImportCadencia() {
  const [cadencia, setCadenciaState] = useState<ImportCadencia>(() => loadCadencia());
  useEffect(() => {
    const refresh = () => setCadenciaState(loadCadencia());
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const setCadencia = useCallback((c: ImportCadencia) => {
    saveCadencia(c);
    setCadenciaState(c);
  }, []);
  return { cadencia, setCadencia };
}

export type ImportStatus = "em_dia" | "vence_hoje" | "atrasada" | "sem_snapshot";

export interface TotvsImportInfo {
  cadencia: ImportCadencia;
  intervaloDias: number;
  ultimaImportacao: string | null;
  proximaPrevista: string | null;
  diasParaProxima: number | null;
  atrasoDias: number;
  status: ImportStatus;
  isLoading: boolean;
}

export function useTotvsImportStatus(enabled: boolean = true): TotvsImportInfo {
  const { cadencia } = useImportCadencia();
  const { data, isLoading } = useQuery({
    queryKey: ["fin_latest_snapshot_meta"],
    queryFn: () => financeiroRepo.getLatestSnapshotMeta(),
    enabled,
    staleTime: 60_000,
  });

  return useMemo(() => {
    const intervaloDias = CADENCIA_DIAS[cadencia];
    const ultima = data?.importado_em ?? null;
    if (!ultima) {
      return {
        cadencia,
        intervaloDias,
        ultimaImportacao: null,
        proximaPrevista: null,
        diasParaProxima: null,
        atrasoDias: 0,
        status: "sem_snapshot" as ImportStatus,
        isLoading,
      };
    }
    const ultimaMs = new Date(ultima).getTime();
    const proximaMs = ultimaMs + intervaloDias * 24 * 3600 * 1000;
    const hojeMs = Date.now();
    const diffMs = proximaMs - hojeMs;
    const diasParaProxima = Math.ceil(diffMs / (24 * 3600 * 1000));
    let status: ImportStatus;
    let atrasoDias = 0;
    if (diasParaProxima < 0) {
      status = "atrasada";
      atrasoDias = -diasParaProxima;
    } else if (diasParaProxima === 0) {
      status = "vence_hoje";
    } else {
      status = "em_dia";
    }
    return {
      cadencia,
      intervaloDias,
      ultimaImportacao: ultima,
      proximaPrevista: new Date(proximaMs).toISOString(),
      diasParaProxima,
      atrasoDias,
      status,
      isLoading,
    };
  }, [cadencia, data, isLoading]);
}
