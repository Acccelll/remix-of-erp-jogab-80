/** @module-kind pure */
/**
 * Parsers para NFS-e (padrão Ginfes e similares).
 * Suporta XML e PDF (texto extraído via pdfjs-dist).
 */

export type NfseExtracted = {
  numero?: string;
  codigo_verificacao?: string;
  data_emissao?: string; // YYYY-MM-DD
  competencia?: string; // YYYY-MM-DD
  valor?: number;
  iss_retido?: number;
  inss_retido?: number;
  aliquota_iss?: number;
  aliquota_inss?: number;
  percentual_material?: number;
  valor_liquido?: number;
  codigo_cno?: string;
  codigo_art?: string;
  tomador_cnpj?: string;
  tomador_nome?: string;
  discriminacao?: string;
  _source: "xml" | "pdf";
  _filledFields: string[];
};

function parseBrNumber(s: string | null | undefined): number | undefined {
  if (!s) return undefined;
  const cleaned = s.trim().replace(/\s/g, "");
  // Formato BR "1.234,56" ou já "1234.56"
  let n: number;
  if (cleaned.includes(",")) {
    n = Number(cleaned.replace(/\./g, "").replace(",", "."));
  } else {
    n = Number(cleaned);
  }
  return Number.isFinite(n) ? n : undefined;
}

