/** @module-kind pure */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMatricula(matricula: string): string {
  return matricula.replace(/\D/g, "").padStart(4, "0");
}

/** Normalize a string for fuzzy/global search (lowercase, strip accents, collapse spaces). */
export function norm(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Re-exports mantidos por compatibilidade — fonte única em src/lib/date.ts.
export { fmtData, hojeBrasilia } from "@/lib/core/date";

export function cleanCPF(cpf: string): string {
  return (cpf || "").replace(/\D/g, "");
}

export function formatCPF(cpf: string): string {
  const clean = cleanCPF(cpf);
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// Aplica a máscara progressivamente durante a digitação
export function maskCPF(value: string): string {
  const clean = cleanCPF(value).slice(0, 11);
  let out = clean;
  if (clean.length > 3) out = clean.replace(/^(\d{3})(\d+)/, "$1.$2");
  if (clean.length > 6) out = out.replace(/^(\d{3})\.(\d{3})(\d+)/, "$1.$2.$3");
  if (clean.length > 9) out = out.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d+)/, "$1.$2.$3-$4");
  return out;
}

// Valida CPF: 11 dígitos + dígitos verificadores
export function isValidCPF(cpf: string): boolean {
  const c = cleanCPF(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(c[9]) && calc(10) === parseInt(c[10]);
}
