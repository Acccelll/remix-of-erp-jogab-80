/** @module-kind pure */
/**
 * Hook genérico de captura offline-first.
 *
 * Responsabilidades:
 *  - Hidrata o estado inicial a partir do draft no IndexedDB (se existir).
 *  - Toda mutação local persiste no IndexedDB (`putDraft`).
 *  - Quando o caller chama `commit()`, enfileira as mutações na
 *    `sync_queue` (uma por linha) e dispara o orquestrador se online.
 *  - Reage à reconexão chamando o runner.
 *
 * O caller é dono do shape do `data` E da função `toMutations(data)` que
 * traduz o estado do formulário em itens da fila (1+ tabelas). Manter
 * essa tradução do lado do caller mantém o hook desacoplado de qualquer
 * domínio (RDO hoje, FVS amanhã).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getDraft, putDraft, setDraftStatus } from "./drafts";
import { enqueue, type EnqueueInput } from "./sync-queue";
import { runSync } from "./sync-runner";
import { supabaseSender, supabaseUploader } from "./supabase-adapters";
import type { DraftRecord } from "./db";

export interface UseOfflineRecordOptions<T> {
  key: string;
  initial: T;
  toMutations: (data: T) => EnqueueInput[];
}

export interface UseOfflineRecordReturn<T> {
  data: T;
  setData: (updater: T | ((prev: T) => T)) => void;
  status: DraftRecord["status"];
  online: boolean;
  hydrated: boolean;
  commit: () => Promise<void>;
  syncing: boolean;
}

export function useOfflineRecord<T>({
  key,
  initial,
  toMutations,
}: UseOfflineRecordOptions<T>): UseOfflineRecordReturn<T> {
  const [data, setDataState] = useState<T>(initial);
  const [status, setStatus] = useState<DraftRecord["status"]>("rascunho");
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const online = useOnlineStatus();
  const dataRef = useRef(data);
  dataRef.current = data;

  // Hidrata do IndexedDB no mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = await getDraft<T>(key);
      if (cancelled) return;
      if (rec) {
        setDataState(rec.data);
        setStatus(rec.status);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const setData = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setDataState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
        void putDraft(key, next, "rascunho");
        return next;
      });
      setStatus("rascunho");
    },
    [key],
  );

  const commit = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const mutations = toMutations(dataRef.current);
      for (const m of mutations) {
        await enqueue(m);
      }
      await setDraftStatus(key, "sincronizando");
      setStatus("sincronizando");
      if (online) {
        const result = await runSync(supabaseSender, supabaseUploader);
        if (result.done) {
          await setDraftStatus(key, "sincronizado");
          setStatus("sincronizado");
        }
      }
    } finally {
      setSyncing(false);
    }
  }, [key, online, syncing, toMutations]);

  // Reconectou + draft pendente → tenta drenar a fila.
  useEffect(() => {
    if (!online || !hydrated) return;
    if (status !== "sincronizando") return;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const result = await runSync(supabaseSender, supabaseUploader);
        if (!cancelled && result.done) {
          await setDraftStatus(key, "sincronizado");
          setStatus("sincronizado");
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, hydrated, status, key]);

  return { data, setData, status, online, hydrated, commit, syncing };
}
