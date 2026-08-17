// PRO-030 — Preferências por categoria na central de notificações.
// Cada categoria é uma "fonte" de notificação (aprovação financeira,
// documentos vencendo, contratos a renovar, follow-ups CRM, …).
// Persistimos apenas as OCULTAS em localStorage — default é "tudo visível".
import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { swallow } from "@/lib/core/errors";

export type NotifCategoriaId =
  | "aprovacao_financeira"
  | "comentarios_minhas_solicitacoes"
  | "documentos_vencendo"
  | "contratos_vencendo"
  | "contratos_documentos_vencendo"
  | "followups_crm"
  | "nc_pendentes"
  | "totvs_import_atrasado"
  | "preventiva_frota"
  | "snapshot_velho"
  | "medicao_aguardando_aprovacao";


export interface NotifCategoria {
  id: NotifCategoriaId;
  rotulo: string;
  descricao: string;
}

export const NOTIF_CATEGORIAS: readonly NotifCategoria[] = [
  {
    id: "aprovacao_financeira",
    rotulo: "Aprovação Financeira",
    descricao: "Novas solicitações e respostas entre Compras e Financeiro.",
  },
  {
    id: "comentarios_minhas_solicitacoes",
    rotulo: "Comentários nas minhas solicitações",
    descricao: "Quando alguém comenta em uma solicitação que você criou.",
  },
  {
    id: "documentos_vencendo",
    rotulo: "Documentos vencendo",
    descricao: "Documentos de colaboradores próximos ao vencimento.",
  },
  {
    id: "contratos_vencendo",
    rotulo: "Contratos e reajustes",
    descricao: "Contratos ativos próximos do término ou reajuste anual (janela de 30 dias).",
  },
  {
    id: "contratos_documentos_vencendo",
    rotulo: "Documentos de contratos",
    descricao: "Anexos de contrato (garantia, apólice, ART) próximos do fim de validade.",
  },
  {
    id: "followups_crm",
    rotulo: "Follow-ups CRM",
    descricao: "Tarefas de oportunidade vencidas ou vencendo hoje.",
  },
  {
    id: "nc_pendentes",
    rotulo: "Não conformidades",
    descricao: "NCs abertas ou em tratativa com prazo próximo/vencido.",
  },
  {
    id: "totvs_import_atrasado",
    rotulo: "Importação TOTVS",
    descricao: "Alertas quando a importação está atrasada em relação à cadência esperada.",
  },
  {
    id: "preventiva_frota",
    rotulo: "Preventiva de frota",
    descricao: "Veículos com manutenção preventiva próxima ou vencida (horímetro/odômetro/data).",
  },
  {
    id: "snapshot_velho",
    rotulo: "Snapshot TOTVS antigo",
    descricao: "Snapshot financeiro ativo com mais de 3 dias desde a última importação.",
  },
  {
    id: "medicao_aguardando_aprovacao",
    rotulo: "Medições aguardando aprovação",
    descricao: "Medições enviadas para aprovação e ainda sem decisão do responsável.",
  },
] as const;


const KEY = STORAGE_KEYS.notifCategoriasOcultas;
const EVT = "gestaobra:notif:preferencias:changed";

function load(): Set<NotifCategoriaId> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? (arr as NotifCategoriaId[]) : []);
  } catch (err) {
    swallow("notif.prefs.load", err, "localStorage indisponível");
    return new Set();
  }
}

function save(set: Set<NotifCategoriaId>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new Event(EVT));
  } catch (err) {
    swallow("notif.prefs.save", err, "localStorage indisponível");
  }
}

export function useNotifPreferencias() {
  const [ocultas, setOcultas] = useState<Set<NotifCategoriaId>>(() => load());

  useEffect(() => {
    const refresh = () => setOcultas(load());
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const isVisivel = useCallback((id: NotifCategoriaId) => !ocultas.has(id), [ocultas]);

  const alternar = useCallback((id: NotifCategoriaId) => {
    const next = new Set(load());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save(next);
  }, []);

  const mostrarTodas = useCallback(() => save(new Set()), []);
  const ocultarTodas = useCallback(
    () => save(new Set(NOTIF_CATEGORIAS.map((c) => c.id))),
    [],
  );

  return { ocultas, isVisivel, alternar, mostrarTodas, ocultarTodas };
}
