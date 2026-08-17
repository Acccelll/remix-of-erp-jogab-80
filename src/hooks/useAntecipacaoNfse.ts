// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mapa NFS-e → operação de antecipação ativa (não cancelada).
 * Retorna somente títulos vinculados a operações com status !== 'cancelada'.
 */
export function useAntecipacaoNfseMap() {
  return useQuery({
    queryKey: ["antecipacao-nfse-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("antecipacao_titulos")
        .select(
          "id, faturamento_nfse_id, obra_id, valor_face, operacao:antecipacao_operacoes(id, numero_interno, data_operacao, status, operador:operadores_credito(nome, apelido))",
        );
      if (error) throw error;
      const map = new Map<string, any>();
      for (const row of data ?? []) {
        if (!row.faturamento_nfse_id) continue;
        if (!row.operacao || row.operacao.status === "cancelada") continue;
        map.set(row.faturamento_nfse_id, {
          tituloId: row.id,
          obraId: row.obra_id,
          valorFace: Number(row.valor_face ?? 0),
          operacaoId: row.operacao.id,
          numero: row.operacao.numero_interno,
          dataOperacao: row.operacao.data_operacao,
          status: row.operacao.status,
          operador:
            row.operacao.operador?.apelido ?? row.operacao.operador?.nome ?? null,
        });
      }
      return map;
    },
    staleTime: 60_000,
  });
}

/** Custo de antecipação consolidado para uma obra específica. */
export function useAntecipacaoObraCusto(obraId: string | undefined) {
  return useQuery({
    queryKey: ["antecipacao-obra-custo", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      // Puxa títulos da obra + operações associadas
      const { data: titulos, error } = await supabase
        .from("antecipacao_titulos")
        .select(
          "id, operacao_id, obra_id, valor_face, operacao:antecipacao_operacoes(id, data_operacao, desagio_total, iof, tarifas, status, valor_face_total)",
        )
        .eq("obra_id", obraId!);
      if (error) throw error;

      const ativos = (titulos ?? []).filter(
        (t: any) => t.operacao && t.operacao.status !== "cancelada",
      );

      // Agrupar por operação → ratear pela participação da obra (face_obra / face_total)
      const opsMap = new Map<string, { op: any; faceObra: number }>();
      for (const t of ativos) {
        const cur = opsMap.get(t.operacao_id) ?? { op: t.operacao, faceObra: 0 };
        cur.faceObra += Number(t.valor_face ?? 0);
        opsMap.set(t.operacao_id, cur);
      }

      let desagio = 0;
      let iof = 0;
      let tarifas = 0;
      let valorFace = 0;
      for (const { op, faceObra } of opsMap.values()) {
        const faceTotal = Number(op.valor_face_total ?? 0);
        const frac = faceTotal > 0 ? faceObra / faceTotal : 0;
        desagio += Number(op.desagio_total ?? 0) * frac;
        iof += Number(op.iof ?? 0) * frac;
        tarifas += Number(op.tarifas ?? 0) * frac;
        valorFace += faceObra;
      }

      return {
        titulos: ativos.length,
        operacoes: opsMap.size,
        valorFace,
        desagio,
        iof,
        tarifas,
        custoTotal: desagio + iof + tarifas,
      };
    },
  });
}
