/** @module-kind pure */
// parser-holerite-xls.ts
// Parser do novo padrão "Holerite em Excel" (.xls/.xlsx)
// Identifica colaborador por CPF, captura proventos, descontos, encargos
// patronais e provisões para compor o custo total do colaborador em obra.

import * as XLSX from "xlsx";
import { cleanCPF } from "@/lib/utils";
import { HE_CODIGOS, SALARIO_BASE_CODIGO, ADIANTAMENTO_CODIGO } from "@/lib/dp/codigos";

export interface VerbaHolerite {
  codigo: string; // ex: "200"
  descricao: string; // ex: "HORAS EXTRAS 100%"
  tipo: "P" | "D"; // provento / desconto
  valor: number;
}

export type HoleriteTipo = "holerite" | "adiantamento";

export interface LinhaHolerite {
  tipo: HoleriteTipo; // detectado pelas verbas presentes
  cpf: string; // 11 dígitos
  nome: string;
  matricula: string; // coluna "Código"
  cargo: string;
  centroCustoNome: string;
  competencia: string; // YYYY-MM
  admissao: string | null; // YYYY-MM-DD

  // Salário base (rubrica 8781 - DIAS NORMAIS P)
  salarioBase: number;

  // Totais já calculados na planilha
  proventos: number;
  descontos: number;
  baseInss: number;
  inss: number;
  baseIrrf: number;
  irrf: number;
  baseFgts: number;
  fgts: number;
  liquido: number;

  // Provisões
  provisao13: number;
  inssProvisao13: number;
  fgtsProvisao13: number;
  provisaoFerias: number;
  inssProvisaoFerias: number;
  fgtsProvisaoFerias: number;

  // Encargos patronais
  inssEmpresa: number;
  rat: number;
  inssTerceiros: number;

  // Derivados
  horasExtras: number; // soma das verbas HE
  custoTotal: number; // proventos + encargos + fgts + provisões

  // Verbas detalhadas (não-zero)
  verbas: VerbaHolerite[];
}

export interface HoleriteParseResult {
  linhas: LinhaHolerite[];
  errors: string[];
  warnings: string[];
}

