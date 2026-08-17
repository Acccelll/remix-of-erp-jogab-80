/** @module-kind pure */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { brl } from "@/lib/billing";
import { drawInstitucionalHeader } from "@/lib/pdf/header";

type AnyObj = Record<string, any>;

const fmtDate = (d?: string | null) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

export function exportObraToPDF(opts: {
  obra: AnyObj;
  medicoes: AnyObj[];
  itensMedicao: AnyObj[];
  nfs: AnyObj[];
  recebimentos: AnyObj[];
  crono: AnyObj[];
  logoDataUrl?: string;
  /** PRO-031.slice-11 — linhas institucionais (razão social/CNPJ/contato). */
  institucionalLines?: string[];
}) {
  const { obra, medicoes, nfs, recebimentos, crono, logoDataUrl, institucionalLines } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // PRO-031.slice-12 — cabeçalho institucional via helper compartilhado.
  const startY = drawInstitucionalHeader(doc, {
    titulo: "Relatório gerencial da obra",
    subtitulo: `Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    logoDataUrl,
    institucionalLines,
    defaultStartY: 80,
  });

  // Identificação
  const valor = Number(obra.valor_contrato || 0);
  const faturado = nfs.reduce((a, n) => a + Number(n.valor || 0), 0);
  const recebido = recebimentos
    .filter((r) => r.data_recebimento)
    .reduce((a, r) => a + Number(r.valor_recebido || r.valor_previsto || 0), 0);
  const aReceber = recebimentos
    .filter((r) => !r.data_recebimento)
    .reduce((a, r) => a + Number(r.valor_previsto || 0), 0);
  const pctFat = valor > 0 ? (faturado / valor) * 100 : 0;

  autoTable(doc, {
    startY,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    body: [
      ["Código", String(obra.codigo ?? "—"), "Status", String(obra.status ?? "—")],
      ["Nome", String(obra.nome ?? "—"), "Cliente", String(obra.clientes?.nome ?? "—")],
      [
        "Início",
        fmtDate(obra.data_inicio),
        "Previsão término",
        fmtDate(obra.data_previsao_termino ?? obra.data_fim),
      ],
      ["Valor contrato", brl(valor), "% faturado", `${pctFat.toFixed(1)}%`],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 90 },
      2: { fontStyle: "bold", cellWidth: 90 },
    },
  });

  // KPIs
  let y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo financeiro", 40, y);
  autoTable(doc, {
    startY: y + 6,
    head: [["Faturado", "Recebido", "A receber", "Saldo a faturar"]],
    body: [[brl(faturado), brl(recebido), brl(aReceber), brl(Math.max(0, valor - faturado))]],
    styles: { fontSize: 9, halign: "right" },
    headStyles: { fillColor: [59, 130, 246], halign: "right" },
  });

  // Cronograma
  y = (doc as any).lastAutoTable.finalY + 14;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Cronograma", 40, y);
  autoTable(doc, {
    startY: y + 6,
    head: [["Ord.", "Descrição", "Início", "Fim", "Custo", "% Prev.", "% Real."]],
    body: (crono ?? []).map((c) => [
      c.ordem ?? "",
      String(c.descricao ?? "").slice(0, 60),
      fmtDate(c.data_inicio),
      fmtDate(c.data_fim),
      brl(Number(c.custo || 0)),
      `${Number(c.percentual_previsto || 0).toFixed(1)}%`,
      `${Number(c.percentual_realizado || 0).toFixed(1)}%`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });

  // Medições
  y = (doc as any).lastAutoTable.finalY + 14;
  if (y > 720) {
    doc.addPage();
    y = 50;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Medições", 40, y);
  autoTable(doc, {
    startY: y + 6,
    head: [["Nº", "Data corte", "Status", "Valor", "%"]],
    body: (medicoes ?? []).map((m) => [
      m.numero,
      fmtDate(m.data_corte),
      m.status,
      brl(Number(m.valor || 0)),
      `${Number(m.percentual || 0).toFixed(1)}%`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
  });

  // NFs
  y = (doc as any).lastAutoTable.finalY + 14;
  if (y > 700) {
    doc.addPage();
    y = 50;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Notas fiscais", 40, y);
  autoTable(doc, {
    startY: y + 6,
    head: [["Nº", "Emissão", "Vencimento", "Valor", "Líquido", "Status"]],
    body: (nfs ?? []).map((n) => [
      n.numero ?? "—",
      fmtDate(n.data_emissao),
      fmtDate(n.data_vencimento),
      brl(Number(n.valor || 0)),
      brl(Number(n.valor_liquido || 0)),
      n.status,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
  });

  // Recebimentos
  y = (doc as any).lastAutoTable.finalY + 14;
  if (y > 700) {
    doc.addPage();
    y = 50;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Recebimentos", 40, y);
  autoTable(doc, {
    startY: y + 6,
    head: [["Previsto", "Valor previsto", "Recebido", "Valor recebido", "Status"]],
    body: (recebimentos ?? []).map((r) => [
      fmtDate(r.data_prevista),
      brl(Number(r.valor_previsto || 0)),
      fmtDate(r.data_recebimento),
      r.valor_recebido != null ? brl(Number(r.valor_recebido)) : "—",
      r.status,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
  });

  // Footer com paginação
  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `${obra.codigo ?? ""} · ${obra.nome ?? ""}`,
      40,
      doc.internal.pageSize.getHeight() - 20,
    );
    doc.text(`Página ${i} de ${total}`, pageW - 40, doc.internal.pageSize.getHeight() - 20, {
      align: "right",
    });
  }

  doc.save(`obra_${obra.codigo}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}
