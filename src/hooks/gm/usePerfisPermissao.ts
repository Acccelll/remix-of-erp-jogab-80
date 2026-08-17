// PRO-028 · slice-02 — Perfis reutilizáveis de permissões no MySQL via
// api.php (rota perfisPermissao), com reconciliação única do legado
// localStorage por navegador. Contrato público preservado do slice-01.
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import { STORAGE_KEYS, makeStorageKey } from "@/lib/core/storage/keys";
import {
  criarPerfil,
  type NovoPerfilInput,
  normalizarAcessos,
  type PerfilPermissao,
  validarPerfil,
} from "@/lib/players/perfisPermissao";

const QK = queryKey("perfis_permissao");
const RECONCILED_FLAG = makeStorageKey("gm", "perfisPermissao:reconciliadoEm");

function fromApi(r: any): PerfilPermissao {
  return {
    id: String(r.id),
    nome: r.nome ?? "",
    descricao: r.descricao ?? undefined,
    acessos: normalizarAcessos(r.acessos) as PerfilPermissao["acessos"],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toApi(p: PerfilPermissao) {
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao ?? null,
    acessos: p.acessos,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function lerLegado(): PerfilPermissao[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.perfisPermissao);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.id === "string" && typeof p.nome === "string")
      .map((p) => ({ ...p, acessos: normalizarAcessos(p.acessos) }));
  } catch {
    return [];
  }
}

/** Empurra perfis legados do localStorage para o MySQL (uma vez por navegador). */
async function reconciliarLegado(): Promise<void> {
  if (localStorage.getItem(RECONCILED_FLAG)) return;
  const locais = lerLegado();
  if (locais.length > 0) {
    await apiFetch("perfisPermissao", {
      method: "POST",
      body: { rows: locais.map(toApi) },
    });
    localStorage.setItem(STORAGE_KEYS.perfisPermissao, JSON.stringify([]));
  }
  localStorage.setItem(RECONCILED_FLAG, new Date().toISOString());
}

export function usePerfisPermissao() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<PerfilPermissao[]> => {
      try {
        await reconciliarLegado();
      } catch {
        /* tenta na próxima sessão */
      }
      const data = await apiFetch<any[]>("perfisPermissao");
      return (Array.isArray(data) ? data : []).map(fromApi);
    },
    staleTime: 60_000,
  });

  const perfis = query.data ?? [];
  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: QK }), [qc]);

  const salvarMut = useMutation({
    mutationFn: (p: PerfilPermissao) =>
      apiFetch("perfisPermissao", { method: "POST", body: toApi(p) }),
    onSettled: invalidate,
  });
  const removerMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch("perfisPermissao", { method: "DELETE", params: { id } }),
    onSettled: invalidate,
  });

  const adicionar = useCallback(
    (input: NovoPerfilInput): PerfilPermissao | { erro: string } => {
      const v = validarPerfil(input, perfis);
      if (!v.ok) return { erro: v.erros.join(" ") };
      const novo = criarPerfil(input);
      qc.setQueryData<PerfilPermissao[]>(QK, (prev) => [...(prev ?? []), novo]);
      salvarMut.mutate(novo);
      return novo;
    },
    [perfis, qc, salvarMut],
  );

  const atualizar = useCallback(
    (id: string, patch: Partial<NovoPerfilInput>): { erro?: string } => {
      const alvo = perfis.find((p) => p.id === id);
      if (!alvo) return { erro: "Perfil não encontrado." };
      const input: NovoPerfilInput = {
        nome: patch.nome ?? alvo.nome,
        descricao: patch.descricao ?? alvo.descricao,
        acessos: normalizarAcessos({ ...alvo.acessos, ...(patch.acessos ?? {}) }),
      };
      const v = validarPerfil(input, perfis, id);
      if (!v.ok) return { erro: v.erros.join(" ") };
      const atualizado: PerfilPermissao = {
        ...alvo,
        nome: input.nome.trim(),
        descricao: input.descricao?.trim() || undefined,
        acessos: input.acessos as PerfilPermissao["acessos"],
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData<PerfilPermissao[]>(QK, (prev) =>
        (prev ?? []).map((p) => (p.id === id ? atualizado : p)),
      );
      salvarMut.mutate(atualizado);
      return {};
    },
    [perfis, qc, salvarMut],
  );

  const remover = useCallback(
    (id: string) => {
      qc.setQueryData<PerfilPermissao[]>(QK, (prev) => (prev ?? []).filter((p) => p.id !== id));
      removerMut.mutate(id);
    },
    [qc, removerMut],
  );

  return { perfis, adicionar, atualizar, remover };
}
