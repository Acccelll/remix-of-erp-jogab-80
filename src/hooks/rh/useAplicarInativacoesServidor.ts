// Dispara, uma vez por carregamento do app, a aplicação SERVER-SIDE das
// inativações de colaboradores já vencidas (rota `aplicarInativacoesProgramadas`
// no api.php). É a fonte-verdade da "programação de inativação": não depende de
// alguém abrir a tela de RH. Idempotente — o backend só mexe em quem está
// `ativo=1` com `data_inativacao <= hoje`.
//
// Complementa (não substitui) o gatilho local `useAplicarInativacoesProgramadas`
// da tela de RH; um cron diário batendo o mesmo endpoint cobre os períodos sem
// ninguém usando o app.
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { colaboradoresKeys } from "@/hooks/rh/useColaboradores";
import { logger } from "@/lib/core/logger";

// Módulo-nível: garante uma única chamada por carregamento (reset no refresh).
let jaDisparouNestaSessao = false;

export function useAplicarInativacoesServidor(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || jaDisparouNestaSessao) return;
    jaDisparouNestaSessao = true;
    (async () => {
      try {
        const res = await api.create<{ aplicados?: number }>(
          "aplicarInativacoesProgramadas",
          {},
        );
        if (res && typeof res.aplicados === "number" && res.aplicados > 0) {
          qc.invalidateQueries({ queryKey: colaboradoresKeys.all });
        }
      } catch (err) {
        // Best-effort: nunca derruba o app; o cron/gatilho local cobrem.
        logger.warn("aplicarInativacoesProgramadas (bootstrap) falhou", err as unknown as Error);
      }
    })();
  }, [enabled, qc]);
}
