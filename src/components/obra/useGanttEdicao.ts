// Hook de persistência otimista para o Gantt interativo.
// Aplica mudança no estado local imediatamente; persiste via supabase com
// optimistic lock em `versao_otimista`. Em conflito, reverte e notifica.
// Suporta cascata de sucessoras, edição/remoção de dependência e desfazer.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cronogramaRepo, cronogramaDependenciasRepo } from "@/lib/repositories/cronograma";
import {
  validarNovaDependencia,
  calcularCascata,
  type GanttEdicaoDep,
} from "@/lib/cronograma/gantt-edicao";
import { differenceInCalendarDays, parseISO } from "date-fns";

export type GanttItem = {
  id: string;
  data_inicio: string;
  data_fim: string;
  versao_otimista?: number | null;
  uid_mpp?: string | null;
  obra_id?: string;
  [k: string]: any;
};

export type GanttDep = GanttEdicaoDep & {
  id?: string;
  obra_id?: string;
  lag_dias?: number | null;
  predecessor_uid_mpp?: string | null;
};

interface Options {
  obraId: string;
  itens: GanttItem[];
  deps: GanttDep[];
  onChanged?: () => void;
  /** Quando false, todas as ações viram no-op. */
  editavel: boolean;
  /** Se true, mover/redimensionar arrasta sucessoras transitivas pelo mesmo delta. */
  cascata?: boolean;
}

type UndoSnap =
  | {
      tipo: "item-move";
      patches: { id: string; data_inicio: string; data_fim: string }[];
    }
  | { tipo: "dep-create"; predecessorId: string; itemId: string }
  | {
      tipo: "dep-update";
      predecessorId: string;
      itemId: string;
      anterior: { tipo: string; lag_dias: number | null };
    }
  | {
      tipo: "dep-delete";
      dep: GanttDep;
    };

