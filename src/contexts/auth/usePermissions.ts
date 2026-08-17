// ARC-002 · Onda 6 — Fachada estável de permissões.
// Segundo domínio extraído do God-context AppContext.
// Uso: `const { hasAccess, isGM, currentPlayer } = usePermissions();`
// Consumidores existentes de `useApp()` seguem funcionando; migração é incremental.
//
// ARC-002.slice-26 · Onda 6 — `hasAccess` deixa de ser repassado pelo AppContext
// e passa a ser calculado localmente aqui via `useHasAccess`, mesmo padrão de
// `DocumentosContext` (slice-25): leitura derivada domiciliada no subcontexto.

import { useCallback, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { useAuthState } from "@/contexts/auth/AuthContext";
import { useHasAccess } from "@/contexts/app/useHasAccess";
import {
  matrizDeAcessosLegados,
  migrarRotasFundidas,
  podeAcao,
  type AcaoPermissao,
  type MatrizPermissoes,
} from "@/lib/authz/paginas";
import type { NivelAcesso, PageKey, Player } from "@/types";

export interface PermissionsState {
  currentPlayer: Player | null;
  isGM: boolean;
  hasAccess: (page: PageKey, level: NivelAcesso) => boolean;
  /**
   * PRO-031 — decisão fina por página (rota do NAV) × ação (V/E/X/I/Ex).
   * GM tem tudo; matriz salva é fonte-verdade; sem matriz, deriva do legado
   * (visualizar ⇒ V+Ex; editar+ ⇒ E+X+I) — nenhuma ação regressa.
   */
  can: (rota: string, acao: AcaoPermissao) => boolean;
}

export function usePermissions(): PermissionsState {
  const app = useApp();
  const { previewPlayer } = useAuthState();
  // "Visualizar como usuário" (GM): quando há preview, TODAS as decisões de
  // permissão (hasAccess/can/isGM + sidebar/guards/command palette) resolvem
  // contra o player previewado. A identidade real permanece em `useAuth()`.
  const efetivo = previewPlayer ?? app.currentPlayer;
  const hasAccess = useHasAccess(efetivo);

  const matrizEfetiva = useMemo<MatrizPermissoes | null>(() => {
    const p = efetivo;
    if (!p || p.isGM) return null; // GM curto-circuita em can()
    // `migrarRotasFundidas` herda as permissões de páginas que viraram aba de
    // outra (ex.: /dp/fopag → /dp/custos) sem exigir migração no banco.
    return migrarRotasFundidas(p.matrizPermissoes ?? matrizDeAcessosLegados(p.acessos ?? {}));
  }, [efetivo]);

  const can = useCallback(
    (rota: string, acao: AcaoPermissao) => {
      if (!efetivo) return false;
      if (efetivo.isGM) return true;
      return podeAcao(matrizEfetiva, rota, acao);
    },
    [efetivo, matrizEfetiva],
  );

  return useMemo(
    () => ({
      currentPlayer: efetivo,
      isGM: !!efetivo?.isGM,
      hasAccess,
      can,
    }),
    [efetivo, hasAccess, can],
  );
}
