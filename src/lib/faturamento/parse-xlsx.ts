/** @module-kind pure */
// Parser para a planilha "FATURAMENTO CS - TOTAL" (aba "Detalhe Nfse").
import { extrairObraDaDiscriminacao, extrairBmsEPedido } from "./vincular-obra";
import type { NfseParsed } from "./parse-xml";

function num(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\s/g, "");
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toISO(v: any): string | undefined {
  if (!v && v !== 0) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Serial do Excel (dias desde 1899-12-30)
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return toISO(Number(s));
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  return undefined;
}


function pick(row: any, keys: string[]): any {
  for (const k of keys) {
    const t = k.toLowerCase();
    for (const real of Object.keys(row)) {
      if (real.toLowerCase().trim() === t) return row[real];
    }
  }
  // fallback contains
  for (const k of keys) {
    const t = k.toLowerCase();
    for (const real of Object.keys(row)) {
      if (real.toLowerCase().includes(t)) return row[real];
    }
  }
  return undefined;
}

export async function parseFaturamentoXlsx(
  file: File,
): Promise<{ linhas: NfseParsed[]; arquivo: string; aba: string }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const aba = wb.SheetNames.find((s) => /detalhe/i.test(s) && /nfs/i.test(s)) ?? wb.SheetNames[0];
  const sheet = wb.Sheets[aba];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

  const linhas: NfseParsed[] = [];
  for (const r of rows) {
    const numero = String(pick(r, ["Numero NFS-e", "Numero NFSe", "Número NFS-e"]) ?? "").trim();
    if (!numero || numero.toLowerCase().startsWith("rótulos")) continue;

    const discriminacao =
      String(pick(r, ["Discriminação dos Serviços", "Discriminacao"]) ?? "").trim() || undefined;
    const obra = discriminacao ? extrairObraDaDiscriminacao(discriminacao) : null;
    const { numero_bms, pedido } = discriminacao
      ? extrairBmsEPedido(discriminacao)
      : { numero_bms: undefined, pedido: undefined };

    const issRetidoStr = String(
      pick(r, ["ISS a reter (Sim,Não)", "ISS a reter (Sim, Nao)", "ISS a reter"]),
    )
      .trim()
      .toLowerCase();
    const aliquotaRaw = num(pick(r, ["ISS (%)", "Aliquota"]));
    const aliquota = aliquotaRaw > 0 && aliquotaRaw <= 1 ? aliquotaRaw * 100 : aliquotaRaw;

    linhas.push({
      numero_nfse: numero,
      codigo_verificacao:
        String(pick(r, ["Codigo de Verificação", "Codigo Verificacao"]) ?? "").trim() || undefined,
      data_emissao: toISO(pick(r, ["Data/Hora Emissão", "Data Emissão"])),
      competencia: toISO(pick(r, ["Competência", "Competencia"])),
      prestador_cnpj: String(pick(r, ["CNPJ/CPF - Prestador"]) ?? "").trim() || undefined,
      prestador_razao:
        String(pick(r, ["Razão Social/Nome - Prestador"]) ?? "").trim() ||
        String(pick(r, ["Nome Fantasia - Prestador"]) ?? "").trim() ||
        undefined,
      tomador_cnpj: String(pick(r, ["CNPJ/CPF - Tomador"]) ?? "").trim() || undefined,
      tomador_razao:
        String(pick(r, ["Razão Social/Nome - Tomador"]) ?? "").trim() ||
        String(pick(r, ["Nome Fantasia - Tomador"]) ?? "").trim() ||
        undefined,
      tomador_uf: String(pick(r, ["UF - Tomador"]) ?? "").trim() || undefined,
      tomador_municipio: String(pick(r, ["Município - Tomador"]) ?? "").trim() || undefined,
      municipio_prestacao: String(pick(r, ["Local da Prestação"]) ?? "").trim() || undefined,
      item_lista_servico:
        String(pick(r, ["Codigo do Serviço/Atividade"]) ?? "").trim() || undefined,
      codigo_servico: undefined,
      codigo_obra_interno: String(pick(r, ["Cod. Obra (INTERNO)"]) ?? "").trim() || undefined,
      codigo_obra: String(pick(r, ["Codigo da Obra"]) ?? "").trim() || obra || undefined,
      numero_bms,
      pedido,
      discriminacao,
      valor_servicos: num(pick(r, ["Valor dos Serviços"])),
      deducoes: num(pick(r, ["Deduções permitidas em lei", "Deducoes"])),
      base_calculo: num(pick(r, ["Base de Cálculo"])),
      aliquota_iss: aliquota,
      valor_iss: num(pick(r, ["Valor do ISS"])),
      iss_retido: issRetidoStr.startsWith("s") || issRetidoStr === "1",
      valor_inss: num(pick(r, ["INSS"])),
      valor_ir: num(pick(r, ["IR"])),
      valor_csll: num(pick(r, ["CSLL"])),
      valor_pis: num(pick(r, ["PIS"])),
      valor_cofins: num(pick(r, ["COFINS"])),
      outras_retencoes: num(pick(r, ["Retenções Federais"])),
      valor_liquido: num(pick(r, ["Valor Líquido"])),
      natureza_operacao: String(pick(r, ["Natureza da Operação"]) ?? "").trim() || undefined,
      arquivo_origem: file.name,
    });
  }

  return { linhas, arquivo: file.name, aba };
}
