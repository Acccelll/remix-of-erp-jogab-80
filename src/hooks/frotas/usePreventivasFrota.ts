/** @module-kind io */
/**
 * PRO-024 · slice-03 — Agrega alertas de manutenção preventiva para o
 * sino de notificações. Consulta as últimas manutenções (com metas de
 * preventiva) e os últimos abastecimentos por veículo, aplica
 * `statusPreventiva` e devolve somente os veículos com status
 * `proxima` ou `vencida`.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVeiculosContext } from "@/contexts/VeiculosContext";
import { isUuid } from "@/lib/core/uuid";
import {
  statusPreventiva,
  type StatusPreventivaResult,
} from "@/lib/frotas/preventiva";

export interface PreventivaAlerta {
  veiculoId: string;
  codigo: string;
  nome: string;
  status: "proxima" | "vencida";
  motivos: string[];
}

export function usePreventivasFrota(enabled: boolean): PreventivaAlerta[] {
  const { veiculos } = useVeiculosContext();
  const [alertas, setAlertas] = useState<PreventivaAlerta[]>([]);

  useEffect(() => {
    if (!enabled || veiculos.length === 0) {
      setAlertas([]);
      return;
    }
    const ids = veiculos.map((v) => v.id).filter(isUuid);
    if (ids.length === 0) {
      setAlertas([]);
      return;
    }
    let cancel = false;

    (async () => {
      const [manutRes, abastRes] = await Promise.all([
        supabase
          .from("frota_manutencoes")
          .select(
            "veiculo_id, data, horimetro, odometro, proxima_preventiva_horimetro, proxima_preventiva_data",
          )
          .in("veiculo_id", ids)
          .order("data", { ascending: false }),
        supabase
          .from("frota_abastecimentos")
          .select("veiculo_id, data, horimetro, odometro")
          .in("veiculo_id", ids)
          .order("data", { ascending: false }),
      ]);
      if (cancel) return;

      const ultimaManut = new Map<string, any>();
      for (const m of manutRes.data ?? []) {
        if (!m.veiculo_id) continue;
        if (!ultimaManut.has(m.veiculo_id)) ultimaManut.set(m.veiculo_id, m);
      }
      const ultimoAbast = new Map<string, any>();
      for (const a of abastRes.data ?? []) {
        if (!a.veiculo_id) continue;
        if (!ultimoAbast.has(a.veiculo_id)) ultimoAbast.set(a.veiculo_id, a);
      }

      const hojeIso = new Date().toISOString().slice(0, 10);
      const out: PreventivaAlerta[] = [];
      for (const v of veiculos) {
        const um = ultimaManut.get(v.id);
        if (!um) continue;
        const ua = ultimoAbast.get(v.id);
        const r: StatusPreventivaResult = statusPreventiva(um, {
          hojeIso,
          horimetroAtual: ua?.horimetro ?? um.horimetro ?? null,
          odometroAtual: ua?.odometro ?? um.odometro ?? null,
        });
        if (r.status === "proxima" || r.status === "vencida") {
          out.push({
            veiculoId: v.id,
            codigo: v.codigo,
            nome: v.nome,
            status: r.status,
            motivos: r.motivos,
          });
        }
      }
      // Vencidas primeiro, depois próximas
      out.sort((a, b) =>
        a.status === b.status ? a.codigo.localeCompare(b.codigo) : a.status === "vencida" ? -1 : 1,
      );
      setAlertas(out);
    })().catch(() => setAlertas([]));

    return () => {
      cancel = true;
    };
  }, [enabled, veiculos]);

  return alertas;
}
