/** @module-kind io */
/** PRO-010 · slice-01 — trilha local de saídas formais para fornecedor. */
import { swallow } from "@/lib/core/errors";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";

export type SuprimentoEnvioTipo = "ordem_compra" | "pedido_cotacao";
export type SuprimentoEnvioCanal = "pdf" | "email";

export interface SuprimentoEnvio {
  id: string;
  tipo: SuprimentoEnvioTipo;
  ordemCompraId?: string;
  cotacaoId?: string;
  fornecedorId?: string;
  destinatarioNome?: string;
  destinatarioEmail?: string;
  canal: SuprimentoEnvioCanal;
  enviadoPor?: string;
  enviadoEm: string;
  observacao?: string;
}

const EVT = "gestaobra:suprimentos:envios:changed";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `envio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeParse(raw: string | null): SuprimentoEnvio[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    swallow("suprimentos.envios.parse", err, "registro local corrompido é ignorável");
    return [];
  }
}

export function listSuprimentoEnvios(): SuprimentoEnvio[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEYS.suprimentoEnvios));
}

export function registrarSuprimentoEnvio(
  input: Omit<SuprimentoEnvio, "id" | "enviadoEm"> & { enviadoEm?: string },
): SuprimentoEnvio {
  const registro: SuprimentoEnvio = {
    ...input,
    id: makeId(),
    enviadoEm: input.enviadoEm ?? new Date().toISOString(),
  };
  const atual = listSuprimentoEnvios();
  localStorage.setItem(STORAGE_KEYS.suprimentoEnvios, JSON.stringify([registro, ...atual]));
  window.dispatchEvent(new Event(EVT));
  return registro;
}

export function subscribeSuprimentoEnvios(callback: () => void): () => void {
  window.addEventListener(EVT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVT, callback);
    window.removeEventListener("storage", callback);
  };
}