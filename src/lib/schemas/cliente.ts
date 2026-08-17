/** @module-kind pure */
import { z } from "zod";
import { isValidCnpj, onlyDigits } from "@/lib/core/cnpj";
import { validateWithSchema, type FormErrors } from "@/lib/schemas/validation";

export const clienteSchema = z
  .object({
    nome: z.string().min(1, "Nome é obrigatório"),
    cnpj: z.string().optional().nullable(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    if (val.cnpj) {
      const d = onlyDigits(val.cnpj);
      if (d.length > 0 && !isValidCnpj(d)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CNPJ inválido",
          path: ["cnpj"],
        });
      }
    }
  });

export type ClienteFormErrors = FormErrors;

export function validateCliente(
  input: any,
): { ok: true; errors?: never } | { ok: false; errors: ClienteFormErrors } {
  return validateWithSchema(clienteSchema, input) as ReturnType<typeof validateCliente>;
}
