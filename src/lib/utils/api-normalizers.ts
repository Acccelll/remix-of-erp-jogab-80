/** @module-kind pure */
/** Normalizadores para payloads vindos de APIs legadas/externas. */

export const parseApiBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "1" || normalized === "true" || normalized === "t" || normalized === "sim"
    );
  }
  return false;
};

export const parseApiArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const sanitizeMobilizacaoPendente = (value: unknown): any => {
  let v: unknown = value;
  if (typeof v === "string" && v.trim().length > 0) {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  if (Array.isArray(v)) return null;
  const obj = v as Record<string, unknown>;
  const hasObra = typeof obj.obraDestinoId === "string" && obj.obraDestinoId.length > 0;
  const hasData = typeof obj.dataMobilizacao === "string" && obj.dataMobilizacao.length > 0;
  if (!hasObra && !hasData) return null;
  return obj;
};

export const withBankSnakeCase = <T extends object>(payload: T): Record<string, unknown> => {
  const source = payload as Record<string, unknown>;
  const out: Record<string, unknown> = { ...source };
  if ("numeroBanco" in source) out.numero_banco = source.numeroBanco ?? null;
  if ("numeroConta" in source) out.numero_conta = source.numeroConta ?? null;
  if ("tipoConta" in source) out.tipo_conta = source.tipoConta ?? null;
  if ("tipoChavePix" in source) out.tipo_chave_pix = source.tipoChavePix ?? null;
  if ("chavePix" in source) out.chave_pix = source.chavePix ?? null;
  return out;
};
