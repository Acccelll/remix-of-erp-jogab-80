/** @module-kind pure */
import { z } from "zod";
import { addIssue, text, validateWithSchema, type FormErrors } from "@/lib/schemas/validation";

export const patrimonioSchema = z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
  const codigo = text(val.codigo);
  if (!codigo) addIssue(ctx, "codigo", "Código é obrigatório.");
  else if (!/^\d{1,6}$/.test(codigo)) addIssue(ctx, "codigo", "Código deve ter até 6 dígitos.");

  if (!text(val.nome)) addIssue(ctx, "nome", "Nome é obrigatório.");
});

export type PatrimonioFormErrors = FormErrors;

export function validatePatrimonio(
  input: any,
): { ok: true; errors?: never } | { ok: false; errors: PatrimonioFormErrors } {
  return validateWithSchema(patrimonioSchema, input) as ReturnType<typeof validatePatrimonio>;
}