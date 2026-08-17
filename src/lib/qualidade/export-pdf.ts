/** @module-kind pure */
/**
 * PRO-029 · slice-01 — Relatório PDF de inspeção (cliente/auditoria).
 *
 * Pura (sem I/O de rede). Recebe dados já carregados e emite um PDF A4 com:
 * cabeçalho, identificação (obra/local/responsável/data), score + aprovação,
 * respostas agrupadas por seção, NCs abertas e rodapé com paginação.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { drawInstitucionalHeader } from "@/lib/pdf/header";
import type { ModeloTemplate, PerguntaTemplate } from "./modelos";
import type { InspecaoData } from "./offline";

/**
 * Loader opcional de imagem (slice-04). Recebe um `path` (foto ou assinatura)
 * e devolve um data URL (`data:image/...;base64,...`) para embed no PDF, ou
 * `null` se a imagem não puder ser carregada. Fica fora do módulo puro para
 * não acoplar a função a `supabase.storage` — a página chamadora injeta.
 */
export type CarregarImagemPdf = (path: string) => Promise<string | null>;

interface ExportOpts {
  modelo: ModeloTemplate;
  inspecao: InspecaoData;
  score: number;
  obraNome?: string;
  responsavelNome?: string;
  assinanteNome?: string;
  /** Se fornecido, embute miniaturas das fotos e a assinatura no PDF. */
  carregarImagem?: CarregarImagemPdf;
  /** Logotipo da empresa (data URL) — renderizado no topo, padrão RDO/BMS. */
  logoDataUrl?: string;
  /** PRO-031.slice-11 — linhas institucionais (razão social/CNPJ/contato). */
  institucionalLines?: string[];
}

const SEV_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

function respostaFormatada(
  p: PerguntaTemplate,
  r: InspecaoData["respostas"][string] | undefined,
): string {
  if (!r) return "—";
  if (r.conformidade)
    return r.conformidade === "sim" ? "Conforme" : r.conformidade === "nao" ? "Não conforme" : "N/A";
  if (r.resposta_opcao != null) return String(r.resposta_opcao);
  if (r.resposta_numero != null) return String(r.resposta_numero);
  if (r.resposta_texto != null) return r.resposta_texto;
  void p;
  return "—";
}

