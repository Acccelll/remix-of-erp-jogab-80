/** @module-kind pure */
// Parser específico para NFS-e padrão GISS/Abrasf usado pelo cliente.
// Extrai todos os campos relevantes para a tabela faturamento_nfse.

import { extrairObraDaDiscriminacao, extrairBmsEPedido } from "./vincular-obra";

export type NfseParsed = {
  numero_nfse: string;
  codigo_verificacao?: string;
  data_emissao?: string;
  competencia?: string;
  prestador_cnpj?: string;
  prestador_razao?: string;
  tomador_cnpj?: string;
  tomador_razao?: string;
  tomador_uf?: string;
  tomador_municipio?: string;
  municipio_prestacao?: string;
  item_lista_servico?: string;
  codigo_servico?: string;
  codigo_obra_interno?: string;
  codigo_obra?: string;
  numero_bms?: string;
  pedido?: string;
  discriminacao?: string;
  valor_servicos: number;
  deducoes: number;
  base_calculo: number;
  aliquota_iss: number;
  valor_iss: number;
  iss_retido: boolean;
  valor_inss: number;
  valor_ir: number;
  valor_csll: number;
  valor_pis: number;
  valor_cofins: number;
  outras_retencoes: number;
  valor_liquido: number;
  natureza_operacao?: string;
  arquivo_origem?: string;
};

function num(v: string | null | undefined): number {
  if (!v) return 0;
  const s = String(v).trim().replace(/\s/g, "");
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : 0;
}

function findEl(root: Element | Document, name: string): Element | null {
  const target = name.toLowerCase();
  const els = (root as any).getElementsByTagName?.("*") ?? [];
  for (const el of els as HTMLCollectionOf<Element>) {
    if (el.localName?.toLowerCase() === target) return el;
  }
  return null;
}

function txt(root: Element | Document, name: string): string | undefined {
  return findEl(root, name)?.textContent?.trim() || undefined;
}

export function parseNfseXmlFull(xml: string, arquivo?: string): NfseParsed | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return null;

  const numero = txt(doc, "Numero");
  if (!numero) return null;

  const prestador = findEl(doc, "PrestadorServico");
  const tomador = findEl(doc, "TomadorServico");
  const orgao = findEl(doc, "OrgaoGerador");
  const valores = findEl(doc, "Valores");

  const emissao = txt(doc, "DataEmissao")?.slice(0, 10);
  const comp = txt(doc, "Competencia")?.slice(0, 10);
  const discriminacao = txt(doc, "Discriminacao");

  const valor_iss = num(txt(valores ?? doc, "ValorIss"));
  const valor_servicos = num(txt(valores ?? doc, "ValorServicos"));
  const valor_liquido = num(txt(doc, "ValorLiquidoNfse"));
  const base_calculo = num(txt(doc, "BaseCalculo"));
  const aliquota_iss_raw = num(txt(valores ?? doc, "Aliquota"));
  const aliquota_iss =
    aliquota_iss_raw > 0 && aliquota_iss_raw <= 1 ? aliquota_iss_raw * 100 : aliquota_iss_raw;

  const issRetido = txt(doc, "IssRetido");

  const enderecoTom = tomador ? findEl(tomador, "Endereco") : null;
  const obraMatch = discriminacao ? extrairObraDaDiscriminacao(discriminacao) : null;
  const { numero_bms, pedido } = discriminacao
    ? extrairBmsEPedido(discriminacao)
    : { numero_bms: undefined, pedido: undefined };

  return {
    numero_nfse: numero,
    codigo_verificacao: txt(doc, "CodigoVerificacao"),
    data_emissao: emissao,
    competencia: comp,
    prestador_cnpj: prestador ? txt(prestador, "Cnpj") : undefined,
    prestador_razao: prestador ? txt(prestador, "RazaoSocial") : undefined,
    tomador_cnpj: tomador
      ? txt(tomador, "CpfCnpj") || txt(tomador, "Cnpj") || txt(tomador, "Cpf")
      : undefined,
    tomador_razao: tomador ? txt(tomador, "RazaoSocial") : undefined,
    tomador_uf: enderecoTom ? txt(enderecoTom, "Uf") : undefined,
    tomador_municipio: enderecoTom ? txt(enderecoTom, "CodigoMunicipio") : undefined,
    municipio_prestacao: orgao ? txt(orgao, "CodigoMunicipio") : undefined,
    item_lista_servico: txt(doc, "ItemListaServico"),
    codigo_servico: txt(doc, "CodigoTributacaoMunicipio"),
    codigo_obra_interno: undefined,
    codigo_obra: obraMatch ?? undefined,
    numero_bms,
    pedido,
    discriminacao,
    valor_servicos,
    deducoes: num(txt(valores ?? doc, "ValorDeducoes")),
    base_calculo: base_calculo || valor_servicos,
    aliquota_iss,
    valor_iss,
    iss_retido: issRetido === "1" || issRetido?.toLowerCase() === "sim",
    valor_inss: num(txt(valores ?? doc, "ValorInss")),
    valor_ir: num(txt(valores ?? doc, "ValorIr")),
    valor_csll: num(txt(valores ?? doc, "ValorCsll")),
    valor_pis: num(txt(valores ?? doc, "vPis")) || num(txt(valores ?? doc, "ValorPis")),
    valor_cofins: num(txt(valores ?? doc, "vCofins")) || num(txt(valores ?? doc, "ValorCofins")),
    outras_retencoes: num(txt(valores ?? doc, "OutrasRetencoes")),
    valor_liquido: valor_liquido || valor_servicos - valor_iss,
    natureza_operacao: undefined,
    arquivo_origem: arquivo,
  };
}
