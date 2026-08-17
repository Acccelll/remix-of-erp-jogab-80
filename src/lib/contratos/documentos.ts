/** @module-kind pure */

export type StatusAssinaturaContrato = "pendente" | "enviado" | "assinado" | "dispensado";

export interface ContratoDocumento {
  id: string;
  contratoId: string;
  nomeArquivo: string;
  mime: string;
  tamanho: number;
  versao: number;
  dataUpload: string;
  usuario: string;
  statusAssinatura: StatusAssinaturaContrato;
  dataUrl: string;
  observacao?: string;
  /** PRO-021 · slice-02 — validade do documento (ISO). Ex.: garantia, apólice. */
  validoAte?: string;
}

export interface NovoContratoDocumentoInput {
  contratoId: string;
  nomeArquivo: string;
  mime: string;
  tamanho: number;
  dataUrl: string;
  usuario: string;
  agora?: string;
  validoAte?: string;
}

export function proximaVersaoDocumento(
  documentos: Pick<ContratoDocumento, "contratoId" | "nomeArquivo" | "versao">[],
  contratoId: string,
  nomeArquivo: string,
): number {
  const alvo = normalizarNome(nomeArquivo);
  const max = documentos
    .filter((d) => d.contratoId === contratoId && normalizarNome(d.nomeArquivo) === alvo)
    .reduce((acc, d) => Math.max(acc, d.versao || 0), 0);
  return max + 1;
}

export function criarRegistroDocumento(
  existentes: ContratoDocumento[],
  input: NovoContratoDocumentoInput,
): ContratoDocumento {
  return {
    id: crypto.randomUUID(),
    contratoId: input.contratoId,
    nomeArquivo: input.nomeArquivo,
    mime: input.mime || "application/octet-stream",
    tamanho: input.tamanho,
    versao: proximaVersaoDocumento(existentes, input.contratoId, input.nomeArquivo),
    dataUpload: input.agora ?? new Date().toISOString(),
    usuario: input.usuario || "Sistema",
    statusAssinatura: "pendente",
    dataUrl: input.dataUrl,
    validoAte: input.validoAte,
  };
}

/**
 * PRO-021 · slice-02 — Documentos com validade a expirar em até `dias`
 * (ou já expirados). Ignora documentos sem `validoAte`.
 */
export interface DocumentoVencendo {
  documento: ContratoDocumento;
  diasRestantes: number; // negativo = vencido
  situacao: "vencido" | "hoje" | "proximo";
}

export function documentosContratoVencendo(
  documentos: ContratoDocumento[],
  dias = 30,
  hoje: Date = new Date(),
): DocumentoVencendo[] {
  const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const out: DocumentoVencendo[] = [];
  for (const d of documentos) {
    if (!d.validoAte) continue;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.validoAte);
    if (!m) continue;
    const alvo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const diff = Math.round((alvo - hojeUtc) / 86_400_000);
    if (diff > dias) continue;
    out.push({
      documento: d,
      diasRestantes: diff,
      situacao: diff < 0 ? "vencido" : diff === 0 ? "hoje" : "proximo",
    });
  }
  return out.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

export function documentosDoContrato(
  documentos: ContratoDocumento[],
  contratoId: string,
): ContratoDocumento[] {
  return documentos
    .filter((d) => d.contratoId === contratoId)
    .sort((a, b) => {
      const byName = a.nomeArquivo.localeCompare(b.nomeArquivo, "pt-BR");
      if (byName !== 0) return byName;
      return b.versao - a.versao;
    });
}

export function resumoDocumental(documentos: ContratoDocumento[]) {
  const total = documentos.length;
  const assinados = documentos.filter((d) => d.statusAssinatura === "assinado").length;
  const pendentes = documentos.filter((d) => d.statusAssinatura === "pendente").length;
  const enviados = documentos.filter((d) => d.statusAssinatura === "enviado").length;
  return { total, assinados, pendentes, enviados };
}

function normalizarNome(nome: string): string {
  return nome.trim().toLocaleLowerCase("pt-BR");
}