export async function exportInspecaoToPDF(opts: ExportOpts) {
  const { modelo, inspecao, score, obraNome, responsavelNome, assinanteNome, carregarImagem, logoDataUrl, institucionalLines } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // PRO-031.slice-12 — cabeçalho institucional via helper compartilhado.
  const startY = drawInstitucionalHeader(doc, {
    titulo: "Relatório de inspeção",
    subtitulo: `Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    logoDataUrl,
    institucionalLines,
    defaultStartY: 80,
  });

  const dataInsp = new Date();
  const aprovado =
    modelo.scoreMinimo !== undefined ? score >= modelo.scoreMinimo : null;

  // Identificação
  autoTable(doc, {
    startY,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    body: [
      ["Modelo", `${modelo.codigo} — ${modelo.nome}`, "Setor", String(modelo.setor ?? "—")],
      ["Obra", obraNome ?? "—", "Local", inspecao.local ?? "—"],
      [
        "Responsável",
        responsavelNome ?? "—",
        "Data",
        format(dataInsp, "dd/MM/yyyy HH:mm", { locale: ptBR }),
      ],
      [
        "Score",
        `${score.toFixed(0)}%` +
          (modelo.scoreMinimo != null ? ` (mín. ${modelo.scoreMinimo}%)` : ""),
        "Situação",
        aprovado == null ? "—" : aprovado ? "Aprovado" : "Reprovado",
      ],
      ["Status", inspecao.status, "NCs", String(inspecao.ncs.length)],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 90 },
      2: { fontStyle: "bold", cellWidth: 90 },
    },
  });

  // Agrupa perguntas por grupo (na ordem do template)
  const grupos = new Map<string, PerguntaTemplate[]>();
  for (const p of modelo.perguntas) {
    const k = p.grupo ?? "Geral";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(p);
  }

  const respPorTempId = new Map(
    Object.values(inspecao.respostas).map((r) => [r.perguntaTempId, r]),
  );

  for (const [grupo, itens] of grupos.entries()) {
    let y = (doc as any).lastAutoTable.finalY + 14;
    if (y > pageH - 120) {
      doc.addPage();
      y = 50;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(grupo, 40, y);

    autoTable(doc, {
      startY: y + 6,
      head: [["#", "Pergunta", "Resposta", "Obs."]],
      body: itens.map((p, i) => {
        const r = respPorTempId.get(p.tempId);
        return [
          String(i + 1),
          p.texto,
          respostaFormatada(p, r),
          r?.observacao ?? "",
        ];
      }),
      styles: { fontSize: 8, cellPadding: 3, valign: "top" },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 24, halign: "right" },
        1: { cellWidth: 260 },
        2: { cellWidth: 90 },
      },
    });
  }

  // NCs
  if (inspecao.ncs.length > 0) {
    let y = (doc as any).lastAutoTable.finalY + 14;
    if (y > pageH - 120) {
      doc.addPage();
      y = 50;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Não conformidades", 40, y);
    autoTable(doc, {
      startY: y + 6,
      head: [["#", "Título", "Severidade"]],
      body: inspecao.ncs.map((n, i) => [
        String(i + 1),
        n.titulo,
        SEV_LABEL[n.severidade] ?? n.severidade,
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [220, 38, 38] },
      columnStyles: { 0: { cellWidth: 24, halign: "right" }, 2: { cellWidth: 80 } },
    });
  }

  // Índice de evidências fotográficas (slice-03)
  // Lista fotos anexadas às respostas, agrupadas por pergunta/grupo.
  // Não incorpora binários — apenas referências (path + legenda) para
  // rastreabilidade quando o PDF for arquivado junto do bucket de mídias.
  if (inspecao.fotos.length > 0) {
    let y = (doc as any).lastAutoTable.finalY + 14;
    if (y > pageH - 120) {
      doc.addPage();
      y = 50;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Evidências fotográficas (${inspecao.fotos.length})`, 40, y);

    // resposta.id → pergunta correspondente
    const perguntaPorResposta = new Map<string, PerguntaTemplate>();
    for (const r of Object.values(inspecao.respostas)) {
      const p = modelo.perguntas.find((q) => q.tempId === r.perguntaTempId);
      if (p) perguntaPorResposta.set(r.id, p);
    }

    autoTable(doc, {
      startY: y + 6,
      head: [["#", "Grupo", "Pergunta", "Arquivo", "Legenda"]],
      body: inspecao.fotos.map((f, i) => {
        const p = perguntaPorResposta.get(f.respostaId);
        return [
          String(i + 1),
          p?.grupo ?? "—",
          p?.texto ?? "—",
          f.path,
          f.legenda ?? "",
        ];
      }),
      styles: { fontSize: 8, cellPadding: 3, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: [16, 185, 129] },
      columnStyles: {
        0: { cellWidth: 24, halign: "right" },
        1: { cellWidth: 80 },
        2: { cellWidth: 180 },
        3: { cellWidth: 130 },
      },
    });
  }

  // Miniaturas embutidas (slice-04) — só quando o chamador injeta `carregarImagem`.
  // Loader falho em uma foto não interrompe as demais.
  if (carregarImagem && inspecao.fotos.length > 0) {
    let y = (doc as any).lastAutoTable.finalY + 14;
    if (y > pageH - 160) {
      doc.addPage();
      y = 50;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Miniaturas", 40, y);
    y += 12;

    const thumbW = 120;
    const thumbH = 90;
    const gap = 10;
    let x = 40;
    for (const [i, f] of inspecao.fotos.entries()) {
      let dataUrl: string | null = null;
      try {
        dataUrl = await carregarImagem(f.path);
      } catch {
        dataUrl = null;
      }
      if (!dataUrl) continue;
      if (x + thumbW > pageW - 40) {
        x = 40;
        y += thumbH + 22;
      }
      if (y + thumbH > pageH - 40) {
        doc.addPage();
        x = 40;
        y = 50;
      }
      try {
        const fmt = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl)?.[1]?.toUpperCase() ?? "PNG";
        doc.addImage(dataUrl, fmt === "JPG" ? "JPEG" : (fmt as any), x, y, thumbW, thumbH);
      } catch {
        continue;
      }
      doc.setFontSize(7);
      doc.setTextColor(90);
      doc.text(`#${i + 1}`, x, y + thumbH + 10);
      doc.setTextColor(0);
      x += thumbW + gap;
    }
    (doc as any).lastAutoTable = { finalY: y + thumbH };
  }

  // Observação geral + assinatura
  {
    let y = (doc as any).lastAutoTable.finalY + 14;
    if (y > pageH - 140) {
      doc.addPage();
      y = 50;
    }
    if (inspecao.observacao) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Observação geral", 40, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const linhas = doc.splitTextToSize(inspecao.observacao, pageW - 80);
      doc.text(linhas, 40, y + 14);
      y += 14 + linhas.length * 11;
    }
    if (assinanteNome || inspecao.assinatura_path) {
      y += 20;
      // Embed opcional da assinatura acima da linha
      if (carregarImagem && inspecao.assinatura_path) {
        try {
          const dataUrl = await carregarImagem(inspecao.assinatura_path);
          if (dataUrl) {
            const fmt = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl)?.[1]?.toUpperCase() ?? "PNG";
            doc.addImage(dataUrl, fmt === "JPG" ? "JPEG" : (fmt as any), 40, y - 50, 220, 50);
          }
        } catch {
          /* silencia — cai no fallback textual */
        }
      }
      doc.setDrawColor(120);
      doc.line(40, y, 260, y);
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(assinanteNome ?? "Assinatura do responsável", 40, y + 12);
      doc.setTextColor(0);
    }
  }

  // Paginação
  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `${modelo.codigo} · ${modelo.nome}${obraNome ? ` · ${obraNome}` : ""}`,
      40,
      pageH - 20,
    );
    doc.text(`Página ${i} de ${total}`, pageW - 40, pageH - 20, { align: "right" });
  }

  const stamp = format(new Date(), "yyyyMMdd_HHmm");
  doc.save(`inspecao_${modelo.codigo}_${stamp}.pdf`);
}
