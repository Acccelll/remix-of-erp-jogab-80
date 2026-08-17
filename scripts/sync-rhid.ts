/**
 * Sincronização automática do ponto com a RHiD — roda fora do navegador.
 *
 * Por que um script Node e não a própria edge function: o mapeamento ACJEF e as
 * regras de vínculo vivem em módulos puros de `src/` que o Deno não resolve por
 * causa do alias `@/`. Reimplementá-los na function faria o cron e a tela
 * divergirem em silêncio — aqui os dois usam exatamente o mesmo código.
 *
 * O que faz: coleta pessoas + apuração via edge function `rhid-apuracao`,
 * converte com `mapApuracaoToRows`, resolve colaborador/obra com
 * `src/lib/ponto/vinculo.ts` e grava no `api.php` — o mesmo caminho que o
 * navegador usa.
 *
 * Roda com `bun`, que executa TypeScript direto e resolve o alias `@/` pelo
 * `tsconfig.json` — sem passo de build nem dependência extra.
 *
 * Uso:
 *   bun run sync:rhid -- --dias 7 [--dry-run]
 *   bun scripts/sync-rhid.ts --inicio 2026-08-01 --fim 2026-08-31
 */
import { mapApuracaoToRows, type RhidDia, type RhidPessoa } from "../src/lib/rhid/mapApuracao";
import { chaveLinha, resolverColaboradores, resolverObras } from "../src/lib/ponto/vinculo";
import {
  podeCarregarPeriodo,
  type FechamentoCompetencia,
} from "../src/lib/dp/fechamento-competencia";
import type { ParsedPontoRow } from "../src/lib/ponto/parseRelatorioCsv";

// Aceita tanto os nomes dos secrets do workflow quanto os `VITE_*` do .env do
// repositório, para rodar localmente sem exportar nada à mão. A chave é a
// publishable/anon (pública por design): as credenciais da RHiD ficam nos
// secrets do backend, nunca aqui.
const API_URL = process.env.VITE_API_URL ?? process.env.API_URL;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Pessoas por chamada à edge function — mantém cada invocação curta. */
const LOTE_PESSOAS = 25;
const CHUNK_GRAVACAO = 500;

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const temFlag = (nome: string) => process.argv.includes(`--${nome}`);

function log(mensagem: string): void {
  // eslint-disable-next-line no-console
  console.log(`[sync-rhid] ${mensagem}`);
}

