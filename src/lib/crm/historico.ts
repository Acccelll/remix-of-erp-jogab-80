/** @module-kind io */
// Histórico de interações por oportunidade.
// Registra movimentações no funil, edições no formulário e comentários.
// Persistência canônica no MySQL via api.php (rota oportunidadeHistorico);
// o localStorage atua como cache local imediato para a mesma sessão.
import { apiFetch } from "@/lib/api";
import type { Oportunidade } from "@/types";

const KEY = "erp:crm:oportunidade-eventos";

export type HistoricoTipo = "movimento" | "edicao" | "comentario" | "criacao";

export interface HistoricoEvento {
  id: string;
  oportunidadeId: string;
  tipo: HistoricoTipo;
  autorId?: string | null;
  autorLogin?: string | null;
  ocorridoEm: string; // ISO
  descricao: string;
  detalhes?: Record<string, unknown>;
}

type Store = Record<string, HistoricoEvento[]>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

export function listarEventos(oportunidadeId: string): HistoricoEvento[] {
  const store = read();
  return [...(store[oportunidadeId] ?? [])].sort((a, b) =>
    b.ocorridoEm.localeCompare(a.ocorridoEm),
  );
}

export function registrarEvento(ev: Omit<HistoricoEvento, "id" | "ocorridoEm"> & {
  ocorridoEm?: string;
}): HistoricoEvento {
  const store = read();
  const full: HistoricoEvento = {
    ...ev,
    id: crypto.randomUUID(),
    ocorridoEm: ev.ocorridoEm ?? new Date().toISOString(),
  };
  store[ev.oportunidadeId] = [full, ...(store[ev.oportunidadeId] ?? [])].slice(0, 200);
  write(store);
  window.dispatchEvent(new CustomEvent("crm:historico", { detail: ev.oportunidadeId }));
  // Persistência remota (best-effort) para sobreviver entre sessões/dispositivos.
  void persistRemote(full);
  return full;
}

async function persistRemote(ev: HistoricoEvento) {
  try {
    await apiFetch("oportunidadeHistorico", {
      method: "POST",
      body: {
        id: ev.id,
        oportunidade_id: ev.oportunidadeId,
        tipo: ev.tipo,
        autor_id: ev.autorId ?? null,
        autor_login: ev.autorLogin ?? null,
        descricao: ev.descricao,
        detalhes: ev.detalhes ?? null,
        ocorrido_em: ev.ocorridoEm,
      },
    });
  } catch {
    /* silencioso */
  }
}

/**
 * Registra uma interação na timeline VISÍVEL "Histórico de interações"
 * (tabela `interacoes` no MySQL, exibida em OportunidadePerfil).
 *
 * Diferente de `registrarEvento`, que grava na trilha interna
 * `oportunidadeHistorico` (não exibida). Use esta para eventos que o
 * usuário deve ver no perfil da oportunidade: comentários, movimentações
 * no funil e edições de formulário.
 *
 * O `usuario_id` é preenchido pelo backend a partir do token. Best-effort:
 * nunca lança, para não travar a ação principal (salvar, mover, comentar).
 */
export async function registrarInteracao(params: {
  oportunidadeId: string;
  tipo: "comentario" | "edicao" | "mudanca_estagio" | "criacao" | "nota";
  descricao: string;
}): Promise<void> {
  try {
    await apiFetch("interacoes", {
      method: "POST",
      body: {
        oportunidadeId: params.oportunidadeId,
        tipo: params.tipo,
        descricao: params.descricao,
      },
    });
    window.dispatchEvent(
      new CustomEvent("crm:interacao", { detail: params.oportunidadeId }),
    );
  } catch {
    /* best-effort — não interrompe a ação principal */
  }
}

/** Lê a trilha completa da oportunidade a partir do MySQL (fonte canônica). */
export async function listarEventosRemoto(oportunidadeId: string): Promise<HistoricoEvento[]> {
  const rows = await apiFetch<any[]>("oportunidadeHistorico", {
    params: { oportunidade_id: oportunidadeId },
  });
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: String(r.id),
    oportunidadeId: String(r.oportunidade_id),
    tipo: r.tipo as HistoricoTipo,
    autorId: r.autor_id ?? null,
    autorLogin: r.autor_login ?? null,
    ocorridoEm: r.ocorrido_em,
    descricao: r.descricao ?? "",
    detalhes: r.detalhes ?? undefined,
  }));
}

/** Compara dois estados de oportunidade e devolve descrição amigável dos campos alterados. */
export function diffOportunidade(
  antes: Partial<Oportunidade> | null,
  depois: Partial<Oportunidade>,
): Array<{ campo: string; antes: unknown; depois: unknown; label: string }> {
  if (!antes) return [];
  // Chaves iguais às do payload/Oportunidade (camelCase). Corrigidas para
  // casar com os nomes reais dos campos — evita diffs falsos/omitidos.
  const map: Record<string, string> = {
    nome: "Título",
    clienteId: "Cliente",
    valorEstimado: "Valor estimado",
    dataPrevistaFechamento: "Data prevista",
    temperatura_temperatura: "Temperatura",
    status: "Status",
    estagio: "Estágio",
    responsavelId: "Responsável",
    observacao: "Observação",
    servicos: "Serviços",
    email: "E-mail",
    telefone: "Telefone",
    localObra: "Local da obra",
    potencialInicioObra: "Potencial início de obra",
    potencialTerminoObra: "Potencial término de obra",
  };
  const out: Array<{ campo: string; antes: unknown; depois: unknown; label: string }> = [];
  for (const campo of Object.keys(map)) {
    const a = (antes as any)[campo];
    const b = (depois as any)[campo];
    const eq = JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (!eq) out.push({ campo, antes: a, depois: b, label: map[campo] });
  }
  return out;
}
