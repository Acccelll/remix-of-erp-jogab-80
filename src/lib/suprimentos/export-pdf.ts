/** @module-kind pure */
/**
 * PRO-010 · slice-01 — Saídas formais de Suprimentos.
 * Funções puras para geração de PDF de Ordem de Compra e Pedido de Cotação.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/core/currency";
import { drawInstitucionalHeader } from "@/lib/pdf/header";

type AnyObj = Record<string, any>;

type FornecedorPdf = {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  contato?: string | null;
  email?: string | null;
  telefone?: string | null;
};

const fmtDateTime = (d = new Date()) => format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
const fmtDateStamp = () => format(new Date(), "yyyyMMdd_HHmm");
const fmtQtd = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const safe = (v: unknown) => String(v ?? "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);

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

function header(
  doc: jsPDF,
  titulo: string,
  subtitulo: string,
  logoDataUrl?: string,
  institucionalLines?: string[],
): number {
  // PRO-031.slice-12 — helper compartilhado; mantém assinatura local para
  // não impactar chamadas existentes dentro deste módulo.
  return drawInstitucionalHeader(doc, {
    titulo,
    subtitulo,
    logoDataUrl,
    institucionalLines,
  });
}

export function exportOrdemCompraToPDF(opts: {
  oc: AnyObj;
  itens: AnyObj[];
  obraNome?: string;
  fornecedor?: FornecedorPdf;
  emitenteNome?: string;
  logoDataUrl?: string;
  institucionalLines?: string[];
}) {
  const { oc, itens, obraNome, fornecedor, emitenteNome, logoDataUrl, institucionalLines } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const numero = oc.numero != null ? String(oc.numero) : safe(oc.id);

  const startY = header(doc, `Ordem de Compra #${numero}`, `Emitida pelo GestãObra em ${fmtDateTime()}`, logoDataUrl, institucionalLines);

  autoTable(doc, {
    startY,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    body: [
      ["Obra", obraNome ?? "—", "Status", String(oc.status ?? "—")],
      ["Fornecedor", fornecedor?.razao_social ?? "—", "Contato", fornecedor?.contato ?? "—"],
      ["E-mail", fornecedor?.email ?? "—", "Telefone", fornecedor?.telefone ?? "—"],
      ["Total", formatBRL(Number(oc.valor_total || 0)), "Emitente", emitenteNome ?? "—"],
      ["Observação", oc.observacao ?? "—", "Data", fmtDateTime()],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 80 },
      2: { fontStyle: "bold", cellWidth: 80 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 12,
    head: [["#", "Descrição", "Qtd", "Preço un.", "Total"]],
    body: itens.map((item, idx) => {
      const qtd = Number(item.quantidade || 0);
      const preco = Number(item.preco_unitario || 0);
      const total = Number(item.valor_total ?? qtd * preco);
      return [String(idx + 1), String(item.descricao ?? ""), fmtQtd(qtd), formatBRL(preco), formatBRL(total)];
    }),
    styles: { fontSize: 8, cellPadding: 3, valign: "top" },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      0: { cellWidth: 24, halign: "right" },
      2: { halign: "right", cellWidth: 70 },
      3: { halign: "right", cellWidth: 80 },
      4: { halign: "right", cellWidth: 80 },
    },
  });

  const y = (doc as any).lastAutoTable.finalY + 28;
  doc.setDrawColor(120);
  doc.line(40, y, 260, y);
  doc.line(335, y, 555, y);
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text("Compras / Emitente", 40, y + 12);
  doc.text("Fornecedor", 335, y + 12);
  doc.setTextColor(0);

  footer(doc, `OC #${numero} · ${obraNome ?? "Obra"}`);
  doc.save(`oc_${numero}_${fmtDateStamp()}.pdf`);
}

export function exportPedidoCotacaoToPDF(opts: {
  cotacao: AnyObj;
  requisicao: AnyObj;
  item?: AnyObj | null;
  obraNome?: string;
  fornecedores?: FornecedorPdf[];
  emitenteNome?: string;
  logoDataUrl?: string;
  institucionalLines?: string[];
}) {
  const { cotacao, requisicao, item, obraNome, fornecedores = [], emitenteNome, logoDataUrl, institucionalLines } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const numero = cotacao.numero ? String(cotacao.numero) : safe(cotacao.id).slice(0, 8).toUpperCase();
  const descricao = item?.descricao ?? requisicao.observacao ?? "Item";

  const startY = header(doc, `Pedido de Cotação ${numero}`, `Emitido pelo GestãObra em ${fmtDateTime()}`, logoDataUrl, institucionalLines);

  autoTable(doc, {
    startY,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    body: [
      ["Obra", obraNome ?? "—", "Solicitante", emitenteNome ?? "—"],
      ["Item", descricao, "Unidade", item?.unidade ?? "—"],
      ["Quantidade", fmtQtd(Number(requisicao.quantidade || 0)), "Status", String(cotacao.status ?? "—")],
      ["Observação", requisicao.observacao ?? "—", "Data", fmtDateTime()],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 80 },
      2: { fontStyle: "bold", cellWidth: 80 },
    },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 12,
    head: [["#", "Descrição", "Qtd", "Unidade", "Preço unitário", "Prazo", "Condição"]],
    body: [["1", descricao, fmtQtd(Number(requisicao.quantidade || 0)), item?.unidade ?? "—", "", "", ""]],
    styles: { fontSize: 8, cellPadding: 3, minCellHeight: 22 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: { 0: { cellWidth: 24, halign: "right" }, 2: { halign: "right" } },
  });

  if (fornecedores.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 14,
      head: [["Fornecedores destinatários", "Contato", "E-mail", "Telefone"]],
      body: fornecedores.map((f) => [
        f.razao_social ?? f.nome_fantasia ?? "—",
        f.contato ?? "—",
        f.email ?? "—",
        f.telefone ?? "—",
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  const y = (doc as any).lastAutoTable.finalY + 16;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Orientações ao fornecedor", 40, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    doc.splitTextToSize(
      "Preencher preço unitário, prazo de entrega e condição de pagamento. Responder citando o código do pedido de cotação.",
      515,
    ),
    40,
    y + 14,
  );

  footer(doc, `Pedido de Cotação ${numero} · ${obraNome ?? "Obra"}`);
  doc.save(`pedido_cotacao_${numero}_${fmtDateStamp()}.pdf`);
}