// PRO-002 — Tarefas / follow-up de oportunidades CRM.
// Persistência no MySQL via api.php (rota crmTarefas), com reconciliação
// única do legado localStorage (`gestaobra:crm:tarefas`) na primeira
// sessão. Escopo: cada tarefa pertence a uma oportunidade, tem data
// prevista, responsável (login) e status (aberta/concluida). Pendências
// alimentam o dashboard M11 (contagem + lista de vencidas/próximas).
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import { makeStorageKey } from "@/lib/core/storage/keys";

export type CrmTarefaStatus = "aberta" | "concluida";

export interface CrmTarefa {
  id: string;
  oportunidadeId: string;
  titulo: string;
  data: string; // ISO date (YYYY-MM-DD)
  responsavelLogin?: string;
  status: CrmTarefaStatus;
  criadaEm: string; // ISO datetime
  concluidaEm?: string;
}

const LEGACY_KEY = makeStorageKey("crm", "tarefas");
const RECONCILED_FLAG = makeStorageKey("crm", "tarefas:reconciliadoEm");
const QK = queryKey("crm_tarefas");

function rowFromApi(r: any): CrmTarefa {
  return {
    id: String(r.id),
    oportunidadeId: String(r.oportunidade_id),
    titulo: r.titulo ?? "",
    data: String(r.data).slice(0, 10),
    responsavelLogin: r.responsavel_login ?? undefined,
    status: r.status === "concluida" ? "concluida" : "aberta",
    criadaEm: r.criada_em,
    concluidaEm: r.concluida_em ?? undefined,
  };
}

function rowToApi(t: CrmTarefa) {
  return {
    id: t.id,
    oportunidade_id: t.oportunidadeId,
    titulo: t.titulo,
    data: t.data,
    responsavel_login: t.responsavelLogin ?? null,
    status: t.status,
    criada_em: t.criadaEm,
    concluida_em: t.concluidaEm ?? null,
  };
}

function lerLegado(): CrmTarefa[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CrmTarefa[]) : [];
  } catch {
    return [];
  }
}

/** Empurra tarefas legadas do localStorage para o MySQL (uma vez por navegador). */
async function reconciliarLegado(): Promise<void> {
  if (localStorage.getItem(RECONCILED_FLAG)) return;
  const locais = lerLegado();
  if (locais.length > 0) {
    await apiFetch("crmTarefas", { method: "POST", body: { rows: locais.map(rowToApi) } });
    localStorage.setItem(LEGACY_KEY, JSON.stringify([]));
  }
  localStorage.setItem(RECONCILED_FLAG, new Date().toISOString());
}

/**
 * `enabled` existe para quem monta o hook fora do CRM — o NotificationBell vive
 * no Layout e roda para todo usuário. A rota `crmTarefas` exige o módulo `crm`
 * no servidor, então buscar sem o módulo só rende 403 a cada carga de página.
 */
export function useCrmTarefas(oportunidadeId?: string, enabled = true) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK,
    enabled,
    queryFn: async (): Promise<CrmTarefa[]> => {
      // Reconciliação best-effort antes da primeira leitura; falha não bloqueia.
      try {
        await reconciliarLegado();
      } catch {
        /* tenta na próxima sessão */
      }
      const data = await apiFetch<any[]>("crmTarefas");
      return (Array.isArray(data) ? data : []).map(rowFromApi);
    },
    staleTime: 30_000,
  });

  const todas = query.data ?? [];
  const setCache = useCallback(
    (fn: (prev: CrmTarefa[]) => CrmTarefa[]) => {
      qc.setQueryData<CrmTarefa[]>(QK, (prev) => fn(prev ?? []));
    },
    [qc],
  );
  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: QK }), [qc]);

  const salvarMut = useMutation({
    mutationFn: (t: CrmTarefa) => apiFetch("crmTarefas", { method: "POST", body: rowToApi(t) }),
    onSettled: invalidate,
  });
  const atualizarMut = useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown> }) =>
      apiFetch("crmTarefas", { method: "PUT", params: { id: v.id }, body: v.patch }),
    onSettled: invalidate,
  });
  const removerMut = useMutation({
    mutationFn: (id: string) => apiFetch("crmTarefas", { method: "DELETE", params: { id } }),
    onSettled: invalidate,
  });

  const escopo = oportunidadeId ? todas.filter((t) => t.oportunidadeId === oportunidadeId) : todas;

  const adicionar = useCallback(
    (input: Omit<CrmTarefa, "id" | "status" | "criadaEm">) => {
      const nova: CrmTarefa = {
        ...input,
        id: crypto.randomUUID(),
        status: "aberta",
        criadaEm: new Date().toISOString(),
      };
      setCache((prev) => [...prev, nova]);
      salvarMut.mutate(nova);
      return nova;
    },
    [setCache, salvarMut],
  );

  const alternar = useCallback(
    (id: string) => {
      const atual = (qc.getQueryData<CrmTarefa[]>(QK) ?? []).find((t) => t.id === id);
      if (!atual) return;
      const novoStatus: CrmTarefaStatus = atual.status === "aberta" ? "concluida" : "aberta";
      const concluidaEm = novoStatus === "concluida" ? new Date().toISOString() : undefined;
      setCache((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: novoStatus, concluidaEm } : t)),
      );
      atualizarMut.mutate({
        id,
        patch: { status: novoStatus, concluida_em: concluidaEm ?? null },
      });
    },
    [qc, setCache, atualizarMut],
  );

  const remover = useCallback(
    (id: string) => {
      setCache((prev) => prev.filter((t) => t.id !== id));
      removerMut.mutate(id);
    },
    [setCache, removerMut],
  );

  // slice-03 — adiar tarefa aberta em N dias a partir da maior data entre hoje e a data atual.
  const adiar = useCallback(
    (id: string, dias: number) => {
      const hojeISO = new Date().toISOString().slice(0, 10);
      const atual = (qc.getQueryData<CrmTarefa[]>(QK) ?? []).find((t) => t.id === id);
      if (!atual || atual.status !== "aberta") return;
      const novaData = calcularDataAdiada(atual.data, dias, hojeISO);
      setCache((prev) => prev.map((t) => (t.id === id ? { ...t, data: novaData } : t)));
      atualizarMut.mutate({ id, patch: { data: novaData } });
    },
    [qc, setCache, atualizarMut],
  );

  return { tarefas: escopo, todas, adicionar, alternar, remover, adiar };
}

export function classificarTarefa(t: CrmTarefa, hojeISO: string): "vencida" | "hoje" | "futura" {
  if (t.data < hojeISO) return "vencida";
  if (t.data === hojeISO) return "hoje";
  return "futura";
}

export function proximaTarefaAberta(
  tarefas: ReadonlyArray<CrmTarefa>,
  oportunidadeId?: string,
): CrmTarefa | undefined {
  return tarefas
    .filter((t) => t.status === "aberta")
    .filter((t) => !oportunidadeId || t.oportunidadeId === oportunidadeId)
    .sort((a, b) => a.data.localeCompare(b.data) || a.criadaEm.localeCompare(b.criadaEm))[0];
}

/**
 * slice-04 — pura: calcula a nova data (ISO YYYY-MM-DD) ao adiar uma tarefa em
 * `dias`. Vencidas contam a partir de `hojeISO`; futuras/hoje a partir de si.
 */
export function calcularDataAdiada(dataISO: string, dias: number, hojeISO: string): string {
  const base = dataISO < hojeISO ? hojeISO : dataISO;
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
