/** @module-kind io */
// Cadastro de Centros de Custo TOTVS — queries e categorias seed.
import { centrosCustoTotvsRepo } from "@/lib/repositories/financeiro";
import { queryKey } from "@/lib/query-keys";

export const CATEGORIAS_INDIRETO_SEED = [
  "ADMINISTRAÇÃO MATRIZ",
  "RECURSOS HUMANOS",
  "FERRAMENTAS",
  "EPI E VESTUÁRIO",
  "VEÍCULOS",
  "LOCAÇÕES",
  "JV",
  "SÍTIO CACHOEIRINHA",
  "COMERCIAL",
] as const;

export interface CentroCustoTotvs {
  id: string;
  owner_id: string;
  codigo: string;
  descricao: string | null;
  tipo: "obra" | "indireto";
  categoria: string | null;
  obra_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const centrosKeys = {
  all: queryKey("centros_custo_totvs"),
};

export async function fetchCentrosCusto(): Promise<CentroCustoTotvs[]> {
  const data = await centrosCustoTotvsRepo.selectOrdered(
    "id, owner_id, codigo, descricao, tipo, categoria, obra_id, ativo, created_at, updated_at",
    "codigo",
  );
  return (data ?? []) as CentroCustoTotvs[];
}

// Sentinel owner_id: o app usa auth próprio (PHP), mas a tabela tem unique
// (owner_id, codigo). Usamos um UUID fixo para que o upsert por código funcione.
const SHARED_OWNER_ID = "00000000-0000-0000-0000-000000000000";

export async function upsertCentroCustoObra(args: {
  id?: string;
  codigo: string;
  descricao: string | null;
  obra_id: string;
}) {
  await centrosCustoTotvsRepo.upsertByOwnerCodigo({
    id: args.id,
    owner_id: SHARED_OWNER_ID,
    codigo: args.codigo,
    descricao: args.descricao,
    tipo: "obra" as const,
    obra_id: args.obra_id,
    categoria: null,
  });
}

export async function upsertCentroCustoIndireto(args: {
  id?: string;
  codigo: string;
  descricao: string | null;
  categoria: string;
}) {
  await centrosCustoTotvsRepo.upsertByOwnerCodigo({
    id: args.id,
    owner_id: SHARED_OWNER_ID,
    codigo: args.codigo,
    descricao: args.descricao,
    tipo: "indireto" as const,
    obra_id: null,
    categoria: args.categoria,
  });
}

export async function deleteCentroCusto(id: string) {
  await centrosCustoTotvsRepo.removeById(id);
}

/** Lista códigos distintos que aparecem no snapshot ativo (lido da view). */
export async function fetchCodigosNoSnapshot(): Promise<
  { centro_custo: string; desc_centro_custo: string | null }[]
> {
  const data = await centrosCustoTotvsRepo.listCodigosNoSnapshot();
  const m = new Map<string, { centro_custo: string; desc_centro_custo: string | null }>();
  for (const r of data) {
    if (!m.has(r.centro_custo)) m.set(r.centro_custo, r);
  }
  return Array.from(m.values()).sort((a, b) => a.centro_custo.localeCompare(b.centro_custo));
}
