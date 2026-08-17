import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export function useTableSort<T, K extends string>(
  rows: T[],
  getValue: (row: T, key: K) => string | number | null | undefined,
  initialKey?: K,
  initialDir: SortDir = "asc",
) {
  const [sortKey, setSortKey] = useState<K | undefined>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  const toggle = (k: K) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), "pt-BR", { numeric: true });
    });
    if (sortDir === "desc") arr.reverse();
    return arr;
  }, [rows, sortKey, sortDir, getValue]);

  return { sorted, sortKey, sortDir, toggle };
}
