/** @module-kind pure */
/**
 * PRO-005 · slice-03 — Exportação local de RDO fechado em PDF.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { drawInstitucionalHeader } from "@/lib/pdf/header";
import type { RdoRegistroLocal } from "./numeracao";

type Turno = "manha" | "tarde" | "noite";

export interface RdoPdfData {
  clima_manha: string;
  clima_tarde: string;
  clima_noite: string;
  trabalhavel_manha: boolean;
  trabalhavel_tarde: boolean;
  trabalhavel_noite: boolean;
  observacoes: string;
  efetivo: { colaborador_id?: string; funcao_id?: string; quantidade: number; presente: boolean }[];
  atividades: { cronograma_item_id?: string; descricao: string; quantidade?: number }[];
  ocorrencias: { tipo: string; descricao: string }[];
  fotos: { path: string; legenda: string }[];
}

export interface ExportRdoPdfOpts {
  registro: RdoRegistroLocal;
  dataDia: string;
  data: RdoPdfData;
  obraNome?: string;
  colaboradorNome?: (id: string) => string | undefined;
  atividadeNome?: (id: string) => string | undefined;
  /** PRO-031.slice-04 — logotipo da empresa (data URL ou http(s)) para cabeçalho. */
  logoDataUrl?: string;
  /** PRO-031.slice-11 — linhas institucionais (razão social/CNPJ/contato). */
  institucionalLines?: string[];
}

const turnoLabel: Record<Turno, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const ocorrenciaLabel: Record<string, string> = {
  chuva: "Chuva",
  falta_material: "Falta de material",
  acidente: "Acidente",
  visita: "Visita",
  outro: "Outro",
};

function safeName(value: unknown) {
  return String(value ?? "rdo")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 48);
}

function fmtDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

function fmtDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function fmtQtd(value?: number) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

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

function lastY(doc: jsPDF, fallback = 80) {
  return ((doc as any).lastAutoTable?.finalY as number | undefined) ?? fallback;
}

export function exportRdoToPDF(opts: ExportRdoPdfOpts) {
  const { registro, dataDia, data, obraNome, colaboradorNome, atividadeNome, logoDataUrl, institucionalLines } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // PRO-031.slice-12 — cabeçalho institucional via helper compartilhado.
  const startY = drawInstitucionalHeader(doc, {
    titulo: `Diário de Obra ${registro.numero}`,
    subtitulo: `Emitido pelo GestãObra em ${fmtDateTime(new Date().toISOString())}`,
    logoDataUrl,
    institucionalLines,
    logoTop: 30,
  });

  autoTable(doc, {
    startY,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    body: [
      ["Número", registro.numero, "Data", fmtDate(dataDia)],
      ["Obra", obraNome ?? registro.obraId, "Status", registro.fechado ? "Fechado" : "Rascunho"],
      ["Fechado em", fmtDateTime(registro.fechadoEm), "Fechado por", registro.fechadoPor ?? "—"],
      ["Assinado em", fmtDateTime(registro.assinadoEm), "Assinado por", registro.assinadoPor ?? "—"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 80 },
      2: { fontStyle: "bold", cellWidth: 80 },
    },
  });

  autoTable(doc, {
    startY: lastY(doc) + 12,
    head: [["Turno", "Clima", "Condição"]],
    body: (["manha", "tarde", "noite"] as Turno[]).map((turno) => [
      turnoLabel[turno],
      data[`clima_${turno}`] || "—",
      data[`trabalhavel_${turno}`] ? "Trabalhável" : "Paralisado",
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  autoTable(doc, {
    startY: lastY(doc) + 12,
    head: [["#", "Efetivo", "Qtd", "Presença"]],
    body:
      data.efetivo.length > 0
        ? data.efetivo.map((e, idx) => [
            String(idx + 1),
            e.colaborador_id ? (colaboradorNome?.(e.colaborador_id) ?? e.colaborador_id) : e.funcao_id ?? "—",
            fmtQtd(e.quantidade),
            e.presente ? "Presente" : "Ausente",
          ])
        : [["—", "Sem efetivo registrado", "—", "—"]],
    styles: { fontSize: 8, cellPadding: 3, valign: "top" },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: { 0: { cellWidth: 24, halign: "right" }, 2: { cellWidth: 50, halign: "right" } },
  });

  autoTable(doc, {
    startY: lastY(doc) + 12,
    head: [["#", "Atividade", "Descrição / observação", "Qtd"]],
    body:
      data.atividades.length > 0
        ? data.atividades.map((a, idx) => [
            String(idx + 1),
            a.cronograma_item_id ? (atividadeNome?.(a.cronograma_item_id) ?? a.cronograma_item_id) : "Livre",
            a.descricao || "—",
            fmtQtd(a.quantidade),
          ])
        : [["—", "Sem atividades registradas", "—", "—"]],
    styles: { fontSize: 8, cellPadding: 3, valign: "top" },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: { 0: { cellWidth: 24, halign: "right" }, 3: { cellWidth: 50, halign: "right" } },
  });

  autoTable(doc, {
    startY: lastY(doc) + 12,
    head: [["#", "Tipo", "Descrição"]],
    body:
      data.ocorrencias.length > 0
        ? data.ocorrencias.map((o, idx) => [
            String(idx + 1),
            ocorrenciaLabel[o.tipo] ?? o.tipo,
            o.descricao || "—",
          ])
        : [["—", "Sem ocorrências", "—"]],
    styles: { fontSize: 8, cellPadding: 3, valign: "top" },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: { 0: { cellWidth: 24, halign: "right" }, 1: { cellWidth: 110 } },
  });

  if (data.fotos.length > 0) {
    autoTable(doc, {
      startY: lastY(doc) + 12,
      head: [["#", "Foto", "Legenda"]],
      body: data.fotos.map((f, idx) => [String(idx + 1), f.path, f.legenda || "—"]),
      styles: { fontSize: 8, cellPadding: 3, valign: "top" },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 0: { cellWidth: 24, halign: "right" } },
    });
  }

  let y = lastY(doc) + 18;
  if (data.observacoes) {
    if (y > pageH - 130) {
      doc.addPage();
      y = 50;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Observações gerais", 40, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const linhas = doc.splitTextToSize(data.observacoes, pageW - 80);
    doc.text(linhas, 40, y + 14);
    y += 16 + linhas.length * 11;
  }

  if (y > pageH - 130) {
    doc.addPage();
    y = 50;
  }
  y += 24;
  if (registro.assinaturaDataUrl) {
    try {
      doc.addImage(registro.assinaturaDataUrl, "PNG", 40, y - 8, 180, 56);
    } catch {
      doc.setFontSize(9);
      doc.text("Assinatura eletrônica registrada localmente.", 40, y + 10);
    }
    y += 58;
  }
  doc.setDrawColor(120);
  doc.line(40, y, 260, y);
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text(registro.assinadoPor ?? "Responsável", 40, y + 12);
  doc.setTextColor(0);

  footer(doc, `${registro.numero} · ${obraNome ?? "Obra"}`);
  doc.save(`rdo_${safeName(registro.numero)}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}