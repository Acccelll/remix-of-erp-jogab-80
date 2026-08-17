/** @module-kind repository */
// ARC-003 — wrapper para invocação da edge function `rhid-apuracao`.
// As credenciais RHiD vivem nos secrets do backend; nada trafega pelo cliente.
import { supabase } from "@/integrations/supabase/client";
import type { RhidDia, RhidPessoa } from "@/lib/rhid/mapApuracao";

export interface RhidPeriodo {
  dataIni: string; // AAAA-MM-DD
  dataFinal: string; // AAAA-MM-DD
}

export interface RhidApuracaoResponse {
  pessoas: RhidPessoa[];
  dias: RhidDia[];
  amostraBruta: RhidDia | null;
  erros: Array<{ idPerson: number; error: string }>;
  /** Resumo do login RHiD, devolvido quando o cadastro volta vazio. */
  diagnostico?: Record<string, unknown> | null;
}

async function invocar(body: Record<string, unknown>): Promise<RhidApuracaoResponse> {
  const { data, error } = await supabase.functions.invoke("rhid-apuracao", { body });
  if (error) throw new Error(error.message || "Falha ao chamar a integração RHiD");
  if (data?.error) throw new Error(String(data.error));
  return {
    pessoas: data?.pessoas ?? [],
    dias: data?.dias ?? [],
    amostraBruta: data?.amostraBruta ?? null,
    erros: data?.erros ?? [],
    diagnostico: data?.diagnostico ?? null,
  };
}

export const rhidRepo = {
  /** Cadastro de pessoas da RHiD (com departamento resolvido), sem apuração. */
  async listarPessoas(periodo: RhidPeriodo): Promise<RhidPessoa[]> {
    const { pessoas, diagnostico } = await invocar({ ...periodo });
    if (pessoas.length === 0) {
      const detalhe = diagnostico ? ` Diagnóstico do login: ${JSON.stringify(diagnostico)}` : "";
      throw new Error(
        `A RHiD autenticou, mas o endpoint /person não devolveu nenhuma pessoa.${detalhe}`,
      );
    }
    return pessoas;
  },

  /** Apuração diária das pessoas informadas no período. */
  async buscarApuracao(periodo: RhidPeriodo, idPersons: number[]): Promise<RhidApuracaoResponse> {
    return await invocar({ ...periodo, idPersons });
  },

  /** Justificativas cruas do período (`POST /justifications`). */
  async buscarJustificativas(periodo: RhidPeriodo): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.functions.invoke("rhid-apuracao", {
      body: { ...periodo, acao: "justificativas" },
    });
    if (error) throw new Error(error.message || "Falha ao consultar justificativas na RHiD");
    if (data?.error) throw new Error(String(data.error));
    return data?.justificativas ?? [];
  },

  /** Equipamentos REP crus (`GET /device`). */
  async buscarDispositivos(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.functions.invoke("rhid-apuracao", {
      body: { acao: "devices" },
    });
    if (error) throw new Error(error.message || "Falha ao consultar dispositivos na RHiD");
    if (data?.error) throw new Error(String(data.error));
    return data?.dispositivos ?? [];
  },

  /**
   * Gera o AFD de um equipamento. Function própria: a resposta é texto grande,
   * não JSON, e tem limites de tamanho/timeout distintos da apuração.
   */
  async gerarAfd(opcoes: {
    idEquipamento: number;
    layout: "1510" | "671";
    coletor?: boolean;
    dataIni?: string;
    dataFinal?: string;
  }): Promise<{
    conteudo: string;
    linhas: number;
    nsrInicial: number | null;
    nsrFinal: number | null;
    paginas: number;
    sha256: string;
    truncado: boolean;
  }> {
    const { data, error } = await supabase.functions.invoke("rhid-afd", { body: opcoes });
    if (error) throw new Error(error.message || "Falha ao gerar o AFD");
    if (data?.error) throw new Error(String(data.error));
    return data;
  },

  /** Tipos de justificativa crus (`GET /justificationstype`). */
  async buscarTiposDeJustificativa(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.functions.invoke("rhid-apuracao", {
      body: { acao: "tipos-justificativa" },
    });
    if (error) throw new Error(error.message || "Falha ao consultar tipos de justificativa");
    if (data?.error) throw new Error(String(data.error));
    return data?.tipos ?? [];
  },
};
