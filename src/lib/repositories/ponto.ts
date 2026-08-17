/** @module-kind repository */
// ARC-003 — repositório de acesso a dados de Ponto (colaboradores/obras/importações/registros).
// Persistência no MySQL via api.php; exceção: custo_colaborador_competencia
// permanece no Supabase por ser compartilhada com o Financeiro (EVM/AC-folha).
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";
import {
  RecursoIndisponivelError,
  ehErroDeSchema,
  respostaDeRotaAusente,
} from "@/lib/ponto/disponibilidade";

/**
 * Executa uma leitura traduzindo "rota/tabela ainda não publicada no host" em
 * `RecursoIndisponivelError`, para a tela mostrar o que falta aplicar em vez de
 * um erro de SQL cru. Ver `src/lib/ponto/disponibilidade.ts`.
 */
async function lerLista<T>(recurso: string, buscar: () => Promise<unknown>): Promise<T[]> {
  let data: unknown;
  try {
    data = await buscar();
  } catch (err) {
    if (ehErroDeSchema(err)) {
      throw new RecursoIndisponivelError(recurso, "schema", (err as Error).message);
    }
    throw err;
  }
  if (respostaDeRotaAusente(data)) throw new RecursoIndisponivelError(recurso, "rota");
  return Array.isArray(data) ? (data as T[]) : [];
}

export interface ColaboradorRow {
  id: string;
  nome: string;
  cpf?: string | null;
  matricula?: string | null;
}

export interface ObraRow {
  id: string;
  nome: string;
  codigo?: string | null;
}

export interface PontoImportacaoInsert {
  arquivo_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_registros: number;
  total_colaboradores: number;
  importado_por: string | null;
}

export interface PontoRegistroInsert {
  importacao_id: string;
  colaborador_id: string | null;
  nome_csv: string;
  matricula_csv: string | null;
  cpf_csv: string | null;
  departamento_csv: string | null;
  obra_id: string | null;
  centro_indireto: boolean;
  agregado: boolean;
  data: string;
  horas_previstas_min: number;
  horas_trabalhadas_min: number;
  horas_falta_min: number;
  dias_falta_qtd: number;
  horas_extra_50_min: number;
  horas_extra_60_min: number;
  horas_extra_100_min: number;
  horas_compensadas_min: number;
  interjornada_min: number;
  banco_saldo_min: number;
  marcacao_invalida: boolean;
  falta: boolean;
  atestado: boolean;
  observacao: string | null;
  payload?: string | null;
  rhid_id_person?: number | null;
}

export interface PontoFiltros {
  inicio: string;
  fim: string;
  obraIds?: string[];
  departamentos?: string[];
}

export interface PontoRegistroRow {
  id: string;
  colaborador_id: string | null;
  nome_csv: string;
  /** Opcionais: só chegam com o `api.php` que os inclui no SELECT de `pontoRegistros`. */
  cpf_csv?: string | null;
  matricula_csv?: string | null;
  departamento_csv: string | null;
  obra_id: string | null;
  centro_indireto: boolean;
  agregado: boolean;
  data: string;
  horas_previstas_min: number;
  horas_trabalhadas_min: number;
  horas_falta_min: number;
  dias_falta_qtd: number;
  horas_extra_50_min: number;
  horas_extra_60_min: number;
  horas_extra_100_min: number;
  horas_compensadas_min: number;
  interjornada_min: number;
  banco_saldo_min: number;
  marcacao_invalida: boolean;
  falta: boolean;
  atestado: boolean;
  observacao: string | null;
  /** Só no espelho (`pontoEspelho`): JSON cru do dia e id da pessoa na RHiD. */
  payload?: string | null;
  rhid_id_person?: number | null;
}

export interface PontoOcorrenciaRow {
  id: string;
  chave_pessoa: string;
  data: string;
  tipo: string;
  registro_id: string | null;
  colaborador_id: string | null;
  obra_id: string | null;
  nome: string;
  severidade: string;
  detalhe: string | null;
  minutos: number;
  status: string;
  responsavel: string | null;
  prazo: string | null;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string | null;
  atualizado_por: string | null;
}

export interface PontoOcorrenciaUpsert {
  chave_pessoa: string;
  data: string;
  tipo: string;
  registro_id: string | null;
  colaborador_id: string | null;
  obra_id: string | null;
  nome: string;
  severidade: string;
  detalhe: string;
  minutos: number;
}

