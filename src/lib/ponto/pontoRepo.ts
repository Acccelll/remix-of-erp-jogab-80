/** @module-kind orchestration */
// BIZ-002.c — orquestra resolução (parse puro + regras) e persistência de ponto.
// ARC-003 — acesso a dados delegado a `pontoRepo` (src/lib/repositories/ponto.ts).
import type { ParsedPontoRow } from "./parseRelatorioCsv";
import { resolverColaboradores, resolverObras } from "./vinculo";
import { swallow } from "@/lib/core/errors";
import { podeCarregarPeriodo, type FechamentoCompetencia } from "@/lib/dp/fechamento-competencia";
import { pontoRepo } from "@/lib/repositories/ponto";

export interface Colaborador {
  id: string;
  nome: string;
  cpf?: string;
  matricula?: string;
}
export interface Obra {
  id: string;
  nome: string;
  codigo?: string | null;
}

function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value) return false;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(Date.UTC(y, month - 1, day));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

// Persistência no MySQL aceita qualquer id do cadastro como texto (INT ou
// UUID legado) — basta não ser vazio. O antigo filtro isUuid existia por
// conta da coluna uuid do Supabase e anularia todos os ids numéricos.
function isColabId(value: string | null | undefined): value is string {
  return !!value && String(value).trim() !== "";
}

export async function resolveColaboradores(
  rows: ParsedPontoRow[],
  colaboradoresCtx?: Array<{ id: string; nome: string; cpf?: string; matricula?: string }>,
): Promise<Map<string, string>> {
  // 1) Tenta primeiro pela lista do AppContext (fonte real do cadastro)
  let lista: Array<{ id: string; nome: string; cpf?: string; matricula?: string }> =
    colaboradoresCtx ?? [];
  if (!lista.length) {
    lista = (await pontoRepo.listColaboradores()) as any;
  }
  // A regra em si é pura e testada — aqui só entra o acesso a dados, para que a
  // sincronização automática (scripts/sync-rhid.ts) case do mesmo jeito.
  return resolverColaboradores(rows, lista);
}

/**
 * Resolve obra a partir do departamento do ponto.
 * Faz match pelo último número de 3-4 dígitos do `codigo` da obra (ex.: `01.002.0210` → `210`)
 * contra o número do depto (ex.: `210 - COPI` → `210`). Centros indiretos (ADM/Barracão)
 * ficam sem obra. Retorna mapas separados: depto → obraId e depto → indireto?
 */
export async function resolveObras(rows: ParsedPontoRow[]): Promise<{
  obraMap: Map<string, string>;
  indiretoMap: Map<string, boolean>;
}> {
  const obras = await pontoRepo.listObras();

  // De-para editado na Conciliação de Cadastro tem precedência sobre a
  // heurística do código. Ausente (tabela ainda não migrada), segue a regra
  // antiga — a importação não pode depender disso.
  let overrides = new Map<string, { obraId: string | null; indireto: boolean }>();
  try {
    const linhas = await pontoRepo.listDepartamentoObra();
    overrides = new Map(
      linhas.map((d) => [d.departamento, { obraId: d.obra_id, indireto: d.indireto }]),
    );
  } catch (err) {
    swallow("ponto.resolveObras", err, "de-para departamento×obra indisponível");
  }

  return resolverObras(rows, obras as Obra[], overrides);
}

/**
 * Barra a importação quando alguma competência do período está fechada para
 * ponto. Falha de leitura da trava não bloqueia a carga: a coluna `escopo` pode
 * ainda não existir no host, e travar toda importação por isso seria pior do
 * que o risco que a trava evita.
 */
async function garantirCompetenciaAberta(periodoInicio: string, periodoFim: string): Promise<void> {
  let fechamentos: FechamentoCompetencia[];
  try {
    fechamentos = await pontoRepo.listFechamentosPonto();
  } catch (err) {
    swallow("ponto.trava", err, "fechamento de competência indisponível");
    return;
  }
  const trava = podeCarregarPeriodo(fechamentos, periodoInicio, periodoFim);
  if (!trava.ok) throw new Error(trava.motivo ?? "Competência fechada para ponto.");
}

