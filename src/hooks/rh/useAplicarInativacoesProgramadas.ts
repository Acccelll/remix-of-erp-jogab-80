// Aplica inativações programadas que já venceram (dataInativacao <= hoje).
// Roda uma vez ao montar quando há candidatos: marca ativo=false, encerra
// responsabilidades de patrimônio e registra entrada de histórico.
import { useEffect, useRef } from "react";
import type { Colaborador, HistoricoEntry } from "@/types";

interface Params {
  colaboradores: Colaborador[];
  updateColaborador: (id: string, patch: Partial<Colaborador>) => void;
  encerrarResponsabilidadesDoColaborador: (colabId: string, data: string) => Promise<void> | void;
  usuario?: string;
}

export function useAplicarInativacoesProgramadas({
  colaboradores,
  updateColaborador,
  encerrarResponsabilidadesDoColaborador,
  usuario,
}: Params) {
  const jaAplicados = useRef<Set<string>>(new Set());

  useEffect(() => {
    const hoje = new Date().toISOString().split("T")[0];
    const pendentes = colaboradores.filter(
      (c) =>
        c.ativo &&
        (c as any).dataInativacao &&
        String((c as any).dataInativacao) <= hoje &&
        !jaAplicados.current.has(c.id),
    );
    if (pendentes.length === 0) return;

    (async () => {
      for (const c of pendentes) {
        jaAplicados.current.add(c.id);
        const dataEf = String((c as any).dataInativacao);
        const historico: HistoricoEntry[] = [
          ...(c.historico || []),
          {
            id: crypto.randomUUID(),
            tipo: "outro",
            descricao: `Inativação programada aplicada (data efetiva: ${dataEf})`,
            data: new Date().toISOString(),
            usuario: usuario || "Sistema",
          },
        ];
        try {
          await encerrarResponsabilidadesDoColaborador(c.id, dataEf);
        } catch {
          // segue o fluxo mesmo se falhar; usuário verá a lista atualizar
        }
        updateColaborador(c.id, { ativo: false, historico });
      }
    })();
  }, [colaboradores, updateColaborador, encerrarResponsabilidadesDoColaborador, usuario]);
}
