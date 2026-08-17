// Observa mudanças de status nas solicitações financeiras e cria uma
// notificação (sino) + toast quando o status de uma solicitação existente muda.
// Notifica tanto o criador quanto quem alterou os dados.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSolicitacoesFinanceiras, type SolicitacaoFinanceira } from "./useSolicitacoesFinanceiras";
import { criarNotificacao } from "@/lib/notificacoes";
import { useAuth } from "@/contexts/auth/useAuth";

const STATUS_LABEL: Record<string, string> = {
  aprovado: "aprovada",
  aprovada: "aprovada",
  recusado: "recusada",
  recusada: "recusada",
  pendente: "atualizada",
  em_analise: "em análise",
  paga: "paga",
};

export function useSolicitacaoStatusWatcher() {
  const { currentPlayer } = useAuth();
  const { data } = useSolicitacoesFinanceiras();
  const prevRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!data) return;
    const prev = prevRef.current;
    if (prev.size === 0) {
      // Primeira carga — apenas semeia o snapshot sem notificar.
      data.forEach((s) => prev.set(s.id, s.status));
      return;
    }
    data.forEach((s: SolicitacaoFinanceira) => {
      const before = prev.get(s.id);
      if (before && before !== s.status) {
        const label = STATUS_LABEL[s.status] ?? s.status;
        const msg = `Solicitação de ${s.setor} — ${label}`;
        toast.info(msg);
        void criarNotificacao({
          tipo: "solicitacao_status",
          role_scope: "financeiro",
          target_id: s.id,
          titulo: `Solicitação ${label}`,
          mensagem: `${s.setor} — R$ ${Number(s.valor || 0).toFixed(2)}`,
          autor_login: currentPlayer?.login ?? null,
          autor_id: currentPlayer?.id ?? null,
          dedupeKey: `solic-status:${s.id}:${s.status}:${s.updated_at}`,
        });
      }
      prev.set(s.id, s.status);
    });
  }, [data, currentPlayer]);
}