export interface ImportarPontoInput {
  arquivoNome: string;
  rows: ParsedPontoRow[];
  periodoInicio: string;
  periodoFim: string;
  importadoPor?: string | null;
  colabMap: Map<string, string>;
  obraMap: Map<string, string>;
  indiretoMap?: Map<string, boolean>;
}

export async function importarPonto(input: ImportarPontoInput) {
  if (!isValidIsoDate(input.periodoInicio) || !isValidIsoDate(input.periodoFim)) {
    throw new Error(
      `Período inválido para importação: ${input.periodoInicio} até ${input.periodoFim}`,
    );
  }
  // Trava de competência: a gravação apaga e reinsere o período, então importar
  // sobre um mês fechado mudaria em silêncio a base de uma folha já paga. Este
  // é o funil único (CSV e RHiD passam por aqui), por isso a checagem mora nele.
  await garantirCompetenciaAberta(input.periodoInicio, input.periodoFim);

  // Data central para relatórios agregados (sem coluna data por linha).
  const dataCentral = (() => {
    const ini = new Date(input.periodoInicio + "T00:00:00Z").getTime();
    const fim = new Date(input.periodoFim + "T00:00:00Z").getTime();
    return new Date((ini + fim) / 2).toISOString().slice(0, 10);
  })();

  // remove importações sobrepostas no mesmo período (e seus registros via cascade)
  await pontoRepo.deleteImportacoesPorPeriodo(input.periodoInicio, input.periodoFim);

  const impId = await pontoRepo.insertImportacao({
    arquivo_nome: input.arquivoNome,
    periodo_inicio: input.periodoInicio,
    periodo_fim: input.periodoFim,
    total_registros: input.rows.length,
    total_colaboradores: new Set(input.rows.map((r) => `${r.matricula || ""}|${r.nome}`)).size,
    importado_por: input.importadoPor ?? null,
  });

  const records = input.rows.map((r) => {
    const key = `${r.matricula || ""}|${r.cpf || ""}|${r.nome}`;
    const colaboradorId = input.colabMap.get(key);
    const indireto = r.departamento ? !!input.indiretoMap?.get(r.departamento) : false;
    const obraId = r.departamento ? (input.obraMap.get(r.departamento) ?? null) : null;
    const dataValida = isValidIsoDate(r.data);
    const dataRegistro = dataValida ? String(r.data) : dataCentral;
    return {
      importacao_id: impId,
      colaborador_id: isColabId(colaboradorId) ? colaboradorId : null,
      nome_csv: r.nome,
      matricula_csv: r.matricula ?? null,
      cpf_csv: r.cpf ?? null,
      departamento_csv: r.departamento ?? null,
      obra_id: obraId,
      centro_indireto: indireto,
      agregado: !dataValida,
      data: dataRegistro,
      horas_previstas_min: r.horas_previstas_min,
      horas_trabalhadas_min: r.horas_trabalhadas_min,
      horas_falta_min: r.horas_falta_min,
      dias_falta_qtd: r.dias_falta_qtd ?? 0,
      horas_extra_50_min: r.horas_extra_50_min,
      horas_extra_60_min: r.horas_extra_60_min,
      horas_extra_100_min: r.horas_extra_100_min,
      horas_compensadas_min: r.horas_compensadas_min ?? 0,
      interjornada_min: r.interjornada_min ?? 0,
      banco_saldo_min: r.banco_saldo_min ?? 0,
      marcacao_invalida: r.marcacao_invalida,
      falta: r.falta,
      atestado: r.atestado,
      observacao: r.observacao ?? null,
      // Presentes só quando a origem é a RHiD; o api.php ignora ambos enquanto
      // as colunas de 2026_08_03_ponto_ondas.sql não existirem no host.
      payload: r.payload ?? null,
      rhid_id_person: r.rhid_id_person ?? null,
    };
  });

  const CHUNK = 500;
  for (let i = 0; i < records.length; i += CHUNK) {
    await pontoRepo.insertRegistrosChunk(records.slice(i, i + CHUNK));
  }
  return impId;
}
