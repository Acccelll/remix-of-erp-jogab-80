/** @module-kind io */
/**
 * PRO-012 · slice-01 — Contagens cíclicas de estoque (scaffold local).
 *
 * Módulo isolado que persiste "planos de contagem" em localStorage,
 * seguindo o mesmo padrão dos demais módulos locais (chave em
 * STORAGE_KEYS, CRUD puro, sem dependência de contexto React).
 *
 * Escopo desta slice: apenas os tipos, o repositório local e helpers
 * de status. Fluxo de execução (registrar contagens, gerar
 * divergências vs. saldo do repositório) entra em slices seguintes.
 */
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { swallow } from "@/lib/core/errors";

export type StatusContagemCiclica = "planejada" | "em_andamento" | "concluida" | "cancelada";

/** Item planejado para contagem (o saldo esperado é congelado no início da contagem). */
export interface ItemContagemCiclica {
  insumoId: string;
  saldoEsperado: number | null;
  saldoContado: number | null;
  divergencia: number | null;
  observacao?: string;
}

export type StatusAjusteContagem = "pendente" | "aplicado" | "dispensado";

/**
 * Ajuste proposto derivado da divergência de um item.
 * `quantidade` é sempre positiva; `tipo` indica o sentido do ajuste.
 * `status` marca a etapa (pendente → aplicado/dispensado). A emissão no
 * repositório oficial de estoque depende de RPC dedicada
 * (`fn_estoque_ajuste`), ainda não disponível — por isso, "aplicado"
 * aqui é apenas registro local de auditoria.
 */
export interface AjusteContagem {
  insumoId: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  status: StatusAjusteContagem;
  aplicadoEm?: string;
  aplicadoPor?: string;
  observacao?: string;
}

export interface LinhaImportacaoIgnorada {
  linha: number;
  codigo: string;
  motivo: string;
}

/**
 * Registro histórico de uma importação XLSX aplicada a uma contagem.
 * Persistido em `ContagemCiclica.auditoriasImportacao` para
 * rastreabilidade posterior (slice-10).
 */
export interface AuditoriaImportacaoRegistro {
  id: string;
  arquivo: string;
  aba: string;
  importadoEm: string;
  importadoPor?: string;
  linhas: number;
  linhasValidas: number;
  aplicados: number;
  divergenciasImportadas: number;
  semDivergencia: number;
  semAlteracao: number;
  ignoradas: LinhaImportacaoIgnorada[];
}

export interface ContagemCiclica {
  id: string;
  local: string;
  criterio: "curva_abc_A" | "curva_abc_B" | "curva_abc_C" | "amostra" | "manual";
  responsavel: string;
  dataPlanejada: string; // ISO YYYY-MM-DD
  dataInicio?: string;
  dataConclusao?: string;
  status: StatusContagemCiclica;
  itens: ItemContagemCiclica[];
  ajustes?: AjusteContagem[];
  /** Percentual (0–100) do local, para critério `amostra`. */
  amostraPct?: number;
  /** IDs de insumos selecionados manualmente, para critério `manual`. */
  insumosSelecionados?: string[];
  /** Histórico de importações XLSX aplicadas (slice-10). */
  auditoriasImportacao?: AuditoriaImportacaoRegistro[];
  observacao?: string;
  createdAt: string;
  updatedAt: string;
}


const KEY = STORAGE_KEYS.estoqueContagensCiclicas;

function readAll(): ContagemCiclica[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ContagemCiclica[]) : [];
  } catch (e) {
    swallow("estoque/contagens-ciclicas.readAll", e, "leitura de localStorage");
    return [];
  }
}

function writeAll(list: ContagemCiclica[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    swallow("estoque/contagens-ciclicas.writeAll", e, "escrita em localStorage");
  }
}

export function listarContagensCiclicas(): ContagemCiclica[] {
  return readAll().sort((a, b) => b.dataPlanejada.localeCompare(a.dataPlanejada));
}

export function getContagemCiclica(id: string): ContagemCiclica | undefined {
  return readAll().find((c) => c.id === id);
}

export interface CriarContagemInput {
  local: string;
  criterio: ContagemCiclica["criterio"];
  responsavel: string;
  dataPlanejada: string;
  itens?: ItemContagemCiclica[];
  amostraPct?: number;
  insumosSelecionados?: string[];
  observacao?: string;
}