export function useGanttEdicao({
  obraId,
  itens,
  deps,
  onChanged,
  editavel,
  cascata = false,
}: Options) {
  const [overridesItens, setOverridesItens] = useState<Record<string, Partial<GanttItem>>>({});
  const [overridesDeps, setOverridesDeps] = useState<GanttDep[]>([]);
  const [depsRemovidos, setDepsRemovidos] = useState<Set<string>>(new Set());
  const undoStack = useRef<UndoSnap[]>([]);

  // Limpa overrides quando os dados base mudam (reload).
  useEffect(() => {
    setOverridesItens({});
    setOverridesDeps([]);
    setDepsRemovidos(new Set());
  }, [itens, deps]);

  const mergedItens = itens.map((i) => ({ ...i, ...(overridesItens[i.id] ?? {}) }));
  const depKey = (d: GanttDep) => `${d.predecessor_item_id}::${d.item_id}`;
  const mergedDeps = [...deps.filter((d) => !depsRemovidos.has(depKey(d))), ...overridesDeps];

  /** Aplica patches em múltiplos itens via UPDATE individual (otimista). */
  const aplicarPatches = useCallback(
    async (patches: { id: string; data_inicio: string; data_fim: string }[]) => {
      if (patches.length === 0) return true;
      // Snapshot anterior para undo + rollback.
      const anteriores: { id: string; data_inicio: string; data_fim: string }[] = [];
      for (const p of patches) {
        const orig = itens.find((i) => i.id === p.id);
        if (orig)
          anteriores.push({ id: p.id, data_inicio: orig.data_inicio, data_fim: orig.data_fim });
      }
      // Override otimista.
      setOverridesItens((prev) => {
        const next = { ...prev };
        for (const p of patches) next[p.id] = { data_inicio: p.data_inicio, data_fim: p.data_fim };
        return next;
      });

      let falhou = false;
      for (const p of patches) {
        const original = itens.find((i) => i.id === p.id);
        if (!original) continue;
        const prevVersao =
          original.versao_otimista != null ? Number(original.versao_otimista) : null;
        const res = await cronogramaRepo.updateDatasOtimista(p.id, prevVersao, {
          data_inicio: p.data_inicio,
          data_fim: p.data_fim,
        });
        if (!res.ok) {
          falhou = true;
          toast.error(
            res.error ??
              `Conflito ao salvar ${original.descricao ?? p.id}. Recarregue e tente novamente.`,
          );
          break;
        }
      }

      if (falhou) {
        // Rollback dos overrides.
        setOverridesItens((prev) => {
          const next = { ...prev };
          for (const p of patches) delete next[p.id];
          return next;
        });
        onChanged?.();
        return false;
      }
      undoStack.current.push({ tipo: "item-move", patches: anteriores });
      onChanged?.();
      return true;
    },
    [itens, onChanged],
  );

  const commitItem = useCallback(
    async (id: string, novo: { data_inicio: string; data_fim: string }) => {
      if (!editavel) return;
      const original = itens.find((i) => i.id === id);
      if (!original) return;
      if (original.data_inicio === novo.data_inicio && original.data_fim === novo.data_fim) {
        return;
      }
      const patches: { id: string; data_inicio: string; data_fim: string }[] = [{ id, ...novo }];
      if (cascata) {
        const delta = differenceInCalendarDays(
          parseISO(novo.data_inicio),
          parseISO(original.data_inicio),
        );
        const extras = calcularCascata(itens as any, deps as any, id, delta);
        patches.push(...extras);
      }
      const ok = await aplicarPatches(patches);
      if (ok) {
        toast.success(
          patches.length > 1
            ? `Atividade + ${patches.length - 1} sucessora(s) atualizadas`
            : "Atividade atualizada",
        );
      }
    },
    [editavel, itens, deps, cascata, aplicarPatches],
  );

  const criarDependencia = useCallback(
    async (predecessorId: string, itemId: string) => {
      if (!editavel) return;
      const val = validarNovaDependencia(mergedDeps, predecessorId, itemId);
      if (!val.ok) {
        const motivo = (val as { motivo?: string }).motivo;
        const msg =
          motivo === "self"
            ? "Uma atividade não pode depender de si mesma"
            : motivo === "duplicata"
              ? "Essa dependência já existe"
              : "A ligação criaria um ciclo no cronograma";
        toast.error(msg);
        return;
      }
      const predecessor = itens.find((i) => i.id === predecessorId);
      const optimistic: GanttDep = {
        item_id: itemId,
        predecessor_item_id: predecessorId,
        tipo: "FS",
        lag_dias: 0,
      };
      setOverridesDeps((prev) => [...prev, optimistic]);

      // TODO(ARC-001/E-01): coluna `predecessor_item_id` ausente em cronograma_dependencias.
      const { error } = await cronogramaDependenciasRepo.insertOne({
        obra_id: obraId,
        item_id: itemId,
        predecessor_item_id: predecessorId,
        predecessor_uid_mpp: predecessor?.uid_mpp ?? "",
        tipo: "FS",
        lag_dias: 0,
      });
      if (error) {
        setOverridesDeps((prev) =>
          prev.filter((d) => !(d.predecessor_item_id === predecessorId && d.item_id === itemId)),
        );
        toast.error(error);
        return;
      }
      undoStack.current.push({ tipo: "dep-create", predecessorId, itemId });
      toast.success("Dependência criada (FS, lag 0)");
      onChanged?.();
    },
    [editavel, itens, mergedDeps, obraId, onChanged],
  );

  const atualizarDependencia = useCallback(
    async (predecessorId: string, itemId: string, patch: { tipo?: string; lag_dias?: number }) => {
      if (!editavel) return;
      const atual = deps.find(
        (d) => d.predecessor_item_id === predecessorId && d.item_id === itemId,
      );
      if (!atual) return;
      const anterior = { tipo: atual.tipo ?? "FS", lag_dias: atual.lag_dias ?? 0 };
      // TODO(ARC-001/E-01): coluna `predecessor_item_id` ausente em cronograma_dependencias.
      const { error } = await cronogramaDependenciasRepo.updateByKey(
        obraId,
        predecessorId,
        itemId,
        {
          ...(patch.tipo !== undefined ? { tipo: patch.tipo } : {}),
          ...(patch.lag_dias !== undefined ? { lag_dias: patch.lag_dias } : {}),
        },
      );
      if (error) {
        toast.error(error);
        return;
      }
      undoStack.current.push({
        tipo: "dep-update",
        predecessorId,
        itemId,
        anterior,
      });
      toast.success("Dependência atualizada");
      onChanged?.();
    },
    [editavel, deps, obraId, onChanged],
  );

  const removerDependencia = useCallback(
    async (predecessorId: string, itemId: string) => {
      if (!editavel) return;
      const atual = deps.find(
        (d) => d.predecessor_item_id === predecessorId && d.item_id === itemId,
      );
      if (!atual) return;
      // Override otimista: marca como removido.
      setDepsRemovidos((prev) => new Set(prev).add(depKey(atual)));

      // TODO(ARC-001/E-01): coluna `predecessor_item_id` ausente em cronograma_dependencias.
      const { error } = await cronogramaDependenciasRepo.deleteByKey(
        obraId,
        predecessorId,
        itemId,
      );
      if (error) {
        setDepsRemovidos((prev) => {
          const n = new Set(prev);
          n.delete(depKey(atual));
          return n;
        });
        toast.error(error);
        return;
      }
      undoStack.current.push({ tipo: "dep-delete", dep: atual });
      toast.success("Dependência removida");
      onChanged?.();
    },
    [editavel, deps, obraId, onChanged],
  );

  const desfazer = useCallback(async () => {
    if (!editavel) return;
    const snap = undoStack.current.pop();
    if (!snap) {
      toast.message("Nada para desfazer");
      return;
    }
    if (snap.tipo === "item-move") {
      // Aplica patches sem empilhar novamente.
      setOverridesItens((prev) => {
        const next = { ...prev };
        for (const p of snap.patches)
          next[p.id] = { data_inicio: p.data_inicio, data_fim: p.data_fim };
        return next;
      });
      for (const p of snap.patches) {
        const original = itens.find((i) => i.id === p.id);
        if (!original) continue;
        await cronogramaRepo.updateDatasOtimista(p.id, null, {
          data_inicio: p.data_inicio,
          data_fim: p.data_fim,
        });
      }
      toast.success("Movimento desfeito");
    } else if (snap.tipo === "dep-create") {
      await cronogramaDependenciasRepo.deleteByKey(obraId, snap.predecessorId, snap.itemId);
      toast.success("Dependência desfeita");
    } else if (snap.tipo === "dep-update") {
      await cronogramaDependenciasRepo.updateByKey(
        obraId,
        snap.predecessorId,
        snap.itemId,
        { tipo: snap.anterior.tipo, lag_dias: snap.anterior.lag_dias ?? 0 },
      );
      toast.success("Edição desfeita");
    } else if (snap.tipo === "dep-delete") {
      const d = snap.dep;
      await cronogramaDependenciasRepo.insertOne({
        obra_id: obraId,
        item_id: d.item_id,
        predecessor_item_id: d.predecessor_item_id,
        predecessor_uid_mpp: d.predecessor_uid_mpp ?? "",
        tipo: d.tipo ?? "FS",
        lag_dias: d.lag_dias ?? 0,
      });
      toast.success("Remoção desfeita");
    }
    onChanged?.();
  }, [editavel, itens, obraId, onChanged]);

  // Ctrl+Z / Cmd+Z para desfazer enquanto em modo edição.
  useEffect(() => {
    if (!editavel) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        // Evita engolir Ctrl+Z de campos de texto.
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        desfazer();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editavel, desfazer]);

  return {
    itens: mergedItens,
    deps: mergedDeps,
    commitItem,
    criarDependencia,
    atualizarDependencia,
    removerDependencia,
    desfazer,
    podeDesfazer: undoStack.current.length > 0,
  };
}
