// Lista de usuários filtrada por SETOR, resolvida no servidor.
//
// O filtro precisa ser do lado do `api.php`: a rota `usuarios` devolve uma
// projeção reduzida (id/login/email/isGM) para quem não é GM, sem
// `papeisPermissao` — então o cliente não tem como saber quem está em qual
// setor. Ver docs/security/access-control.md §9.2.
import { useQuery } from "@tanstack/react-query";
import { playerFromApi } from "@/contexts/app/mappers";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { Player } from "@/types";

// Mesma raiz de `usePlayers` (a rota é a mesma, `usuarios`), com o setor no
// sufixo — assim invalidar `players` alcança também as listas por setor.
export const usuariosPorSetorKeys = {
  setor: (setor: string) => queryKey("players", "setor", setor),
};

async function fetchUsuariosPorSetor(setor: string): Promise<Player[]> {
  const data = await apiFetch<any[]>("usuarios", { params: { setor } });
  return Array.isArray(data) ? data.map(playerFromApi) : [];
}

/**
 * Usuários que têm `setor` concedido em Permissões (`papeis_permissao.setores`).
 * Usado pelo campo "Responsável por negociação" do cadastro de cliente, que só
 * lista o setor `engenharia`.
 */
export function useUsuariosPorSetor(setor: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: usuariosPorSetorKeys.setor(setor),
    queryFn: () => fetchUsuariosPorSetor(setor),
    enabled: !!setor && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}
