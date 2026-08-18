/** @module-kind pure */
// BIZ-003 (Onda 5) — Schema Zod para o domínio `insumos`.
// Consumido por `useCreateInsumo`/`useUpdateInsumo` e o formulário em
// `pages/suprimentos/Insumos.tsx`.
import { z } from "zod";
import {
  addIssue,
  numberOrNull,
  text,
  validateWithSchema,
  type FormErrors,
} from "@/lib/schemas/validation";

const UNIDADES_VALIDAS = new Set([
  "un",
  "pc",
  "kg",
  "g",
  "t",
  "m",
  "m2",
  "m3",
  "l",
  "ml",
  "h",
  "cx",
  "vb",
]);

export const insumoSchema = z
  .record(z.string(), z.unknown())
  .superRefine((val, ctx) => {
    const descricao = text(val.descricao);
    if (!descricao) addIssue(ctx, "descricao", "Descrição é obrigatória");
    if (descricao.length > 300) addIssue(ctx, "descricao", "Máx. 300 caracteres");

    const codigo = text(val.codigo);
    if (codigo.length > 40) addIssue(ctx, "codigo", "Máx. 40 caracteres");

    const categoria = text(val.categoria);
    if (categoria.length > 80) addIssue(ctx, "categoria", "Máx. 80 caracteres");

    const subcategoria = text(val.subcategoria);
    if (subcategoria.length > 80) addIssue(ctx, "subcategoria", "Máx. 80 caracteres");

    const unidade = text(val.unidade).toLowerCase();
    if (!unidade) addIssue(ctx, "unidade", "Unidade é obrigatória");
    else if (!UNIDADES_VALIDAS.has(unidade))
      addIssue(ctx, "unidade", "Unidade inválida (ex.: un, kg, m, m2, m3, l, h, cx, vb)");

    const preco = numberOrNull(val.preco_unitario ?? (val as Record<string, unknown>).precoUnitario);
    if (preco != null && preco < 0) addIssue(ctx, "preco_unitario", "Preço não pode ser negativo");
  });

export function validarInsumo(input: unknown): { ok: true } | { ok: false; errors: FormErrors } {
  return validateWithSchema(insumoSchema, input);
}
