import type { EstoqueProvider } from "../EstoqueProvider";

/**
 * Esqueleto do provider real de Estoque do TOTVS RM.
 *
 * Ainda não há URL, credenciais nem documentação da API do TOTVS RM
 * disponíveis para este projeto. Este arquivo existe para deixar o ponto de
 * extensão explícito: quando as credenciais chegarem, a implementação real
 * deve:
 *
 *   1. Nunca chamar a API do TOTVS RM diretamente do browser — credenciais
 *      de sistemas externos ficam sempre do lado do servidor. Criar uma
 *      edge function (ex.: supabase/functions/totvs-rm-estoque-sync/index.ts)
 *      seguindo o padrão de supabase/functions/totvs-import-validar/index.ts
 *      (createClient com SUPABASE_SERVICE_ROLE_KEY, credenciais do TOTVS RM
 *      via Deno.env.get("TOTVS_RM_BASE_URL") / Deno.env.get("TOTVS_RM_API_KEY"),
 *      nunca em código versionado).
 *   2. Implementar os 4 métodos abaixo chamando essa edge function via
 *      supabase.functions.invoke(...), mantendo a mesma assinatura de
 *      EstoqueProvider — a UI de Romaneio (src/components/logisticaAtivos/)
 *      e o hook useConfirmarRomaneio não precisam mudar.
 *   3. Ligar esta implementação trocando a feature flag "totvs_rm_estoque_ativo"
 *      (ver ../estoqueProviderFactory.ts) para true — sem deploy de código
 *      novo no restante do domínio de Romaneio.
 */
export const totvsRmProvider: EstoqueProvider = {
  async listarSaldos() {
    throw new Error(
      "totvs_rm_nao_configurado: integração com Estoque do TOTVS RM ainda não implementada",
    );
  },
  async consultarSaldo() {
    throw new Error(
      "totvs_rm_nao_configurado: integração com Estoque do TOTVS RM ainda não implementada",
    );
  },
  async transferir() {
    throw new Error(
      "totvs_rm_nao_configurado: integração com Estoque do TOTVS RM ainda não implementada",
    );
  },
  async registrarSaida() {
    throw new Error(
      "totvs_rm_nao_configurado: integração com Estoque do TOTVS RM ainda não implementada",
    );
  },
};
