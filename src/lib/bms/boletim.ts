/** @module-kind pure */
// Geração de Boletim de Medição (BMS) — visualização, Excel e PDF.
// O layout do Excel replica as colunas do importador em src/lib/bms-excel.ts
// para que o arquivo gerado seja reimportável.
import { format, parseISO } from "date-fns";
import { brl } from "../billing";
import { drawInstitucionalLines } from "@/lib/pdf/header";

export type BoletimItem = {
  codigo: string;
  descricao: string;
  unidade?: string;
  quantidade?: number;
  preco_unitario?: number;
  valor_total: number; // base (R$) do item no contrato
  pct_anterior: number;
  pct_atual: number;
  valor_anterior: number;
  valor_acumulado: number;
  valor_periodo: number;
  saldo: number;
};

export type BoletimData = {
  obra: {
    codigo?: string;
    nome: string;
    cliente?: string;
    cliente_cnpj?: string;
    pedido_contrato?: string;
    valor_contrato: number;
  };
  medicao: {
    numero: string;
    data_inicio?: string | null;
    data_corte: string;
    data_aprovacao?: string | null;
  };
  itens: BoletimItem[];
};

const fmtDate = (d?: string | null) => (d ? format(parseISO(d), "dd/MM/yyyy") : "—");

export function totaisBoletim(itens: BoletimItem[]) {
  return {
    valor_total: itens.reduce((a, i) => a + i.valor_total, 0),
    valor_anterior: itens.reduce((a, i) => a + i.valor_anterior, 0),
    valor_acumulado: itens.reduce((a, i) => a + i.valor_acumulado, 0),
    valor_periodo: itens.reduce((a, i) => a + i.valor_periodo, 0),
    saldo: itens.reduce((a, i) => a + i.saldo, 0),
  };
}

