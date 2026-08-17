/** @module-kind pure */
import { z } from "zod";
import { isValidCnpj, onlyDigits } from "@/lib/core/cnpj";
import {
  addIssue,
  firstPresent,
  numberOrNull,
  text,
  validateWithSchema,
  type FormErrors,
} from "@/lib/schemas/validation";

const percentFields: Array<[string[], string]> = [
  [["percentual_material", "percentualMaterial"], "% Material deve estar entre 0 e 100"],
  [["aliquota_iss", "aliquotaIss"], "ISS entre 0 e 100"],
  [["aliquota_inss", "aliquotaInss"], "INSS entre 0 e 100"],
  [["aliquota_cbs", "aliquotaCbs"], "CBS entre 0 e 100"],
  [["aliquota_ibs", "aliquotaIbs"], "IBS entre 0 e 100"],
];

export const obraSchema = z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
  const isFinanceiroShape =
    "valor_contrato" in val || "cliente_id" in val || "data_inicio" in val || "data_fim" in val;

  if (isFinanceiroShape && !text(val.codigo)) addIssue(ctx, "codigo", "Código é obrigatório");
  if (text(val.codigo).length > 50) addIssue(ctx, "codigo", "Máx. 50 caracteres");
  if (!text(val.nome)) addIssue(ctx, "nome", "Nome é obrigatório");

  const valorContrato = firstPresent(val, ["valor_contrato", "valorContrato"]);
  if (valorContrato) {
    const [path, raw] = valorContrato;
    const value = numberOrNull(raw);
    if ((isFinanceiroShape || raw !== "") && (value == null || value <= 0)) {
      addIssue(ctx, path, "Valor do contrato deve ser > 0");
    }
  }

  for (const [keys, message] of percentFields) {
    const field = firstPresent(val, keys);
    if (!field) continue;
    const [path, raw] = field;
    const value = numberOrNull(raw);
    if (raw !== "" && value != null && (value < 0 || value > 100)) addIssue(ctx, path, message);
  }

  const dataInicio = firstPresent(val, ["data_inicio", "dataInicio"]);
  const dataFim = firstPresent(val, ["data_fim", "dataFim"]);
  if (text(dataInicio?.[1]) && text(dataFim?.[1]) && text(dataFim?.[1]) < text(dataInicio?.[1])) {
    addIssue(ctx, dataFim?.[0] ?? "data_fim", "Data fim não pode ser anterior à data início");
  }

  const cnpj = firstPresent(val, ["cnpj"]);
  if (cnpj && onlyDigits(String(cnpj[1])).length > 0 && !isValidCnpj(String(cnpj[1]))) {
    addIssue(ctx, "cnpj", "CNPJ inválido");
  }
});

export type ObraFormErrors = FormErrors;

export function validateObra(
  input: any,
): { ok: true; errors?: never } | { ok: false; errors: ObraFormErrors } {
  return validateWithSchema(obraSchema, input) as ReturnType<typeof validateObra>;
}
