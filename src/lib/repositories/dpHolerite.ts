// Repositório único do módulo DP — lê/grava na tabela dp_holerite (MySQL via api.php).
import { apiFetch } from "@/lib/api";
import type { LinhaHolerite, HoleriteTipo } from "@/lib/dp/parser-holerite-xls";

export interface DpHoleriteRow {
  id: string;
  tipo: HoleriteTipo;
  colaborador_id: string | null;
  cpf: string;
  competencia: string;
  nome_lido: string | null;
  matricula_lida: string | null;
  cargo_lido: string | null;
  centro_custo_nome_lido: string | null;
  admissao: string | null;
  proventos: number;
  descontos: number;
  liquido: number;
  base_inss: number;
  inss: number;
  base_irrf: number;
  irrf: number;
  base_fgts: number;
  fgts: number;
  provisao_13: number;
  inss_provisao_13: number;
  fgts_provisao_13: number;
  provisao_ferias: number;
  inss_provisao_ferias: number;
  fgts_provisao_ferias: number;
  inss_empresa: number;
  rat: number;
  inss_terceiros: number;
  salario_base: number;
  horas_extras_valor: number;
  custo_total: number;
  fator_k: number | null;
  verbas: Array<{ codigo: string; descricao: string; tipo: "P" | "D"; valor: number }>;
  imported_at: string;
}

export interface ImportSummary {
  inserted: number;
  cpfsNaoCadastrados: Array<{ cpf: string; nome: string }>;
  totalLiquido: number;
  totalCusto: number;
}

const n = (v: any) => (typeof v === "number" ? v : Number(v) || 0);

export function mapRow(r: any): DpHoleriteRow {
  return {
    id: r.id,
    tipo: (r.tipo as HoleriteTipo) || "holerite",
    colaborador_id: r.colaborador_id,
    cpf: r.cpf,
    competencia: r.competencia,
    nome_lido: r.nome_lido,
    matricula_lida: r.matricula_lida,
    cargo_lido: r.cargo_lido,
    centro_custo_nome_lido: r.centro_custo_nome_lido,
    admissao: r.admissao,
    proventos: n(r.proventos),
    descontos: n(r.descontos),
    liquido: n(r.liquido),
    base_inss: n(r.base_inss),
    inss: n(r.inss),
    base_irrf: n(r.base_irrf),
    irrf: n(r.irrf),
    base_fgts: n(r.base_fgts),
    fgts: n(r.fgts),
    provisao_13: n(r.provisao_13),
    inss_provisao_13: n(r.inss_provisao_13),
    fgts_provisao_13: n(r.fgts_provisao_13),
    provisao_ferias: n(r.provisao_ferias),
    inss_provisao_ferias: n(r.inss_provisao_ferias),
    fgts_provisao_ferias: n(r.fgts_provisao_ferias),
    inss_empresa: n(r.inss_empresa),
    rat: n(r.rat),
    inss_terceiros: n(r.inss_terceiros),
    salario_base: n(r.salario_base),
    horas_extras_valor: n(r.horas_extras_valor),
    custo_total: n(r.custo_total),
    fator_k: r.fator_k == null ? null : Number(r.fator_k),
    verbas: Array.isArray(r.verbas) ? r.verbas : [],
    imported_at: r.imported_at,
  };
}

export async function upsertHoleriteBatch(
  linhas: LinhaHolerite[],
  resolveColabId: (cpf: string) => string | null,
): Promise<ImportSummary> {
  const cpfsNaoCadastrados: Array<{ cpf: string; nome: string }> = [];
  const payload = linhas.map((l) => {
    const colaboradorId = resolveColabId(l.cpf);
    if (!colaboradorId) cpfsNaoCadastrados.push({ cpf: l.cpf, nome: l.nome });
    return {
      tipo: l.tipo,
      colaborador_id: colaboradorId,
      cpf: l.cpf,
      competencia: l.competencia,
      nome_lido: l.nome,
      matricula_lida: l.matricula,
      cargo_lido: l.cargo,
      centro_custo_nome_lido: l.centroCustoNome,
      admissao: l.admissao,
      proventos: l.proventos,
      descontos: l.descontos,
      liquido: l.liquido,
      base_inss: l.baseInss,
      inss: l.inss,
      base_irrf: l.baseIrrf,
      irrf: l.irrf,
      base_fgts: l.baseFgts,
      fgts: l.fgts,
      provisao_13: l.provisao13,
      inss_provisao_13: l.inssProvisao13,
      fgts_provisao_13: l.fgtsProvisao13,
      provisao_ferias: l.provisaoFerias,
      inss_provisao_ferias: l.inssProvisaoFerias,
      fgts_provisao_ferias: l.fgtsProvisaoFerias,
      inss_empresa: l.inssEmpresa,
      rat: l.rat,
      inss_terceiros: l.inssTerceiros,
      salario_base: l.salarioBase,
      horas_extras_valor: l.horasExtras,
      verbas: l.verbas,
      origem: l.tipo === "adiantamento" ? "adiantamento_xls" : "holerite_xls",
      imported_at: new Date().toISOString(),
    };
  });

  if (payload.length === 0)
    return { inserted: 0, cpfsNaoCadastrados, totalLiquido: 0, totalCusto: 0 };

  // Upsert em lote no MySQL (chave cpf+competencia+tipo); custo_total e
  // fator_k são recalculados pelo api.php na escrita.
  await apiFetch("dpHolerites", { method: "POST", body: { rows: payload } });

  return {
    inserted: payload.length,
    cpfsNaoCadastrados,
    totalLiquido: linhas.reduce((s, l) => s + l.liquido, 0),
    totalCusto: linhas.reduce((s, l) => s + l.custoTotal, 0),
  };
}

export async function fetchAllHolerites(): Promise<DpHoleriteRow[]> {
  const data = await apiFetch<any[]>("dpHolerites");
  return (Array.isArray(data) ? data : []).map(mapRow);
}

export async function deleteCompetencia(competencia: string) {
  await apiFetch("dpHolerites", { method: "DELETE", params: { competencia } });
}

export async function fetchLastImport(): Promise<{
  competencia: string;
  count: number;
  imported_at: string;
} | null> {
  const data = await apiFetch<{ competencia: string; count: number; imported_at: string } | null>(
    "dpHolerites",
    { params: { ultima: "1" } },
  );
  return data && data.competencia ? data : null;
}
