/** @module-kind pure */
// Helpers para extrair referências de obra / BMS / pedido a partir do texto
// livre que aparece em discriminação de NFS-e e nas planilhas de faturamento.

const RE_OBRA = /\|\s*OBRA\s*(\d{2,5})\s*\|/i;
const RE_OBRA_LIVRE = /\bOBRA\s+(\d{3,5})\b/i;
const RE_BMS = /\bBMS\s*0*(\d{1,3})\b/i;
const RE_PEDIDO = /\bPEDIDO[:\s]+([A-Z0-9\-./]+)/i;

export function extrairObraDaDiscriminacao(texto: string): string | null {
  if (!texto) return null;
  const m = texto.match(RE_OBRA);
  if (m) return m[1];
  const m2 = texto.match(RE_OBRA_LIVRE);
  if (m2) return m2[1];
  return null;
}

export function extrairBmsEPedido(texto: string): { numero_bms?: string; pedido?: string } {
  const out: { numero_bms?: string; pedido?: string } = {};
  if (!texto) return out;
  const b = texto.match(RE_BMS);
  if (b) out.numero_bms = String(parseInt(b[1], 10));
  const p = texto.match(RE_PEDIDO);
  if (p) out.pedido = p[1];
  return out;
}
