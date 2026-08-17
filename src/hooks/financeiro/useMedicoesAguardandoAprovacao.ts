// PRO-016 slice-02 — Medições aguardando aprovação (status = 'enviada').
// Alimenta o sino global (PRO-030) com um card por medição pendente.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { swallow } from "@/lib/core/errors";

export interface MedicaoPendenteAprovacao {
  id: string;
  obraId: string;
  numero: string;
  valor: number | null;
  enviadaEm: string | null;
  enviadaPor: string | null;
  diasEsperando: number;
}

export function useMedicoesAguardandoAprovacao(enabled: boolean): MedicaoPendenteAprovacao[] {
  const [rows, setRows] = useState<MedicaoPendenteAprovacao[]>([]);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      return;
    }
    let cancel = false;
    const load = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("medicoes")
          .select("id, obra_id, numero, valor, enviada_em, enviada_por")
          .eq("status", "enviada");
        if (error) throw error;
        if (cancel) return;
        const hoje = Date.now();
        setRows(
          (data ?? []).map((r: Record<string, unknown>) => {
            const enviadaEm = (r.enviada_em as string) ?? null;
            const diasEsperando = enviadaEm
              ? Math.max(0, Math.floor((hoje - new Date(enviadaEm).getTime()) / 86_400_000))
              : 0;
            return {
              id: String(r.id),
              obraId: String(r.obra_id),
              numero: String(r.numero),
              valor: (r.valor as number) ?? null,
              enviadaEm,
              enviadaPor: (r.enviada_por as string) ?? null,
              diasEsperando,
            };
          }),
        );
      } catch (err) {
        swallow("medicoes.pendentesAprovacao", err, "falha ao carregar");
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [enabled]);

  return rows;
}
