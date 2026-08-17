/** @module-kind pure */
/**
 * Compressão de imagem para uso de campo (OFF.1).
 *
 * Foto crua de canteiro é grande e mata o upload offline-first em rede ruim.
 * Antes de `enqueueMedia`, reduz: máx ~1600px (lado maior) e qualidade ~0.7,
 * sempre re-encodando como JPEG. Mantém a orientação visível (o canvas já
 * desenha o bitmap rotacionado quando o browser respeita EXIF — Chromium e
 * Safari recentes o fazem para `createImageBitmap` + `<img>`).
 *
 * O cálculo de dimensões é puro (`fitDimensions`) e tem teste unitário; a
 * função `compressImage` precisa de DOM (Image/Canvas) e é exercida em
 * runtime — ao falhar ou rodar fora de browser, devolve o blob original
 * para não bloquear o fluxo.
 */
export interface CompressOptions {
  /** Maior lado em pixels. Padrão 1600. */
  maxDimension?: number;
  /** Qualidade JPEG 0..1. Padrão 0.72. */
  quality?: number;
  /** Tipo de saída. Padrão "image/jpeg". */
  mimeType?: "image/jpeg" | "image/webp";
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.72,
  mimeType: "image/jpeg",
};

/** Cálculo puro de redimensionamento mantendo proporção. */
export function fitDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  if (maxDimension <= 0) return { width, height };
  const maior = Math.max(width, height);
  if (maior <= maxDimension) return { width, height };
  const fator = maxDimension / maior;
  return {
    width: Math.max(1, Math.round(width * fator)),
    height: Math.max(1, Math.round(height * fator)),
  };
}

/** Heurística: vale a pena comprimir? (file de imagem e > 200KB) */
export function shouldCompress(file: File | Blob): boolean {
  const tipo = file.type || "";
  if (!tipo.startsWith("image/")) return false;
  if (tipo === "image/gif") return false; // perde animação
  if (tipo === "image/svg+xml") return false; // vetorial
  return file.size > 200 * 1024;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao decodificar imagem"));
    };
    img.src = url;
  });
}

/**
 * Comprime imagem. Em caso de erro/ambiente sem DOM, devolve o blob original.
 * Nunca bloqueia o upload — perder qualidade é OK, perder a foto não é.
 */
export async function compressImage(
  file: File | Blob,
  options: CompressOptions = {},
): Promise<Blob> {
  const opts = { ...DEFAULTS, ...options };
  if (!shouldCompress(file)) return file;
  if (typeof document === "undefined" || typeof HTMLCanvasElement === "undefined") {
    return file;
  }
  try {
    const img = await loadImage(file);
    const dims = fitDimensions(img.naturalWidth, img.naturalHeight, opts.maxDimension);
    if (dims.width === 0 || dims.height === 0) return file;
    const canvas = document.createElement("canvas");
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, dims.width, dims.height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), opts.mimeType, opts.quality),
    );
    if (!blob) return file;
    // Se ficou maior que o original (raro), devolve o original.
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