export interface PontoOcorrenciaPatch {
  id: string;
  status?: string;
  responsavel?: string | null;
  prazo?: string | null;
  observacao?: string | null;
  atualizado_por?: string | null;
}

export interface DepartamentoObraRow {
  departamento: string;
  obra_id: string | null;
  indireto: boolean;
  atualizado_em: string;
  atualizado_por: string | null;
}

export interface RhidVinculoRow {
  id_person: number;
  colaborador_id: string | null;
  cpf: string | null;
  nome_rhid: string | null;
  ignorado: boolean;
  observacao: string | null;
  vinculado_em: string;
  vinculado_por: string | null;
}

export interface PontoSyncErroInsert {
  importacao_id: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  id_person: number;
  nome_rhid: string | null;
  mensagem: string;
}

export interface PontoImportacaoRow {
  id: string;
  arquivo_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_registros: number;
  total_colaboradores: number;
  importado_por: string | null;
  importado_em: string;
}

export interface HomemHoraRow {
  colaborador_id: string | null;
  obra_id: string | null;
  competencia: string;
  dias: number;
  horas_previstas_min: number;
  horas_realizadas_min: number;
  horas_falta_min: number;
  horas_extra_total_min: number;
  horas_extra_50_min: number;
  horas_extra_60_min: number;
  horas_extra_100_min: number;
  dias_falta: number;
  dias_marcacao_invalida: number;
}

