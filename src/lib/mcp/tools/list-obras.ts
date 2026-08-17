/** @module-kind orchestration */
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_obras",
  title: "Listar obras",
  description:
    "Lista as obras (centros de custo) visíveis para o usuário autenticado, com busca opcional por nome ou código.",
  inputSchema: {
    busca: z.string().trim().optional().describe("Filtra por nome ou código da obra."),
    limite: z.number().int().min(1).max(200).optional().describe("Máximo de obras (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("obras")
      .select("id, codigo, nome, status, cliente_id, centro_custo_totvs, valor_contrato")
      .order("codigo")
      .limit(limite ?? 50);
    if (busca) query = query.or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { obras: data ?? [] },
    };
  },
});
