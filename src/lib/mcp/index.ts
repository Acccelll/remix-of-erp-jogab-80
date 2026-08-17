/** @module-kind orchestration */
import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listObras from "./tools/list-obras";
import getObra from "./tools/get-obra";
import listCronogramaObra from "./tools/list-cronograma-obra";
import listMedicoesObra from "./tools/list-medicoes-obra";
import listOportunidades from "./tools/list-oportunidades";

// O issuer OAuth precisa ser o host direto do Supabase, derivado do project ref
// (inlined pelo Vite em build). Nunca usar SUPABASE_URL aqui.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "erp-jogab",
  title: "ERP-JOGAB",
  version: "0.1.0",
  instructions:
    "Ferramentas do ERP-JOGAB (gestão de obras). Use `list_obras` para localizar uma obra e obter seu id, depois `get_obra`, `list_cronograma_obra` ou `list_medicoes_obra` para detalhes. `list_oportunidades` consulta o funil de vendas (CRM). Todas as consultas respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listObras, getObra, listCronogramaObra, listMedicoesObra, listOportunidades],
});
