/** @module-kind pure */
import type { Colaborador } from "@/types";
import type { SortDef, ExtraFilter } from "./sortAndGroup";

export const BOARD_SORT_OPTIONS: SortDef<Colaborador>[] = [
  { value: "nome", label: "Nome (A-Z)", compare: (a, b) => a.nome.localeCompare(b.nome, "pt-BR") },
  {
    value: "funcao",
    label: "Função",
    compare: (a, b) => (a.funcao || "").localeCompare(b.funcao || "", "pt-BR"),
  },
  {
    value: "mob-asc",
    label: "Mobilização (mais antiga)",
    compare: (a, b) => {
      const da = a.mobilizacaoPendente?.dataMobilizacao ?? "";
      const db = b.mobilizacaoPendente?.dataMobilizacao ?? "";
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    },
  },
  {
    value: "mob-desc",
    label: "Mobilização (mais nova)",
    compare: (a, b) => {
      const da = a.mobilizacaoPendente?.dataMobilizacao ?? "";
      const db = b.mobilizacaoPendente?.dataMobilizacao ?? "";
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    },
  },
];

export const BOARD_EXTRA_FILTERS: ExtraFilter<Colaborador>[] = [
  {
    key: "pendente",
    label: "Apenas mobilização pendente",
    predicate: (c) => !!c.mobilizacaoPendente,
  },
  {
    key: "docs30",
    label: "Docs vencendo em ≤30d",
    predicate: (c) => {
      if (!Array.isArray(c.documentos) || c.documentos.length === 0) return false;
      const now = Date.now();
      const limit = now + 30 * 24 * 60 * 60 * 1000;
      return c.documentos.some((d) => {
        if (!d.dataVencimento) return false;
        const t = new Date(d.dataVencimento).getTime();
        return !Number.isNaN(t) && t <= limit;
      });
    },
  },
];
