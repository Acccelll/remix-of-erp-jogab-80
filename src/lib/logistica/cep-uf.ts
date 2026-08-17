/** @module-kind pure */
/**
 * UF a partir da faixa de CEP.
 *
 * Os Correios distribuem os CEPs em faixas contíguas por estado, então o
 * prefixo numérico determina a UF sem consultar serviço nenhum. Serve para
 * desempatar cidades homônimas quando o cadastro tem o nome mas não a UF:
 * "Rio Claro" existe em SP e RJ, mas "Rio Claro" + CEP 13503-661 só pode ser
 * o de SP.
 *
 * É de propósito uma alternativa offline ao ViaCEP: dezenas de colaboradores
 * na tela significariam dezenas de requisições a um serviço com limite de uso,
 * para uma informação que a própria numeração já carrega.
 *
 * Só resolve a UF — o nome da cidade continua vindo do cadastro. Faixas
 * conferidas contra a tabela de faixas de CEP por unidade da federação.
 */
import type { UF } from "@/lib/logistica/normalize";

interface Faixa {
  de: number;
  ate: number;
  uf: UF;
}

/**
 * Ordenadas por início de faixa. Alguns estados aparecem mais de uma vez:
 * AM e RO são partidos por enclaves de RR e MT, e DF/GO se alternam em 72–73.
 */
const FAIXAS: readonly Faixa[] = [
  { de: 1000000, ate: 19999999, uf: "SP" },
  { de: 20000000, ate: 28999999, uf: "RJ" },
  { de: 29000000, ate: 29999999, uf: "ES" },
  { de: 30000000, ate: 39999999, uf: "MG" },
  { de: 40000000, ate: 48999999, uf: "BA" },
  { de: 49000000, ate: 49999999, uf: "SE" },
  { de: 50000000, ate: 56999999, uf: "PE" },
  { de: 57000000, ate: 57999999, uf: "AL" },
  { de: 58000000, ate: 58999999, uf: "PB" },
  { de: 59000000, ate: 59999999, uf: "RN" },
  { de: 60000000, ate: 63999999, uf: "CE" },
  { de: 64000000, ate: 64999999, uf: "PI" },
  { de: 65000000, ate: 65999999, uf: "MA" },
  { de: 66000000, ate: 68899999, uf: "PA" },
  { de: 68900000, ate: 68999999, uf: "AP" },
  { de: 69000000, ate: 69299999, uf: "AM" },
  { de: 69300000, ate: 69399999, uf: "RR" },
  { de: 69400000, ate: 69899999, uf: "AM" },
  { de: 69900000, ate: 69999999, uf: "AC" },
  { de: 70000000, ate: 72799999, uf: "DF" },
  { de: 72800000, ate: 72999999, uf: "GO" },
  { de: 73000000, ate: 73699999, uf: "DF" },
  { de: 73700000, ate: 76799999, uf: "GO" },
  { de: 76800000, ate: 76999999, uf: "RO" },
  { de: 77000000, ate: 77999999, uf: "TO" },
  { de: 78000000, ate: 78899999, uf: "MT" },
  { de: 78900000, ate: 78999999, uf: "RO" },
  { de: 79000000, ate: 79999999, uf: "MS" },
  { de: 80000000, ate: 87999999, uf: "PR" },
  { de: 88000000, ate: 89999999, uf: "SC" },
  { de: 90000000, ate: 99999999, uf: "RS" },
] as const;

/**
 * UF do CEP, ou `null` se o valor não tiver 8 dígitos ou cair fora das faixas.
 *
 * Aceita o CEP em qualquer formatação — "13.503-661", "13503661" e
 * "13503-661" dão o mesmo resultado, porque a base tem os três formatos.
 */
export function ufPorCep(cep: string | null | undefined): UF | null {
  const digitos = (cep ?? "").replace(/\D/g, "");
  if (digitos.length !== 8) return null;

  const numero = Number(digitos);
  if (!Number.isFinite(numero)) return null;

  for (const faixa of FAIXAS) {
    if (numero >= faixa.de && numero <= faixa.ate) return faixa.uf;
  }
  return null;
}
