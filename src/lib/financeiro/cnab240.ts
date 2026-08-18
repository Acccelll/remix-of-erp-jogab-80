/** @module-kind pure */
/**
 * Gerador de remessa e parser de retorno CNAB 240 (padrão FEBRABAN),
 * escopo: pagamento a fornecedor por crédito em conta corrente (Segmento A).
 *
 * ATENÇÃO — LEIA ANTES DE USAR EM PRODUÇÃO:
 * O layout comum de Header/Trailer de Arquivo e de Lote segue a
 * especificação FEBRABAN documentada publicamente, replicada aqui de
 * memória (sem acesso a um manual oficial ou a um banco real nesta sessão).
 * Cada linha gerada é validada estruturalmente (exatamente 240 caracteres),
 * o que pega erros de tamanho, mas НЕ garante que cada campo individual
 * esteja no código exato que o SEU banco/convênio espera — em especial:
 * forma de lançamento (hoje fixo em "01", crédito em conta — pode precisar
 * ser "41"/TED dependendo do banco), tipo de serviço, e versão de layout de
 * lote. Antes de transmitir uma remessa real, valide linha a linha contra o
 * manual do banco usado. Não foi testado contra nenhum banco real.
 */

type CampoTipo = "num" | "alfa";

function campo(valor: string | number | null | undefined, largura: number, tipo: CampoTipo): string {
  if (tipo === "num") {
    const digits = String(valor ?? "").replace(/\D/g, "");
    return digits.padStart(largura, "0").slice(-largura);
  }
  const semAcento = String(valor ?? "")
    .toUpperCase()
    .normalize("NFD")
    .split("")
    .filter((ch) => ch.charCodeAt(0) < 0x0300 || ch.charCodeAt(0) > 0x036f)
    .join(""); // remove diacríticos (NFD → marcas combinantes) — CNAB é ASCII
  return semAcento.slice(0, largura).padEnd(largura, " ");
}

function montarLinha(campos: string[]): string {
  const linha = campos.join("");
  if (linha.length !== 240) {
    throw new Error(`Linha CNAB240 com tamanho inválido: ${linha.length} (esperado 240)`);
  }
  return linha;
}

export type EmpresaCedente = {
  cnpj: string;
  nome: string;
  bancoCodigo: string;
  bancoNome: string;
  agencia: string;
  agenciaDv?: string;
  conta: string;
  contaDv?: string;
  convenio: string;
};

export type FavorecidoPagamento = {
  nome: string;
  documento: string; // CPF ou CNPJ
  bancoCodigo: string;
  agencia: string;
  agenciaDv?: string;
  conta: string;
  contaDv?: string;
  valor: number; // em reais
  nossoNumero: string;
  dataPagamento: Date;
};

