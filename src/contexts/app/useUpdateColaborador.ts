import { useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { withBankSnakeCase } from "@/contexts/app/helpers";
import type { Colaborador } from "@/types";
import { reportError } from "@/lib/core/errors";

interface Params {
  colaboradores: Colaborador[];
  setColaboradores: React.Dispatch<React.SetStateAction<Colaborador[]>>;
}

/**
 * ARC-002/ARC-004 · Onda 6 — atualização de colaboradores extraída do AppProvider.
 * Mantém o mesmo contrato do updateColaborador original: optimistic update com reversão em falha,
 * persistência dedicada de `documentos` via api.saveDocumentoColaborador/deleteDocumentoColaborador,
 * e PUT dos demais campos em `colaboradores`.
 */
export function useUpdateColaborador({ colaboradores, setColaboradores }: Params) {
  return useCallback(
    async (id: string, d: Partial<Colaborador>) => {
      let originalColaborador: Colaborador | undefined;
      setColaboradores((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          originalColaborador = c;
          const updated: Colaborador = { ...c, ...d };

          if (d.ativo === false && c.ativo === true && !d.dataInativacao) {
            const today = new Date().toISOString().split("T")[0];
            updated.dataInativacao = today;
          }

          if (d.ativo === true && c.ativo === false && !d.dataInativacao) {
            updated.dataInativacao = undefined;
          }

          return updated;
        }),
      );

      const finalData: any = { ...d };
      const updatedColab = colaboradores.find((c) => c.id === id);
      if (updatedColab && updatedColab.dataInativacao !== originalColaborador?.dataInativacao) {
        finalData.dataInativacao = updatedColab.dataInativacao;
      }

      const backendIgnoredKeys = ["documentos"];
      const payloadKeys = Object.keys(finalData).filter((k) => !backendIgnoredKeys.includes(k));
      const cleanPayload: any = {};
      for (const k of payloadKeys) cleanPayload[k] = finalData[k];

      try {
        if (Array.isArray(finalData.documentos) && originalColaborador) {
          const prevDocs = originalColaborador.documentos || [];
          const newDocs = finalData.documentos as any[];

          for (const nd of newDocs) {
            const prev = prevDocs.find((p: any) => p.id === nd.id);
            const changed =
              !prev || prev.dataVencimento !== nd.dataVencimento || prev.nome !== nd.nome;
            if (changed) {
              try {
                await api.saveDocumentoColaborador({
                  colaborador_id: id,
                  documento_id: typeof nd.id === "string" && nd.id.length > 20 ? null : nd.id,
                  nome: nd.nome,
                  dataVencimento: nd.dataVencimento || null,
                  obrigatorio: !!nd.obrigatorio,
                  feriasId: nd.feriasId || null,
                });
              } catch (err) {
                reportError("colaboradores.update.falha-ao-salvar-documento", err, { detalhes: [nd] });
              }
            }
          }

          for (const pd of prevDocs) {
            if (!newDocs.find((n: any) => n.id === pd.id)) {
              try {
                await api.deleteDocumentoColaborador(id, pd.id);
              } catch (err) {
                reportError("colaboradores.update.falha-ao-remover-documento", err, { detalhes: [pd] });
              }
            }
          }
        }

        if (payloadKeys.length > 0) {
          await api.update("colaboradores", id, withBankSnakeCase(cleanPayload));
        }
      } catch (error) {
        reportError("colaboradores.update.error-updating-colaborador", error);
        if (originalColaborador) {
          const original = originalColaborador;
          setColaboradores((prev) => prev.map((c) => (c.id === id ? original : c)));
        }
        toast.error("Falha ao atualizar colaborador. Tente novamente.");
      }
    },
    [colaboradores, setColaboradores],
  );
}
