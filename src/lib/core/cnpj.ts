/** @module-kind io */
/**
 * CNPJ helpers — camada `lib/` (pura, sem dependências de UI).
 *
 * ARC-006: helpers de formatação/validação extraídos de
 * `components/ui/cnpj-input.tsx` para permitir que `lib/schemas/*` valide
 * CNPJ sem inverter a camada (schemas → ui). O componente `CnpjInput`
 * re-exporta estes helpers para retrocompatibilidade.
 *
 * `fetchCnpj` consulta dados públicos via edge function `cnpj-lookup`
 * (evita CORS/rate-limit no navegador) com fallback direto à BrasilAPI.
 * https://brasilapi.com.br/docs#tag/CNPJ
 */

import { cnpjRepo } from "@/lib/repositories/cnpj";
import { fetchWithRetry } from "@/lib/core/http/withRetry";
import { logger } from "@/lib/core/logger";

export function onlyDigits(s: string | null | undefined): string {
  return String(s ?? "").replace(/\D/g, "");
}

/** Format raw digits as 99.999.999/9999-99 (up to 14 digits). */
export function formatCnpj(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);
  let out = p1;
  if (d.length > 2) out += "." + p2;
  if (d.length > 5) out += "." + p3;
  if (d.length > 8) out += "/" + p4;
  if (d.length > 12) out += "-" + p5;
  return out;
}

/** Validates CNPJ check digits. */
export function isValidCnpj(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (slice: string, weights: number[]) => {
    const sum = slice.split("").reduce((acc, c, i) => acc + Number(c) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calc(d.slice(0, 12), w1);
  const dv2 = calc(d.slice(0, 12) + dv1, w2);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}

export interface CnpjResult {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  email?: string;
  ddd_telefone_1?: string;
}

export type CnpjLookupReason = "invalid" | "not_found" | "service_unavailable";

export class CnpjLookupError extends Error {
  reason: CnpjLookupReason;
  constructor(message: string, reason: CnpjLookupReason) {
    super(message);
    this.reason = reason;
  }
}

function mapResult(data: any, digits: string): CnpjResult {
  return {
    cnpj: data.cnpj ?? digits,
    razao_social: data.razao_social ?? "",
    nome_fantasia: data.nome_fantasia ?? "",
    logradouro: data.logradouro ?? "",
    numero: data.numero ?? "",
    bairro: data.bairro ?? "",
    municipio: data.municipio ?? "",
    uf: data.uf ?? "",
    cep: data.cep ?? "",
    email: data.email ?? "",
    ddd_telefone_1: data.ddd_telefone_1 ?? "",
  };
}

function res404(msg: string): boolean {
  return /não encontrado/i.test(msg);
}

export async function fetchCnpj(cnpj: string): Promise<CnpjResult> {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) throw new CnpjLookupError("CNPJ inválido.", "invalid");

  // 1) Edge function (preferencial).
  try {
    const { data, error } = await cnpjRepo.lookup(digits);
    if (!error && data && !data.error) return mapResult(data, digits);
    if (!error && data?.error) {
      if (res404(data.error))
        throw new CnpjLookupError("CNPJ não encontrado na BrasilAPI.", "not_found");
      logger.error("cnpj-lookup retornou erro, tentando consulta direta:", data.error);
    } else if (error) {
      logger.error("cnpj-lookup edge function indisponível, tentando consulta direta:", error);
    }
  } catch (err) {
    if (err instanceof CnpjLookupError) throw err;
    logger.error("cnpj-lookup edge function falhou, tentando consulta direta:", err);
  }

  // 2) Fallback: BrasilAPI direto do navegador.
  try {
    const res = await fetchWithRetry(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
      {},
      { timeoutMs: 10000, maxAttempts: 2, label: "brasilapi.cnpj" },
    );
    if (res.status === 404)
      throw new CnpjLookupError("CNPJ não encontrado na BrasilAPI.", "not_found");
    if (!res.ok)
      throw new CnpjLookupError("Falha ao consultar a BrasilAPI.", "service_unavailable");
    const data = await res.json();
    return mapResult(data, digits);
  } catch (err) {
    if (err instanceof CnpjLookupError) throw err;
    logger.error("Consulta direta à BrasilAPI também falhou:", err);
    throw new CnpjLookupError(
      "Não foi possível consultar a BrasilAPI no momento.",
      "service_unavailable",
    );
  }
}
