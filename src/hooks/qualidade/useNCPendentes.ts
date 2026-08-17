// PRO-007 · slice-01/slice-06 — NCs pendentes / com prazo vencido no sino de notificações.
// Consulta enxuta em `nao_conformidades`: só campos usados pelo alerta.
// Regra:
//   - status ∈ {aberta, em_tratativa} e `prazo`/`quando_planejado` já venceu
//     ou vence dentro dos próximos N dias (padrão 7); OU
//   - `aguardando_reinspecao = true` (workflow PRO-007), independente de prazo.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DIAS_ALERTA_NC_PADRAO = 7;

export type NCAlertaSituacao = "vencida" | "hoje" | "proxima" | "aguardando_reinspecao";
export type NCAlertaSev = "baixa" | "media" | "alta" | "critica";

export interface NCAlerta {
  id: string;
  codigo: string | null;
  titulo: string;
  severidade: NCAlertaSev;
  status: "aberta" | "em_tratativa";
  obra_id: string | null;
  quando_planejado: string | null;
  diasRestantes: number | null;
  situacao: NCAlertaSituacao;
}

interface NCRow {
  id: string;
  codigo: string | null;
  titulo: string;
  severidade: NCAlertaSev;
  status: NCAlerta["status"];
  obra_id: string | null;
  quando_planejado: string | null;
  prazo: string | null;
  aguardando_reinspecao: boolean | null;
}

function diffDias(destinoISO: string, hojeISO: string): number {
  const [ay, am, ad] = destinoISO.split("-").map(Number);
  const [by, bm, bd] = hojeISO.split("-").map(Number);
  const a = Date.UTC(ay, (am ?? 1) - 1, ad ?? 1);
  const b = Date.UTC(by, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((a - b) / 86_400_000);
}

/** Converte `prazo` (timestamptz ISO) ou `quando_planejado` (date) para YYYY-MM-DD. */
export function coalescePrazoDate(
  prazo: string | null,
  quando: string | null,
): string | null {
  const src = prazo ?? quando;
  if (!src) return null;
  return src.length >= 10 ? src.slice(0, 10) : src;
}

export function computeSituacao(
  dias: number,
  aguardando: boolean,
): NCAlertaSituacao {
  if (aguardando) return "aguardando_reinspecao";
  if (dias < 0) return "vencida";
  if (dias === 0) return "hoje";
  return "proxima";
}

export function useNCPendentes(diasAlerta = DIAS_ALERTA_NC_PADRAO, enabled = true) {
  const q = useQuery({
    enabled,
    queryKey: ["nc-alertas", diasAlerta],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nao_conformidades")
        .select(
          "id, codigo, titulo, severidade, status, obra_id, quando_planejado, prazo, aguardando_reinspecao",
        )
        .in("status", ["aberta", "em_tratativa"])
        .order("quando_planejado", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as NCRow[];
    },
  });

  const alertas = useMemo<NCAlerta[]>(() => {
    if (!q.data) return [];
    const hojeISO = new Date().toISOString().slice(0, 10);
    const out: NCAlerta[] = [];
    for (const n of q.data) {
      const aguardando = n.aguardando_reinspecao === true;
      const prazoDate = coalescePrazoDate(n.prazo, n.quando_planejado);
      const dias = prazoDate ? diffDias(prazoDate, hojeISO) : null;
      const dentroJanela = dias !== null && dias <= diasAlerta;
      if (!aguardando && !dentroJanela) continue;
      out.push({
        id: n.id,
        codigo: n.codigo,
        titulo: n.titulo,
        severidade: n.severidade,
        status: n.status,
        obra_id: n.obra_id,
        quando_planejado: prazoDate,
        diasRestantes: dias,
        situacao: computeSituacao(dias ?? Number.POSITIVE_INFINITY, aguardando),
      });
    }
    return out.sort((a, b) => {
      // aguardando_reinspecao primeiro, depois por prazo crescente
      if (a.situacao === "aguardando_reinspecao" && b.situacao !== "aguardando_reinspecao") return -1;
      if (b.situacao === "aguardando_reinspecao" && a.situacao !== "aguardando_reinspecao") return 1;
      return (a.diasRestantes ?? Number.POSITIVE_INFINITY) - (b.diasRestantes ?? Number.POSITIVE_INFINITY);
    });
  }, [q.data, diasAlerta]);

  return { alertas, isLoading: q.isLoading };
}