function brDateToIso(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
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

function textOf(root: Element | Document, localName: string): string | undefined {
  const el = findEl(root, localName);
  return el?.textContent?.trim() || undefined;
}

export function parseNfseXml(xml: string): NfseExtracted {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const out: NfseExtracted = { _source: "xml", _filledFields: [] };
  const set = <K extends keyof NfseExtracted>(k: K, v: NfseExtracted[K]) => {
    if (v !== undefined && v !== null && v !== "") {
      (out as any)[k] = v;
      out._filledFields.push(k as string);
    }
  };

  set("numero", textOf(doc, "Numero"));
  set("codigo_verificacao", textOf(doc, "CodigoVerificacao"));

  const emissao = textOf(doc, "DataEmissao");
  if (emissao) set("data_emissao", emissao.slice(0, 10));
  const comp = textOf(doc, "Competencia");
  if (comp) set("competencia", comp.slice(0, 10));

  set("valor", parseBrNumber(textOf(doc, "ValorServicos")));
  set("iss_retido", parseBrNumber(textOf(doc, "ValorIssRetido") ?? textOf(doc, "ValorIss")));
  set("inss_retido", parseBrNumber(textOf(doc, "ValorInss") ?? textOf(doc, "ValorPis")));
  set("valor_liquido", parseBrNumber(textOf(doc, "ValorLiquidoNfse")));

  const aliq = parseBrNumber(textOf(doc, "Aliquota"));
  if (aliq !== undefined) {
    // Ginfes envia 0.0500 (fração) — converter para 5
    set("aliquota_iss", aliq <= 1 ? aliq * 100 : aliq);
  }

  set("codigo_cno", textOf(doc, "CodigoObra"));
  set("codigo_art", textOf(doc, "Art"));

  // Tomador
  const tomador = findEl(doc, "TomadorServico");
  if (tomador) {
    set("tomador_cnpj", textOf(tomador, "Cnpj"));
    set("tomador_nome", textOf(tomador, "RazaoSocial"));
  }

  const discriminacao = textOf(doc, "Discriminacao");
  if (discriminacao) {
    set("discriminacao", discriminacao);
    enrichFromDiscriminacao(discriminacao, out);
  }

  return out;
}

function enrichFromDiscriminacao(text: string, out: NfseExtracted) {
  const push = (k: keyof NfseExtracted, v: any) => {
    if (v !== undefined && (out as any)[k] === undefined) {
      (out as any)[k] = v;
      out._filledFields.push(k as string);
    }
  };
  const matMat = text.match(/MATERIAL[^()\n]*\((\d+(?:[.,]\d+)?)\s*%\)/i);
  if (matMat) push("percentual_material", parseBrNumber(matMat[1]));
  const inssMat = text.match(
    /RETEN[ÇC][ÃA]O\s+PREVIDENCI[ÁA]RIA[^%]*?(\d+(?:[.,]\d+)?)\s*%[^R$]*R?\$?\s*([\d.,]+)/i,
  );
  if (inssMat) {
    const aliq = parseBrNumber(inssMat[1]);
    const base = parseBrNumber(inssMat[2]);
    if (aliq !== undefined) push("aliquota_inss", aliq);
    if (aliq !== undefined && base !== undefined) push("inss_retido", (aliq / 100) * base);
  }
}

export function parseNfsePdfText(text: string): NfseExtracted {
  const out: NfseExtracted = { _source: "pdf", _filledFields: [] };
  const set = <K extends keyof NfseExtracted>(k: K, v: NfseExtracted[K]) => {
    if (v !== undefined && v !== null && v !== "" && (out as any)[k] === undefined) {
      (out as any)[k] = v;
      out._filledFields.push(k as string);
    }
  };
  const norm = text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");

  const reFind = (re: RegExp) => norm.match(re)?.[1]?.trim();

  set("numero", reFind(/N[úu]mero\s+da\s+NFS-?e\s*[:\-]?\s*(\d+)/i));
  set("codigo_verificacao", reFind(/C[óo]digo\s+de\s+Verifica[çc][ãa]o\s*[:\-]?\s*([A-Z0-9]+)/i));
  set(
    "data_emissao",
    brDateToIso(reFind(/Data\s+e?\s*Hora?\s+da?\s+Emiss[ãa]o\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i)),
  );
  set("competencia", brDateToIso(reFind(/Compet[êe]ncia\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)));
  set("valor", parseBrNumber(reFind(/Valor\s+dos\s+Servi[çc]os\s*R?\$?\s*([\d.,]+)/i)));
  set(
    "iss_retido",
    parseBrNumber(
      reFind(/ISS\s+Retido\s*[:\-]?\s*([\d.,]+)/i) ??
        reFind(/Valor\s+do\s+ISS\s*:?\s*R?\$?\s*([\d.,]+)/i),
    ),
  );
  set("valor_liquido", parseBrNumber(reFind(/Valor\s+L[íi]quido\s*R?\$?\s*([\d.,]+)/i)));
  set("aliquota_iss", parseBrNumber(reFind(/Al[íi]quota\s*%?\s*([\d.,]+)/i)));
  set("codigo_cno", reFind(/C[óo]digo\s+da\s+Obra\s*[:\-]?\s*(\d+)/i));
  set("codigo_art", reFind(/C[óo]digo\s+ART\s*[:\-]?\s*(\d+)/i));

  // Discriminação heurística
  const discMat = norm.match(
    /Discrimina[çc][ãa]o\s+dos\s+Servi[çc]os\s*([\s\S]{0,800}?)(?:C[óo]digo\s+do\s+Servi[çc]o|Tributos\s+Federais|Detalhamento)/i,
  );
  if (discMat) {
    set("discriminacao", discMat[1].trim());
    enrichFromDiscriminacao(discMat[1], out);
  } else {
    enrichFromDiscriminacao(norm, out);
  }

  // Tomador (heurística)
  const tomMat = norm.match(
    /Dados\s+do\s+Tomador[\s\S]{0,500}?Raz[ãa]o\s+Social\/?Nome\s+([^\n]+?)\s+CNPJ\/?CPF\s+([\d./\-]+)/i,
  );
  if (tomMat) {
    set("tomador_nome", tomMat[1].trim());
    set("tomador_cnpj", tomMat[2].replace(/[^\d]/g, ""));
  }

  return out;
}

/** Extrai texto de um File PDF usando pdfjs-dist (browser). */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib: any = await import("pdfjs-dist");
  // Worker via URL Vite
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  let full = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strs = content.items.map((it: any) => it.str);
    full += strs.join(" ") + "\n";
  }
  return full;
}

/** Dispatcher: detecta XML ou PDF e retorna campos extraídos. */
export async function parseNfseFile(file: File): Promise<NfseExtracted> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xml") || file.type.includes("xml")) {
    const txt = await file.text();
    return parseNfseXml(txt);
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const text = await extractPdfText(file);
    return parseNfsePdfText(text);
  }
  throw new Error("Formato não suportado. Envie um PDF ou XML da NFS-e.");
}
