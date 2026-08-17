/** @module-kind io */
// ViaCEP — API pública para consulta de endereço por CEP.
// https://viacep.com.br/
import { fetchWithRetry } from "@/lib/core/http/withRetry";

export interface ViaCepResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  complemento?: string;
}

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

export async function fetchCep(cep: string): Promise<ViaCepResult | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetchWithRetry(
      `https://viacep.com.br/ws/${digits}/json/`,
      {},
      { timeoutMs: 5000, maxAttempts: 2, label: "viacep" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.erro) return null;
    return {
      cep: data.cep ?? "",
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      localidade: data.localidade ?? "",
      uf: data.uf ?? "",
      complemento: data.complemento ?? "",
    };
  } catch {
    return null;
  }
}

/** Monta string única no formato usado nos cadastros. */
export function formatEndereco(r: ViaCepResult): string {
  const ruaBairro = [r.logradouro, r.bairro].filter(Boolean).join(", ");
  const cidadeUf = [r.localidade, r.uf].filter(Boolean).join("/");
  return [ruaBairro, cidadeUf].filter(Boolean).join(" - ");
}
