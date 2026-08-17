// PRO-003 · slice-07 — Reconciliação de fechamentos DP locais → backend.
// Roda uma única vez por sessão autenticada: replica fechamentos gravados
// em `localStorage` (slices 01-03) para `dp_fechamento_competencia` no
// MySQL via api.php, respeitando trava do backend (competência já fechada
// é ignorada).
import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { useAuth } from "@/contexts/auth/useAuth";
import type { FechamentoCompetencia } from "@/lib/dp/fechamento-competencia";

const KEY = STORAGE_KEYS.dpFechamentosCompetencia;
const FLAG = "gestaobra:dp:fechamentosCompetencia:reconciliadoEm";

function lerLocais(): FechamentoCompetencia[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FechamentoCompetencia[]) : [];
  } catch {
    return [];
  }
}

export function useDpFechamentoReconciliacao() {
  const { isAuthenticated, currentPlayer } = useAuth();
  const rodou = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || rodou.current) return;
    if (localStorage.getItem(FLAG)) {
      rodou.current = true;
      return;
    }
    const locais = lerLocais().filter((f) => !f.reabertoEm);
    if (locais.length === 0) {
      localStorage.setItem(FLAG, new Date().toISOString());
      rodou.current = true;
      return;
    }
    rodou.current = true;

    (async () => {
      const nome = currentPlayer?.login ?? "reconciliacao";
      let existentes: Array<{ competencia: string; reaberto_em: string | null }> = [];
      try {
        const data = await apiFetch<Array<{ competencia: string; reaberto_em: string | null }>>(
          "dpFechamentoCompetencia",
        );
        existentes = Array.isArray(data) ? data : [];
      } catch {
        // Backend indisponível: tenta na próxima sessão (não seta FLAG)
        rodou.current = false;
        return;
      }
      const jaFechadas = new Set(
        existentes.filter((r) => r.reaberto_em === null).map((r) => r.competencia),
      );

      let migrados = 0;
      for (const f of locais) {
        if (jaFechadas.has(f.competencia)) continue;
        try {
          await apiFetch("dpFechamentoCompetencia", {
            method: "POST",
            body: {
              acao: "fechar",
              competencia: f.competencia,
              fechado_por: f.fechadoPor || nome,
              motivo: f.motivo ?? `Migração local (${f.fechadoEm.slice(0, 10)})`,
            },
          });
          migrados++;
        } catch {
          // Ex.: 403 (sem perfil GM) ou 409 (já fechada por corrida) — segue
        }
      }
      localStorage.setItem(FLAG, new Date().toISOString());
      if (migrados > 0) {
        // limpa locais migrados
        localStorage.setItem(KEY, JSON.stringify([]));
      }
    })();
  }, [isAuthenticated, currentPlayer?.login]);
}
