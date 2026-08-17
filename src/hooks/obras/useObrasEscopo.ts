// EST-002 (Onda 0) — Hook canônico para consumo de obras com escopo de empresa.
//
// A auditoria (Etapa 7) constatou que `EmpresaContext` publica `obraIdsDaEmpresa`
// e `filtrarObras`, mas nenhum consumidor além do próprio `EmpresaSelector` os
// utiliza. Este hook é o "fio" que faltava: encapsula
//   useObrasContext().obras  +  useEmpresa().filtrarObras
// em uma única leitura consumível por qualquer página/tela ancorada em obra.
//
// Regras:
//  - Empresa selecionada específica → devolve apenas obras dessa empresa.
//  - Modo "Todas" (GM, `empresaAtualId === null`) → devolve tudo (sem recorte).
//  - Usuários que ainda leem `useObrasContext().obras` diretamente continuam funcionando,
//    porém sem o recorte — a migração dos callsites é incremental e rastreada
//    no changeset EST-002.

import { useMemo } from "react";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import type { Obra } from "@/types";

export interface UseObrasEscopoResult {
  /** Obras já recortadas pela empresa atualmente selecionada. */
  obras: Obra[];
  /** Set com os ids das obras visíveis; `null` = sem recorte (modo "Todas"). */
  obraIdsVisiveis: Set<string> | null;
  /** `true` quando o escopo é "todas as empresas" (GM sem seleção). */
  isTodas: boolean;
  /** `true` enquanto o mapa obra→empresa está carregando. */
  carregando: boolean;
  /** Aplica o recorte a qualquer coleção que tenha `id` ou `obra_id`. */
  filtrarPorObra: <T extends { id?: string; obra_id?: string | null }>(items: T[]) => T[];
}

export function useObrasEscopo(): UseObrasEscopoResult {
  const { obras } = useObrasContext();
  const { filtrarObras, obraIdsDaEmpresa, carregando } = useEmpresa();

  const obrasFiltradas = useMemo(() => filtrarObras(obras), [obras, filtrarObras]);

  const filtrarPorObra = useMemo(
    () =>
      <T extends { id?: string; obra_id?: string | null }>(items: T[]): T[] => {
        if (obraIdsDaEmpresa === null) return items;
        return items.filter((it) => {
          const key = (it.obra_id ?? it.id) as string | undefined;
          return !!key && obraIdsDaEmpresa.has(key);
        });
      },
    [obraIdsDaEmpresa],
  );

  return {
    obras: obrasFiltradas,
    obraIdsVisiveis: obraIdsDaEmpresa,
    isTodas: obraIdsDaEmpresa === null,
    carregando,
    filtrarPorObra,
  };
}
