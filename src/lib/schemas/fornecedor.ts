/** @module-kind pure */
// BIZ-003 (Onda 5) — Schema Zod para o domínio `fornecedores`.
// Consumido por `useCreateFornecedor`/`useUpdateFornecedor` e formulários
// (`FornecedorForm`, dialogs em Suprimentos).
import { z } from "zod";
import { isValidCnpj, onlyDigits } from "@/lib/core/cnpj";
import { addIssue, text, validateWithSchema, type FormErrors } from "@/lib/schemas/validation";

/**
 * Aceita tanto o formato do formulário (camelCase) quanto o do banco
 * (snake_case); o repositório normaliza antes de persistir.
 */
export const fornecedorSchema = z
  .record(z.string(), z.unknown())
  .superRefine((val, ctx) => {
    const razao = text(val.razao_social ?? (val as Record<string, unknown>).razaoSocial);
    if (!razao) addIssue(ctx, "razao_social", "Razão social é obrigatória");
    if (razao.length > 200) addIssue(ctx, "razao_social", "Máx. 200 caracteres");

    const cnpjRaw = val.cnpj ?? (val as Record<string, unknown>).documento;
    if (cnpjRaw != null && text(cnpjRaw).length > 0) {
      const digits = onlyDigits(String(cnpjRaw));
      // Fornecedor pode ser PF (CPF) ou PJ (CNPJ). Só validamos como CNPJ
      // quando o comprimento indicar PJ.
      if (digits.length === 14 && !isValidCnpj(digits)) {
        addIssue(ctx, "cnpj", "CNPJ inválido");
      }
      if (digits.length !== 11 && digits.length !== 14) {
        addIssue(ctx, "cnpj", "Documento deve ser CPF (11) ou CNPJ (14 dígitos)");
      }
    }

    const email = text(val.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addIssue(ctx, "email", "E-mail inválido");
    }
  });

export function validarFornecedor(input: unknown): { ok: true } | { ok: false; errors: FormErrors } {
  return validateWithSchema(fornecedorSchema, input);
}
