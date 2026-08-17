/** @module-kind pure */
import { z } from "zod";
import { cleanCPF, isValidCPF } from "@/lib/utils";
import {
  addIssue,
  text,
  validateWithSchema,
  type FormErrors,
} from "@/lib/schemas/validation";

type DuplicateSource = Array<{ id?: string; cpf?: string; matricula?: string; nome?: string }>;

export type ColaboradorValidationOptions = {
  colaboradores?: DuplicateSource;
  editingId?: string | null;
};

function schema(options: ColaboradorValidationOptions = {}) {
  return z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
    const matricula = cleanCPF(String(val.matricula ?? ""));
    if (!matricula) addIssue(ctx, "matricula", "Matrícula é obrigatória.");
    else if (matricula.length < 4) {
      addIssue(ctx, "matricula", "A matrícula deve ter no mínimo 4 dígitos (ex: 0001).");
    }

    if (!text(val.nome)) addIssue(ctx, "nome", "Nome é obrigatório.");

    const cpf = String(val.cpf ?? "");
    const cpfNorm = cleanCPF(cpf);
    if (!cpfNorm) addIssue(ctx, "cpf", "CPF é obrigatório.");
    else if (!isValidCPF(cpfNorm)) addIssue(ctx, "cpf", "CPF inválido. Verifique os dígitos.");
    else {
      const duplicate = options.colaboradores?.find(
        (c) => cleanCPF(c.cpf ?? "") === cpfNorm && c.id !== options.editingId,
      );
      if (duplicate) {
        addIssue(
          ctx,
          "cpf",
          `CPF já cadastrado para "${duplicate.nome}" (Matrícula ${duplicate.matricula}).`,
        );
      }
    }
  });
}

export type ColaboradorFormErrors = FormErrors;

export function validateColaborador(
  input: any,
  options?: ColaboradorValidationOptions,
): { ok: true; errors?: never } | { ok: false; errors: ColaboradorFormErrors } {
  return validateWithSchema(schema(options), input) as ReturnType<typeof validateColaborador>;
}