// ============================================================
// EXCEL — replica o layout do importador (bms-excel.ts)
// ============================================================
export async function gerarBoletimExcel(d: BoletimData): Promise<Blob> {
  const XLSX = await import("xlsx");
  const totais = totaisBoletim(d.itens);
  const periodo = `${fmtDate(d.medicao.data_inicio)} a ${fmtDate(d.medicao.data_corte)}`;

  // Layout em matriz (15 colunas: A..O) — espelhando bms-excel.ts
  const rows: any[][] = [];
  rows.push(["BOLETIM DE MEDIÇÃO DE SERVIÇO"]);
  rows.push([
    `Contrato:`,
    d.obra.pedido_contrato ?? "",
    "",
    "",
    "",
    "Valor Total Contrato:",
    d.obra.valor_contrato,
  ]);
  rows.push([`Obra:`, d.obra.nome, "", "", "", "Cliente:", d.obra.cliente ?? ""]);
  rows.push([`Código:`, d.obra.codigo ?? "", "", "", "", "CNPJ:", d.obra.cliente_cnpj ?? ""]);
  rows.push([
    `Boletim de Medição Nº:`,
    d.medicao.numero,
    "",
    "",
    "",
    "Data:",
    fmtDate(d.medicao.data_corte),
  ]);
  rows.push([`Período:`, periodo]);
  rows.push([]);
  // Header de colunas (duas linhas, como no importador)
  rows.push([
    "Item",
    "Descrição",
    "",
    "Quant.",
    "UM",
    "Preço Unit.",
    "Valor Total Contrato",
    "Anterior",
    "",
    "Mês",
    "",
    "Acumulado",
    "",
    "Saldo",
    "",
  ]);
  rows.push([
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "Qtd",
    "Valor",
    "Qtd",
    "Valor",
    "Qtd",
    "Valor",
    "Qtd",
    "Valor",
  ]);
  for (const i of d.itens) {
    const qtdContrato = Number(i.quantidade ?? 0);
    const pu = Number(i.preco_unitario ?? 0);
    const qa = qtdContrato * (i.pct_anterior / 100);
    const qac = qtdContrato * (i.pct_atual / 100);
    const qm = qac - qa;
    const sq = qtdContrato - qac;
    rows.push([
      i.codigo,
      i.descricao,
      "",
      qtdContrato || "",
      i.unidade ?? "",
      pu || "",
      i.valor_total,
      qa || "",
      i.valor_anterior,
      qm || "",
      i.valor_periodo,
      qac || "",
      i.valor_acumulado,
      sq || "",
      i.saldo,
    ]);
  }
  rows.push([
    "",
    "SUB TOTAL",
    "",
    "",
    "",
    "",
    totais.valor_total,
    "",
    totais.valor_anterior,
    "",
    totais.valor_periodo,
    "",
    totais.valor_acumulado,
    "",
    totais.saldo,
  ]);
  rows.push(["", "Total Desta Medição", "", "", "", "", totais.valor_periodo]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 10 },
    { wch: 40 },
    { wch: 2 },
    { wch: 10 },
    { wch: 6 },
    { wch: 12 },
    { wch: 16 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(d.medicao.numero));
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function sanitizeSheetName(n: string): string {
  return n.replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || "BMS";
}

// ============================================================
// PDF — jsPDF + autoTable
// ============================================================
export type BoletimPdfOpts = {
  /** Logotipo da empresa (data URL) — quando presente, renderiza 48×48 no topo. */
  logoDataUrl?: string;
  /** Linhas curtas de identificação institucional (razão social, CNPJ, contato). */
  institucionalLines?: string[];
};

export async function gerarBoletimPdf(d: BoletimData, opts: BoletimPdfOpts = {}): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const totais = totaisBoletim(d.itens);
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();

  if (opts.logoDataUrl) {
    try {
      const fmt =
        opts.logoDataUrl.startsWith("data:image/jpeg") ||
        opts.logoDataUrl.startsWith("data:image/jpg")
          ? "JPEG"
          : "PNG";
      doc.addImage(opts.logoDataUrl, fmt, 30, 20, 48, 48);
    } catch {
      /* logo inválido: segue sem imagem */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("BOLETIM DE MEDIÇÃO DE SERVIÇO", pageW / 2, 36, { align: "center" });

  const instLines = (opts.institucionalLines ?? []).filter((s) => s && s.trim().length > 0);
  if (instLines.length > 0) {
    // PRO-031.slice-13 — usa helper compartilhado (variante centralizada).
    drawInstitucionalLines(doc, {
      lines: instLines,
      x: pageW / 2,
      startY: 46,
      align: "center",
    });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const periodo = `${fmtDate(d.medicao.data_inicio)} a ${fmtDate(d.medicao.data_corte)}`;
  const headerLines: [string, string][][] = [
    [
      ["Obra:", `${d.obra.codigo ?? ""} ${d.obra.nome}`.trim()],
      ["Cliente:", d.obra.cliente ?? "—"],
    ],
    [
      ["Contrato:", d.obra.pedido_contrato ?? "—"],
      ["CNPJ:", d.obra.cliente_cnpj ?? "—"],
    ],
    [
      ["BMS Nº:", d.medicao.numero],
      ["Data corte:", fmtDate(d.medicao.data_corte)],
    ],
    [
      ["Período:", periodo],
      ["Valor contrato:", brl(d.obra.valor_contrato)],
    ],
  ];
  let y = instLines.length > 0 ? 56 + instLines.length * 10 : 56;
  for (const line of headerLines) {
    let x = 40;
    for (const [k, v] of line) {
      doc.setFont("helvetica", "bold");
      doc.text(k, x, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(v), x + 70, y);
      x += pageW / 2 - 20;
    }
    y += 14;
  }

  autoTable(doc, {
    startY: y + 8,
    head: [
      [
        "Item",
        "Descrição",
        "Qtd/UM",
        "% Ant.",
        "% Período",
        "% Acum.",
        "Valor Período",
        "Valor Acumulado",
        "Saldo",
      ],
    ],
    body: d.itens.map((i) => [
      i.codigo,
      i.descricao,
      i.quantidade ? `${i.quantidade} ${i.unidade ?? ""}`.trim() : (i.unidade ?? "—"),
      `${i.pct_anterior.toFixed(2)}%`,
      `${(i.pct_atual - i.pct_anterior).toFixed(2)}%`,
      `${i.pct_atual.toFixed(2)}%`,
      brl(i.valor_periodo),
      brl(i.valor_acumulado),
      brl(i.saldo),
    ]),
    foot: [
      [
        "",
        "TOTAIS",
        "",
        "",
        "",
        "",
        brl(totais.valor_periodo),
        brl(totais.valor_acumulado),
        brl(totais.saldo),
      ],
    ],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    footStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 60 },
      3: { cellWidth: 50, halign: "right" },
      4: { cellWidth: 60, halign: "right" },
      5: { cellWidth: 55, halign: "right" },
      6: { cellWidth: 80, halign: "right" },
      7: { cellWidth: 85, halign: "right" },
      8: { cellWidth: 75, halign: "right" },
    },
    margin: { left: 30, right: 30 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  const sigY = Math.min(finalY + 60, doc.internal.pageSize.getHeight() - 80);
  doc.setFontSize(9);
  doc.line(60, sigY, 280, sigY);
  doc.line(pageW - 280, sigY, pageW - 60, sigY);
  doc.text("Responsável Técnico (Contratada)", 170, sigY + 14, { align: "center" });
  doc.text("Fiscalização (Contratante)", pageW - 170, sigY + 14, { align: "center" });

  return doc.output("blob");
}