function dataDDMMAAAA(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

function horaHHMMSS(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}${mi}${ss}`;
}

/** Valor em reais para centavos, sem separador (campo numérico CNAB). */
function valorCentavos(v: number, largura: number): string {
  const centavos = Math.round(v * 100);
  return campo(centavos, largura, "num");
}

function headerArquivo(empresa: EmpresaCedente, numeroSequencial: number, agora: Date): string {
  return montarLinha([
    campo(empresa.bancoCodigo, 3, "num"),
    campo("0", 4, "num"), // lote de serviço (0000 no header de arquivo)
    campo("0", 1, "num"), // tipo de registro: 0 = header de arquivo
    campo("", 9, "alfa"), // uso exclusivo FEBRABAN/CNAB
    campo("2", 1, "num"), // tipo de inscrição da empresa: 2 = CNPJ
    campo(empresa.cnpj, 14, "num"),
    campo(empresa.convenio, 20, "alfa"),
    campo(empresa.agencia, 5, "num"),
    campo(empresa.agenciaDv ?? "", 1, "alfa"),
    campo(empresa.conta, 12, "num"),
    campo(empresa.contaDv ?? "", 1, "alfa"),
    campo("", 1, "alfa"), // dv agência/conta
    campo(empresa.nome, 30, "alfa"),
    campo(empresa.bancoNome, 30, "alfa"),
    campo("", 10, "alfa"), // uso exclusivo FEBRABAN/CNAB
    campo("1", 1, "num"), // código remessa/retorno: 1 = remessa
    campo(dataDDMMAAAA(agora), 8, "num"),
    campo(horaHHMMSS(agora), 6, "num"),
    campo(numeroSequencial, 6, "num"),
    campo("103", 3, "num"), // nº da versão do layout do arquivo
    campo("", 5, "alfa"), // densidade de gravação
    campo("", 20, "alfa"), // uso reservado do banco
    campo("", 20, "alfa"), // uso reservado da empresa
    campo("", 29, "alfa"), // uso exclusivo FEBRABAN/CNAB
  ]);
}

function headerLote(empresa: EmpresaCedente): string {
  return montarLinha([
    campo(empresa.bancoCodigo, 3, "num"),
    campo("1", 4, "num"), // lote de serviço = 1 (único lote nesta implementação)
    campo("1", 1, "num"), // tipo de registro: 1 = header de lote
    campo("C", 1, "alfa"), // tipo de operação: C = crédito
    campo("20", 2, "num"), // tipo de serviço: 20 = pagamento a fornecedor
    campo("01", 2, "num"), // forma de lançamento: 01 = crédito em conta corrente — CONFIRMAR com o banco (pode ser 41/TED)
    campo("040", 3, "num"), // versão do layout do lote — CONFIRMAR com o banco
    campo("", 1, "alfa"),
    campo("2", 1, "num"), // tipo de inscrição: 2 = CNPJ
    campo(empresa.cnpj, 15, "num"), // largura 15 no header de lote (difere do header de arquivo)
    campo(empresa.convenio, 20, "alfa"),
    campo(empresa.agencia, 5, "num"),
    campo(empresa.agenciaDv ?? "", 1, "alfa"),
    campo(empresa.conta, 12, "num"),
    campo(empresa.contaDv ?? "", 1, "alfa"),
    campo("", 1, "alfa"),
    campo(empresa.nome, 30, "alfa"),
    campo("", 40, "alfa"), // mensagem 1
    campo("", 30, "alfa"), // logradouro do cedente (endereço) — não coletado, deixado em branco
    campo("", 5, "alfa"),
    campo("", 15, "alfa"),
    campo("", 20, "alfa"),
    campo("BR", 2, "alfa"),
    campo("", 25, "alfa"), // uso exclusivo FEBRABAN/CNAB (complemento de registro)
  ]);
}

function segmentoA(empresa: EmpresaCedente, fav: FavorecidoPagamento, numeroRegistroLote: number): string {
  return montarLinha([
    campo(empresa.bancoCodigo, 3, "num"),
    campo("1", 4, "num"),
    campo("3", 1, "num"), // tipo de registro: 3 = detalhe
    campo(numeroRegistroLote, 5, "num"),
    campo("A", 1, "alfa"), // código do segmento
    campo("0", 1, "num"), // tipo de movimento: 0 = inclusão
    campo("00", 2, "num"), // código da instrução para movimento
    campo("", 3, "alfa"), // câmara centralizadora de compensação — não utilizada
    campo(fav.bancoCodigo, 3, "num"), // banco favorecido
    campo(fav.agencia, 5, "num"),
    campo(fav.agenciaDv ?? "", 1, "alfa"),
    campo(fav.conta, 12, "num"),
    campo(fav.contaDv ?? "", 1, "alfa"),
    campo("", 1, "alfa"), // dv agência/conta
    campo(fav.nome, 30, "alfa"),
    campo(fav.nossoNumero, 20, "alfa"),
    campo(dataDDMMAAAA(fav.dataPagamento), 8, "num"),
    campo("BRL", 3, "alfa"),
    campo("0", 15, "num"), // quantidade de moeda — não utilizada em crédito por valor
    valorCentavos(fav.valor, 15),
    campo("", 15, "alfa"), // número do documento atribuído pelo banco
    campo(dataDDMMAAAA(fav.dataPagamento), 8, "num"), // data real do pagamento (preenchida pelo banco no retorno)
    valorCentavos(fav.valor, 15), // valor real do pagamento (preenchido pelo banco no retorno)
    campo("", 40, "alfa"), // informação 2 / finalidade do DOC/TED — CONFIRMAR com o banco
    campo("", 10, "alfa"), // uso exclusivo do banco
    campo("0", 1, "num"), // aviso ao favorecido: 0 = não emite
    campo(fav.documento.length > 11 ? "2" : "1", 1, "num"), // tipo de inscrição do favorecido
    campo(fav.documento, 14, "num"),
    campo("", 2, "alfa"), // uso exclusivo FEBRABAN/CNAB
  ]);
}

function trailerLote(empresa: EmpresaCedente, qtdRegistrosLote: number, somaValores: number): string {
  return montarLinha([
    campo(empresa.bancoCodigo, 3, "num"),
    campo("1", 4, "num"),
    campo("5", 1, "num"), // tipo de registro: 5 = trailer de lote
    campo("", 9, "alfa"),
    campo(qtdRegistrosLote, 6, "num"),
    valorCentavos(somaValores, 18),
    campo("0", 18, "num"), // somatória de quantidade de moeda
    campo("", 6, "alfa"),
    campo("", 175, "alfa"),
  ]);
}

function trailerArquivo(empresa: EmpresaCedente, qtdLotes: number, qtdRegistros: number): string {
  return montarLinha([
    campo(empresa.bancoCodigo, 3, "num"),
    campo("9999", 4, "num"),
    campo("9", 1, "num"), // tipo de registro: 9 = trailer de arquivo
    campo("", 9, "alfa"),
    campo(qtdLotes, 6, "num"),
    campo(qtdRegistros, 6, "num"),
    campo("0", 6, "num"), // quantidade de contas para conciliação
    campo("", 205, "alfa"),
  ]);
}

/** Gera o conteúdo textual (linhas separadas por \r\n) de uma remessa CNAB240. */
export function gerarRemessaCnab240(
  empresa: EmpresaCedente,
  favorecidos: FavorecidoPagamento[],
  numeroSequencialArquivo: number,
  agora: Date = new Date(),
): string {
  if (favorecidos.length === 0) {
    throw new Error("Remessa sem favorecidos — nada para gerar.");
  }
  const linhas: string[] = [];
  linhas.push(headerArquivo(empresa, numeroSequencialArquivo, agora));
  linhas.push(headerLote(empresa));

  let somaValores = 0;
  let registro = 0;
  for (const fav of favorecidos) {
    registro += 1;
    linhas.push(segmentoA(empresa, fav, registro));
    somaValores += fav.valor;
  }
  // +2 no trailer de lote: header de lote + trailer de lote entram na contagem de registros do lote.
  linhas.push(trailerLote(empresa, favorecidos.length + 2, somaValores));
  // +4 no trailer de arquivo: header de arquivo + header de lote + trailer de lote + trailer de arquivo.
  linhas.push(trailerArquivo(empresa, 1, favorecidos.length + 4));

  return linhas.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Retorno — leitura das ocorrências de pagamento (Segmento A em modo retorno).
// ---------------------------------------------------------------------------

export type OcorrenciaRetorno = {
  nossoNumero: string;
  codigoOcorrencia: string;
  dataOcorrencia: string; // YYYY-MM-DD
  valorPago: number;
};

function parseValorCentavos(trecho: string): number {
  const n = Number(trecho.replace(/\D/g, ""));
  return Number.isFinite(n) ? n / 100 : 0;
}

function parseDataDDMMAAAA(trecho: string): string | null {
  if (!/^\d{8}$/.test(trecho) || trecho === "00000000") return null;
  const dd = trecho.slice(0, 2);
  const mm = trecho.slice(2, 4);
  const yyyy = trecho.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Extrai as ocorrências de pagamento de um arquivo de retorno CNAB240.
 * Lê apenas registros de detalhe (tipo '3') com código de segmento 'A' —
 * suficiente para o Segmento A de crédito em conta usado na remessa acima.
 * Não interpreta os demais segmentos (B, outras câmaras de compensação).
 */
export function parseRetornoCnab240(conteudo: string): OcorrenciaRetorno[] {
  const linhas = conteudo.split(/\r\n|\r|\n/).filter((l) => l.length >= 240);
  const ocorrencias: OcorrenciaRetorno[] = [];

  for (const linha of linhas) {
    const tipoRegistro = linha[7];
    const segmento = linha[13];
    if (tipoRegistro !== "3" || segmento !== "A") continue;

    // Offsets alinhados ao layout do Segmento A definido em segmentoA() acima —
    // a especificação FEBRABAN reaproveita as mesmas posições de campo entre
    // remessa e retorno (ex.: "código da instrução" na remessa é sobrescrito
    // pelo banco com o "código de ocorrência" no retorno).
    const nossoNumero = linha.slice(73, 93).trim();
    const codigoOcorrencia = linha.slice(15, 17).trim();
    const dataReal = parseDataDDMMAAAA(linha.slice(149, 157));
    const valorReal = parseValorCentavos(linha.slice(157, 172));

    ocorrencias.push({
      nossoNumero,
      codigoOcorrencia,
      dataOcorrencia: dataReal ?? new Date().toISOString().slice(0, 10),
      valorPago: valorReal,
    });
  }

  return ocorrencias;
}
