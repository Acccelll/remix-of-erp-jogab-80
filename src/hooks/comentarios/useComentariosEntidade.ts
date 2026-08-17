// Comentários encadeados por entidade (Colaborador, Patrimônio, Contrato).
// Fábrica que espelha o padrão de useOportunidadeComentarios (CRM): lista para
// o mapa de contagem dos badges, leitura por entidade com polling enquanto o
// painel está aberto, e criação. Persistência em MySQL via api.php.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import type { RegisteredQueryKeyRoot } from "@/lib/query-keys";
import type { ComentarioEntidade } from "@/types";

/** Deriva o `Map<entidadeId, quantidade>` usado nos contadores dos cards. */
export function contarPorEntidade(rows: ComentarioEntidade[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of rows) {
    map.set(c.entidadeId, (map.get(c.entidadeId) || 0) + 1);
  }
  return map;
}

interface Config {
  /** Rota do api.php (ex.: "colaboradorComentarios"). */
  rota: string;
  /** Raiz de query-key registrada em ARC-008. */
  rootKey: RegisteredQueryKeyRoot;
  /** Nome do parâmetro/campo do id da entidade (ex.: "colaboradorId"). */
  idKey: string;
  /** Nome do parâmetro de query na leitura por entidade (ex.: "colaborador_id"). */
  idParam: string;
}

export interface ComentariosEntidadeHooks {
  keys: { all: readonly unknown[]; da: (id: string) => readonly unknown[] };
  /** Todos os comentários da entidade — base do mapa de contagem. */
  useLista: () => ReturnType<typeof useQuery<ComentarioEntidade[]>>;
  /** Mapa `entidadeId -> contagem` para os badges nos cards. */
  useContagem: () => { data: Map<string, number>; isLoading: boolean };
  /** Comentários de uma entidade específica (polling de 3s enquanto aberto). */
  useDaEntidade: (
    id: string | null,
    enabled?: boolean,
  ) => ReturnType<typeof useQuery<ComentarioEntidade[]>>;
  /** Cria um comentário e invalida as queries relacionadas. */
  useCriar: () => ReturnType<
    typeof useMutation<ComentarioEntidade, Error, { entidadeId: string; texto: string; autor: string }>
  >;
}

export function criarComentariosEntidade(cfg: Config): ComentariosEntidadeHooks {
  const keys = {
    all: queryKey(cfg.rootKey),
    da: (id: string) => queryKey(cfg.rootKey, id),
  };

  const useLista = () =>
    useQuery({
      queryKey: keys.all,
      queryFn: async () => {
        const rows = await api.getAll<ComentarioEntidade>(cfg.rota);
        return Array.isArray(rows) ? rows : [];
      },
      staleTime: 30_000,
    });

  const useContagem = () => {
    const q = useLista();
    return { data: contarPorEntidade(q.data || []), isLoading: q.isLoading };
  };

  const useDaEntidade = (id: string | null, enabled = true) =>
    useQuery({
      queryKey: keys.da(id || ""),
      queryFn: async () => {
        const rows = await api.getAll<ComentarioEntidade>(cfg.rota, {
          [cfg.idParam]: id as string,
        });
        return Array.isArray(rows) ? rows : [];
      },
      enabled: !!id && enabled,
      staleTime: 2_000,
      // Chat-like: enquanto o painel está aberto, refaz a cada 3 s.
      refetchInterval: !!id && enabled ? 3_000 : false,
      refetchIntervalInBackground: false,
    });

  const useCriar = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (payload: { entidadeId: string; texto: string; autor: string }) =>
        api.create<ComentarioEntidade>(cfg.rota, {
          [cfg.idKey]: payload.entidadeId,
          texto: payload.texto,
          autor: payload.autor,
        }),
      onSuccess: (_data, vars) => {
        qc.invalidateQueries({ queryKey: keys.all });
        qc.invalidateQueries({ queryKey: keys.da(vars.entidadeId) });
      },
    });
  };

  return { keys, useLista, useContagem, useDaEntidade, useCriar };
}

// Instâncias prontas por entidade.
export const comentariosColaborador = criarComentariosEntidade({
  rota: "colaboradorComentarios",
  rootKey: "colaborador_comentarios",
  idKey: "colaboradorId",
  idParam: "colaborador_id",
});

export const comentariosPatrimonio = criarComentariosEntidade({
  rota: "patrimonioComentarios",
  rootKey: "patrimonio_comentarios",
  idKey: "patrimonioId",
  idParam: "patrimonio_id",
});

export const comentariosContrato = criarComentariosEntidade({
  rota: "contratoComentarios",
  rootKey: "contrato_comentarios",
  idKey: "contratoId",
  idParam: "contrato_id",
});

export type TipoEntidadeComentario = "colaborador" | "patrimonio" | "contrato";

/** Resolve a instância de hooks a partir do tipo textual (usado nos componentes genéricos). */
export function hooksPorTipo(tipo: TipoEntidadeComentario): ComentariosEntidadeHooks {
  if (tipo === "patrimonio") return comentariosPatrimonio;
  if (tipo === "contrato") return comentariosContrato;
  return comentariosColaborador;
}