function num(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v)
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}([^\d]|$))/g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function str(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normalizeCompetencia(raw: any): string {
  const s = str(raw);
  if (!s) return "";
  const m1 = s.match(/^(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[2]}-${m1[1]}`;
  const m2 = s.match(/^(\d{4})[\/\-](\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}`;
  if (typeof raw === "number" && raw > 10000) {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}`;
  }
  return s;
}

const VERBA_HEADER_RE = /^(\d+)\s*-\s*(.+?)\s+([PD])(?:\.\d+)?\s*$/i;

export function parseHoleriteXls(arrayBuffer: ArrayBuffer): HoleriteParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const linhas: LinhaHolerite[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array" });
  } catch (e: any) {
    return { linhas, errors: [`Falha ao ler planilha: ${e.message}`], warnings };
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { linhas, errors: ["Planilha vazia"], warnings };

  const sheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (rows.length < 2) return { linhas, errors: ["Planilha sem dados"], warnings };

  const headers = rows[0].map((h) => str(h));
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const iCodigo = idx("Código");
  const iNome = idx("Nome");
  const iCpf = idx("CPF");
  const iAdmissao = idx("Admissão");
  const iCargo = idx("Cargo");
  const iCentro = idx("Centro de Custo");
  const iComp = idx("Competência");

  const iProventos = idx("PROVENTOS");
  const iDescontos = idx("DESCONTOS");
  const iBaseInss = idx("BASE INSS");
  const iInss = idx("INSS");
  const iBaseIrrf = idx("BASE IRRF");
  const iIrrf = idx("IRRF");
  const iBaseFgts = idx("BASE FGTS");
  const iFgts = idx("FGTS");
  const iLiquido = idx("LÍQUIDO");
  const iProv13 = idx("PROVISÃO 13°");
  const iInssProv13 = idx("INSS PROVISÃO 13°");
  const iFgtsProv13 = idx("FGTS PROVISÃO 13°");
  const iProvFer = idx("PROVISÃO FÉRIAS");
  const iInssProvFer = idx("INSS PROVISÃO FÉRIAS");
  const iFgtsProvFer = idx("FGTS PROVISÃO FÉRIAS");
  const iInssEmp = idx("INSS EMPRESA");
  const iRat = idx("RAT");
  const iInssTerc = idx("INSS TERCEIROS");

  if (iCpf < 0 || iProventos < 0) {
    return {
      linhas,
      errors: [
        'Planilha não está no formato "Holerite em Excel" (faltam colunas CPF e/ou PROVENTOS).',
      ],
      warnings,
    };
  }

  const verbaCols: { col: number; codigo: string; descricao: string; tipo: "P" | "D" }[] = [];
  headers.forEach((h, i) => {
    const m = h.match(VERBA_HEADER_RE);
    if (m)
      verbaCols.push({
        col: i,
        codigo: m[1],
        descricao: m[2].trim(),
        tipo: m[3].toUpperCase() as "P" | "D",
      });
  });

  const tipo: HoleriteTipo = verbaCols.some((v) => v.codigo === ADIANTAMENTO_CODIGO)
    ? "adiantamento"
    : "holerite";

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === null || c === "")) continue;

    const cpf = cleanCPF(str(row[iCpf]));
    if (!cpf || cpf.length !== 11) {
      warnings.push(`Linha ${r + 1}: CPF inválido/ausente, ignorada`);
      continue;
    }

    const verbas: VerbaHolerite[] = [];
    let horasExtras = 0;
    for (const vc of verbaCols) {
      const v = num(row[vc.col]);
      if (v === 0) continue;
      verbas.push({ codigo: vc.codigo, descricao: vc.descricao, tipo: vc.tipo, valor: v });
      if (vc.tipo === "P" && HE_CODIGOS.has(vc.codigo)) horasExtras += v;
    }

    const proventos = iProventos >= 0 ? num(row[iProventos]) : 0;
    const inssEmpresa = iInssEmp >= 0 ? num(row[iInssEmp]) : 0;
    const rat = iRat >= 0 ? num(row[iRat]) : 0;
    const inssTerceiros = iInssTerc >= 0 ? num(row[iInssTerc]) : 0;
    const fgts = iFgts >= 0 ? num(row[iFgts]) : 0;
    const provisao13 = iProv13 >= 0 ? num(row[iProv13]) : 0;
    const provisaoFerias = iProvFer >= 0 ? num(row[iProvFer]) : 0;
    const inssProvisao13 = iInssProv13 >= 0 ? num(row[iInssProv13]) : 0;
    const fgtsProvisao13 = iFgtsProv13 >= 0 ? num(row[iFgtsProv13]) : 0;
    const inssProvisaoFerias = iInssProvFer >= 0 ? num(row[iInssProvFer]) : 0;
    const fgtsProvisaoFerias = iFgtsProvFer >= 0 ? num(row[iFgtsProvFer]) : 0;

    // Mesmo cálculo do generated column dp_holerite.custo_total — fonte única.
    const custoTotal =
      proventos +
      inssEmpresa +
      rat +
      inssTerceiros +
      fgts +
      provisao13 +
      provisaoFerias +
      inssProvisao13 +
      fgtsProvisao13 +
      inssProvisaoFerias +
      fgtsProvisaoFerias;

    const salarioBase = verbas.find((v) => v.codigo === SALARIO_BASE_CODIGO)?.valor ?? 0;

    let admissao: string | null = null;
    if (iAdmissao >= 0) {
      const av = row[iAdmissao];
      if (typeof av === "number" && av > 10000) {
        const d = XLSX.SSF.parse_date_code(av);
        if (d) admissao = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      } else {
        const s = str(av);
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) admissao = `${m[3]}-${m[2]}-${m[1]}`;
      }
    }

    linhas.push({
      tipo,
      cpf,
      nome: str(row[iNome]),
      matricula: str(row[iCodigo]),
      cargo: str(row[iCargo]),
      centroCustoNome: str(row[iCentro]),
      competencia: normalizeCompetencia(row[iComp]),
      admissao,
      salarioBase,
      proventos,
      descontos: iDescontos >= 0 ? num(row[iDescontos]) : 0,
      baseInss: iBaseInss >= 0 ? num(row[iBaseInss]) : 0,
      inss: iInss >= 0 ? num(row[iInss]) : 0,
      baseIrrf: iBaseIrrf >= 0 ? num(row[iBaseIrrf]) : 0,
      irrf: iIrrf >= 0 ? num(row[iIrrf]) : 0,
      baseFgts: iBaseFgts >= 0 ? num(row[iBaseFgts]) : 0,
      fgts,
      liquido: iLiquido >= 0 ? num(row[iLiquido]) : 0,
      provisao13,
      inssProvisao13,
      fgtsProvisao13,
      provisaoFerias,
      inssProvisaoFerias,
      fgtsProvisaoFerias,
      inssEmpresa,
      rat,
      inssTerceiros,
      horasExtras,
      custoTotal,
      verbas,
    });
  }

  if (linhas.length === 0 && errors.length === 0) {
    errors.push("Nenhum colaborador válido encontrado na planilha.");
  }

  return { linhas, errors, warnings };
}

export function maskCPFDisplay(cpf: string): string {
  const c = cleanCPF(cpf);
  if (c.length !== 11) return cpf;
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
