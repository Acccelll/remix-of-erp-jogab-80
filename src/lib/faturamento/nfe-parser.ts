/** @module-kind pure */
/**
 * Parser para NF-e de entrada (compra de fornecedor) — padrão nacional
 * SEFAZ, distinto do parser de NFS-e (nfse-parser.ts): schema de XML
 * diferente (infNFe/chNFe/det/prod em vez de tags municipais), com chave
 * de acesso de 44 dígitos, que NFS-e não tem.
 */

export type NfeItemExtracted = {
  descricao: string;
  codigo?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total?: number;
};

export type NfeExtracted = {
  chave_acesso?: string; // 44 dígitos
  numero?: string;
  serie?: string;
  data_emissao?: string; // YYYY-MM-DD
  cnpj_emitente?: string;
  nome_emitente?: string;
  cnpj_destinatario?: string;
  valor_total?: number;
  status_sefaz_codigo?: string;
  status_sefaz_motivo?: string;
  itens: NfeItemExtracted[];
  _filledFields: string[];
};

function parseBrNumber(s: string | null | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s.trim());
  return Number.isFinite(n) ? n : undefined;
}

/** Procura recursivamente por elementos cujo localName casa (case-insensitive). */
function findEl(root: Element | Document, localName: string): Element | null {
  const target = localName.toLowerCase();
  const walker = (root as Element).getElementsByTagName
    ? (root as any).getElementsByTagName("*")
    : [];
  for (const el of walker as HTMLCollectionOf<Element>) {
    if (el.localName?.toLowerCase() === target) return el;
  }
  return null;
}

function findAll(root: Element | Document, localName: string): Element[] {
  const target = localName.toLowerCase();
  const walker = (root as Element).getElementsByTagName
    ? (root as any).getElementsByTagName("*")
    : [];
  const out: Element[] = [];
  for (const el of walker as HTMLCollectionOf<Element>) {
    if (el.localName?.toLowerCase() === target) out.push(el);
  }
  return out;
}

function textOf(root: Element | Document, localName: string): string | undefined {
  const el = findEl(root, localName);
  return el?.textContent?.trim() || undefined;
}

/** Extrai a chave de acesso (44 dígitos) do atributo Id de infNFe (formato "NFe<44 dígitos>"). */
function chaveDoAtributoId(doc: Document): string | undefined {
  const infNFe = findEl(doc, "infNFe");
  const id = infNFe?.getAttribute("Id") ?? infNFe?.getAttribute("id");
  if (!id) return undefined;
  const digits = id.replace(/\D/g, "");
  return digits.length === 44 ? digits : undefined;
}

/** Valida dígito verificador (módulo 11) da chave de acesso de 44 dígitos. */
export function validarChaveAcesso(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  const corpo = chave.slice(0, 43);
  const dvInformado = Number(chave[43]);
  let peso = 2;
  let soma = 0;
  for (let i = corpo.length - 1; i >= 0; i--) {
    soma += Number(corpo[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dvCalculado = resto < 2 ? 0 : 11 - resto;
  return dvCalculado === dvInformado;
}

/** Decompõe a chave de acesso nos seus componentes (UF, data, CNPJ emitente, modelo, série, número, tpEmis, cNF, DV). */
export function decomporChaveAcesso(chave: string): {
  uf: string;
  anoMes: string;
  cnpjEmitente: string;
  modelo: string;
  serie: string;
  numero: string;
  tipoEmissao: string;
  codigoNumerico: string;
  digitoVerificador: string;
} | null {
  if (!/^\d{44}$/.test(chave)) return null;
  return {
    uf: chave.slice(0, 2),
    anoMes: chave.slice(2, 6),
    cnpjEmitente: chave.slice(6, 20),
    modelo: chave.slice(20, 22),
    serie: chave.slice(22, 25),
    numero: chave.slice(25, 34),
    tipoEmissao: chave.slice(34, 35),
    codigoNumerico: chave.slice(35, 43),
    digitoVerificador: chave.slice(43, 44),
  };
}

export function parseNfeXml(xml: string): NfeExtracted {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const out: NfeExtracted = { itens: [], _filledFields: [] };
  const set = <K extends keyof NfeExtracted>(k: K, v: NfeExtracted[K]) => {
    if (v !== undefined && v !== null && v !== "") {
      (out as any)[k] = v;
      out._filledFields.push(k as string);
    }
  };

  const chaveId = chaveDoAtributoId(doc);
  const chaveProt = textOf(doc, "chNFe");
  set("chave_acesso", chaveId ?? chaveProt);

  const ide = findEl(doc, "ide");
  if (ide) {
    set("numero", textOf(ide, "nNF"));
    set("serie", textOf(ide, "serie"));
    const dhEmi = textOf(ide, "dhEmi") ?? textOf(ide, "dEmi");
    if (dhEmi) set("data_emissao", dhEmi.slice(0, 10));
  }

  const emit = findEl(doc, "emit");
  if (emit) {
    set("cnpj_emitente", textOf(emit, "CNPJ"));
    set("nome_emitente", textOf(emit, "xNome"));
  }

  const dest = findEl(doc, "dest");
  if (dest) {
    set("cnpj_destinatario", textOf(dest, "CNPJ"));
  }

  const icmsTot = findEl(doc, "ICMSTot");
  if (icmsTot) set("valor_total", parseBrNumber(textOf(icmsTot, "vNF")));

  const infProt = findEl(doc, "infProt");
  if (infProt) {
    set("status_sefaz_codigo", textOf(infProt, "cStat"));
    set("status_sefaz_motivo", textOf(infProt, "xMotivo"));
  }

  for (const det of findAll(doc, "det")) {
    const prod = findEl(det, "prod");
    if (!prod) continue;
    const quantidade = parseBrNumber(textOf(prod, "qCom")) ?? 0;
    const valor_unitario = parseBrNumber(textOf(prod, "vUnCom")) ?? 0;
    if (quantidade <= 0) continue;
    out.itens.push({
      descricao: textOf(prod, "xProd") ?? "(sem descrição)",
      codigo: textOf(prod, "cProd"),
      quantidade,
      valor_unitario,
      valor_total: parseBrNumber(textOf(prod, "vProd")),
    });
  }
  if (out.itens.length > 0) out._filledFields.push("itens");

  return out;
}

/** Dispatcher: valida extensão/tipo e delega ao parser de XML. */
export async function parseNfeFile(file: File): Promise<NfeExtracted> {
  const name = file.name.toLowerCase();
  if (!(name.endsWith(".xml") || file.type.includes("xml"))) {
    throw new Error("Formato não suportado. Envie o XML da NF-e.");
  }
  const txt = await file.text();
  return parseNfeXml(txt);
}