export const pontoRepo = {
  async listColaboradores(): Promise<ColaboradorRow[]> {
    const data = await apiFetch<any[]>("colaboradores");
    return (Array.isArray(data) ? data : []).map((c) => ({
      id: String(c.id),
      nome: c.nome ?? "",
      cpf: c.cpf ?? null,
      matricula: c.matricula ?? null,
    }));
  },

  async listObras(): Promise<ObraRow[]> {
    const data = await apiFetch<any[]>("obras");
    return (Array.isArray(data) ? data : []).map((o) => ({
      id: String(o.id),
      nome: o.nome ?? "",
      codigo: o.codigo ?? null,
    }));
  },

  async deleteImportacoesPorPeriodo(periodoInicio: string, periodoFim: string): Promise<void> {
    // FK ON DELETE CASCADE no MySQL remove os ponto_registros vinculados
    await apiFetch("pontoImportacoes", {
      method: "DELETE",
      params: { periodo_inicio: periodoInicio, periodo_fim: periodoFim },
    });
  },

  async insertImportacao(payload: PontoImportacaoInsert): Promise<string> {
    const data = await apiFetch<{ id: string }>("pontoImportacoes", {
      method: "POST",
      body: payload,
    });
    if (!data?.id) throw new Error("Falha ao criar ponto_importacoes");
    return String(data.id);
  },

  async insertRegistrosChunk(records: PontoRegistroInsert[]): Promise<void> {
    if (!records.length) return;
    await apiFetch("pontoRegistros", { method: "POST", body: { rows: records } });
  },

  async listRegistros(f: PontoFiltros): Promise<PontoRegistroRow[]> {
    const params: Record<string, string> = { inicio: f.inicio, fim: f.fim };
    if (f.obraIds?.length) params.obra_ids = f.obraIds.join(",");
    const data = await apiFetch<PontoRegistroRow[]>("pontoRegistros", { params });
    return Array.isArray(data) ? data : [];
  },

  /** Histórico de importações de ponto (RHiD e CSV) que cobrem o período. */
  async listImportacoes(inicio: string, fim: string): Promise<PontoImportacaoRow[]> {
    const rows = await lerLista<Record<string, unknown>>("pontoImportacoes", () =>
      apiFetch("pontoImportacoes", { params: { inicio, fim } }),
    );
    return rows.map((r) => ({
      id: String(r.id ?? ""),
      arquivo_nome: String(r.arquivo_nome ?? ""),
      periodo_inicio: String(r.periodo_inicio ?? ""),
      periodo_fim: String(r.periodo_fim ?? ""),
      total_registros: Number(r.total_registros ?? 0),
      total_colaboradores: Number(r.total_colaboradores ?? 0),
      importado_por: (r.importado_por as string | null) ?? null,
      importado_em: String(r.importado_em ?? ""),
    }));
  },

  /** Dia a dia de um colaborador, com o JSON cru da apuração. */
  async listEspelho(params: {
    inicio: string;
    fim: string;
    colaboradorId?: string | null;
    nome?: string | null;
  }): Promise<PontoRegistroRow[]> {
    const query: Record<string, string> = { inicio: params.inicio, fim: params.fim };
    if (params.colaboradorId) query.colaborador_id = params.colaboradorId;
    else if (params.nome) query.nome = params.nome;
    return await lerLista<PontoRegistroRow>("pontoEspelho", () =>
      apiFetch("pontoEspelho", { params: query }),
    );
  },

  async listOcorrencias(inicio: string, fim: string, status?: string) {
    const params: Record<string, string> = { inicio, fim };
    if (status) params.status = status;
    return await lerLista<PontoOcorrenciaRow>("pontoOcorrencias", () =>
      apiFetch("pontoOcorrencias", { params }),
    );
  },

  /** Regenera os fatos; o status já dado pelo DP é preservado pelo api.php. */
  async upsertOcorrencias(rows: PontoOcorrenciaUpsert[]): Promise<number> {
    if (!rows.length) return 0;
    const CHUNK = 500;
    let total = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const data = await apiFetch<{ upserted?: number }>("pontoOcorrencias", {
        method: "POST",
        body: { rows: rows.slice(i, i + CHUNK) },
      });
      total += Number(data?.upserted ?? 0);
    }
    return total;
  },

  /**
   * Atualiza a tratativa. Usa PUT: o CORS do api.php não anuncia PATCH em
   * `Access-Control-Allow-Methods`, e o preflight do navegador barraria.
   */
  async patchOcorrencia(patch: PontoOcorrenciaPatch): Promise<void> {
    await apiFetch("pontoOcorrencias", { method: "PUT", body: patch });
  },

  async listDepartamentoObra(): Promise<DepartamentoObraRow[]> {
    return await lerLista<DepartamentoObraRow>("pontoDepartamentoObra", () =>
      apiFetch("pontoDepartamentoObra"),
    );
  },

  async salvarDepartamentoObra(row: {
    departamento: string;
    obra_id: string | null;
    indireto: boolean;
    atualizado_por?: string | null;
  }): Promise<void> {
    await apiFetch("pontoDepartamentoObra", { method: "PUT", body: row });
  },

  async listRhidVinculos(): Promise<RhidVinculoRow[]> {
    return await lerLista<RhidVinculoRow>("pontoRhidVinculos", () => apiFetch("pontoRhidVinculos"));
  },

  async salvarRhidVinculo(row: {
    id_person: number;
    colaborador_id: string | null;
    cpf?: string | null;
    nome_rhid?: string | null;
    ignorado?: boolean;
    observacao?: string | null;
    vinculado_por?: string | null;
  }): Promise<void> {
    await apiFetch("pontoRhidVinculos", { method: "PUT", body: row });
  },

  async listJustificativas(inicio: string, fim: string) {
    return await lerLista<{
      id_rhid: string;
      id_person: number | null;
      colaborador_id: string | null;
      nome_rhid: string | null;
      cpf: string | null;
      data_inicio: string;
      data_fim: string;
      id_tipo: string | null;
      tipo_nome: string | null;
      status_aprovacao: string;
      motivo: string | null;
      sincronizado_em: string;
    }>("pontoJustificativas", () => apiFetch("pontoJustificativas", { params: { inicio, fim } }));
  },

  async upsertJustificativas(rows: Array<Record<string, unknown>>): Promise<number> {
    if (!rows.length) return 0;
    const CHUNK = 500;
    let total = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const data = await apiFetch<{ upserted?: number }>("pontoJustificativas", {
        method: "POST",
        body: { rows: rows.slice(i, i + CHUNK) },
      });
      total += Number(data?.upserted ?? 0);
    }
    return total;
  },

  async listJustificativaTipos() {
    return await lerLista<{
      id: string;
      nome: string;
      abreviacao: string | null;
      abonar_dia_falta: boolean;
      desconta_dsr: boolean;
      exige_cid: boolean;
      qtd_mensal: number | null;
      qtd_trimestral: number | null;
      qtd_semestral: number | null;
      qtd_anual: number | null;
    }>("pontoJustificativaTipos", () => apiFetch("pontoJustificativaTipos"));
  },

  async upsertJustificativaTipos(rows: Array<Record<string, unknown>>): Promise<void> {
    if (!rows.length) return;
    await apiFetch("pontoJustificativaTipos", { method: "POST", body: { rows } });
  },

  async listDispositivos() {
    return await lerLista<{
      id_device: number;
      nome: string | null;
      serial: string | null;
      versao: string | null;
      status: string | null;
      status_papel: string | null;
      id_empresa: string | null;
      num_pessoas: number | null;
      num_digitais: number | null;
      ultima_conexao: string | null;
      ultima_sincronizacao: string | null;
      sincronizado_em: string;
    }>("pontoDispositivos", () => apiFetch("pontoDispositivos"));
  },

  async upsertDispositivos(rows: Array<Record<string, unknown>>): Promise<void> {
    if (!rows.length) return;
    await apiFetch("pontoDispositivos", { method: "POST", body: { rows } });
  },

  async listAfdArquivos() {
    return await lerLista<{
      id: string;
      id_device: number;
      equipamento_nome: string | null;
      layout: string;
      coletor: boolean;
      periodo_inicio: string | null;
      periodo_fim: string | null;
      nsr_inicial: number | null;
      nsr_final: number | null;
      linhas: number;
      sha256: string;
      storage_path: string | null;
      truncado: boolean;
      gerado_por: string | null;
      gerado_em: string;
    }>("pontoAfdArquivos", () => apiFetch("pontoAfdArquivos"));
  },

  async registrarAfd(meta: Record<string, unknown>): Promise<string> {
    const data = await apiFetch<{ id?: string }>("pontoAfdArquivos", {
      method: "POST",
      body: meta,
    });
    return String(data?.id ?? "");
  },

  /**
   * Fechamentos de competência do **ponto**. O filtro por `escopo` é aplicado
   * aqui de novo: `api.php` sem a coluna devolve as linhas de folha, e tratá-las
   * como trava de ponto barraria importações que deveriam passar.
   */
  async listFechamentosPonto(): Promise<
    Array<{
      competencia: string;
      fechadoEm: string;
      fechadoPor: string;
      motivo?: string;
      reabertoEm?: string;
      reabertoPor?: string;
      motivoReabertura?: string;
    }>
  > {
    const data = await apiFetch<Array<Record<string, unknown>>>("dpFechamentoCompetencia", {
      params: { escopo: "ponto" },
    });
    if (!Array.isArray(data)) return [];
    return data
      .filter((r) => r.escopo === "ponto")
      .map((r) => ({
        competencia: String(r.competencia ?? ""),
        fechadoEm: String(r.fechado_em ?? ""),
        fechadoPor: String(r.fechado_por ?? ""),
        motivo: (r.motivo as string) ?? undefined,
        reabertoEm: (r.reaberto_em as string) ?? undefined,
        reabertoPor: (r.reaberto_por as string) ?? undefined,
        motivoReabertura: (r.motivo_reabertura as string) ?? undefined,
      }));
  },

  async listSyncErros(inicio: string, fim: string) {
    return await lerLista<{
      id: string;
      importacao_id: string | null;
      periodo_inicio: string;
      periodo_fim: string;
      id_person: number;
      nome_rhid: string | null;
      mensagem: string | null;
      ocorrido_em: string;
    }>("pontoSyncErros", () => apiFetch("pontoSyncErros", { params: { inicio, fim } }));
  },

  async registrarSyncErros(rows: PontoSyncErroInsert[]): Promise<void> {
    if (!rows.length) return;
    await apiFetch("pontoSyncErros", { method: "POST", body: { rows } });
  },

  async listHomemHoraMensal(competencia: string): Promise<HomemHoraRow[]> {
    const data = await apiFetch<HomemHoraRow[]>("dpHomemHora", { params: { competencia } });
    return Array.isArray(data) ? data : [];
  },

  async listCustoColabCompetencia(competencia: string) {
    const { data, error } = await supabase
      .from("custo_colaborador_competencia")
      .select(
        "colaborador_id, cpf, centro_custo_id, salario_base, proventos, horas_extras, fgts, inss_empresa, rat, inss_terceiros, provisao_13, provisao_ferias, inss_provisao_13, fgts_provisao_13, inss_provisao_ferias, fgts_provisao_ferias",
      )
      .eq("competencia", competencia);
    if (error) throw error;
    return data ?? [];
  },
};
