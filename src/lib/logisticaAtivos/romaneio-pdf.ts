/** @module-kind io */
/**
 * Geração de PDF do Romaneio — segue o padrão de src/lib/suprimentos/export-pdf.ts
 * (cabeçalho institucional + jspdf-autotable + rodapé paginado), por ser um
 * documento formal de transporte, não um export ad-hoc.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { drawInstitucionalHeader } from "@/lib/pdf/header";
import { ROMANEIO_STATUS_LABEL, type RomaneioStatus } from "./status";

const fmtDateTime = (d = new Date()) => format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
const fmtDate = (v: string | null) =>
  v ? format(new Date(`${v}T00:00:00`), "dd/MM/yyyy", { locale: ptBR }) : "—";
const fmtDateStamp = () => format(new Date(), "yyyyMMdd_HHmm");
const fmtQtd = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const safe = (v: unknown) =>
  String(v ?? "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 40);

function footer(doc: jsPDF, label: string) {
  const total = (doc as any).internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(label, 40, pageH - 20);
    doc.text(`Página ${i} de ${total}`, pageW - 40, pageH - 20, { align: "right" });
    doc.setTextColor(0);
  }
}

export interface RomaneioPdfItemEstoque {
  insumoNome: string;
  quantidade: number;
  unidade?: string;
  localOrigem: string;
  localDestino: string;
}

export interface RomaneioPdfItemPatrimonio {
  codigo?: string | null;
  nome: string;
}

export interface ExportRomaneioPdfOpts {
  numero: string;
  status: RomaneioStatus;
  obraOrigemNome?: string;
  obraDestinoNome: string;
  veiculoNome?: string;
  dataProgramada: string | null;
  observacao?: string | null;
  criadoPorNome?: string | null;
  itensEstoque: RomaneioPdfItemEstoque[];
  itensPatrimonio: RomaneioPdfItemPatrimonio[];
  logoDataUrl?: string;
  institucionalLines?: string[];
}

export function exportRomaneioToPDF(opts: ExportRomaneioPdfOpts): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const startY = drawInstitucionalHeader(doc, {
    titulo: `Romaneio ${opts.numero}`,
    subtitulo: `Gerado em ${fmtDateTime()}`,
    logoDataUrl: opts.logoDataUrl,
    institucionalLines: opts.institucionalLines,
  });

  autoTable(doc, {
    startY,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    body: [
      [
        "Status",
        ROMANEIO_STATUS_LABEL[opts.status],
        "Data programada",
        fmtDate(opts.dataProgramada),
      ],
      ["Obra origem", opts.obraOrigemNome ?? "—", "Obra destino", opts.obraDestinoNome],
      ["Veículo transportador", opts.veiculoNome ?? "—", "Criado por", opts.criadoPorNome ?? "—"],
      ["Observação", opts.observacao ?? "—", "", ""],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 110 },
      2: { fontStyle: "bold", cellWidth: 110 },
    },
  });

  let cursorY = (doc as any).lastAutoTable.finalY + 16;

  if (opts.itensEstoque.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Itens de estoque", 40, cursorY);
    autoTable(doc, {
      startY: cursorY + 8,
      head: [["Insumo", "Quantidade", "Origem", "Destino"]],
      body: opts.itensEstoque.map((item) => [
        item.insumoNome,
        `${fmtQtd(item.quantidade)}${item.unidade ? ` ${item.unidade}` : ""}`,
        item.localOrigem,
        item.localDestino,
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 16;
  }

  if (opts.itensPatrimonio.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Patrimônios transportados", 40, cursorY);
    autoTable(doc, {
      startY: cursorY + 8,
      head: [["Código", "Nome"]],
      body: opts.itensPatrimonio.map((item) => [item.codigo ?? "—", item.nome]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 28;
  } else {
    cursorY += 12;
  }

  doc.setDrawColor(120);
  doc.line(40, cursorY, 260, cursorY);
  doc.line(335, cursorY, 555, cursorY);
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text("Responsável pela expedição", 40, cursorY + 12);
  doc.text("Recebido por", 335, cursorY + 12);
  doc.setTextColor(0);

  footer(doc, `Romaneio ${opts.numero} · ${opts.obraDestinoNome}`);
  doc.save(`romaneio_${safe(opts.numero)}_${fmtDateStamp()}.pdf`);
}
