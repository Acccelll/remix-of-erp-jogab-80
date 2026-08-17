/** @module-kind pure */
import { z } from "zod";

export type FormErrors = Partial<Record<string, string>>;

export type ValidationResult = { ok: true; errors?: never } | { ok: false; errors: FormErrors };

export function issuesToErrors(issues: z.ZodIssue[]): FormErrors {
  const errors: FormErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function validateWithSchema(schema: z.ZodTypeAny, input: unknown): ValidationResult {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true };
  return { ok: false, errors: issuesToErrors(result.error.issues) };
}

/**
 * BIZ-003 (Onda 5) — Erro tipado carregando `FormErrors` para bloquear
 * mutations e alimentar formulários. Consumido por hooks de fornecedor/insumo.
 */
export class ValidationError extends Error {
  readonly errors: FormErrors;
  constructor(errors: FormErrors, message?: string) {
    const first = Object.values(errors).find((v) => typeof v === "string" && v.length > 0);
    super(message ?? first ?? "Dados inválidos");
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export function isValidationError(err: unknown): err is ValidationError {
  return err instanceof ValidationError || (err as { name?: string } | null)?.name === "ValidationError";
}

/** Guard para mutations: lança `ValidationError` se `result.ok === false`. */
export function assertValid(
  result: ValidationResult,
): asserts result is { ok: true } {
  if (!result.ok) throw new ValidationError(result.errors);
}

export function addIssue(ctx: z.RefinementCtx, path: string, message: string) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
}

export function text(input: unknown): string {
  return String(input ?? "").trim();
}

export function numberOrNull(input: unknown): number | null {
  if (input == null || input === "") return null;
  const value = typeof input === "number" ? input : Number(input);
  return Number.isFinite(value) ? value : null;
}

export function firstPresent(input: Record<string, unknown>, keys: string[]): [string, unknown] | null {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) return [key, input[key]];
  }
  return null;
}