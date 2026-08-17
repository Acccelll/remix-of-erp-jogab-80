// PRO-018 · slice-03 — Hook de perfis de layout BMS (persistência local).
import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import {
  analisarImportacaoPerfis,
  aplicarImportacaoPerfis,
  atualizarPerfil,
  criarPerfil,
  exportarPerfisJson,
  importarPerfisJson,
  removerPerfil,
  upsertPerfil,
  type BmsLayoutImportDecisao,
  type BmsLayoutImportItem,
  type BmsLayoutPerfil,
  type BmsLayoutPerfilInput,
  type BmsLayoutPerfilPatch,
} from "@/lib/bms/layoutPerfis";

const KEY = STORAGE_KEYS.bmsLayoutPerfis;

function ler(): BmsLayoutPerfil[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BmsLayoutPerfil[]) : [];
  } catch {
    return [];
  }
}

export function useBmsLayoutPerfis() {
  const [perfis, setPerfis] = useState<BmsLayoutPerfil[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPerfis(ler());
    setHydrated(true);
  }, []);

  const persistir = useCallback((list: BmsLayoutPerfil[]) => {
    localStorage.setItem(KEY, JSON.stringify(list));
    setPerfis(list);
  }, []);

  const criar = useCallback(
    (input: BmsLayoutPerfilInput) => {
      const p = criarPerfil(input);
      persistir(upsertPerfil(perfis, p));
      return p;
    },
    [perfis, persistir],
  );

  const remover = useCallback(
    (id: string) => persistir(removerPerfil(perfis, id)),
    [perfis, persistir],
  );

  const atualizar = useCallback(
    (id: string, patch: BmsLayoutPerfilPatch) => {
      persistir(atualizarPerfil(perfis, id, patch));
    },
    [perfis, persistir],
  );

  const exportarJson = useCallback(() => exportarPerfisJson(perfis), [perfis]);

  const importarJson = useCallback(
    (json: string) => {
      const resultado = importarPerfisJson(json, perfis);
      persistir(resultado.perfis);
      return resultado;
    },
    [perfis, persistir],
  );

  const analisarImportacao = useCallback(
    (json: string): BmsLayoutImportItem[] => analisarImportacaoPerfis(json, perfis),
    [perfis],
  );

  const aplicarImportacao = useCallback(
    (decisoes: BmsLayoutImportDecisao[]) => {
      const resultado = aplicarImportacaoPerfis(perfis, decisoes);
      persistir(resultado.perfis);
      return resultado;
    },
    [perfis, persistir],
  );

  return {
    hydrated,
    perfis,
    criar,
    remover,
    atualizar,
    exportarJson,
    importarJson,
    analisarImportacao,
    aplicarImportacao,
  };
}
