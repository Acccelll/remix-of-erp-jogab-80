/** @module-kind pure */
/**
 * Paleta única para capas de card e cores de listas do board.
 * Sempre hex — facilita aplicar tintas com alpha para preservar contraste.
 */
export interface CorPaleta {
  label: string;
  value: string;
}

export const CORES_PALETA: CorPaleta[] = [
  { label: "Vermelho", value: "#ef4444" },
  { label: "Laranja", value: "#f97316" },
  { label: "Amarelo", value: "#eab308" },
  { label: "Verde", value: "#22c55e" },
  { label: "Turquesa", value: "#14b8a6" },
  { label: "Azul", value: "#3b82f6" },
  { label: "Índigo", value: "#6366f1" },
  { label: "Roxo", value: "#a855f7" },
  { label: "Rosa", value: "#ec4899" },
  { label: "Marrom", value: "#92400e" },
  { label: "Cinza", value: "#6b7280" },
  { label: "Preto", value: "#111827" },
];

export const isHexCor = (v?: string | null): v is string =>
  !!v && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

/** Converte hex → rgba(r,g,b,alpha). Aceita #rgb ou #rrggbb. */
export function hexToRgba(hex: string, alpha = 1): string {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
