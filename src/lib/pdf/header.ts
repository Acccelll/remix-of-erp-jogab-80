/** @module-kind pure */
/**
 * PRO-031 · slice-12 — Helper compartilhado de cabeçalho institucional para PDFs.
 *
 * Consolida a lógica repetida em 5 exports (RDO, Obra, Inspeção, OC, Cotação, BMS):
 *  - Renderiza logotipo 48×48pt (best-effort, ignora erros silenciosamente).
 *  - Desenha título (16pt bold) e subtítulo (10pt cinza) deslocados quando há logo.
 *  - Desenha linhas institucionais (8pt cinza) abaixo do subtítulo.
 *  - Retorna o `startY` seguro para a primeira `autoTable` do documento.
 *
 * Puro (não depende de estado local nem de `window`). Recebe apenas o `doc`
 * e as opções — o chamador continua responsável por prover `logoDataUrl` e
 * `institucionalLines` já resolvidos (via `empresaParametrizacaoRepo` /
 * `getInstitucionalHeaderLines`).
 */
import type jsPDF from "jspdf";

export interface DrawInstitucionalHeaderOpts {
  titulo: string;
  subtitulo?: string;
  logoDataUrl?: string;
  institucionalLines?: string[];
  /** Y padrão da primeira tabela quando não há linhas institucionais. Padrão: 82. */
  defaultStartY?: number;
  /** Y do topo do logo. Padrão: 24. */
  logoTop?: number;
}

function inferImageFormat(dataUrl: string): "JPEG" | "PNG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")
    ? "JPEG"
    : "PNG";
}

/**
 * Desenha o cabeçalho institucional padrão do GestãObra e devolve o
 * `startY` que a primeira `autoTable` deve usar.
 */
export function drawInstitucionalHeader(
  doc: jsPDF,
  opts: DrawInstitucionalHeaderOpts,
): number {
  const {
    titulo,
    subtitulo,
    logoDataUrl,
    institucionalLines,
    defaultStartY = 82,
    logoTop = 24,
  } = opts;

  let titleX = 40;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, inferImageFormat(logoDataUrl), 40, logoTop, 48, 48);
      titleX = 100;
    } catch {
      /* logo inválido: mantém título à esquerda */
    }
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, titleX, 50);

  if (subtitulo) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(subtitulo, titleX, 65);
    doc.setTextColor(0);
  }

  const filtered = (institucionalLines ?? []).filter((s) => s && s.trim().length > 0);
  if (filtered.length === 0) return defaultStartY;
  const iy = drawInstitucionalLines(doc, {
    lines: filtered,
    x: titleX,
    startY: subtitulo ? 77 : 65,
  });
  return iy + 2;
}

export interface DrawInstitucionalLinesOpts {
  lines: string[];
  x: number;
  startY: number;
  align?: "left" | "center" | "right";
  /** Espaçamento entre linhas (pt). Padrão: 10. */
  lineHeight?: number;
  /** Cor cinza padrão (0-255). Padrão: 110. */
  color?: number;
}

/**
 * Desenha um bloco de linhas institucionais (fonte pequena, cinza) a partir
 * de `startY` e devolve o `y` final (após a última linha). Reutilizado pelo
 * BMS (centralizado, landscape) e pelo `drawInstitucionalHeader` (alinhado
 * à esquerda). Filtra strings vazias/brancas.
 */
export function drawInstitucionalLines(
  doc: jsPDF,
  opts: DrawInstitucionalLinesOpts,
): number {
  const { lines, x, startY, align = "left", lineHeight = 10, color = 110 } = opts;
  const filtered = lines.filter((s) => s && s.trim().length > 0);
  if (filtered.length === 0) return startY;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(color);
  let iy = startY;
  for (const line of filtered) {
    doc.text(line, x, iy, align === "left" ? undefined : { align });
    iy += lineHeight;
  }
  doc.setTextColor(0);
  return iy;
}

