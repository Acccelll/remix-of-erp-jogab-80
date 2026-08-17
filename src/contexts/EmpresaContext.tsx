// Contexto de empresa selecionada. Persiste em localStorage.
// Se o usuário só tem 1 empresa, fica fixa nela. Se tem 2+, o selector na
// navbar oferece troca. GMs veem opção "Todas" (empresaId=null).

import { useContext, useEffect, useMemo, useState } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth/useAuth";
import { ensureCloudSession } from "@/lib/auth/ensureCloudSession";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { swallow } from "@/lib/core/errors";
import { isUuid } from "@/lib/core/uuid";

export type Empresa = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  ativa: boolean;
  cor: string | null;
};

interface EmpresaCtx {
  empresas: Empresa[];
  empresaAtualId: string | null; // null = "todas" (só GM)
  setEmpresaAtualId: (id: string | null) => void;
  empresaAtual: Empresa | null;
  carregando: boolean;
  /** Set de obra_ids visíveis para a empresa atual. null = sem restrição (GM "Todas"). */
  obraIdsDaEmpresa: Set<string> | null;
  /** Helper: aplica o filtro da empresa atual sobre uma lista de obras. */
  filtrarObras: <T extends { id: string }>(obras: T[]) => T[];
}

const Ctx = createRequiredContext<EmpresaCtx>({
  hook: "useEmpresa",
  provider: "EmpresaProvider",
  file: "src/contexts/EmpresaContext.tsx",
});

const STORAGE_KEY = STORAGE_KEYS.empresaAtualId;

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const { currentPlayer } = useAuth();
  const isGm = !!currentPlayer?.isGM;

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas-do-usuario", currentPlayer?.id, isGm],
    queryFn: async () => {
      if (!currentPlayer?.id) return [];
      const session = await ensureCloudSession(currentPlayer);
      if (!session.ok) return [];
      // GM vê tudo; demais veem só os vínculos.
      if (isGm) {
        const { data, error } = await supabase
          .from("empresas")
          .select("id, razao_social, nome_fantasia, cnpj, ativa, cor")
          .eq("ativa", true)
          .order("razao_social");
        if (error) throw error;
        return (data ?? []) as Empresa[];
      }
      if (!isUuid(currentPlayer.id)) return [];
      const { data, error } = await supabase
        .from("user_empresas")
        .select("empresa:empresas(id, razao_social, nome_fantasia, cnpj, ativa, cor)")
        .eq("user_id", currentPlayer.id);
      if (error) throw error;
      const list = (data ?? []).map((r: any) => r.empresa as Empresa).filter((e) => e?.ativa);
      return list;
    },
    enabled: !!currentPlayer?.id,
    staleTime: 5 * 60_000,
  });

  const [empresaAtualId, setEmpresaAtualIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Ajusta default quando carregam empresas.
  useEffect(() => {
    if (isLoading) return;
    if (empresas.length === 0) {
      setEmpresaAtualIdState(null);
      return;
    }
    // Se o id salvo não existe mais nas empresas visíveis, fallback.
    if (empresaAtualId && !empresas.some((e) => e.id === empresaAtualId)) {
      // GM com id "null" (todas) é válido — mas string null não bate. Mantém null se GM.
      const next = isGm ? null : empresas[0].id;
      setEmpresaAtualIdState(next);
    } else if (empresaAtualId === null && !isGm && empresas.length > 0) {
      // Usuário comum precisa ter uma empresa selecionada.
      setEmpresaAtualIdState(empresas[0].id);
    }
  }, [empresas, isLoading, empresaAtualId, isGm]);

  const setEmpresaAtualId = (id: string | null) => {
    setEmpresaAtualIdState(id);
    try {
      if (id === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, id);
    } catch (err) {
      swallow("empresa.selecionada.persist", err, "localStorage indisponível");
    }
  };

  const empresaAtual = useMemo(
    () => empresas.find((e) => e.id === empresaAtualId) ?? null,
    [empresas, empresaAtualId],
  );

  // Carrega o mapa obra→empresa direto do Supabase (independente do PHP).
  const { data: obraEmpresaMap } = useQuery({
    queryKey: ["obras-empresa-map", currentPlayer?.id],
    queryFn: async () => {
      const session = await ensureCloudSession(currentPlayer);
      if (!session.ok) return new Map<string, string>();
      const { data, error } = await (supabase as any).from("obras").select("id, empresa_id");
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((r: any) => {
        if (r.empresa_id) m.set(String(r.id), String(r.empresa_id));
      });
      return m;
    },
    enabled: !!currentPlayer?.id,
    staleTime: 5 * 60_000,
  });

  const obraIdsDaEmpresa = useMemo<Set<string> | null>(() => {
    if (empresaAtualId === null) return null; // GM "Todas"
    const set = new Set<string>();
    if (!obraEmpresaMap) return set;
    obraEmpresaMap.forEach((empId, obraId) => {
      if (empId === empresaAtualId) set.add(obraId);
    });
    return set;
  }, [obraEmpresaMap, empresaAtualId]);

  const filtrarObras = useMemo(
    () =>
      <T extends { id: string }>(obras: T[]): T[] => {
        if (obraIdsDaEmpresa === null) return obras;
        return obras.filter((o) => obraIdsDaEmpresa.has(o.id));
      },
    [obraIdsDaEmpresa],
  );

  return (
    <Ctx.Provider
      value={{
        empresas,
        empresaAtualId,
        setEmpresaAtualId,
        empresaAtual,
        carregando: isLoading,
        obraIdsDaEmpresa,
        filtrarObras,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useEmpresa() {
  return useRequiredContext(Ctx);
}

/**
 * Variante tolerante: retorna `null` quando o consumidor está fora de
 * `<EmpresaProvider>`. Útil em providers que ficam acima do EmpresaProvider
 * na árvore e precisam apenas ler `empresaAtualId` quando disponível.
 */
export function useEmpresaOptional() {
  return useContext(Ctx);
}
