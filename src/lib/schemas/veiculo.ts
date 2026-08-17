/** @module-kind pure */
import { z } from "zod";
import { TIPOS_VEICULO } from "@/lib/frotas/tipos";
import { addIssue, text, validateWithSchema, type FormErrors } from "@/lib/schemas/validation";

export const veiculoSchema = z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
  const codigo = text(val.codigo).toUpperCase();
  if (!codigo) addIssue(ctx, "codigo", "Placa é obrigatória.");
  else if (codigo.length > 7) addIssue(ctx, "codigo", "Placa deve ter até 7 caracteres.");

  if (!text(val.nome)) addIssue(ctx, "nome", "Nome é obrigatório.");
  if (!TIPOS_VEICULO.includes(val.tipo as any)) addIssue(ctx, "tipo", "Tipo de veículo inválido.");
});

export type VeiculoFormErrors = FormErrors;

export function validateVeiculo(
  input: any,
): { ok: true; errors?: never } | { ok: false; errors: VeiculoFormErrors } {
  return validateWithSchema(veiculoSchema, input) as ReturnType<typeof validateVeiculo>;
}