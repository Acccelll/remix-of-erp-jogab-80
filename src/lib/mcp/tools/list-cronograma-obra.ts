import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_cronograma_obra",
  title: "Listar cronograma da obra",
  description:
    "Lista os itens de cronograma de uma obra, com datas, avanço e marcação de caminho crítico.",
  inputSchema: {
    obra_id: z.string().uuid().describe("UUID da obra."),
    apenas_criticos: z.boolean().optional().describe("Retorna apenas itens do caminho crítico."),
    limite: z.number().int().min(1).max(500).optional().describe("Máximo de itens (padrão 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ obra_id, apenas_criticos, limite }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("cronograma_itens")
      .select("id, descricao, data_inicio, data_fim, percentual_concluido, critico, folga_dias")
      .eq("obra_id", obra_id)
      .order("data_inicio")
      .limit(limite ?? 100);
    if (apenas_criticos) query = query.eq("critico", true);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { itens: data ?? [] },
    };
  },
});
