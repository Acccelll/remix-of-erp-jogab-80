import { Player, PageKey, NivelAcesso, Patrimonio, Veiculo, HistoricoEntry } from "@/types";

export const allPages: PageKey[] = [
  "rh",
  "dp",
  "patrimonios",
  "frotas",
  "obras_div",
  "admin",
  "financeiro",
  "contratos",
  "almoxarifado",
];

export const defaultPlayers: Player[] = [
  {
    id: "gm",
    login: "Cappucceno",
    // Sem senha embutida: credencial no bundle é legível por qualquer um.
    // Login sempre valida contra o backend; senha vazia nunca autentica.
    senha: "",
    email: "",
    isGM: true,
    acessos: {
      rh: "editar",
      dp: "editar",
      patrimonios: "editar",
      frotas: "editar",
      obras_div: "editar",
      admin: "editar",
      financeiro: "financeiro",
      contratos: "editar",
      almoxarifado: "editar",
      crm: "editar",
    },
  },
];

export const loadLocal = <T>(key: string, fallback: T): T => {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : fallback;
  } catch {
    return fallback;
  }
};

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

// Backend (PHP/MySQL) pode devolver colunas JSON como string. Normaliza para array.
export const parseApiArray = (value: any): any[] => {
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

// Sanitiza mobilizacaoPendente: backend (PHP/JSONB) pode retornar {} ou [] no lugar de null.
export const sanitizeMobilizacaoPendente = (value: any) => {
  let v: any = value;
  if (typeof v === "string" && v.trim().length > 0) {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  if (Array.isArray(v)) return null;
  const hasObra = typeof v.obraDestinoId === "string" && v.obraDestinoId.length > 0;
  const hasData = typeof v.dataMobilizacao === "string" && v.dataMobilizacao.length > 0;
  if (!hasObra && !hasData) return null;
  return v;
};

export const migratePlayers = (players: Player[]): Player[] => {
  return players.map((p) => {
    const oldAcessos = p.acessos as any;
    const acessos: Record<PageKey, NivelAcesso> = {
      rh: oldAcessos.rh || oldAcessos.colaboradores || (p.isGM ? "editar" : "visualizar"),
      dp: oldAcessos.dp || (p.isGM ? "editar" : "visualizar"),
      patrimonios:
        oldAcessos.patrimonios ||
        oldAcessos.patrimonio ||
        oldAcessos.quadroPatrimonios ||
        (p.isGM ? "editar" : "visualizar"),
      frotas:
        oldAcessos.frotas ||
        oldAcessos.quadroVeiculos ||
        oldAcessos.veiculos ||
        (p.isGM ? "editar" : "visualizar"),
      obras_div:
        oldAcessos.obras_div ||
        oldAcessos.quadro ||
        oldAcessos.obras ||
        (p.isGM ? "editar" : "visualizar"),
      admin: oldAcessos.admin || oldAcessos.gm || (p.isGM ? "editar" : "nenhum"),
      financeiro: oldAcessos.financeiro || (p.isGM ? "financeiro" : "nenhum"),
      contratos: oldAcessos.contratos || (p.isGM ? "editar" : "nenhum"),
      // `oldAcessos.compras`: nome antigo da chave, preservado na leitura.
      almoxarifado:
        oldAcessos.almoxarifado || oldAcessos.compras || (p.isGM ? "editar" : "nenhum"),
      crm: oldAcessos.crm || (p.isGM ? "editar" : "nenhum"),
    };
    return { ...p, acessos };
  });
};

/**
 * Backend persiste os campos bancários em snake_case. O frontend usa camelCase.
 * Esta função adiciona os aliases snake_case quando os campos camelCase estão presentes,
 * para que INSERT/UPDATE no PHP grave corretamente as colunas.
 */
export const withBankSnakeCase = (payload: any): any => {
  const out: any = { ...payload };
  if ("numeroBanco" in payload) out.numero_banco = payload.numeroBanco ?? null;
  if ("numeroConta" in payload) out.numero_conta = payload.numeroConta ?? null;
  if ("tipoConta" in payload) out.tipo_conta = payload.tipoConta ?? null;
  if ("tipoChavePix" in payload) out.tipo_chave_pix = payload.tipoChavePix ?? null;
  if ("chavePix" in payload) out.chave_pix = payload.chavePix ?? null;
  return out;
};

// Flags rastreadas para registro automático em "Outros eventos"
export const PATRIMONIO_FLAGS: { key: keyof Patrimonio; label: string }[] = [
  { key: "riscado", label: "Riscado" },
  { key: "quebrado", label: "Quebrado" },
  { key: "emManutencao", label: "Em Manutenção" },
  { key: "sujo", label: "Sujo" },
  { key: "alugado", label: "Alugado" },
];
export const VEICULO_FLAGS: { key: keyof Veiculo; label: string }[] = [
  { key: "riscado", label: "Riscado" },
  { key: "manutencao", label: "Em Manutenção" },
  { key: "sujo", label: "Sujo" },
  { key: "alugado", label: "Alugado" },
];

export function buildFlagHistory<T>(
  prev: T,
  patch: Partial<T>,
  flags: { key: keyof T; label: string }[],
  usuario?: string,
): HistoricoEntry[] {
  const entries: HistoricoEntry[] = [];
  const now = new Date();
  const dataBR = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  for (const { key, label } of flags) {
    if (!(key in (patch as any))) continue;
    const next = !!(patch as any)[key];
    const before = !!(prev as any)[key];
    if (next === before) continue;
    entries.push({
      id: crypto.randomUUID(),
      tipo: "outro",
      descricao: next ? `Marcado como ${label} em ${dataBR}` : `Desmarcado ${label} em ${dataBR}`,
      data: now.toISOString(),
      usuario: usuario || "Sistema",
    });
  }
  return entries;
}
