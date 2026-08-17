// PRO-003 · slice-02 — Hook de fechamento de competência (persistência local).
import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import {
  competenciaFechada,
  fechamentoAtivo,
  fecharCompetencia,
  podeEditarCompetencia,
  reabrirCompetencia,
  type CompetenciaMes,
  type FechamentoCompetencia,
} from "@/lib/dp/fechamento-competencia";

const KEY = STORAGE_KEYS.dpFechamentosCompetencia;

function ler(): FechamentoCompetencia[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FechamentoCompetencia[]) : [];
  } catch {
    return [];
  }
}

function gravar(list: FechamentoCompetencia[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function useDpFechamentoCompetencia() {
  const [fechamentos, setFechamentos] = useState<FechamentoCompetencia[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFechamentos(ler());
    setHydrated(true);
  }, []);

  const persistir = useCallback((list: FechamentoCompetencia[]) => {
    gravar(list);
    setFechamentos(list);
  }, []);

  const fechar = useCallback(
    (competencia: CompetenciaMes, fechadoPor: string, motivo?: string) => {
      const novo = fecharCompetencia({ competencia, fechadoPor, motivo, fechamentos });
      persistir([...fechamentos, novo]);
      return novo;
    },
    [fechamentos, persistir],
  );

  const reabrir = useCallback(
    (competencia: CompetenciaMes, reabertoPor: string, motivoReabertura: string) => {
      const reaberto = reabrirCompetencia({
        competencia,
        reabertoPor,
        motivoReabertura,
        fechamentos,
      });
      const proximo = fechamentos.map((f) =>
        f.competencia === competencia && f.fechadoEm === reaberto.fechadoEm ? reaberto : f,
      );
      persistir(proximo);
      return reaberto;
    },
    [fechamentos, persistir],
  );

  const estaFechada = useCallback(
    (competencia: CompetenciaMes) => competenciaFechada(fechamentos, competencia),
    [fechamentos],
  );

  const trava = useCallback(
    (competencia: CompetenciaMes) => podeEditarCompetencia(fechamentos, competencia),
    [fechamentos],
  );

  const ativo = useCallback(
    (competencia: CompetenciaMes) => fechamentoAtivo(fechamentos, competencia),
    [fechamentos],
  );

  return { hydrated, fechamentos, fechar, reabrir, estaFechada, trava, ativo };
}
