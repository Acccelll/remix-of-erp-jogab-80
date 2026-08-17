/** @module-kind pure */
/**
 * Normalização de nomes de cidade e parsing do campo livre `obras.local`.
 *
 * O cadastro de obras sempre teve `local` como texto digitado à mão, sem
 * formato garantido ("Camaçari/BA", "Camaçari - BA", "CAMACARI, Bahia",
 * "Obra do Polo — Camaçari/BA"). Enquanto as colunas `cidade`/`uf` não
 * estiverem preenchidas em toda a base, o mapa depende de extrair a cidade
 * daí, então o parser precisa ser tolerante — e o índice de municípios
 * precisa de uma chave estável que ignore acento, caixa e pontuação.
 */

/** As 27 unidades federativas, para validar a sigla extraída do texto livre. */
export const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;

export type UF = (typeof UFS)[number];

const UF_SET = new Set<string>(UFS);

/** Nome por extenso → sigla, para textos como "Camaçari, Bahia". */
const UF_POR_NOME: Record<string, UF> = {
  acre: "AC",
  alagoas: "AL",
  amazonas: "AM",
  amapa: "AP",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "minas gerais": "MG",
  "mato grosso do sul": "MS",
  "mato grosso": "MT",
  para: "PA",
  paraiba: "PB",
  pernambuco: "PE",
  piaui: "PI",
  parana: "PR",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  rondonia: "RO",
  roraima: "RR",
  "rio grande do sul": "RS",
  "santa catarina": "SC",
  sergipe: "SE",
  "sao paulo": "SP",
  tocantins: "TO",
};

/** `true` se a string é uma sigla de UF válida (aceita minúsculas). */
export function isUF(valor: string | null | undefined): valor is UF {
  return !!valor && UF_SET.has(valor.trim().toUpperCase());
}

/** Normaliza a sigla para maiúscula, ou `null` se não for uma UF conhecida. */
export function normalizeUF(valor: string | null | undefined): UF | null {
  if (!valor) return null;
  const bruto = valor.trim();
  const sigla = bruto.toUpperCase();
  if (UF_SET.has(sigla)) return sigla as UF;
  return UF_POR_NOME[slugCidade(bruto)] ?? null;
}

/**
 * Chave de busca de um nome de cidade: sem acento, sem pontuação, minúscula,
 * espaços colapsados. "Camaçari" e "CAMACARI " viram a mesma chave.
 */
export function slugCidade(nome: string | null | undefined): string {
  if (!nome) return "";
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['`´’.]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

/** Chave composta usada pelo índice de municípios. */
export function chaveMunicipio(nome: string, uf: string): string {
  return `${slugCidade(nome)}|${uf.trim().toUpperCase()}`;
}

export interface LocalParseado {
  cidade: string | null;
  uf: UF | null;
}

const VAZIO: LocalParseado = { cidade: null, uf: null };

/**
 * Extrai `{cidade, uf}` de um texto livre que pode trazer os dois juntos.
 *
 * Vale tanto para `obras.local` quanto para `colaboradores.cidade`: apesar do
 * nome, o segundo também guarda o par combinado ("Rio Claro/SP"), porque é
 * assim que o `EmployeeFormDialog` grava o resultado da busca por CEP.
 *
 * Reconhece os separadores usados na base ("/", "-", "–", ",") e a UF tanto
 * por sigla quanto por nome. Quando o texto tem mais de um trecho antes da
 * UF ("Obra do Polo — Camaçari/BA"), assume que a cidade é o trecho
 * imediatamente anterior à UF, que é como o campo vem sendo preenchido.
 * Sem UF reconhecível, devolve o texto inteiro como cidade.
 *
 * Só o **último** separador é considerado, e a cidade fica com tudo que vem
 * antes dele: 27 municípios têm hífen no nome próprio ("Xique-Xique",
 * "Pindaré-Mirim", "Pingo-d'Água") e cortar no primeiro separador os
 * destruiria. Quando o resultado ainda tem prefixo descritivo
 * ("Obra do Polo — Camaçari"), quem descasca é o `geocodeCidade`, que pode
 * testar cada candidato contra a base real em vez de adivinhar aqui.
 */
export function parseCidadeUF(texto0: string | null | undefined): LocalParseado {
  if (!texto0) return VAZIO;
  const texto = texto0.trim();
  if (!texto) return VAZIO;

  // Último separador do texto: o que vem depois é candidato a UF.
  const comSeparador = texto.match(/^(.*)[/,\-–—|]\s*([^/,\-–—|]+?)\s*$/);
  if (comSeparador) {
    const uf = normalizeUF(comSeparador[2]);
    const cidade = comSeparador[1].trim().replace(/[\s/,\-–—|]+$/, "");
    if (uf && cidade) return { cidade, uf };
  }

  // Sem separador: tenta "Camaçari BA" — sigla colada no fim.
  const comSiglaFinal = texto.match(/^(.*?)\s+([A-Za-z]{2})$/);
  if (comSiglaFinal) {
    const uf = normalizeUF(comSiglaFinal[2]);
    if (uf && comSiglaFinal[1].trim()) {
      return { cidade: comSiglaFinal[1].trim(), uf };
    }
  }

  return { cidade: texto, uf: null };
}

/**
 * Candidatos de nome de cidade para um texto, do mais fiel ao mais descascado.
 *
 * "Obra do Polo — Camaçari" só resolve pelo segundo candidato; "Xique-Xique"
 * só pelo primeiro. Quem decide é o índice de municípios, testando na ordem.
 */
export function candidatosCidade(cidade: string | null | undefined): string[] {
  if (!cidade) return [];
  const texto = cidade.trim();
  if (!texto) return [];

  const candidatos = [texto];
  const ultimoTrecho = texto
    .split(/[/,\-–—|]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .pop();
  if (ultimoTrecho && ultimoTrecho !== texto) candidatos.push(ultimoTrecho);

  return candidatos;
}
