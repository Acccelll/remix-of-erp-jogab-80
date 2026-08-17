import { useCallback } from "react";
import type { Colaborador, DocumentoTipo, DocumentoVencimento } from "@/types";

export interface ExpiringDoc {
  colaborador: Colaborador;
  documento: DocumentoVencimento;
}

interface Params {
  colaboradores: Colaborador[];
  documentosTipo: DocumentoTipo[];
}

/**
 * ARC-002/ARC-004 · Onda 6 — cálculos de documentos vencendo extraídos do AppProvider.
 * `getExpiringDocuments` respeita `avisoDias` do DocumentoTipo (fallback 7d docs, 60d férias).
 * `getAllExpiringDocuments` retorna todos com data de vencimento, sem filtrar por janela.
 * Ambos incluem fallback virtual de "Férias" a partir de c.ferias[].
 */
export function useExpiringDocuments({ colaboradores, documentosTipo }: Params) {
  const getExpiringDocuments = useCallback((): ExpiringDoc[] => {
    const now = new Date();
    const results: ExpiringDoc[] = [];
    colaboradores
      .filter((c) => c.ativo)
      .forEach((c) => {
        const included: DocumentoVencimento[] = [];
        c.documentos.forEach((doc) => {
          if (!doc.dataVencimento) return;
          const dv = new Date(doc.dataVencimento);
          const docTipo = documentosTipo.find((dt) => dt.nome === doc.nome);
          const warningDays = docTipo ? docTipo.avisoDias : 7;
          const limit = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);
          if (dv <= limit) {
            results.push({ colaborador: c, documento: doc });
            included.push(doc);
          }
        });
        (c.ferias || []).forEach((f) => {
          if (!f.vencimento) return;
          const alreadyIncluded = included.some(
            (d) =>
              d.feriasId === f.id || (d.nome === "Férias" && d.dataVencimento === f.vencimento),
          );
          if (alreadyIncluded) return;
          const dv = new Date(f.vencimento);
          const docTipo = documentosTipo.find((dt) => dt.nome === "Férias");
          const warningDays = docTipo ? docTipo.avisoDias : 60;
          const limit = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);
          if (dv <= limit) {
            results.push({
              colaborador: c,
              documento: {
                id: `ferias-${f.id}`,
                nome: "Férias",
                dataVencimento: f.vencimento,
                obrigatorio: false,
                feriasId: f.id,
              },
            });
          }
        });
      });
    return results.sort(
      (a, b) =>
        new Date(a.documento.dataVencimento).getTime() -
        new Date(b.documento.dataVencimento).getTime(),
    );
  }, [colaboradores, documentosTipo]);

  const getAllExpiringDocuments = useCallback((): ExpiringDoc[] => {
    const results: ExpiringDoc[] = [];
    colaboradores
      .filter((c) => c.ativo)
      .forEach((c) => {
        const included: DocumentoVencimento[] = [];
        c.documentos.forEach((doc) => {
          if (!doc.dataVencimento) return;
          results.push({ colaborador: c, documento: doc });
          included.push(doc);
        });
        (c.ferias || []).forEach((f) => {
          if (!f.vencimento) return;
          const alreadyIncluded = included.some(
            (d) =>
              d.feriasId === f.id || (d.nome === "Férias" && d.dataVencimento === f.vencimento),
          );
          if (alreadyIncluded) return;
          results.push({
            colaborador: c,
            documento: {
              id: `ferias-${f.id}`,
              nome: "Férias",
              dataVencimento: f.vencimento,
              obrigatorio: false,
              feriasId: f.id,
            },
          });
        });
      });
    return results.sort(
      (a, b) =>
        new Date(a.documento.dataVencimento).getTime() -
        new Date(b.documento.dataVencimento).getTime(),
    );
  }, [colaboradores]);

  return { getExpiringDocuments, getAllExpiringDocuments };
}
