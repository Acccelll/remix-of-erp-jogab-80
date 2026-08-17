/** @module-kind orchestration */
// BIZ-002.c — orquestra upsert de NFS-e: carrega mapas do banco, delega
// a resolução de obra_id para lib pura (./resolver-obra.ts) e grava.
import { obrasRepo } from "@/lib/repositories/obras";
import { centrosCustoTotvsRepo, faturamentoNfseRepo } from "@/lib/repositories/financeiro";
import type { NfseParsed } from "./parse-xml";
import { buildMapaObrasAliases, criarResolverObraNfse } from "./resolver-obra";

export type UpsertResultado = {
  novas: number;
  atualizadas: number;
  inalteradas: number;
  vinculadas_obra: number;
  total: number;
  erros?: string[];
};

async function carregarMapaObraPorCentro(): Promise<Map<string, string>> {
  const rows = await centrosCustoTotvsRepo.listCodigoObraIdComObra();
  const m = new Map<string, string>();
  for (const r of rows) {
    if (r.codigo && r.obra_id) m.set(String(r.codigo).trim(), r.obra_id);
  }
  return m;
}

async function carregarMapaObras(): Promise<Map<string, string>> {
  const rows = await obrasRepo.listComCodigoTotvs();
  return buildMapaObrasAliases(rows as any[]);
}

export async function upsertNfse(
  linhas: NfseParsed[],
  origem: "planilha" | "xml",
  obraIdForcado?: string,
): Promise<UpsertResultado> {
  const mapaCentros = await carregarMapaObraPorCentro();
  const mapaObras = await carregarMapaObras();
  const resolverObra = criarResolverObraNfse(mapaCentros, mapaObras);

  // resolve obra_id
  const linhasComObra = linhas.map((l) => ({
    ...l,
    obra_id: obraIdForcado ?? resolverObra(l),
    origem,
  }));

  const resultado = await faturamentoNfseRepo.importarLote(linhasComObra);
  return { ...resultado, erros: [] };
}
