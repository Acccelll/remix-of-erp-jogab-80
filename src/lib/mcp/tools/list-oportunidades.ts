import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_oportunidades",
  title: "Listar oportunidades (CRM)",
  description:
    "Lista as oportunidades do CRM visíveis para o usuário autenticado, com filtro opcional por etapa/status.",
  inputSchema: {
    status: z.string().trim().optional().describe("Etapa/status da oportunidade."),
    busca: z.string().trim().optional().describe("Filtra pelo título da oportunidade."),
    limite: z.number().int().min(1).max(200).optional().describe("Máximo de registros (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, busca, limite }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("oportunidades")
      .select("*")
      .limit(limite ?? 50);
    if (status) query = query.eq("status", status);
    if (busca) query = query.ilike("titulo", `%${busca}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { oportunidades: data ?? [] },
    };
  },
});