export function criarContagemCiclica(input: CriarContagemInput): ContagemCiclica {
  const now = new Date().toISOString();
  const contagem: ContagemCiclica = {
    id: `cc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    local: input.local,
    criterio: input.criterio,
    responsavel: input.responsavel,
    dataPlanejada: input.dataPlanejada,
    status: "planejada",
    itens: input.itens ?? [],
    amostraPct: input.amostraPct,
    insumosSelecionados: input.insumosSelecionados,
    observacao: input.observacao,
    createdAt: now,
    updatedAt: now,
  };
  const list = readAll();
  list.push(contagem);
  writeAll(list);
  return contagem;
}

/**
 * PRNG determinístico (mulberry32) para amostragem reproduzível a
 * partir do id da contagem. Não é criptográfico.
 */
export function amostragemDeterministica<T>(items: T[], pct: number, seed: string): T[] {
  if (pct <= 0 || items.length === 0) return [];
  const n = Math.max(1, Math.round((Math.min(pct, 100) / 100) * items.length));
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let s = h >>> 0;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export function atualizarContagemCiclica(
  id: string,
  patch: Partial<Omit<ContagemCiclica, "id" | "createdAt">>,
): ContagemCiclica | undefined {
  const list = readAll();
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  const atual = list[idx];
  const atualizado: ContagemCiclica = {
    ...atual,
    ...patch,
    id: atual.id,
    createdAt: atual.createdAt,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = atualizado;
  writeAll(list);
  return atualizado;
}

export function removerContagemCiclica(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id));
}

/** Recalcula `divergencia` = contado - esperado para cada item. */
export function recalcularDivergencias(itens: ItemContagemCiclica[]): ItemContagemCiclica[] {
  return itens.map((i) => ({
    ...i,
    divergencia:
      i.saldoContado == null || i.saldoEsperado == null
        ? null
        : Number((i.saldoContado - i.saldoEsperado).toFixed(4)),
  }));
}

export const STATUS_LABEL: Record<StatusContagemCiclica, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/**
 * Deriva a lista de ajustes propostos a partir dos itens contados.
 * Itens sem contagem (saldoContado == null) e itens com divergência zero
 * são ignorados. Preserva o status de ajustes já registrados no plano
 * (não sobrescreve "aplicado" / "dispensado").
 */
export function gerarAjustesPropostos(contagem: ContagemCiclica): AjusteContagem[] {
  const anteriores = new Map<string, AjusteContagem>();
  (contagem.ajustes ?? []).forEach((a) => anteriores.set(a.insumoId, a));

  const propostos: AjusteContagem[] = [];
  for (const it of contagem.itens) {
    if (it.saldoContado == null || it.divergencia == null || it.divergencia === 0) continue;
    const prev = anteriores.get(it.insumoId);
    const qtd = Math.abs(it.divergencia);
    const tipo: "entrada" | "saida" = it.divergencia > 0 ? "entrada" : "saida";
    propostos.push({
      insumoId: it.insumoId,
      tipo,
      quantidade: Number(qtd.toFixed(4)),
      status: prev && prev.tipo === tipo && prev.quantidade === Number(qtd.toFixed(4))
        ? prev.status
        : "pendente",
      aplicadoEm: prev?.aplicadoEm,
      aplicadoPor: prev?.aplicadoPor,
      observacao: prev?.observacao,
    });
  }
  return propostos;
}

export function marcarAjuste(
  contagemId: string,
  insumoId: string,
  patch: Partial<Pick<AjusteContagem, "status" | "aplicadoPor" | "observacao">>,
): ContagemCiclica | undefined {
  const list = readAll();
  const idx = list.findIndex((c) => c.id === contagemId);
  if (idx === -1) return undefined;
  const atual = list[idx];
  const ajustes = (atual.ajustes ?? []).map((a) =>
    a.insumoId === insumoId
      ? {
          ...a,
          ...patch,
          aplicadoEm:
            patch.status === "aplicado"
              ? new Date().toISOString()
              : patch.status === "pendente"
                ? undefined
                : a.aplicadoEm,
        }
      : a,
  );
  const atualizado: ContagemCiclica = {
    ...atual,
    ajustes,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = atualizado;
  writeAll(list);
  return atualizado;
}

export const STATUS_AJUSTE_LABEL: Record<StatusAjusteContagem, string> = {
  pendente: "Pendente",
  aplicado: "Aplicado",
  dispensado: "Dispensado",
};

// ─── Métricas / dashboard ────────────────────────────────────────────

export interface MetricasContagens {
  totalPlanos: number;
  concluidas: number;
  emAndamento: number;
  planejadas: number;
  itensContados: number;
  itensSemDivergencia: number;
  acuracia: number; // 0..1 — semDivergencia / contados
  ajustesPendentes: number;
  ajustesAplicados: number;
}

export function calcularMetricas(list: ContagemCiclica[]): MetricasContagens {
  let itensContados = 0;
  let itensSemDivergencia = 0;
  let ajustesPendentes = 0;
  let ajustesAplicados = 0;
  let concluidas = 0;
  let emAndamento = 0;
  let planejadas = 0;
  for (const c of list) {
    if (c.status === "concluida") concluidas++;
    else if (c.status === "em_andamento") emAndamento++;
    else if (c.status === "planejada") planejadas++;
    for (const it of c.itens) {
      if (it.saldoContado != null) {
        itensContados++;
        if (it.divergencia === 0) itensSemDivergencia++;
      }
    }
    for (const a of c.ajustes ?? []) {
      if (a.status === "pendente") ajustesPendentes++;
      else if (a.status === "aplicado") ajustesAplicados++;
    }
  }
  return {
    totalPlanos: list.length,
    concluidas,
    emAndamento,
    planejadas,
    itensContados,
    itensSemDivergencia,
    acuracia: itensContados > 0 ? itensSemDivergencia / itensContados : 0,
    ajustesPendentes,
    ajustesAplicados,
  };
}

export interface MetricasPorLocal {
  local: string;
  planos: number;
  itensContados: number;
  acuracia: number;
  ajustesPendentes: number;
  ultimaConclusao?: string;
}

export function metricasPorLocal(list: ContagemCiclica[]): MetricasPorLocal[] {
  const map = new Map<string, MetricasPorLocal & { _semDiv: number }>();
  for (const c of list) {
    const key = c.local;
    const entry =
      map.get(key) ??
      ({
        local: key,
        planos: 0,
        itensContados: 0,
        acuracia: 0,
        ajustesPendentes: 0,
        ultimaConclusao: undefined,
        _semDiv: 0,
      } as MetricasPorLocal & { _semDiv: number });
    entry.planos++;
    for (const it of c.itens) {
      if (it.saldoContado != null) {
        entry.itensContados++;
        if (it.divergencia === 0) entry._semDiv++;
      }
    }
    for (const a of c.ajustes ?? []) {
      if (a.status === "pendente") entry.ajustesPendentes++;
    }
    if (c.dataConclusao && (!entry.ultimaConclusao || c.dataConclusao > entry.ultimaConclusao)) {
      entry.ultimaConclusao = c.dataConclusao;
    }
    map.set(key, entry);
  }
  return Array.from(map.values())
    .map((e) => ({
      local: e.local,
      planos: e.planos,
      itensContados: e.itensContados,
      acuracia: e.itensContados > 0 ? e._semDiv / e.itensContados : 0,
      ajustesPendentes: e.ajustesPendentes,
      ultimaConclusao: e.ultimaConclusao,
    }))
    .sort((a, b) => a.local.localeCompare(b.local, "pt-BR"));
}

// ─── Métricas de importações XLSX (slice-12) ─────────────────────────

export interface MetricasImportacoes {
  totalImportacoes: number;
  contagensComImportacao: number;
  totalLinhas: number;
  totalLinhasValidas: number;
  totalAplicados: number;
  totalDivergentes: number;
  totalIgnoradas: number;
  taxaAplicacao: number; // aplicados / linhasValidas
  taxaValidas: number; // linhasValidas / linhas
  ignoradasPorMotivo: { motivo: string; total: number }[];
  ultimaImportacaoEm?: string;
}

export function calcularMetricasImportacoes(list: ContagemCiclica[]): MetricasImportacoes {
  let totalImportacoes = 0;
  let contagensComImportacao = 0;
  let totalLinhas = 0;
  let totalLinhasValidas = 0;
  let totalAplicados = 0;
  let totalDivergentes = 0;
  let totalIgnoradas = 0;
  let ultimaImportacaoEm: string | undefined;
  const motivos = new Map<string, number>();
  for (const c of list) {
    const regs = c.auditoriasImportacao ?? [];
    if (regs.length === 0) continue;
    contagensComImportacao++;
    for (const r of regs) {
      totalImportacoes++;
      totalLinhas += r.linhas;
      totalLinhasValidas += r.linhasValidas;
      totalAplicados += r.aplicados;
      totalDivergentes += r.divergenciasImportadas;
      totalIgnoradas += r.ignoradas.length;
      if (!ultimaImportacaoEm || r.importadoEm > ultimaImportacaoEm) {
        ultimaImportacaoEm = r.importadoEm;
      }
      for (const ig of r.ignoradas) {
        motivos.set(ig.motivo, (motivos.get(ig.motivo) ?? 0) + 1);
      }
    }
  }
  return {
    totalImportacoes,
    contagensComImportacao,
    totalLinhas,
    totalLinhasValidas,
    totalAplicados,
    totalDivergentes,
    totalIgnoradas,
    taxaAplicacao: totalLinhasValidas > 0 ? totalAplicados / totalLinhasValidas : 0,
    taxaValidas: totalLinhas > 0 ? totalLinhasValidas / totalLinhas : 0,
    ignoradasPorMotivo: Array.from(motivos.entries())
      .map(([motivo, total]) => ({ motivo, total }))
      .sort((a, b) => b.total - a.total),
    ultimaImportacaoEm,
  };
}