/** Data em YYYY-MM-DD no fuso de Brasília — mesma regra da tela. */
function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function diasAtras(dias: number): string {
  const base = new Date(`${hojeBrasilia()}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - dias);
  return base.toISOString().slice(0, 10);
}

async function invocarFuncao<T>(nome: string, body: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${nome}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify(body),
  });
  const texto = await res.text();
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(`${nome} devolveu resposta não-JSON (HTTP ${res.status})`);
  }
  const erro = (dados as { error?: string })?.error;
  if (!res.ok || erro) throw new Error(`${nome}: ${erro ?? `HTTP ${res.status}`}`);
  return dados as T;
}

/**
 * Cliente mínimo do api.php. Não reusa `src/lib/api.ts` de propósito: aquele
 * lê token do `localStorage` e dispara eventos de janela para reautenticação.
 */
async function api<T>(
  entidade: string,
  opcoes: { method?: string; body?: unknown; params?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(API_URL!);
  url.searchParams.set("entidade", entidade);
  for (const [k, v] of Object.entries(opcoes.params ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method: opcoes.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: opcoes.body === undefined ? undefined : JSON.stringify(opcoes.body),
  });
  const texto = await res.text();
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(`api.php ${entidade} devolveu resposta não-JSON (HTTP ${res.status})`);
  }
  const erro = (dados as { error?: string })?.error;
  if (!res.ok || erro) throw new Error(`api.php ${entidade}: ${erro ?? `HTTP ${res.status}`}`);
  return dados as T;
}

async function main(): Promise<void> {
  for (const [nome, valor] of Object.entries({ API_URL, SUPABASE_URL, SUPABASE_ANON_KEY })) {
    if (!valor) throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  }

  const dias = Number(argumento("dias") ?? 7);
  if (!Number.isInteger(dias) || dias <= 0 || dias > 90) {
    throw new Error("--dias deve ser um inteiro entre 1 e 90 (a API limita a janela a 90 dias)");
  }
  const dryRun = temFlag("dry-run");

  const periodoInicio = argumento("inicio") ?? diasAtras(dias);
  const periodoFim = argumento("fim") ?? hojeBrasilia();
  log(`período ${periodoInicio} → ${periodoFim}${dryRun ? " (dry-run)" : ""}`);

  // Trava de competência antes de qualquer chamada à RHiD: se o mês está
  // fechado, coletar é desperdício e gravar seria mudar a base de uma folha
  // paga. `importarPonto` faz a mesma checagem na tela; o cron não passa por lá.
  try {
    const linhas = await api<Array<Record<string, unknown>>>("dpFechamentoCompetencia", {
      params: { escopo: "ponto" },
    });
    const fechamentos: FechamentoCompetencia[] = (Array.isArray(linhas) ? linhas : [])
      .filter((r) => r.escopo === "ponto")
      .map((r) => ({
        competencia: String(r.competencia ?? ""),
        fechadoEm: String(r.fechado_em ?? ""),
        fechadoPor: String(r.fechado_por ?? ""),
        reabertoEm: (r.reaberto_em as string) ?? undefined,
      }));
    const trava = podeCarregarPeriodo(fechamentos, periodoInicio, periodoFim);
    if (!trava.ok) {
      log(`bloqueado: ${trava.motivo}`);
      return;
    }
  } catch {
    log("trava de competência indisponível — seguindo (a coluna escopo pode não existir ainda)");
  }

  // 1. Cadastro da RHiD
  const { pessoas } = await invocarFuncao<{ pessoas: RhidPessoa[] }>("rhid-apuracao", {
    dataIni: periodoInicio,
    dataFinal: periodoFim,
  });
  if (pessoas.length === 0) throw new Error("A RHiD não devolveu nenhuma pessoa cadastrada.");
  log(`${pessoas.length} pessoas na RHiD`);

  // 2. Apuração em lotes — `/apuracao_ponto` é por pessoa, não há consulta em lote.
  const pessoasPorId = new Map(pessoas.map((p) => [p.idPerson, p]));
  const ids = pessoas.map((p) => p.idPerson);
  const dias_: RhidDia[] = [];
  const erros: Array<{ idPerson: number; error: string }> = [];

  for (let i = 0; i < ids.length; i += LOTE_PESSOAS) {
    const lote = ids.slice(i, i + LOTE_PESSOAS);
    const resposta = await invocarFuncao<{
      dias: RhidDia[];
      erros: Array<{ idPerson: number; error: string }>;
    }>("rhid-apuracao", { dataIni: periodoInicio, dataFinal: periodoFim, idPersons: lote });
    dias_.push(...resposta.dias);
    erros.push(...(resposta.erros ?? []));
    log(`apuração ${Math.min(i + lote.length, ids.length)}/${ids.length}`);
  }

  const rows: ParsedPontoRow[] = mapApuracaoToRows(dias_, pessoasPorId);
  log(`${rows.length} registros convertidos, ${erros.length} falha(s) por colaborador`);
  if (rows.length === 0) {
    log("nada a gravar — encerrando sem tocar no banco");
    return;
  }

  // 3. Vínculo com o cadastro do ERP — mesmas regras puras da tela.
  const [colaboradores, obras] = await Promise.all([
    api<Array<{ id: string; nome: string; cpf?: string; matricula?: string }>>("colaboradores"),
    api<Array<{ id: string; nome: string; codigo?: string | null }>>("obras"),
  ]);

  let overrides = new Map<string, { obraId: string | null; indireto: boolean }>();
  try {
    const dePara =
      await api<Array<{ departamento: string; obra_id: string | null; indireto: boolean }>>(
        "pontoDepartamentoObra",
      );
    if (Array.isArray(dePara)) {
      overrides = new Map(
        dePara.map((d) => [d.departamento, { obraId: d.obra_id, indireto: d.indireto }]),
      );
    }
  } catch {
    log("de-para departamento×obra indisponível — usando a heurística do código");
  }

  const colabMap = resolverColaboradores(rows, colaboradores);
  const { obraMap, indiretoMap } = resolverObras(rows, obras, overrides);
  const vinculados = rows.filter((r) => colabMap.has(chaveLinha(r))).length;
  log(`${vinculados}/${rows.length} registros vinculados a colaborador do ERP`);

  if (dryRun) {
    log("dry-run: nada foi gravado");
    return;
  }

  // 4. Gravação — mesma sequência de `importarPonto`: apaga o período e reinsere.
  await api("pontoImportacoes", {
    method: "DELETE",
    params: { periodo_inicio: periodoInicio, periodo_fim: periodoFim },
  });

  const importacao = await api<{ id: string }>("pontoImportacoes", {
    method: "POST",
    body: {
      arquivo_nome: `rhid_apuracao_${periodoInicio}_a_${periodoFim}.json`,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      total_registros: rows.length,
      total_colaboradores: new Set(rows.map((r) => `${r.matricula || ""}|${r.nome}`)).size,
      importado_por: "RHID_CRON",
    },
  });

  const registros = rows.map((r) => {
    const indireto = r.departamento ? !!indiretoMap.get(r.departamento) : false;
    return {
      importacao_id: importacao.id,
      colaborador_id: colabMap.get(chaveLinha(r)) ?? null,
      nome_csv: r.nome,
      matricula_csv: r.matricula ?? null,
      cpf_csv: r.cpf ?? null,
      departamento_csv: r.departamento ?? null,
      obra_id: r.departamento ? (obraMap.get(r.departamento) ?? null) : null,
      centro_indireto: indireto,
      agregado: !r.data,
      data: r.data ?? periodoFim,
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
      payload: r.payload ?? null,
      rhid_id_person: r.rhid_id_person ?? null,
    };
  });

  for (let i = 0; i < registros.length; i += CHUNK_GRAVACAO) {
    await api("pontoRegistros", {
      method: "POST",
      body: { rows: registros.slice(i, i + CHUNK_GRAVACAO) },
    });
  }
  log(`${registros.length} registros gravados (importação ${importacao.id})`);

  // 5. Falhas por colaborador viram histórico, não somem no log do runner.
  if (erros.length > 0) {
    try {
      await api("pontoSyncErros", {
        method: "POST",
        body: {
          rows: erros.map((e) => ({
            importacao_id: importacao.id,
            periodo_inicio: periodoInicio,
            periodo_fim: periodoFim,
            id_person: e.idPerson,
            nome_rhid: pessoasPorId.get(e.idPerson)?.name ?? null,
            mensagem: e.error,
          })),
        },
      });
    } catch {
      log("não foi possível registrar as falhas (tabela ponto_sync_erros ausente?)");
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[sync-rhid] falhou: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
