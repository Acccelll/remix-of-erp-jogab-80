/**
 * Portal de Campo (system design §5.9) — detecta se o usuário logado é um
 * "acesso restrito": nenhum PageKey/módulo concedido (nem legado nem matriz
 * fina), não é GM, mas tem pelo menos uma linha em `obra_membros`. Esse
 * vínculo já basta pra RLS de RDO/cronograma(leitura)/solicitação de
 * material — não criamos setor/PageKey novo pra isso (ver ✎ no documento).
 *
 * Não decide nada enquanto `currentPlayer` ainda não carregou — evita redirect
 * precoce no primeiro render pós-login.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { authRepo } from "@/lib/repositories/auth";
import { obraMembrosRepo } from "@/lib/repositories/obras";

export function useAcessoRestrito() {
  const { currentPlayer, isGM } = usePermissions();

  const semAcessoAmplo = useMemo(() => {
    if (!currentPlayer) return false;
    if (isGM) return false;
    const acessos = currentPlayer.acessos ?? {};
    const temAcessoLegado = Object.values(acessos).some((v) => v && v !== "nenhum");
    if (temAcessoLegado) return false;
    const matriz = currentPlayer.matrizPermissoes ?? {};
    const temAcessoMatriz = Object.values(matriz).some((acoes) =>
      Object.values(acoes ?? {}).some(Boolean),
    );
    return !temAcessoMatriz;
  }, [currentPlayer, isGM]);

  const membrosQ = useQuery({
    queryKey: ["campo-obra-membros-atual"],
    queryFn: async () => {
      const uid = await authRepo.getUserId();
      if (!uid) return [];
      return obraMembrosRepo.listByUser(uid);
    },
    enabled: semAcessoAmplo,
    staleTime: 5 * 60 * 1000,
  });

  const obraIds = (membrosQ.data ?? []).map((m) => m.obra_id);
  const restrito = semAcessoAmplo && obraIds.length > 0;
  const carregando = !!currentPlayer && semAcessoAmplo && membrosQ.isLoading;

  return { restrito, carregando, obraIds };
}
